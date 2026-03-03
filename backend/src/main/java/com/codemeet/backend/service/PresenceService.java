package com.codemeet.backend.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    private final Map<String, String> sessionToUser = new ConcurrentHashMap<>();
    private final Map<String, Integer> sessionsPerUser = new ConcurrentHashMap<>();

    public boolean registerSession(String sessionId, String userId) {
        if (sessionId == null || userId == null || userId.isBlank()) {
            return false;
        }
        sessionToUser.put(sessionId, userId);
        int prev = sessionsPerUser.getOrDefault(userId, 0);
        sessionsPerUser.put(userId, prev + 1);
        return prev == 0;
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
            return new PresenceChange(userId, true);
        }

        sessionsPerUser.put(userId, prev - 1);
        return PresenceChange.none();
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
