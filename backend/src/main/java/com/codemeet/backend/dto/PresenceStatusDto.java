package com.codemeet.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.Instant;

@Data
@AllArgsConstructor
public class PresenceStatusDto {
    private boolean online;
    private Instant lastSeenAt;
}
