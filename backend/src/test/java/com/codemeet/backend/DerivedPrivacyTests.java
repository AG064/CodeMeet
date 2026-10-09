package com.codemeet.backend;

import com.codemeet.backend.config.WebSocketPresenceEventListener;
import com.codemeet.backend.controller.RecommendationController;
import com.codemeet.backend.dto.PresenceEventDto;
import com.codemeet.backend.model.*;
import com.codemeet.backend.repository.*;
import com.codemeet.backend.service.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.*;
import tools.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DerivedPrivacyTests extends IsolatedBackendTest {
    @Autowired ObjectMapper mapper;

    private User user(String email) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setRole(User.Role.USER);
        return user;
    }

    @Test
    void scoreSerializationHonorsHiddenLocationAndRetainsVisibleZeroAndAdminBypass() throws Exception {
        User viewer = user("viewer@example.test"), target = user("target@example.test");
        var users = mock(UserRepository.class);
        var recommendations = mock(RecommendationService.class);
        when(users.findByEmail(viewer.getEmail())).thenReturn(Optional.of(viewer));
        when(users.findById(target.getId())).thenReturn(Optional.of(target));
        when(recommendations.getRecommendationMatchesForUser(viewer, 10)).thenReturn(List.of(new RecommendationService.RecommendationMatch(target.getId(), 72, 12.123456789)));
        var visibility = new ProfileVisibilityService(mock(ConnectionRepository.class), recommendations);
        var controller = new RecommendationController(recommendations, users, visibility);
        var mvc = MockMvcBuilders.standaloneSetup(controller).build();
        var authentication = new TestingAuthenticationToken(viewer.getEmail(), "unused");
        target.setHideLocation(true);
        mvc.perform(get("/api/recommendations/" + target.getId() + "/score").principal(authentication))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(target.getId().toString()))
                .andExpect(jsonPath("$.matchScore").value(72)).andExpect(jsonPath("$.distanceKm").isEmpty());
        target.setHideLocation(false);
        assertEquals(12.123456789, controller.getRecommendationScore(target.getId(), authentication).getBody().getDistanceKm());
        when(recommendations.getRecommendationMatchesForUser(viewer, 10)).thenReturn(List.of(new RecommendationService.RecommendationMatch(target.getId(), 72, 0.0)));
        assertEquals(0.0, controller.getRecommendationScore(target.getId(), authentication).getBody().getDistanceKm());
        target.setHideLocation(true);
        viewer.setRole(User.Role.ADMIN);
        assertEquals(0.0, controller.getRecommendationScore(target.getId(), authentication).getBody().getDistanceKm());
        mvc.perform(get("/api/recommendations/" + UUID.randomUUID() + "/score").principal(authentication)).andExpect(status().isNotFound());
    }

    @Test
    void hiddenPresenceTransitionsSerializeNoTimestampAndKeepSessionAccounting() throws Exception {
        User source = user("source@example.test"), peer = user("peer@example.test");
        source.setHideLastSeen(true);
        source.setLastSeenAt(Instant.parse("2024-01-01T00:00:00Z"));
        var users = mock(UserRepository.class);
        when(users.findById(source.getId())).thenReturn(Optional.of(source));
        var connections = mock(ConnectionRepository.class);
        Connection connection = new Connection();
        connection.setRequester(source);
        connection.setRecipient(peer);
        connection.setStatus(ConnectionStatus.ACCEPTED);
        when(connections.findByUserAndStatus(source, ConnectionStatus.ACCEPTED)).thenReturn(List.of(connection));
        var messages = mock(SimpMessagingTemplate.class);
        var presence = new PresenceService();
        var listener = new WebSocketPresenceEventListener(presence, users, connections, messages);
        for (String session : List.of("first", "second")) {
            var headers = StompHeaderAccessor.create(StompCommand.CONNECTED);
            headers.setSessionId(session);
            headers.setUser(() -> source.getId().toString());
            listener.handleWebSocketConnectListener(new SessionConnectedEvent(this, MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders())));
        }
        var event = ArgumentCaptor.forClass(PresenceEventDto.class);
        verify(messages, times(1)).convertAndSendToUser(eq(peer.getId().toString()), eq("/queue/presence"), event.capture());
        assertTrue(event.getValue().isOnline());
        assertFalse(event.getValue().isLastSeenVisible());
        assertNull(event.getValue().getLastSeenAt());
        assertTrue(mapper.writeValueAsString(event.getValue()).contains("\"lastSeenVisible\":false"));
        var disconnect = MessageBuilder.withPayload(new byte[0]).build();
        listener.handleWebSocketDisconnectListener(new SessionDisconnectEvent(this, disconnect, "first", CloseStatus.NORMAL));
        assertTrue(presence.isOnline(source.getId()));
        verify(messages, times(1)).convertAndSendToUser(anyString(), anyString(), any());
        listener.handleWebSocketDisconnectListener(new SessionDisconnectEvent(this, disconnect, "second", CloseStatus.NORMAL));
        assertFalse(presence.isOnline(source.getId()));
        verify(messages, times(2)).convertAndSendToUser(eq(peer.getId().toString()), eq("/queue/presence"), event.capture());
        assertFalse(event.getValue().isOnline());
        assertNull(event.getValue().getLastSeenAt());
        assertFalse(event.getValue().isLastSeenVisible());
        assertTrue(source.getLastSeenAt().isAfter(Instant.parse("2024-01-01T00:00:00Z")));
        verify(users).save(source);
    }

    @Test
    void visibleTimestampAndAbsentTimestampRetainTheirDistinctVisibilityContract() {
        User source = user("visible@example.test");
        assertTrue(PrivacyFields.lastSeenVisible(source, false));
        assertNull(PrivacyFields.lastSeen(source, false));
        source.setLastSeenAt(Instant.parse("2026-01-01T00:00:00Z"));
        assertEquals(source.getLastSeenAt(), PrivacyFields.lastSeen(source, false));
        source.setHideLastSeen(true);
        assertNull(PrivacyFields.lastSeen(source, false));
        assertEquals(source.getLastSeenAt(), PrivacyFields.lastSeen(source, true));
    }
}
