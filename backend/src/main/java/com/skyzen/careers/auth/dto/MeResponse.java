package com.skyzen.careers.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MeResponse(
        String userId,
        String email,
        String fullName,
        String phoneNumber,
        List<String> roles,
        Instant createdAt,
        Boolean emailVerified,
        String applicantId
) {}
