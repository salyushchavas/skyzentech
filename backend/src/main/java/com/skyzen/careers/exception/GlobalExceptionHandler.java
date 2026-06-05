package com.skyzen.careers.exception;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
        return error(HttpStatus.NOT_FOUND, ex.getMessage(), null);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(BadRequestException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage(), null);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(ConflictException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage(), null);
    }

    /**
     * Phase 8 — write attempted against an exited / terminal lifecycle.
     * 409 with a stable {@code code = "LIFECYCLE_CLOSED"} so the frontend
     * can render a clean "Internship is inactive" toast.
     */
    @ExceptionHandler(LifecycleClosedException.class)
    public ResponseEntity<Map<String, Object>> handleLifecycleClosed(LifecycleClosedException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("code", "LIFECYCLE_CLOSED");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    /**
     * ERM Phase 4 — onboarding assignment attempted before Trainer +
     * Evaluator + Manager all set. 409 with a structured {@code missing}
     * array so the ERM UI can highlight which slots are blank.
     */
    @ExceptionHandler(ReportingStructureIncompleteException.class)
    public ResponseEntity<Map<String, Object>> handleReportingStructureIncomplete(
            ReportingStructureIncompleteException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("code", "REPORTING_STRUCTURE_INCOMPLETE");
        body.put("missing", ex.getMissing());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(ForbiddenException ex) {
        return error(HttpStatus.FORBIDDEN, ex.getMessage(), null);
    }

    /**
     * GitHub upstream failure (auth / scope / network). 502 Bad Gateway with
     * a top-level {@code code = "github_call_failed"} so the TE UI can render
     * a dedicated toast instead of treating it as a generic 500. The
     * exception's message is the operator-readable reason — the token is
     * never included.
     */
    @ExceptionHandler(com.skyzen.careers.github.GitHubIntegrationException.class)
    public ResponseEntity<Map<String, Object>> handleGithubIntegration(
            com.skyzen.careers.github.GitHubIntegrationException ex) {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("error", ex.getMessage());
        body.put("code", "github_call_failed");
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(body);
    }

    /**
     * Email-verification gate (phase 1.3). Returns 403 with a top-level
     * {@code code} field so the frontend can distinguish this from generic
     * forbidden responses and render the verify-email prompt instead of a raw
     * "Access denied" toast.
     */
    @ExceptionHandler(EmailUnverifiedException.class)
    public ResponseEntity<Map<String, Object>> handleEmailUnverified(EmailUnverifiedException ex) {
        return codedForbidden(ex.getMessage(), "EMAIL_UNVERIFIED");
    }

    /**
     * Post-offer gate (GAP_REPORT A1). A candidate is hitting I-9 create or
     * Section-1 submit before they have an ACCEPTED offer (or while their
     * engagement is BLOCKED_NO_AUTHORIZATION). Returns 403 + code
     * {@code OFFER_REQUIRED} so the frontend can render a clean
     * "available after your offer is accepted" state.
     */
    @ExceptionHandler(OfferRequiredException.class)
    public ResponseEntity<Map<String, Object>> handleOfferRequired(OfferRequiredException ex) {
        return codedForbidden(ex.getMessage(), "OFFER_REQUIRED");
    }

    /**
     * E-Verify sequencing gate (GAP_REPORT A2). Federal rule: E-Verify case
     * may only be created once Form I-9 is COMPLETED. Returns 403 + code
     * {@code I9_NOT_COMPLETE}.
     */
    @ExceptionHandler(I9NotCompleteException.class)
    public ResponseEntity<Map<String, Object>> handleI9NotComplete(I9NotCompleteException ex) {
        return codedForbidden(ex.getMessage(), "I9_NOT_COMPLETE");
    }

    /**
     * I-983 track gate (GAP_REPORT A5). A non-STEM_OPT candidate is hitting an
     * I-983 endpoint. Returns 403 + code {@code STEM_OPT_REQUIRED} so the
     * frontend can render the "training plan not required" panel.
     */
    @ExceptionHandler(StemOptRequiredException.class)
    public ResponseEntity<Map<String, Object>> handleStemOptRequired(StemOptRequiredException ex) {
        return codedForbidden(ex.getMessage(), "STEM_OPT_REQUIRED");
    }

    /**
     * Interview-before-offer gate (GAP_REPORT A3). Offer create or
     * conditional-select against an application that hasn't reached INTERVIEWED
     * / SELECTED_CONDITIONAL. Returns 403 + code {@code INTERVIEW_REQUIRED}.
     * Hard gate — no admin / HR override path.
     */
    @ExceptionHandler(InterviewRequiredException.class)
    public ResponseEntity<Map<String, Object>> handleInterviewRequired(InterviewRequiredException ex) {
        return codedForbidden(ex.getMessage(), "INTERVIEW_REQUIRED");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, "Access denied", null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fe ->
                fieldErrors.put(fe.getField(), fe.getDefaultMessage()));
        return error(HttpStatus.BAD_REQUEST, "Validation failed", Map.of("fields", fieldErrors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraint(ConstraintViolationException ex) {
        return error(HttpStatus.BAD_REQUEST, "Constraint violation: " + ex.getMessage(), null);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return error(HttpStatus.BAD_REQUEST, "Uploaded file exceeds the maximum allowed size", null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMediaType(HttpMediaTypeNotSupportedException ex) {
        log.warn("Unsupported media type: {}", ex.getMessage());
        return error(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Unsupported content type for this endpoint", null);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return error(HttpStatus.CONFLICT,
                "Data integrity violation: a duplicate or conflicting record exists", null);
    }

    /**
     * Unmatched routes (Spring 6 stopped auto-trimming trailing slashes; any URL
     * that no controller maps falls through to the static-resource handler and
     * throws this). Return a clean 404 instead of logging "Unhandled exception"
     * and emitting 500.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
        return error(HttpStatus.NOT_FOUND, "Not Found", null);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", null);
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message, Map<String, Object> details) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        if (details != null) {
            body.put("details", details);
        }
        return ResponseEntity.status(status).body(body);
    }

    /**
     * Shared shape for 403 responses that carry a stable {@code code} the
     * frontend keys off (EMAIL_UNVERIFIED, OFFER_REQUIRED, I9_NOT_COMPLETE,
     * STEM_OPT_REQUIRED). Keeping the body shape uniform across these gated
     * forbids lets the API client share one error handler.
     */
    private ResponseEntity<Map<String, Object>> codedForbidden(String message, String code) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        body.put("code", code);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }
}
