package com.codemeet.backend.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class ProfileDto {
    private UUID id;
    private String aboutMe;
}
