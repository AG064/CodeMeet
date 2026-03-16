package com.codemeet.backend.graphql;

import com.codemeet.backend.model.Bio;
import com.codemeet.backend.model.Profile;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.BioRepository;
import com.codemeet.backend.repository.ProfileRepository;
import com.codemeet.backend.repository.UserRepository;
import com.codemeet.backend.repository.ConnectionRepository;
import com.codemeet.backend.service.RecommendationService;
import com.codemeet.backend.service.PresenceService;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.SchemaMapping;
import org.springframework.graphql.data.method.annotation.SubscriptionMapping;
import org.springframework.graphql.data.method.annotation.BatchMapping;
import org.springframework.stereotype.Controller;
import org.springframework.security.core.context.SecurityContextHolder;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Controller
public class GraphqlController {

    private final UserRepository userRepository;
    private final BioRepository bioRepository;
    private final ProfileRepository profileRepository;
    private final RecommendationService recommendationService;
    private final ConnectionRepository connectionRepository;
    private final PresenceService presenceService;

    public GraphqlController(UserRepository userRepository, BioRepository bioRepository, ProfileRepository profileRepository, RecommendationService recommendationService, ConnectionRepository connectionRepository, PresenceService presenceService) {
        this.userRepository = userRepository;
        this.bioRepository = bioRepository;
        this.profileRepository = profileRepository;
        this.recommendationService = recommendationService;
        this.connectionRepository = connectionRepository;
        this.presenceService = presenceService;
    }

    @QueryMapping
    public User user(@Argument UUID id) {
        return userRepository.findById(id).orElse(null);
    }

    @QueryMapping
    public Bio bio(@Argument UUID id) {
        return bioRepository.findById(id).orElse(null);
    }

    @QueryMapping
    public Profile profile(@Argument UUID id) {
        return profileRepository.findById(id).orElse(null);
    }

    private Optional<User> currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) return Optional.empty();
        String email = auth.getName();
        return userRepository.findByEmail(email);
    }

    @QueryMapping
    public User me() {
        return currentUser().orElse(null);
    }

    @QueryMapping
    public Bio myBio() {
        return currentUser().flatMap(u -> bioRepository.findByUser(u)).orElse(null);
    }

    @QueryMapping
    public Profile myProfile() {
        return currentUser().flatMap(u -> profileRepository.findByUser(u)).orElse(null);
    }

    @QueryMapping
    public List<User> recommendations() {
        Optional<User> current = currentUser();
        if (current.isEmpty()) return List.of();
        List<UUID> ids = recommendationService.getRecommendationsForUser(current.get(), 20);
        return userRepository.findAllById(ids);
    }

    @QueryMapping
    public List<User> connections() {
        Optional<User> current = currentUser();
        if (current.isEmpty()) return List.of();
        // return ACCEPTED connections' counterpart users
        return connectionRepository.findAllForUser(current.get()).stream()
                .filter(c -> c.getStatus() != null && c.getStatus().name().equals("ACCEPTED"))
                .map(c -> c.getRequester().getId().equals(current.get().getId()) ? c.getRecipient() : c.getRequester())
                .collect(Collectors.toList());
    }

    @SubscriptionMapping
    public Flux<PresenceService.PresenceChange> presenceChanged() {
        return presenceService.presenceFlux();
    }

    // Batch mappings to avoid multiple queries when resolving nested bio/profile for many users
    @BatchMapping(typeName = "User", field = "bio")
    public java.util.Map<User, Bio> batchUserBios(List<User> users) {
        List<java.util.UUID> ids = users.stream().map(User::getId).collect(Collectors.toList());
        List<Bio> bios = bioRepository.findByUserIdIn(ids);
        java.util.Map<java.util.UUID, Bio> byUserId = bios.stream().collect(Collectors.toMap(b -> b.getUser().getId(), b -> b));
        java.util.Map<User, Bio> result = new java.util.HashMap<>();
        for (User u : users) {
            result.put(u, byUserId.get(u.getId()));
        }
        return result;
    }

    @BatchMapping(typeName = "User", field = "profile")
    public java.util.Map<User, Profile> batchUserProfiles(List<User> users) {
        List<java.util.UUID> ids = users.stream().map(User::getId).collect(Collectors.toList());
        List<Profile> profiles = profileRepository.findByUserIdIn(ids);
        
        java.util.Map<java.util.UUID, Profile> byUserId = profiles.stream().collect(Collectors.toMap(p -> p.getUser().getId(), p -> p));
        java.util.Map<User, Profile> result = new java.util.HashMap<>();
        for (User u : users) {
            result.put(u, byUserId.get(u.getId()));
        }
        return result;
    }

    @SchemaMapping(typeName = "Bio", field = "user")
    public User bioUser(Bio bio) {
        return bio.getUser();
    }

    @SchemaMapping(typeName = "Profile", field = "user")
    public User profileUser(Profile profile) {
        return profile.getUser();
    }
}
