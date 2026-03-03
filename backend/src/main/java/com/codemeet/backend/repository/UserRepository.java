package com.codemeet.backend.repository;

import com.codemeet.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    // This method will allow us to find a user by their email, which is useful for login and registration and it writes it to the database
    Optional<User> findByEmail(String email);
}
