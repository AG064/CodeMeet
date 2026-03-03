package com.codemeet.backend.repository;

import com.codemeet.backend.model.Bio;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface BioRepository extends JpaRepository<Bio, UUID> {
    java.util.Optional<com.codemeet.backend.model.Bio> findByUser(com.codemeet.backend.model.User user);
}