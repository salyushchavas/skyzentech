package com.skyzen.careers.notification;

import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Fallback {@link EmailProvider}. Logs at INFO and returns. Used in dev / CI /
 * local where SMTP isn't configured. Bean is created by
 * {@link EmailProviderConfiguration} only when no SMTP host is set.
 *
 * Never throws — these are still real call sites in tests/dev, and we don't
 * want a log statement to corrupt an auth flow.
 */
@Slf4j
public class LogEmailProvider implements EmailProvider {

    @Override
    public void sendVerificationCode(String email, String code, Instant expiresAt) {
        log.info("[LOG EMAIL] Verification code for {}: {} (expires {})",
                email, code, expiresAt);
    }

    @Override
    public void sendApplicantIdIssued(String email, String applicantId) {
        log.info("[LOG EMAIL] Applicant ID issued for {}: {}", email, applicantId);
    }

    @Override
    public void sendPasswordReset(String email, String resetUrl, Instant expiresAt) {
        log.info("[LOG EMAIL] Password reset for {}: {} (expires {})",
                email, resetUrl, expiresAt);
    }

    @Override
    public void sendConditionalSelectionConfirmation(String email,
                                                     String jobPostingTitle,
                                                     String entityName) {
        log.info("[LOG EMAIL] Conditional selection confirmed for {} — {}{}",
                email,
                jobPostingTitle != null ? jobPostingTitle : "(role)",
                entityName != null ? " @ " + entityName : "");
    }

    @Override
    public void sendApplicationReceived(String email, String candidateName,
                                        String jobTitle, String entityName) {
        log.info("[LOG EMAIL] Application received for {} ({}) — {}{}",
                candidateName, email,
                jobTitle != null ? jobTitle : "(role)",
                entityName != null ? " @ " + entityName : "");
    }

    @Override
    public void sendApplicationShortlisted(String email, String candidateName,
                                           String jobTitle, String entityName) {
        log.info("[LOG EMAIL] Application shortlisted for {} ({}) — {}{}",
                candidateName, email,
                jobTitle != null ? jobTitle : "(role)",
                entityName != null ? " @ " + entityName : "");
    }

    @Override
    public void sendApplicationRejected(String email, String candidateName,
                                        String jobTitle, String entityName) {
        log.info("[LOG EMAIL] Application rejected for {} ({}) — {}{}",
                candidateName, email,
                jobTitle != null ? jobTitle : "(role)",
                entityName != null ? " @ " + entityName : "");
    }

    @Override
    public void sendInterviewScheduled(String email, String candidateName,
                                       String jobTitle, String entityName,
                                       Instant scheduledAt, Integer durationMinutes,
                                       String interviewType, String interviewerName,
                                       String meetingUrl, String candidateNotes) {
        log.info("[LOG EMAIL] Interview scheduled for {} ({}) — {} on {} ({} mins, type={}, with={}, link={})",
                candidateName, email,
                jobTitle != null ? jobTitle : "(role)",
                scheduledAt, durationMinutes, interviewType, interviewerName, meetingUrl);
    }

    @Override
    public void sendInterviewReminder(String email, String candidateName,
                                      String jobTitle, String entityName,
                                      Instant scheduledAt, Integer durationMinutes,
                                      String interviewType, String interviewerName,
                                      String meetingUrl) {
        log.info("[LOG EMAIL] Interview reminder (24h) for {} ({}) — {} on {} (with={}, link={})",
                candidateName, email,
                jobTitle != null ? jobTitle : "(role)",
                scheduledAt, interviewerName, meetingUrl);
    }

    @Override
    public void sendOfferExtended(String email, String candidateName,
                                  String jobTitle, String entityName,
                                  BigDecimal compensationAmount, String compensationCurrency,
                                  String compensationFrequency, LocalDate startDate,
                                  Instant expiresAt, String viewOfferUrl) {
        log.info("[LOG EMAIL] Offer extended to {} ({}) — {}{}, comp={} {} {}, start={}, expires={}, url={}",
                candidateName, email,
                jobTitle != null ? jobTitle : "(role)",
                entityName != null ? " @ " + entityName : "",
                compensationAmount, compensationCurrency, compensationFrequency,
                startDate, expiresAt, viewOfferUrl);
    }

    @Override
    public void sendOfferAccepted(String email, String candidateName,
                                  String jobTitle, String entityName,
                                  LocalDate startDate) {
        log.info("[LOG EMAIL] Offer accepted by {} ({}) — {}{}, start={}",
                candidateName, email,
                jobTitle != null ? jobTitle : "(role)",
                entityName != null ? " @ " + entityName : "",
                startDate);
    }

    @Override
    public void sendOfferAcceptedToOps(String opsEmail, String candidateName,
                                       String candidateEmail, String jobTitle,
                                       String entityName, LocalDate startDate) {
        log.info("[LOG EMAIL] OPS notified — offer accepted by {} <{}> for {}{}, start={} (to ops: {})",
                candidateName, candidateEmail,
                jobTitle != null ? jobTitle : "(role)",
                entityName != null ? " @ " + entityName : "",
                startDate, opsEmail);
    }

    @Override
    public void sendOnboardingWelcome(String email, String internName,
                                      String jobTitle, String entityName,
                                      LocalDate startDate, String dashboardUrl) {
        log.info("[LOG EMAIL] Onboarding welcome to {} ({}) — {}{}, start={}, dashboard={}",
                internName, email,
                jobTitle != null ? jobTitle : "(role)",
                entityName != null ? " @ " + entityName : "",
                startDate, dashboardUrl);
    }
}
