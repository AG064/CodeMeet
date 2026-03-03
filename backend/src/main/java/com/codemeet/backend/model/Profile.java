package com.codemeet.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Entity
@Table(name="profiles")
@Data
@NoArgsConstructor
public class Profile {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id", nullable = false)
    private User user;

    @Column(length = 1000) // allow for longer aboutMe's
    private String aboutMe;

    private boolean isOnline = false; // default to offline
}
