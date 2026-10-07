package com.codemeet.backend.service;

import com.codemeet.backend.model.ConnectionStatus;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.ConnectionRepository;
import org.springframework.stereotype.Service;

@Service
public class ProfileVisibilityService {
    private final ConnectionRepository connections;
    private final RecommendationService recommendations;

    public ProfileVisibilityService(ConnectionRepository connections, RecommendationService recommendations) {
        this.connections = connections;
        this.recommendations = recommendations;
    }

    public boolean canBypassPrivacy(User viewer, User target) {
        return viewer != null && target != null
                && (viewer.getRole() == User.Role.ADMIN || viewer.getId().equals(target.getId()));
    }

    public boolean canViewProfile(User viewer, User target) {
        if (viewer == null || target == null) return false;
        if (canBypassPrivacy(viewer, target)) return true;
        if (recommendations.isBlockedEitherDirection(viewer, target)) return false;
        var connection = connections.findAllConnectionsBetweenUsers(viewer, target);
        if (connection.isPresent()) return connection.get().getStatus() != ConnectionStatus.REJECTED;
        return recommendations.getRecommendationsForUser(viewer, 50).contains(target.getId());
    }
}
