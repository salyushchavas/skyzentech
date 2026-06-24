package com.skyzen.careers.mail.controller;

import com.skyzen.careers.mail.auth.MailPrincipal;
import com.skyzen.careers.mail.exception.MailApiException;
import com.skyzen.careers.mail.service.MailSseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Real-time event stream under the @Order(1) mail chain (MAIL_USER+). The client
 * connects with fetch (NOT EventSource) so it can send the mail Bearer header;
 * the chain authenticates the request, then we register an emitter for the
 * caller's account. Unauthenticated requests 401 via the mail entry point.
 */
@RestController
@RequestMapping("/api/mail")
@RequiredArgsConstructor
public class MailSseController {

    private final MailSseService sseService;

    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@AuthenticationPrincipal MailPrincipal principal) {
        if (principal == null) {
            throw new MailApiException(HttpStatus.UNAUTHORIZED, "Authentication required", "MAIL_UNAUTHENTICATED");
        }
        return sseService.register(principal.accountId());
    }
}
