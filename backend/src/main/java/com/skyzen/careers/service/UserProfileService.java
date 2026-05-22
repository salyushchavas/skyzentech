package com.skyzen.careers.service;

import com.skyzen.careers.dto.users.ChangePasswordRequest;
import com.skyzen.careers.dto.users.UpdateProfileRequest;
import com.skyzen.careers.dto.users.UserProfileResponse;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Current-user profile read + update + password change. All ownership is
 * derived strictly from {@code @AuthenticationPrincipal} — never trust a
 * client-supplied user id.
 *
 * Phase 1.4 — reads/writes the intake profile + neutral work-authorization
 * self-attestation on the Candidate row. Staff users (no Candidate row) see
 * those fields as null and edits to them are silently dropped.
 */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(User caller) {
        if (caller == null || caller.getId() == null) {
            throw new BadRequestException("Authentication required");
        }
        User user = userRepository.findById(caller.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        Optional<Candidate> candidate = candidateRepository.findByUserId(user.getId());
        return toResponse(user, candidate.orElse(null));
    }

    @Transactional
    public UserProfileResponse updateProfile(User caller, UpdateProfileRequest req) {
        if (caller == null || caller.getId() == null) {
            throw new BadRequestException("Authentication required");
        }
        User user = userRepository.findById(caller.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setFullName(req.getFullName().trim());
        user.setPhoneNumber(emptyToNull(req.getPhone()));
        userRepository.save(user);

        // Candidate-row fields. Staff without a Candidate row see null reads
        // and skipped writes — the role separation prevents 500s on edit.
        Optional<Candidate> candidateOpt = candidateRepository.findByUserId(user.getId());
        Candidate candidate = null;
        if (candidateOpt.isPresent()) {
            candidate = candidateOpt.get();
            candidate.setDateOfBirth(req.getDateOfBirth());
            // Phase 1.4 intake — explicit null wins over the existing value so
            // the candidate can blank a field. We trim non-null strings.
            candidate.setLegalName(emptyToNull(req.getLegalName()));
            candidate.setPreferredName(emptyToNull(req.getPreferredName()));
            candidate.setEducation(emptyToNull(req.getEducation()));
            candidate.setSchool(emptyToNull(req.getSchool()));
            candidate.setDegree(emptyToNull(req.getDegree()));
            candidate.setSkillset(emptyToNull(req.getSkillset()));
            // Phase 1.4 self-attestation
            candidate.setAuthorizedToWork(req.getAuthorizedToWork());
            candidate.setSponsorshipNeeded(req.getSponsorshipNeeded());
            candidate.setExpectedTrack(req.getExpectedTrack());
            candidate.setValidityDate(req.getValidityDate());
            candidateRepository.save(candidate);
        }
        return toResponse(user, candidate);
    }

    @Transactional
    public void changePassword(User caller, ChangePasswordRequest req) {
        if (caller == null || caller.getId() == null) {
            throw new BadRequestException("Authentication required");
        }
        User user = userRepository.findById(caller.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash())) {
            // 400 not 500. Mapped by GlobalExceptionHandler.
            throw new BadRequestException("Current password is incorrect");
        }
        if (req.getNewPassword().equals(req.getCurrentPassword())) {
            throw new BadRequestException("New password must be different from current");
        }
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    private UserProfileResponse toResponse(User user, Candidate candidate) {
        UserProfileResponse.UserProfileResponseBuilder b = UserProfileResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhoneNumber())
                .roles(user.getRoles() == null
                        ? java.util.Set.of()
                        : user.getRoles().stream()
                                .map(Enum::name)
                                .collect(Collectors.toCollection(java.util.LinkedHashSet::new)));
        if (candidate != null) {
            b.dateOfBirth(candidate.getDateOfBirth())
                    .legalName(candidate.getLegalName())
                    .preferredName(candidate.getPreferredName())
                    .education(candidate.getEducation())
                    .school(candidate.getSchool())
                    .degree(candidate.getDegree())
                    .skillset(candidate.getSkillset())
                    .authorizedToWork(candidate.getAuthorizedToWork())
                    .sponsorshipNeeded(candidate.getSponsorshipNeeded())
                    .expectedTrack(candidate.getExpectedTrack())
                    .validityDate(candidate.getValidityDate());
        }
        return b.build();
    }

    private static String emptyToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
