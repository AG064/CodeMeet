package com.codemeet.backend.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class TypingEventDto {
    private UUID senderId;
    private UUID recipientId;
    private boolean typing;
}
