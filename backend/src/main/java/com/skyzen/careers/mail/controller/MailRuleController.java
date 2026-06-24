package com.skyzen.careers.mail.controller;

import com.skyzen.careers.mail.auth.MailPrincipal;
import com.skyzen.careers.mail.dto.MailRuleRequest;
import com.skyzen.careers.mail.dto.MailRuleResponse;
import com.skyzen.careers.mail.exception.MailApiException;
import com.skyzen.careers.mail.service.MailRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Per-account inbox-rule CRUD under the @Order(1) mail chain (MAIL_USER+). */
@RestController
@RequestMapping("/api/mail/rules")
@RequiredArgsConstructor
public class MailRuleController {

    private final MailRuleService service;

    @GetMapping
    public List<MailRuleResponse> list(@AuthenticationPrincipal MailPrincipal principal) {
        return service.list(principal);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MailRuleResponse create(@AuthenticationPrincipal MailPrincipal principal,
                                   @RequestBody MailRuleRequest req) {
        return service.create(principal, req);
    }

    @GetMapping("/{id}")
    public MailRuleResponse get(@AuthenticationPrincipal MailPrincipal principal, @PathVariable String id) {
        return service.get(principal, uuid(id));
    }

    @PutMapping("/{id}")
    public MailRuleResponse update(@AuthenticationPrincipal MailPrincipal principal,
                                   @PathVariable String id, @RequestBody MailRuleRequest req) {
        return service.update(principal, uuid(id), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal MailPrincipal principal, @PathVariable String id) {
        service.delete(principal, uuid(id));
    }

    private static UUID uuid(String s) {
        try {
            return UUID.fromString(s);
        } catch (RuntimeException e) {
            throw new MailApiException(HttpStatus.BAD_REQUEST, "Invalid id", "MAIL_INVALID_ID");
        }
    }
}
