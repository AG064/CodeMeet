package com.codemeet.backend.repository;

import com.codemeet.backend.model.Profile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.List;
import java.util.Collection;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {
    java.util.Optional<com.codemeet.backend.model.Profile> findByUser(com.codemeet.backend.model.User user);
    List<Profile> findByUserIdIn(Collection<UUID> userIds);
}
