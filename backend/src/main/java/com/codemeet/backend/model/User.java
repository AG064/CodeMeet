package com.codemeet.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="users") // "user" is a reserved keyword in SQL, so we use "users" instead
@Data // lombok annotation to generate getters, setters, toString, equals, and hashCode methods
@NoArgsConstructor // lombok annotation to generate a no-argument constructor

public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID) // automatically generate a UUID for the primary key
    private UUID id; // unique identifier for each user

    @Column(nullable = false, unique = true) // email must be unique and cannot be null
    private String email;

    @Column(nullable = false) // password cannot be null
    private String password; // we will store the bcrypt hashed password here

    private String name;

    private String profilePicture;

    private Instant lastSeenAt;
}
