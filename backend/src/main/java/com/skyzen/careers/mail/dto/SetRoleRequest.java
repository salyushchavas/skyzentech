package com.skyzen.careers.mail.dto;

import com.skyzen.careers.mail.entity.MailRole;
import jakarta.validation.constraints.NotNull;

public record SetRoleRequest(
        @NotNull MailRole role
) {
}
