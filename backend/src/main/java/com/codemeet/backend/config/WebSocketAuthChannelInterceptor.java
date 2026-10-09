package com.codemeet.backend.config;

import com.codemeet.backend.service.JwtService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import java.util.Set;

@Component
public class WebSocketAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private static final Set<String> SEND_DESTINATIONS = Set.of("/app/chat", "/app/chat/typing");
    private static final Set<String> SUBSCRIPTIONS = Set.of("/user/queue/messages", "/user/queue/typing", "/user/queue/presence", "/user/queue/notifications");

    public WebSocketAuthChannelInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        // We only need to authenticate the initial CONNECT frame; later messages reuse that user principal.
        if (StompCommand.CONNECT.equals(accessor.getCommand()) || StompCommand.STOMP.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null) {
                authHeader = accessor.getFirstNativeHeader("authorization");
            }
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                try {
                    if (jwtService.isTokenValid(token)) {
                        String userId = jwtService.extractUserId(token);
                        if (userId != null && !userId.isBlank()) {
                            // The websocket session now carries the same identity the REST API uses.
                            accessor.setUser(new StompPrincipal(userId));
                        }
                    }
                } catch (Exception e) {
                    throw new BadCredentialsException("Invalid WebSocket credentials");
                }
            }
            if (accessor.getUser() == null) {
                throw new BadCredentialsException("WebSocket authentication required");
            }
        } else if (accessor.getCommand() != null) {
            if (accessor.getUser() == null) {
                throw new AccessDeniedException("Authenticated WebSocket session required");
            }
            if (StompCommand.SEND.equals(accessor.getCommand()) && (accessor.getDestination() == null || !SEND_DESTINATIONS.contains(accessor.getDestination()))) {
                throw new AccessDeniedException("Client publication is restricted to chat handlers");
            }
            if (StompCommand.SUBSCRIBE.equals(accessor.getCommand()) && (accessor.getDestination() == null || !SUBSCRIPTIONS.contains(accessor.getDestination()))) {
                throw new AccessDeniedException("Only private subscriptions are permitted");
            }
        }

        return message;
    }
}
