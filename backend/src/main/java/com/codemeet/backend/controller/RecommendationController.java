package com.codemeet.backend.controller;

import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.UserRepository;
import com.codemeet.backend.service.RecommendationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class RecommendationController {

    private final RecommendationService recommendationService;
    private final UserRepository userRepository;

    public RecommendationController(RecommendationService recommendationService, UserRepository userRepository) {
        this.recommendationService = recommendationService;
        this.userRepository = userRepository;
    }

    @GetMapping("/recommendations")
    public ResponseEntity<List<Map<String, String>>> getRecommendations(Authentication authentication) {
        User currentUser = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Get max 10 recommendations
        List<UUID> recommendedUserIds = recommendationService.getRecommendationsForUser(currentUser, 10);

        // Map to required JSON structure [{ "id": "..." }]
        List<Map<String, String>> response = recommendedUserIds.stream()
                .map(id -> {
                    Map<String, String> map = new HashMap<>();
                    map.put("id", id.toString());
                    return map;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }
}
