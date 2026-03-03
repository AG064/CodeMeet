package com.codemeet.backend.dto;

import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
public class PublicUserDto {
    private UUID id;
    private String name;
    private String profilePicture;
    private Instant lastSeenAt;
}
