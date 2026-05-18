package com.skyzen.careers.auth.dto;

import java.time.Instant;
import java.util.List;

public record MeResponse(
        String userId,
        String email,
        String fullName,
        String phoneNumber,
        List<String> roles,
        Instant createdAt
) {}
