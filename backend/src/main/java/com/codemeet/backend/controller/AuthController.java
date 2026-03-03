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

        User newUser = new User();
        newUser.setEmail(request.getEmail());
        String requestedName = request.getName() != null ? request.getName().trim() : "";
        if (!requestedName.isBlank()) {
            newUser.setName(requestedName);
        } else {
            String email = request.getEmail() != null ? request.getEmail().trim() : "";
            int atIndex = email.indexOf('@');
            String fallback = atIndex > 0 ? email.substring(0, atIndex) : "coder";
            newUser.setName(fallback);
        }
        // Hash the password with a salt (bcrypt automatically handles salting)
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));

        userRepository.save(newUser);

        return ResponseEntity.ok("User registered successfully");
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequest request) {
        Optional<User> userOptional = userRepository.findByEmail(request.getEmail());
        if (userOptional.isPresent()) {
            User user = userOptional.get ();
            if (passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                String token = jwtService.generateToken(user.getEmail(), user.getId().toString());
                return ResponseEntity.ok(token);
            }
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid email or password");
    }
}
