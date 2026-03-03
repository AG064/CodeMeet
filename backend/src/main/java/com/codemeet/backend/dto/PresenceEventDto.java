package com.codemeet.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@AllArgsConstructor
public class PresenceEventDto {
    private UUID userId;
    private boolean online;
    private Instant lastSeenAt;
}
