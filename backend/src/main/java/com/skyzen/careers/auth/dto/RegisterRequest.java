package com.skyzen.careers.auth.dto;

import com.skyzen.careers.enums.DegreeLevel;
import com.skyzen.careers.enums.WorkAuthTrack;
import jakarta.validation.constraints.AssertTrue;
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
 *
 * Legal: {@code acceptedTos} must be true at submit — proof of consent is
 * stamped on the user (tos_accepted_at + tos_version) by AuthService.
 */
public record RegisterRequest(
        @Email @NotBlank String email,
        @NotBlank @Size(min = 8) String password,
        @NotBlank String fullName,
        String phoneNumber,
        // Intake profile (Candidate row)
        String legalName,
        String preferredName,
        /** Legacy free-text education summary. New clients leave this null
         *  and populate the structured {@link #degreeLevel} / {@link
         *  #specialization} / {@link #graduationYear} below. Accepted for
         *  backwards compatibility with older clients still sending it. */
        String education,
        String school,
        /** Legacy free-text degree. New clients leave null and use
         *  {@link #degreeLevel} instead. */
        String degree,
        /** Phase 1.5 — structured education. */
        DegreeLevel degreeLevel,
        String specialization,
        Short graduationYear,
        String skillset,
        // Neutral work-authorization self-attestation
        Boolean authorizedToWork,
        Boolean sponsorshipNeeded,
        WorkAuthTrack expectedTrack,
        /** END / expiration date of work auth. Required when the track's
         *  {@link com.skyzen.careers.enums.VisaDateRequirement} is
         *  {@code END_ONLY} or {@code BOTH}; left null for {@code NONE}. */
        LocalDate validityDate,
        /** START date of work auth. Only populated when the track's
         *  requirement is {@code BOTH}. */
        LocalDate validityStartDate,
        // Legal — must be explicitly true at submit
        Boolean acceptedTos
) {
    @AssertTrue(message = "You must accept the Privacy Policy and Terms of Service")
    public boolean isTosAccepted() {
        return Boolean.TRUE.equals(acceptedTos);
    }
}
