package com.skyzen.careers.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Stub controller exposing the doc-spec intern API surface. Every endpoint
 * returns HTTP 501 NOT_IMPLEMENTED today — Phase 1+ wires in real handlers.
 *
 * <p>The doc lists these endpoints as the canonical intern API. Existing
 * intern-callable endpoints elsewhere (e.g. {@code /api/v1/applications/me},
 * {@code /api/v1/users/me}) keep working until those callers are migrated.
 * This controller is the placeholder so the routes claim their final paths
 * now and frontend wiring in later phases doesn't churn.</p>
 */
@RestController
@RequestMapping("/api/v1/intern")
@Slf4j
public class InternController {

    private static final String NOT_YET = "Intern surface is being rebuilt in Phase 1+.";

    @GetMapping("/dashboard")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> dashboard() {
        throw notImplemented();
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> getProfile() {
        throw notImplemented();
    }

    @PatchMapping("/profile")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> updateProfile(@RequestBody Map<String, Object> body) {
        throw notImplemented();
    }

    @GetMapping("/projects/mine")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> myProjects() {
        throw notImplemented();
    }

    @GetMapping("/timesheets/mine")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> myTimesheets() {
        throw notImplemented();
    }

    @PostMapping("/timesheets")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> createTimesheet(@RequestBody Map<String, Object> body) {
        throw notImplemented();
    }

    @GetMapping("/evaluations/mine")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> myEvaluations() {
        throw notImplemented();
    }

    @GetMapping("/documents/mine")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> myDocuments() {
        throw notImplemented();
    }

    @GetMapping("/messages")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> messages() {
        throw notImplemented();
    }

    private ResponseStatusException notImplemented() {
        return new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, NOT_YET);
    }
}
