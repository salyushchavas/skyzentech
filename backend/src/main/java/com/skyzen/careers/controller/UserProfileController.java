package com.skyzen.careers.controller;

import com.skyzen.careers.dto.users.ChangePasswordRequest;
import com.skyzen.careers.dto.users.NotificationPreferencesResponse;
import com.skyzen.careers.dto.users.UpdateNotificationPreferencesRequest;
import com.skyzen.careers.dto.users.UpdateProfileRequest;
import com.skyzen.careers.dto.users.UserProfileResponse;
import com.skyzen.careers.auth.JwtAuthenticationFilter;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.service.UserProfileService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;

import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Current-user profile endpoints. Read + edit personal info and change
 * password. Distinct from the {@code /auth/me} JWT-bootstrap endpoint —
 * that one stays as-is so the auth client doesn't need to change.
 */
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public UserProfileResponse getMe(@AuthenticationPrincipal User caller) {
        return userProfileService.getProfile(caller);
    }

    @PutMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public UserProfileResponse updateMe(@Valid @RequestBody UpdateProfileRequest req,
                                        @AuthenticationPrincipal User caller) {
        return userProfileService.updateProfile(caller, req);
    }

    @PostMapping("/me/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                               @AuthenticationPrincipal User caller,
                                               HttpServletRequest request) {
        Object raw = request.getAttribute(JwtAuthenticationFilter.CURRENT_SESSION_ID_ATTR);
        UUID currentSessionId = raw instanceof UUID u ? u : null;
        userProfileService.changePassword(caller, req, currentSessionId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Self-service GitHub username — the intern types it once on their
     * assignment page so the TE can invite them as a repository collaborator
     * out-of-band on GitHub. Validated against GitHub's username rules via
     * the request DTO's @Pattern.
     */
    @PutMapping("/me/github-username")
    @PreAuthorize("isAuthenticated()")
    public java.util.Map<String, Object> setGithubUsername(
            @Valid @RequestBody
            com.skyzen.careers.dto.user.SetGithubUsernameRequest req,
            @AuthenticationPrincipal User caller) {
        return userProfileService.setGithubUsername(caller, req.githubUsername());
    }
}
