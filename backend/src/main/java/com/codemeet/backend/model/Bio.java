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

    @Column(columnDefinition="TEXT")
    private String primaryLanguage;
    
    @Column(columnDefinition="TEXT")
    private String experienceLevel;
    
    @Column(columnDefinition="TEXT")
    private String lookFor;
    
    @Column(columnDefinition="TEXT")
    private String preferredOs;
    
    @Column(columnDefinition="TEXT")
    private String codingStyle;
    
    @Column(columnDefinition="TEXT")
    private String city;
}
