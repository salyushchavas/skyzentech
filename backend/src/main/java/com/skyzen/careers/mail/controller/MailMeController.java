package com.skyzen.careers.mail.controller;

import com.skyzen.careers.mail.auth.MailPrincipal;
import com.skyzen.careers.mail.dto.MailAuthResponse;
import com.skyzen.careers.mail.dto.MailChangePasswordRequest;
import com.skyzen.careers.mail.dto.MailMeResponse;
import com.skyzen.careers.mail.service.MailAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Self endpoints. Both are reachable by a pre-change principal (the way out of
 * the must-change gate); every other mail route is blocked for such a principal.
 */
@RestController
@RequestMapping("/api/mail/me")
@RequiredArgsConstructor
public class MailMeController {

    private final MailAuthService mailAuthService;

    @GetMapping
    public ResponseEntity<MailMeResponse> me(@AuthenticationPrincipal MailPrincipal principal) {
        return ResponseEntity.ok(new MailMeResponse(
                principal.accountId().toString(),
                principal.email(),
                principal.displayName(),
                principal.domainId().toString(),
                principal.role().name(),
                principal.mustChangePassword()));
    }

    @PostMapping("/change-password")
    public ResponseEntity<MailAuthResponse> changePassword(@AuthenticationPrincipal MailPrincipal principal,
                                                           @Valid @RequestBody MailChangePasswordRequest req,
                                                           HttpServletRequest httpRequest) {
        return ResponseEntity.ok(mailAuthService.changePassword(principal.accountId(), req, httpRequest));
    }
}
