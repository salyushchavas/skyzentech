package com.skyzen.careers.mail.dto;

import jakarta.validation.constraints.NotBlank;

/** Move an entry to a target folder (one of the system folder names). */
public record MailMoveRequest(
        @NotBlank String folder
) {
}
