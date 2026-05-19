package com.skyzen.careers.auth.dto;

import java.util.List;

public record AuthResponse(
        String token,
        String userId,
        String email,
        String fullName,
        List<String> roles
) {}
