package com.codemeet.backend.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class BioDto {
    private UUID id;
    private String primaryLanguage;
    private String experienceLevel;
    private String lookFor;
    private String preferredOs;
    private String codingStyle;
    private String city;
    private Double latitude;
    private Double longitude;
    private Integer maxDistanceKm;
    private boolean locationVisible = true;
    private Integer age;
    private boolean ageVisible = true;
}
