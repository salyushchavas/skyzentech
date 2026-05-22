package com.skyzen.careers.auth.dto;

import com.skyzen.careers.enums.WorkAuthTrack;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Phase 1.4 — registration accepts the intake profile + neutral work-auth
 * self-attestation alongside the original auth fields. EVERYTHING beyond
 * email/password/fullName is OPTIONAL; older clients that only send those
 * three must continue to work. The profile page is the primary edit surface;
 * registration captures what it can up-front.
 *
 * Compliance: this DTO must NEVER carry document fields (I-9, E-Verify, work
 * permits, visas). The four attestation fields are the candidate's neutral
 * self-statement; documents come post-offer only (Phase 3).
 */
public record RegisterRequest(
        @Email @NotBlank String email,
        @NotBlank @Size(min = 8) String password,
        @NotBlank String fullName,
        String phoneNumber,
        // Intake profile (Candidate row)
        String legalName,
        String preferredName,
        String education,
        String school,
        String degree,
        String skillset,
        // Neutral work-authorization self-attestation
        Boolean authorizedToWork,
        Boolean sponsorshipNeeded,
        WorkAuthTrack expectedTrack,
        LocalDate validityDate
) {}
