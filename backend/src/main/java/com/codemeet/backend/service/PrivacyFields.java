package com.codemeet.backend.service;

import com.codemeet.backend.model.User;
import java.time.Instant;

public final class PrivacyFields {
    private PrivacyFields() {}

    public static boolean locationVisible(User target, boolean bypass) {
        return target != null && (bypass || !target.isHideLocation());
    }

    public static boolean lastSeenVisible(User target, boolean bypass) {
        return target != null && (bypass || !target.isHideLastSeen());
    }

    public static Instant lastSeen(User target, boolean bypass) {
        return lastSeenVisible(target, bypass) ? target.getLastSeenAt() : null;
    }
}
