package com.skyzen.careers.dto.admin;

import com.skyzen.careers.enums.UserRole;
import lombok.*;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserResponse {
    private UUID id;
    private String name;
    private String email;
    /** Multi-role accounts are rare today, but the entity allows it; expose the full set. */
    private Set<UserRole> roles;
    private Boolean active;
    private Instant createdAt;
}
