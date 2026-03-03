package com.codemeet.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Entity
@Table(name="bios")
@Data
@NoArgsConstructor
public class Bio {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id", nullable = false)
    private User user;

    // Minimum 5 biographical data points for recommendations
    @Column(columnDefinition="TEXT")
    private String primaryLanguage; // e.g., Java, Python, TypeScript
    
    @Column(columnDefinition="TEXT")
    private String experienceLevel;  // e.g., Junior, Mid, Senior
    
    @Column(columnDefinition="TEXT")
    private String lookFor;         // e.g., Mentor, Mentee, Coding Buddy, Networking
    
    @Column(columnDefinition="TEXT")
    private String preferredOs;     // e.g., Linux, macOS, Windows
    
    @Column(columnDefinition="TEXT")
    private String codingStyle;     // e.g., Night Owl, Early Bird
    
    @Column(columnDefinition="TEXT")
    private String city;            // e.g., New York, London, Tokyo
}
