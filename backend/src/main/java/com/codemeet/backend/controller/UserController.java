package com.codemeet.backend.controller;

import com.codemeet.backend.dto.BioDto;
import com.codemeet.backend.dto.ProfileDto;
import com.codemeet.backend.dto.UserResponse;
import com.codemeet.backend.dto.PublicUserDto;
import com.codemeet.backend.model.Bio;
import com.codemeet.backend.model.Connection;
import com.codemeet.backend.model.ConnectionStatus;
import com.codemeet.backend.model.Profile;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.BioRepository;
import com.codemeet.backend.repository.ConnectionRepository;
import com.codemeet.backend.repository.ProfileRepository;
import com.codemeet.backend.repository.UserRepository;
import com.codemeet.backend.service.FileService;
import com.codemeet.backend.service.RecommendationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class UserController {
    
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final BioRepository bioRepository;
    private final FileService fileService;
    private final ConnectionRepository connectionRepository;
    private final RecommendationService recommendationService;

    public UserController(UserRepository userRepository, ProfileRepository profileRepository, BioRepository bioRepository, FileService fileService, ConnectionRepository connectionRepository, RecommendationService recommendationService) {
        this.userRepository = userRepository;
        this.profileRepository = profileRepository;
        this.bioRepository = bioRepository;
        this.fileService = fileService;
        this.connectionRepository = connectionRepository;
        this.recommendationService = recommendationService;
    }
    // Core endpoints for fetching user data
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {

        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        return ResponseEntity.ok(mapToResponse(user));
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<PublicUserDto> getUserById(@PathVariable UUID id, Authentication authentication) {
        User currentUser = getAuthenticatedUser(authentication);
        User targetUser = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!canViewProfile(currentUser, targetUser)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        return ResponseEntity.ok(mapToPublicDto(targetUser));
    }

    @GetMapping("/users/{id}/profile")
    public ResponseEntity<ProfileDto> getUserProfileById(@PathVariable UUID id, Authentication authentication) {
        User currentUser = getAuthenticatedUser(authentication);
        User targetUser = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!canViewProfile(currentUser, targetUser)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        Profile profile = profileRepository.findByUser(targetUser)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not set up yet"));

        ProfileDto dto = new ProfileDto();
        dto.setAboutMe(profile.getAboutMe());
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/users/{id}/bio")
    public ResponseEntity<BioDto> getUserBioById(@PathVariable UUID id, Authentication authentication) {
        User currentUser = getAuthenticatedUser(authentication);
        User targetUser = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!canViewProfile(currentUser, targetUser)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        Bio bio = bioRepository.findByUser(targetUser)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bio not set up yet"));

        BioDto dto = new BioDto();
        dto.setPrimaryLanguage(bio.getPrimaryLanguage());
        dto.setExperienceLevel(bio.getExperienceLevel());
        dto.setLookFor(bio.getLookFor());
        dto.setPreferredOs(bio.getPreferredOs());
        dto.setCodingStyle(bio.getCodingStyle());
        dto.setCity(bio.getCity());
        return ResponseEntity.ok(dto);
    }

    // profile endpoints

    @GetMapping("/me/profile")
    public ResponseEntity<ProfileDto> getMyProfile(Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        
        Profile profile = profileRepository.findByUser(user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not set up yet"));

        ProfileDto dto = new ProfileDto();
        dto.setAboutMe(profile.getAboutMe());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/me/profile")
    public ResponseEntity<String> updateMyProfile(Authentication authentication, @RequestBody ProfileDto request
    ) {
        User user = getAuthenticatedUser(authentication);

        Profile profile = profileRepository.findByUser(user).orElse(new Profile());

        profile.setUser(user);
        profile.setAboutMe(request.getAboutMe());
        profileRepository.save(profile);

        return ResponseEntity.ok("Profile updated successfully");
    }

    // bio endpoints

    @GetMapping("/me/bio")
    public ResponseEntity<BioDto> getMyBio(Authentication authentication) {
        User user = getAuthenticatedUser(authentication);

        Bio bio = bioRepository.findByUser(user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bio not set up yet"));

        BioDto dto = new BioDto();
        dto.setPrimaryLanguage(bio.getPrimaryLanguage());
        dto.setExperienceLevel(bio.getExperienceLevel());
        dto.setLookFor(bio.getLookFor());
        dto.setPreferredOs(bio.getPreferredOs());
        dto.setCodingStyle(bio.getCodingStyle());
        dto.setCity(bio.getCity());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/me/bio")
    public ResponseEntity<String> updateMyBio(Authentication authentication, @RequestBody BioDto request) {
        User user = getAuthenticatedUser(authentication);

        Bio bio = bioRepository.findByUser(user).orElse(new Bio());
        bio.setUser(user);
        bio.setPrimaryLanguage(request.getPrimaryLanguage());
        bio.setExperienceLevel(request.getExperienceLevel());
        bio.setLookFor(request.getLookFor());
        bio.setPreferredOs(request.getPreferredOs());
        bio.setCodingStyle(request.getCodingStyle());
        bio.setCity(request.getCity());
        bioRepository.save(bio);

        return ResponseEntity.ok("Bio updated successfully");
    }

    @PostMapping("/me/alias")
    public ResponseEntity<String> updateMyAlias(Authentication authentication, @RequestBody Map<String, String> body) {
        User user = getAuthenticatedUser(authentication);
        String alias = body.get("name");
        if (alias == null || alias.trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alias cannot be empty");
        }

        user.setName(alias.trim());
        userRepository.save(user);
        return ResponseEntity.ok("Alias updated successfully");
    }

    // helpers

    @PostMapping("/me/profile-picture")
    public ResponseEntity<String> uploadProfilePicture(Authentication authentication, @RequestParam("file") MultipartFile file) {
        User user = getAuthenticatedUser(authentication);

        try {
            String fileUrl = fileService.saveFile(file);
            user.setProfilePicture(fileUrl);
            userRepository.save(user);
            return ResponseEntity.ok("Profile picture updated successfully: " + fileUrl);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload file");
        }
    }

    private User getAuthenticatedUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private boolean canViewProfile(User current, User target) {
        if (current.getId().equals(target.getId())) {
            return true;
        }

        Optional<Connection> connection = connectionRepository.findAllConnectionsBetweenUsers(current, target);
        // Если есть связь (PENDING или ACCEPTED)
        if (connection.isPresent()) {
            if (connection.get().getStatus() != ConnectionStatus.REJECTED) {
                return true;
            }
            return false; // REJECTED - скрываем
        }

        // Проверяем, есть ли пользователь в списке рекомендаций (топ 50 например)
        return recommendationService.getRecommendationsForUser(current, 50).contains(target.getId());
    }

    private UserResponse mapToResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setName(resolveDisplayName(user));
        response.setProfilePicture(user.getProfilePicture());
        return response;
    }

    private PublicUserDto mapToPublicDto(User user) {
        PublicUserDto dto = new PublicUserDto();
        dto.setId(user.getId());
        dto.setName(resolveDisplayName(user));
        dto.setProfilePicture(user.getProfilePicture());
        dto.setLastSeenAt(user.getLastSeenAt());
        return dto;
    }

    private String resolveDisplayName(User user) {
        String name = user.getName();
        if (name != null && !name.trim().isBlank()) {
            return name.trim();
        }

        String email = user.getEmail();
        if (email != null && !email.trim().isBlank()) {
            int atIndex = email.indexOf('@');
            if (atIndex > 0) {
                return email.substring(0, atIndex);
            }
        }

        String id = user.getId() != null ? user.getId().toString() : "unknown";
        return "User-" + id.substring(0, Math.min(8, id.length()));
    }
}
