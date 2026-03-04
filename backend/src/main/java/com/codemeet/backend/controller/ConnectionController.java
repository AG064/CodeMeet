package com.codemeet.backend.controller;

import com.codemeet.backend.model.Connection;
import com.codemeet.backend.model.ConnectionStatus;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.ConnectionRepository;
import com.codemeet.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ConnectionController {

    private final ConnectionRepository connectionRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public ConnectionController(ConnectionRepository connectionRepository, UserRepository userRepository, SimpMessagingTemplate messagingTemplate) {
        this.connectionRepository = connectionRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    // Get all active connections for the current user (returns only IDs per spec)
    @GetMapping("/connections")
    public ResponseEntity<List<Map<String, String>>> getConnections(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);

        List<Connection> activeConnections = connectionRepository.findByUserAndStatus(currentUser, ConnectionStatus.ACCEPTED);

        List<Map<String, String>> response = activeConnections.stream()
                .map(conn -> {
                    Map<String, String> map = new HashMap<>();
                    UUID partnerId = conn.getRequester().getId().equals(currentUser.getId()) 
                                        ? conn.getRecipient().getId() 
                                        : conn.getRequester().getId();
                    map.put("id", partnerId.toString());
                    return map;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    // Get pending connection requests for current user
    @GetMapping("/connections/pending")
    public ResponseEntity<List<Map<String, String>>> getPendingConnections(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        List<Connection> pending = connectionRepository.findPendingRequestsForUser(currentUser);
        List<Map<String, String>> response = pending.stream()
                .map(conn -> {
                    Map<String, String> map = new HashMap<>();
                    map.put("id", conn.getRequester().getId().toString());
                    map.put("connectionId", conn.getId().toString());
                    return map;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/connections/request/{recipientId}")
    public ResponseEntity<List<Map<String, String>>> sendConnectionRequest(@PathVariable UUID recipientId, Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

        if (currentUser.getId().equals(recipient.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot connect with yourself");
        }

        Optional<Connection> existingRequest = connectionRepository.findAllConnectionsBetweenUsers(currentUser, recipient);
        
        if (existingRequest.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connection or request already exists");
        }

        Connection request = new Connection();
        request.setRequester(currentUser);
        request.setRecipient(recipient);
        request.setStatus(ConnectionStatus.PENDING);
        
        connectionRepository.save(request);

        Map<String, String> notification = new HashMap<>();
        notification.put("type", "connection_request");
        notification.put("message", "New connection request from " + currentUser.getName());
        messagingTemplate.convertAndSendToUser(recipient.getId().toString(), "/queue/notifications", notification);

        List<Connection> pending = connectionRepository.findPendingRequestsForUser(currentUser);

         List<Map<String, String>> response = pending.stream()
                .map(conn -> {
                    Map<String, String> map = new HashMap<>();
                    map.put("id", conn.getRequester().getId().toString()); // Return the requester's ID
                    map.put("connectionId", conn.getId().toString()); 
                    return map;
                })
                .collect(Collectors.toList());

         return ResponseEntity.ok(response);
    }

    @PostMapping("/connections/{connectionId}/accept")
    public ResponseEntity<String> acceptConnection(@PathVariable UUID connectionId, Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        
        Connection connection = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Connection not found"));

        if (!connection.getRecipient().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to accept this connection");
        }

        connection.setStatus(ConnectionStatus.ACCEPTED);
        connectionRepository.save(connection);

        return ResponseEntity.ok("Connection accepted");
    }

    @PostMapping("/connections/{connectionId}/reject")
    public ResponseEntity<String> rejectConnection(@PathVariable UUID connectionId, Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        
        Connection connection = connectionRepository.findById(connectionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Connection not found"));

        if (!connection.getRecipient().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to reject this connection");
        }

        connection.setStatus(ConnectionStatus.REJECTED);
        connectionRepository.save(connection);

        return ResponseEntity.ok("Connection rejected");
    }

    @DeleteMapping("/connections/disconnect/{userId}")
    public ResponseEntity<String> disconnect(@PathVariable UUID userId, Authentication authentication) {
         User currentUser = getCurrentUser(authentication);
         User partner = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

         Connection connection = connectionRepository.findConnectionBetweenUsers(currentUser, partner, ConnectionStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No active connection found"));

         connectionRepository.delete(connection);

         return ResponseEntity.ok("Disconnected successfully");
    }


    private User getCurrentUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
}

