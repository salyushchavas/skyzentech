package com.skyzen.careers.dto.users;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.skyzen.careers.enums.WorkAuthTrack;
import lombok.*;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * Current-user profile DTO. Never includes the password hash. Roles is the
 * full set the user holds (typical accounts have exactly one).
 *
 * Phase 1.4 — adds the intake profile + neutral work-authorization
 * self-attestation. NO document fields here; documents are post-offer only.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserProfileResponse {
    private UUID id;
    private String fullName;
    private String email;
    private String phone;
    /** Only populated when the user has a Candidate row; otherwise null. */
    private LocalDate dateOfBirth;
    private Set<String> roles;

    // Phase 1.4 intake — all candidate-row fields, null for non-candidates.
    private String legalName;
    private String preferredName;
    private String education;
    private String school;
    private String degree;
    private String skillset;

    // Phase 1.4 neutral work-authorization self-attestation.
    private Boolean authorizedToWork;
    private Boolean sponsorshipNeeded;
    private WorkAuthTrack expectedTrack;
    private LocalDate validityDate;
}
