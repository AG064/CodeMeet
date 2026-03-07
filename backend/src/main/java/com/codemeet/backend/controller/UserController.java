package com.codemeet.backend.controller;

import com.codemeet.backend.dto.BioDto;
import com.codemeet.backend.dto.PrivacySettingsDto;
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
    private static final int MIN_BIO_AGE = 13;
    private static final int MAX_BIO_AGE = 120;
    private static final int MIN_RADIUS_KM = 1;
    private static final int MAX_RADIUS_KM = 500;
    
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

        return ResponseEntity.ok(mapToPublicDto(targetUser, canBypassPrivacy(currentUser, targetUser)));
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

        return ResponseEntity.ok(mapToBioDto(bio, canBypassPrivacy(currentUser, targetUser)));
    }

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

    @GetMapping("/me/bio")
    public ResponseEntity<BioDto> getMyBio(Authentication authentication) {
        User user = getAuthenticatedUser(authentication);

        Bio bio = bioRepository.findByUser(user)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Bio not set up yet"));

        return ResponseEntity.ok(mapToBioDto(bio, true));
    }

    @GetMapping("/me/privacy")
    public ResponseEntity<PrivacySettingsDto> getMyPrivacySettings(Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        return ResponseEntity.ok(mapToPrivacySettingsDto(user));
    }

    @PostMapping("/me/privacy")
    public ResponseEntity<String> updateMyPrivacySettings(Authentication authentication, @RequestBody PrivacySettingsDto request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Privacy settings are required");
        }

        User user = getAuthenticatedUser(authentication);
        user.setHideAvatar(request.isHideAvatar());
        user.setHideLocation(request.isHideLocation());
        user.setHideAge(request.isHideAge());
        user.setHideLastSeen(request.isHideLastSeen());
        userRepository.save(user);

        return ResponseEntity.ok("Privacy settings updated successfully");
    }

    @PostMapping("/me/bio")
    public ResponseEntity<String> updateMyBio(Authentication authentication, @RequestBody BioDto request) {
        User user = getAuthenticatedUser(authentication);
        validateBioRequest(request);

        Bio bio = bioRepository.findByUser(user).orElse(new Bio());
        bio.setUser(user);
        bio.setPrimaryLanguage(normalizeText(request.getPrimaryLanguage()));
        bio.setExperienceLevel(normalizeText(request.getExperienceLevel()));
        bio.setLookFor(normalizeText(request.getLookFor()));
        bio.setPreferredOs(normalizeText(request.getPreferredOs()));
        bio.setCodingStyle(normalizeText(request.getCodingStyle()));
        bio.setLatitude(request.getLatitude());
        bio.setLongitude(request.getLongitude());
        bio.setMaxDistanceKm(request.getMaxDistanceKm());
        bio.setAge(request.getAge());
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

    @PostMapping("/me/profile-picture")
    public ResponseEntity<String> uploadProfilePicture(Authentication authentication, @RequestParam("file") MultipartFile file) {
        User user = getAuthenticatedUser(authentication);
        String previousFileUrl = user.getProfilePicture();

        try {
            String fileUrl = fileService.saveFile(file);
            user.setProfilePicture(fileUrl);
            userRepository.save(user);
            fileService.deleteFileByUrl(previousFileUrl);
            return ResponseEntity.ok("Profile picture updated successfully: " + fileUrl);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload file");
        }
    }

    @DeleteMapping("/me/profile-picture")
    public ResponseEntity<String> removeProfilePicture(Authentication authentication) {
        User user = getAuthenticatedUser(authentication);
        String currentFileUrl = user.getProfilePicture();

        if (currentFileUrl == null || currentFileUrl.isBlank()) {
            return ResponseEntity.ok("Profile picture removed successfully");
        }

        try {
            fileService.deleteFileByUrl(currentFileUrl);
            user.setProfilePicture(null);
            userRepository.save(user);
            return ResponseEntity.ok("Profile picture removed successfully");
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to remove file");
        }
    }

    private User getAuthenticatedUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private BioDto mapToBioDto(Bio bio, boolean includePrivateFields) {
        BioDto dto = new BioDto();
        dto.setPrimaryLanguage(bio.getPrimaryLanguage());
        dto.setExperienceLevel(bio.getExperienceLevel());
        dto.setLookFor(bio.getLookFor());
        dto.setPreferredOs(bio.getPreferredOs());
        dto.setCodingStyle(bio.getCodingStyle());
        dto.setLatitude(includePrivateFields ? bio.getLatitude() : null);
        dto.setLongitude(includePrivateFields ? bio.getLongitude() : null);
        dto.setLocationVisible(includePrivateFields || !bio.getUser().isHideLocation());
        dto.setMaxDistanceKm(dto.isLocationVisible() || includePrivateFields ? bio.getMaxDistanceKm() : null);
        dto.setAgeVisible(includePrivateFields || !bio.getUser().isHideAge());
        dto.setAge(dto.isAgeVisible() || includePrivateFields ? bio.getAge() : null);
        return dto;
    }

    private PrivacySettingsDto mapToPrivacySettingsDto(User user) {
        PrivacySettingsDto dto = new PrivacySettingsDto();
        dto.setHideAvatar(user.isHideAvatar());
        dto.setHideLocation(user.isHideLocation());
        dto.setHideAge(user.isHideAge());
        dto.setHideLastSeen(user.isHideLastSeen());
        return dto;
    }

    private void validateBioRequest(BioDto request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bio is required");
        }

        requireBioValue(request.getPrimaryLanguage(), "Primary language");
        requireBioValue(request.getExperienceLevel(), "Experience level");
        requireBioValue(request.getLookFor(), "Looking for");
        requireBioValue(request.getPreferredOs(), "Preferred OS");
        requireBioValue(request.getCodingStyle(), "Coding style");

        Double latitude = request.getLatitude();
        Double longitude = request.getLongitude();
        Integer maxDistanceKm = request.getMaxDistanceKm();

        if (latitude == null || longitude == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "GPS coordinates are required");
        }
        if (latitude < -90 || latitude > 90) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Latitude must be between -90 and 90");
        }
        if (longitude < -180 || longitude > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Longitude must be between -180 and 180");
        }
        if (maxDistanceKm == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search radius is required");
        }
        if (maxDistanceKm < MIN_RADIUS_KM || maxDistanceKm > MAX_RADIUS_KM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search radius must be between " + MIN_RADIUS_KM + " and " + MAX_RADIUS_KM + " km");
        }

        Integer age = request.getAge();
        if (age == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Age is required");
        }
        if (age < MIN_BIO_AGE || age > MAX_BIO_AGE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Age must be between " + MIN_BIO_AGE + " and " + MAX_BIO_AGE);
        }
    }

    private void requireBioValue(String value, String fieldName) {
        if (normalizeText(value) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " is required");
        }
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean canViewProfile(User current, User target) {
        if (current.getRole() == User.Role.ADMIN) {
            return true;
        }

        if (current.getId().equals(target.getId())) {
            return true;
        }

        if (recommendationService.isBlockedEitherDirection(current, target)) {
            return false;
        }

        Optional<Connection> connection = connectionRepository.findAllConnectionsBetweenUsers(current, target);
        if (connection.isPresent()) {
            return connection.get().getStatus() != ConnectionStatus.REJECTED;
        }

        return recommendationService.getRecommendationsForUser(current, 50).contains(target.getId());
    }

    private UserResponse mapToResponse(User user) {
        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setName(resolveDisplayName(user));
        response.setProfilePicture(user.getProfilePicture());
        return response;
    }

    private PublicUserDto mapToPublicDto(User user, boolean includePrivateFields) {
        PublicUserDto dto = new PublicUserDto();
        dto.setId(user.getId());
        dto.setName(resolveDisplayName(user));
        dto.setAvatarVisible(includePrivateFields || !user.isHideAvatar());
        dto.setProfilePicture(dto.isAvatarVisible() ? user.getProfilePicture() : null);
        dto.setLastSeenVisible(includePrivateFields || !user.isHideLastSeen());
        dto.setLastSeenAt(dto.isLastSeenVisible() ? user.getLastSeenAt() : null);
        return dto;
    }

    private boolean canBypassPrivacy(User viewer, User target) {
        return viewer.getRole() == User.Role.ADMIN || viewer.getId().equals(target.getId());
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
