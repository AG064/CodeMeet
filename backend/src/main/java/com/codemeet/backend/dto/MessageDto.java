package com.codemeet.backend.dto;

import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class MessageDto {
    private UUID id;
    private UUID senderId;
    private UUID recipientId;
    private String content;
    private String attachmentUrl;
    private String attachmentName;
    private ZonedDateTime timestamp;
    private Boolean isRead;
}
