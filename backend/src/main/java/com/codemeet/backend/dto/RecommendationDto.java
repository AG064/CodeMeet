package com.codemeet.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.UUID;

@Data
@AllArgsConstructor
public class RecommendationDto {
    private UUID id;
    private int matchScore;
    private double distanceKm;
}