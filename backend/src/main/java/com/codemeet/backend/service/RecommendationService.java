package com.codemeet.backend.service;

import com.codemeet.backend.model.Bio;
import com.codemeet.backend.model.Connection;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.BioRepository;
import com.codemeet.backend.repository.ConnectionRepository;
import com.codemeet.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private final BioRepository bioRepository;
    private final UserRepository userRepository;
    private final ConnectionRepository connectionRepository;

    public RecommendationService(BioRepository bioRepository, UserRepository userRepository, ConnectionRepository connectionRepository) {
        this.bioRepository = bioRepository;
        this.userRepository = userRepository;
        this.connectionRepository = connectionRepository;
    }

    public List<UUID> getRecommendationsForUser(User currentUser, int limit) {
        Bio currentUserBio = bioRepository.findByUser(currentUser).orElse(null);

        // If the user hasn't completed their bio, return an empty list.
        if (currentUserBio == null) {
            return new ArrayList<>();
        }

        // Get all users the current user already has a connection/request/rejection with
        List<UUID> excludedUserIds = connectionRepository.findAll().stream()
                .filter(conn -> conn.getRequester().getId().equals(currentUser.getId()) || conn.getRecipient().getId().equals(currentUser.getId()))
                .map(conn -> conn.getRequester().getId().equals(currentUser.getId()) ? conn.getRecipient().getId() : conn.getRequester().getId())
                .collect(Collectors.toList());
        
        excludedUserIds.add(currentUser.getId()); // Exclude self

        // Fetch all bios EXCEPT the excluded ones
        List<Bio> eligibleBios = bioRepository.findAll().stream()
                .filter(bio -> !excludedUserIds.contains(bio.getUser().getId()))
                .collect(Collectors.toList());

        // Calculate scores
        List<Map.Entry<Bio, Integer>> scoredBios = eligibleBios.stream()
                .map(bio -> Map.entry(bio, calculateScore(currentUserBio, bio)))
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue())) // Sort descending by score
                .collect(Collectors.toList());

        // Extract User IDs of the top 'limit' recommendations
        return scoredBios.stream()
                .limit(limit)
                .map(entry -> entry.getKey().getUser().getId())
                .collect(Collectors.toList());
    }

    private int calculateScore(Bio current, Bio candidate) {
        int score = 0;

        // Primary language (high weight)
        if (current.getPrimaryLanguage() != null && current.getPrimaryLanguage().equalsIgnoreCase(candidate.getPrimaryLanguage())) {
            score += 30;
        }

        // City match (high weight — basic location check)
        if (current.getCity() != null && current.getCity().equalsIgnoreCase(candidate.getCity())) {
            score += 25;
        }

        // What they're looking for
        if (current.getLookFor() != null && current.getLookFor().equalsIgnoreCase(candidate.getLookFor())) {
            score += 20;
        }

        // Experience level
        if (current.getExperienceLevel() != null && current.getExperienceLevel().equalsIgnoreCase(candidate.getExperienceLevel())) {
            score += 15;
        }

        // Preferred OS
        if (current.getPreferredOs() != null && current.getPreferredOs().equalsIgnoreCase(candidate.getPreferredOs())) {
            score += 5;
        }

        // Coding style
        if (current.getCodingStyle() != null && current.getCodingStyle().equalsIgnoreCase(candidate.getCodingStyle())) {
            score += 5;
        }

        return score;
    }
}
