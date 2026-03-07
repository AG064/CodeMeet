package com.codemeet.backend.controller;

import com.codemeet.backend.dto.LoginRequest;
import com.codemeet.backend.dto.RegisterRequest;
import com.codemeet.backend.model.User;
import com.codemeet.backend.repository.UserRepository;
import com.codemeet.backend.service.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body("Email is already in use");
        }

        String requestedName = request.getName() != null ? request.getName().trim() : "";
        if (requestedName.isBlank()) {
            String email = request.getEmail() != null ? request.getEmail().trim() : "";
            int atIndex = email.indexOf('@');
            requestedName = atIndex > 0 ? email.substring(0, atIndex) : "coder";
        }
        if (userRepository.findByName(requestedName).isPresent()) {
            return ResponseEntity.badRequest().body("Username is already taken");
        }

        User newUser = new User();
        newUser.setEmail(request.getEmail());
        newUser.setName(requestedName);
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));

        userRepository.save(newUser);

        return ResponseEntity.ok("User registered successfully");
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequest request) {
        System.out.println(">>> [DEBUG] Login attempt! Identifier: " + request.getIdentifier());

        String identifier = request.getIdentifier() != null ? request.getIdentifier().trim() : "";

        Optional<User> userOptional = identifier.contains("@")
                ? userRepository.findByEmail(identifier)
                : userRepository.findByName(identifier);

        if (userOptional.isEmpty()) {
            userOptional = identifier.contains("@")
                    ? userRepository.findByName(identifier)
                    : userRepository.findByEmail(identifier);
        }

        if (userOptional.isPresent()) {
            User user = userOptional.get();
            System.out.println(">>> [DEBUG] User found in DB: " + user.getEmail());

            boolean passwordMatch = passwordEncoder.matches(request.getPassword(), user.getPassword());
            System.out.println(">>> [DEBUG] Password match result: " + passwordMatch);

            if (passwordMatch) {
                String roleName = user.getRole() != null ? user.getRole().name() : "USER";

                String token = jwtService.generateToken(user.getEmail(), user.getId().toString(), roleName);
                System.out.println(">>> [DEBUG] Token generated successfully!");
                return ResponseEntity.ok(token);
            }
        } else {
            System.out.println(">>> [DEBUG] User NOT found in DB by identifier: " + identifier);
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials");
    }
}
