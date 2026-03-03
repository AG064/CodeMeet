package com.codemeet.backend.config;

import com.codemeet.backend.dto.PresenceEventDto;
import com.codemeet.backend.model.Connection;
import com.codemeet.backend.model.ConnectionStatus;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.ConnectionRepository;
import com.codemeet.backend.repository.UserRepository;
import com.codemeet.backend.service.PresenceService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class WebSocketPresenceEventListener {

    private final PresenceService presenceService;
    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketPresenceEventListener(
            PresenceService presenceService,
            UserRepository userRepository,
            ConnectionRepository connectionRepository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.presenceService = presenceService;
        this.userRepository = userRepository;
        this.connectionRepository = connectionRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = accessor.getUser();
        String sessionId = accessor.getSessionId();

        if (principal == null || sessionId == null) {
            return;
        }

        boolean becameOnline = presenceService.registerSession(sessionId, principal.getName());
        if (becameOnline) {
            notifyConnections(principal.getName(), true);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        PresenceService.PresenceChange change = presenceService.unregisterSession(event.getSessionId());
        if (change.hasUser() && change.becameOffline()) {
            try {
                UUID userId = UUID.fromString(change.userId());
                userRepository.findById(userId).ifPresent(user -> {
                    user.setLastSeenAt(Instant.now());
                    userRepository.save(user);
                });
            } catch (IllegalArgumentException ignored) {
                // Ignore malformed user id values
            }
            notifyConnections(change.userId(), false);
        }
    }

    private void notifyConnections(String userIdRaw, boolean online) {
        try {
            UUID userId = UUID.fromString(userIdRaw);
            User sourceUser = userRepository.findById(userId).orElse(null);
            if (sourceUser == null) {
                return;
            }

            List<Connection> connections = connectionRepository.findByUserAndStatus(sourceUser, ConnectionStatus.ACCEPTED);
            PresenceEventDto event = new PresenceEventDto(sourceUser.getId(), online, sourceUser.getLastSeenAt());

            for (Connection connection : connections) {
                User peer = connection.getRequester().getId().equals(sourceUser.getId())
                        ? connection.getRecipient()
                        : connection.getRequester();

                messagingTemplate.convertAndSendToUser(peer.getId().toString(), "/queue/presence", event);
            }
        } catch (IllegalArgumentException ignored) {
            // Ignore malformed user id values
        }
    }
}
