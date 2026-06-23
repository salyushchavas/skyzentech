package com.skyzen.careers.mail.exception;

import com.skyzen.careers.exception.ErrorResponse;
import com.skyzen.careers.exception.TraceIdFilter;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

/**
 * Advice scoped to {@code com.skyzen.careers.mail} ONLY. It handles the
 * mail-specific exception types ({@link MailAuthException} and
 * {@link MailApiException}) and emits the exact same {@link ErrorResponse} JSON
 * contract Skyzen uses elsewhere (reusing the shared record + trace id). It does
 * NOT touch Skyzen's
 * {@code GlobalExceptionHandler}: it is package-scoped (never applies to Skyzen
 * controllers) and only declares a handler for a type Skyzen's handler never
 * sees. Other exceptions thrown by mail controllers (validation, etc.) fall
 * through to Skyzen's global handler for a consistent response. {@code @Order}
 * HIGHEST guarantees this advice wins for {@code MailAuthException} over the
 * global handler's {@code Exception.class} catch-all.
 */
@RestControllerAdvice(basePackages = "com.skyzen.careers.mail")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MailExceptionHandler {

    @ExceptionHandler(MailAuthException.class)
    public ResponseEntity<ErrorResponse> handle(MailAuthException ex) {
        return toResponse(ex.getStatus(), ex.getMessage(), ex.getCode());
    }

    @ExceptionHandler(MailApiException.class)
    public ResponseEntity<ErrorResponse> handle(MailApiException ex) {
        return toResponse(ex.getStatus(), ex.getMessage(), ex.getCode());
    }

    private ResponseEntity<ErrorResponse> toResponse(HttpStatus status, String message, String code) {
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        ErrorResponse er = new ErrorResponse(
                status.value(),
                message,   // legacy `error` field
                message,   // canonical `message`
                code,
                traceId,
                Instant.now(),
                null);
        return ResponseEntity.status(status).body(er);
    }
}
