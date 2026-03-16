package com.codemeet.backend.service;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    // One websocket session id maps to one user id.
    private final Map<String, String> sessionToUser = new ConcurrentHashMap<>();
    // A user stays online while they still have at least one active session.
    private final Map<String, Integer> sessionsPerUser = new ConcurrentHashMap<>();

    private final Sinks.Many<PresenceChange> presenceSink = Sinks.many().multicast().onBackpressureBuffer();

    public boolean registerSession(String sessionId, String userId) {
        if (sessionId == null || userId == null || userId.isBlank()) {
            return false;
        }
        sessionToUser.put(sessionId, userId);
        int prev = sessionsPerUser.getOrDefault(userId, 0);
        sessionsPerUser.put(userId, prev + 1);
        // Returns true when this session changed the user from offline to online.
        boolean becameOnline = prev == 0;
        if (becameOnline) {
            presenceSink.tryEmitNext(new PresenceChange(userId, false));
        }
        return becameOnline;
    }

    public PresenceChange unregisterSession(String sessionId) {
        if (sessionId == null) {
            return PresenceChange.none();
        }
        String userId = sessionToUser.remove(sessionId);
        if (userId == null) {
            return PresenceChange.none();
        }

        Integer prev = sessionsPerUser.get(userId);
        if (prev == null || prev <= 1) {
            sessionsPerUser.remove(userId);
            // This signals the websocket layer that it should broadcast an offline event.
            PresenceChange change = new PresenceChange(userId, true);
            presenceSink.tryEmitNext(change);
            return change;
        }

        sessionsPerUser.put(userId, prev - 1);
        return PresenceChange.none();
    }

    public Flux<PresenceChange> presenceFlux() {
        return presenceSink.asFlux();
    }

    public boolean isOnline(UUID userId) {
        if (userId == null) {
            return false;
        }
        return sessionsPerUser.getOrDefault(userId.toString(), 0) > 0;
    }

    public Set<String> getOnlineUserIds() {
        return sessionsPerUser.keySet();
    }

    public record PresenceChange(String userId, boolean becameOffline) {
        public static PresenceChange none() {
            return new PresenceChange(null, false);
        }

        public boolean hasUser() {
            return userId != null;
        }
    }
}
