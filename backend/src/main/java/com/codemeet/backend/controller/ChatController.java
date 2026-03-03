package com.codemeet.backend.controller;

import com.codemeet.backend.dto.MessageDto;
import com.codemeet.backend.dto.PresenceStatusDto;
import com.codemeet.backend.dto.TypingEventDto;
import com.codemeet.backend.model.Connection;
import com.codemeet.backend.model.ConnectionStatus;
import com.codemeet.backend.model.Message;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.ConnectionRepository;
import com.codemeet.backend.repository.MessageRepository;
import com.codemeet.backend.repository.UserRepository;
import com.codemeet.backend.service.PresenceService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;
    private final SimpMessagingTemplate messagingTemplate;
        private final PresenceService presenceService;

        public ChatController(MessageRepository messageRepository, UserRepository userRepository, ConnectionRepository connectionRepository, SimpMessagingTemplate messagingTemplate, PresenceService presenceService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.connectionRepository = connectionRepository;
        this.messagingTemplate = messagingTemplate;
                this.presenceService = presenceService;
    }

    // --- WebSocket Endpoints ---

    // Expected destination mapping: /app/chat
    @MessageMapping("/chat")
    public void processMessage(@Payload MessageDto chatMessage, Principal principal) {

                if (principal == null || principal.getName() == null) {
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized websocket session");
                }

                User sender = resolvePrincipalUser(principal.getName());

        User recipient = userRepository.findById(chatMessage.getRecipientId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

        // 2. Validate connection exists
        connectionRepository.findConnectionBetweenUsers(sender, recipient, ConnectionStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

        // 3. Save message
        Message message = new Message();
        message.setSender(sender);
        message.setRecipient(recipient);
        message.setContent(chatMessage.getContent());
        Message savedMessage = messageRepository.save(message);

        // 4. Map to Dto and broadcast
        MessageDto mapped = mapToDto(savedMessage);

        // Send to queue specific to the user. E.g. /user/{recipientId}/queue/messages
        // Use the users unique user identifier to push notifications
        messagingTemplate.convertAndSendToUser(
                recipient.getId().toString(), "/queue/messages", mapped
        );
        
        // Optionally echo back to the sender
        messagingTemplate.convertAndSendToUser(
                 sender.getId().toString(), "/queue/messages", mapped
        );
    }

        @MessageMapping("/chat/typing")
        public void processTyping(@Payload TypingEventDto typingEvent, Principal principal) {
                if (principal == null || principal.getName() == null) {
                        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized websocket session");
                }

                User sender = resolvePrincipalUser(principal.getName());
                User recipient = userRepository.findById(typingEvent.getRecipientId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

                connectionRepository.findConnectionBetweenUsers(sender, recipient, ConnectionStatus.ACCEPTED)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

                TypingEventDto outbound = new TypingEventDto();
                outbound.setSenderId(sender.getId());
                outbound.setRecipientId(recipient.getId());
                outbound.setTyping(typingEvent.isTyping());

                messagingTemplate.convertAndSendToUser(recipient.getId().toString(), "/queue/typing", outbound);
        }


    // --- REST Endpoints for History & Initialization  ---

    @GetMapping("/history/{partnerId}")
    public ResponseEntity<Page<MessageDto>> getChatHistory(
            @PathVariable UUID partnerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {

        User currentUser = getCurrentUser(authentication);
        User partner = userRepository.findById(partnerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Must be connected
        connectionRepository.findConnectionBetweenUsers(currentUser, partner, ConnectionStatus.ACCEPTED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

        Pageable pageable = PageRequest.of(page, size);
        Page<Message> history = messageRepository.findChatHistory(currentUser, partner, pageable);

        Page<MessageDto> response = history.map(this::mapToDto);
        return ResponseEntity.ok(response);
    }
    
    // Quick REST endpoint for standard messaging (if user defaults outside WS)
    @PostMapping("/send/{recipientId}")
    public ResponseEntity<MessageDto> sendRestMessage(
            @PathVariable UUID recipientId, 
            @RequestBody Map<String, String> body, 
            Authentication authentication) {

          User sender = getCurrentUser(authentication);
          User recipient = userRepository.findById(recipientId)
                  .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

          connectionRepository.findConnectionBetweenUsers(sender, recipient, ConnectionStatus.ACCEPTED)
                  .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not connected with this user"));

          Message message = new Message();
          message.setSender(sender);
          message.setRecipient(recipient);
          message.setContent(body.get("content"));
          Message savedMessage = messageRepository.save(message);

          MessageDto dto = mapToDto(savedMessage);

          // Broadcast to connected WS sessions
          messagingTemplate.convertAndSendToUser(
                  recipient.getId().toString(), "/queue/messages", dto
          );

          return ResponseEntity.ok(dto);
    }

    // Get Active Chats overview – includes ALL accepted connections so new
    // conversations appear immediately even before any messages are exchanged.
    @GetMapping("/partners")
    public ResponseEntity<List<Map<String, Object>>> getChatPartners(Authentication authentication) {
        User currentUser = getCurrentUser(authentication);

        // 1. Partners with existing messages (ordered by latest message)
        List<UUID> messagePartnerIds = messageRepository.findActiveChatPartners(currentUser.getId());

        // 2. All accepted connections (may include partners with no messages yet)
        List<Connection> acceptedConnections = connectionRepository.findByUserAndStatus(currentUser, ConnectionStatus.ACCEPTED);

        // Build ordered result: message-partners first (preserve recency), then
        // connected users that have no chat history yet.
        java.util.LinkedHashSet<UUID> orderedIds = new java.util.LinkedHashSet<>(messagePartnerIds);
        for (Connection conn : acceptedConnections) {
            UUID peerId = conn.getRequester().getId().equals(currentUser.getId())
                    ? conn.getRecipient().getId()
                    : conn.getRequester().getId();
            orderedIds.add(peerId); // no-op if already present
        }

        List<Map<String, Object>> response = orderedIds.stream().map(id -> {
            User p = userRepository.findById(id).orElse(null);
            if (p != null) {
                long unreadCount = messageRepository.countUnreadMessages(p, currentUser);
                Map<String, Object> map = new java.util.HashMap<>();
                map.put("id", p.getId().toString());
                String displayName = (p.getName() != null && !p.getName().trim().isBlank())
                        ? p.getName().trim()
                        : ("User-" + p.getId().toString().substring(0, 8));
                map.put("name", displayName);
                map.put("unreadCount", unreadCount);
                return map;
            }
            return null;
        }).filter(java.util.Objects::nonNull).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/read/{senderId}")
    public ResponseEntity<String> markAsRead(@PathVariable UUID senderId, Authentication authentication) {
        User currentUser = getCurrentUser(authentication);
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<Message> unreads = messageRepository.findBySenderAndRecipientAndIsReadFalse(sender, currentUser);
        for(Message m : unreads) {
            m.setRead(true);
        }
        messageRepository.saveAll(unreads);
        return ResponseEntity.ok("Marked as read");
    }

        @GetMapping("/presence")
        public ResponseEntity<Map<String, PresenceStatusDto>> getPresenceForConnections(Authentication authentication) {
                User currentUser = getCurrentUser(authentication);
                List<Connection> acceptedConnections = connectionRepository.findByUserAndStatus(currentUser, ConnectionStatus.ACCEPTED);

                Map<String, PresenceStatusDto> response = new HashMap<>();
                for (Connection connection : acceptedConnections) {
                        User peer = connection.getRequester().getId().equals(currentUser.getId())
                                        ? connection.getRecipient()
                                        : connection.getRequester();
                        response.put(
                                peer.getId().toString(),
                                new PresenceStatusDto(presenceService.isOnline(peer.getId()), peer.getLastSeenAt())
                        );
                }

                return ResponseEntity.ok(response);
        }


    private MessageDto mapToDto(Message message) {
        return MessageDto.builder()
                .id(message.getId())
                .senderId(message.getSender().getId())
                .recipientId(message.getRecipient().getId())
                .content(message.getContent())
                .timestamp(message.getTimestamp())
                .isRead(message.isRead())
                .build();
    }

    private User getCurrentUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

        private User resolvePrincipalUser(String principalName) {
                try {
                        UUID userId = UUID.fromString(principalName);
                        return userRepository.findById(userId)
                                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sender not found"));
                } catch (IllegalArgumentException ignored) {
                        return userRepository.findByEmail(principalName)
                                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sender not found"));
                }
        }
}
