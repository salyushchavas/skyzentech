package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.interview.CandidateInterviewResponse;
import com.skyzen.careers.dto.interview.InterviewResponse;
import com.skyzen.careers.dto.interview.InterviewSummaryResponse;
import com.skyzen.careers.dto.interview.ScheduleInterviewRequest;
import com.skyzen.careers.dto.interview.SubmitFeedbackRequest;
import com.skyzen.careers.dto.interview.UpdateInterviewRequest;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.InterviewRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewService {

    private static final Set<ApplicationStatus> SCHEDULABLE_FROM = EnumSet.of(
            ApplicationStatus.SHORTLISTED,
            ApplicationStatus.INTERVIEW_SCHEDULED,
            ApplicationStatus.INTERVIEWED
    );

    private final InterviewRepository interviewRepository;
    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final ApplicationService applicationService;

    // ── Commands ────────────────────────────────────────────────────────────

    @Transactional
    public InterviewResponse schedule(ScheduleInterviewRequest req, User scheduler) {
        Application application = applicationRepository.findById(req.getApplicationId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Application not found: " + req.getApplicationId()));

        if (!SCHEDULABLE_FROM.contains(application.getStatus())) {
            throw new BadRequestException(
                    "Cannot schedule interview for application in status " + application.getStatus());
        }

        User interviewer = userRepository.findById(req.getInterviewerId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Interviewer not found: " + req.getInterviewerId()));

        if (interviewer.getRoles().contains(UserRole.CANDIDATE)
                && interviewer.getRoles().size() == 1) {
            throw new BadRequestException("Interviewer must be an internal user, not a candidate");
        }

        Interview interview = Interview.builder()
                .application(application)
                .interviewer(interviewer)
                .scheduledAt(req.getScheduledAt())
                .durationMinutes(req.getDurationMinutes() != null ? req.getDurationMinutes() : 60)
                .type(req.getType())
                .status(InterviewStatus.SCHEDULED)
                .meetingUrl(req.getMeetingUrl())
                .candidateNotes(req.getCandidateNotes())
                .createdBy(scheduler.getId())
                .build();
        interview = interviewRepository.save(interview);

        if (application.getStatus() == ApplicationStatus.SHORTLISTED) {
            // SHORTLISTED → INTERVIEW_SCHEDULED is legal in LEGAL_TRANSITIONS;
            // transitionTo writes the single STATUS_CHANGE audit row.
            applicationService.transitionTo(application, ApplicationStatus.INTERVIEW_SCHEDULED,
                    "STATUS_CHANGE", scheduler);
        }

        writeAudit("Interview", interview.getId(), "SCHEDULE", scheduler.getId(),
                null, snapshot(interview));
        return toResponse(interview);
    }

    @Transactional
    public InterviewResponse update(UUID interviewId, UpdateInterviewRequest req, User actor) {
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Interview not found: " + interviewId));

        if (interview.getStatus() != InterviewStatus.SCHEDULED) {
            throw new BadRequestException(
                    "Cannot edit interview in status " + interview.getStatus() + " — only SCHEDULED is editable");
        }

        Map<String, Object> before = snapshot(interview);

        if (req.getScheduledAt() != null) interview.setScheduledAt(req.getScheduledAt());
        if (req.getDurationMinutes() != null) interview.setDurationMinutes(req.getDurationMinutes());
        if (req.getType() != null) interview.setType(req.getType());
        if (req.getMeetingUrl() != null) interview.setMeetingUrl(req.getMeetingUrl());
        if (req.getCandidateNotes() != null) interview.setCandidateNotes(req.getCandidateNotes());
        if (req.getInterviewerId() != null
                && !req.getInterviewerId().equals(interview.getInterviewer().getId())) {
            User newInterviewer = userRepository.findById(req.getInterviewerId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Interviewer not found: " + req.getInterviewerId()));
            if (newInterviewer.getRoles().contains(UserRole.CANDIDATE)
                    && newInterviewer.getRoles().size() == 1) {
                throw new BadRequestException("Interviewer must be an internal user, not a candidate");
            }
            interview.setInterviewer(newInterviewer);
        }

        interview = interviewRepository.save(interview);
        writeAudit("Interview", interview.getId(), "UPDATE", actor.getId(),
                before, snapshot(interview));
        return toResponse(interview);
    }

    @Transactional
    public InterviewResponse submitFeedback(UUID interviewId, SubmitFeedbackRequest req, User submitter) {
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Interview not found: " + interviewId));

        ensureCanSubmitFeedback(interview, submitter);

        if (interview.getStatus() != InterviewStatus.SCHEDULED
                && interview.getStatus() != InterviewStatus.COMPLETED) {
            throw new BadRequestException(
                    "Cannot submit feedback for interview in status " + interview.getStatus());
        }

        Map<String, Object> before = snapshot(interview);

        interview.setFeedbackOverallRating(req.getOverallRating());
        interview.setFeedbackTechnicalRating(req.getTechnicalRating());
        interview.setFeedbackCommunicationRating(req.getCommunicationRating());
        interview.setFeedbackStrengths(req.getStrengths());
        interview.setFeedbackConcerns(req.getConcerns());
        interview.setFeedbackRecommendation(req.getRecommendation());
        interview.setFeedbackSubmittedAt(Instant.now());
        interview.setFeedbackSubmittedBy(submitter.getId());
        interview.setStatus(InterviewStatus.COMPLETED);
        interview = interviewRepository.save(interview);

        Application application = interview.getApplication();
        if (application.getStatus() == ApplicationStatus.INTERVIEW_SCHEDULED) {
            // INTERVIEW_SCHEDULED → INTERVIEWED is legal in LEGAL_TRANSITIONS;
            // transitionTo writes the single STATUS_CHANGE audit row.
            applicationService.transitionTo(application, ApplicationStatus.INTERVIEWED,
                    "STATUS_CHANGE", submitter);
        }

        writeAudit("Interview", interview.getId(), "SUBMIT_FEEDBACK", submitter.getId(),
                before, snapshot(interview));
        return toResponse(interview);
    }

    @Transactional
    public InterviewResponse updateStatus(UUID interviewId, InterviewStatus newStatus, User actor) {
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Interview not found: " + interviewId));

        if (interview.getStatus() != InterviewStatus.SCHEDULED) {
            throw new BadRequestException(
                    "Cannot transition interview from " + interview.getStatus()
                            + " (only SCHEDULED interviews accept status changes)");
        }
        if (newStatus != InterviewStatus.CANCELLED
                && newStatus != InterviewStatus.NO_SHOW
                && newStatus != InterviewStatus.COMPLETED) {
            throw new BadRequestException(
                    "Invalid target status " + newStatus + " — allowed: CANCELLED, NO_SHOW, COMPLETED");
        }

        Map<String, Object> before = snapshot(interview);
        interview.setStatus(newStatus);
        interview = interviewRepository.save(interview);
        writeAudit("Interview", interview.getId(), "STATUS_CHANGE", actor.getId(),
                before, snapshot(interview));
        return toResponse(interview);
    }

    @Transactional
    public void delete(UUID interviewId, User actor) {
        Interview interview = interviewRepository.findById(interviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Interview not found: " + interviewId));

        if (interview.getStatus() != InterviewStatus.SCHEDULED) {
            throw new BadRequestException(
                    "Cannot delete interview in status " + interview.getStatus()
                            + " — completed/cancelled interviews are preserved for audit");
        }

        writeAudit("Interview", interview.getId(), "DELETE", actor.getId(),
                snapshot(interview), null);
        interviewRepository.delete(interview);
    }

    // ── Queries ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<InterviewSummaryResponse> list(UUID applicationId,
                                               InterviewStatus status,
                                               UUID interviewerId,
                                               Boolean upcoming,
                                               Pageable pageable) {
        Instant now = Instant.now();
        Instant upcomingCutoff = Boolean.TRUE.equals(upcoming) ? now : null;
        Instant pastCutoff = Boolean.FALSE.equals(upcoming) ? now : null;
        return interviewRepository
                .search(applicationId, status, interviewerId, upcomingCutoff, pastCutoff, pageable)
                .map(this::toSummary);
    }

    @Transactional(readOnly = true)
    public InterviewResponse getDetail(UUID interviewId, User caller) {
        // Fetch-join application → candidate → user + jobPosting + interviewer
        // so the DTO mapper doesn't N+1 / lazy-load after this method returns.
        Interview interview = interviewRepository.findByIdWithGraph(interviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Interview not found: " + interviewId));

        if (caller == null) {
            throw new ForbiddenException("Authentication required");
        }

        Set<UserRole> roles = caller.getRoles();
        boolean privileged = roles.contains(UserRole.ADMIN)
                || roles.contains(UserRole.ERM)
                || roles.contains(UserRole.RECRUITER)
                || roles.contains(UserRole.HR_COMPLIANCE)
                || roles.contains(UserRole.TECHNICAL_EVALUATOR);
        boolean isInterviewer = interview.getInterviewer() != null
                && caller.getId().equals(interview.getInterviewer().getId());

        if (privileged || isInterviewer) {
            return toResponse(interview);
        }

        if (roles.contains(UserRole.CANDIDATE) && belongsToCandidate(interview, caller)) {
            // Candidates technically use /me, but if they hit this directly we hide
            // feedback by 404-ing rather than 200 with sanitized payload, to be safe.
            throw new ResourceNotFoundException("Interview not found: " + interviewId);
        }

        throw new ForbiddenException("Not allowed to view this interview");
    }

    @Transactional(readOnly = true)
    public List<CandidateInterviewResponse> listForCandidate(User candidate) {
        return interviewRepository.findAllForCandidateUser(candidate.getId())
                .stream()
                .map(this::toCandidateResponse)
                .toList();
    }

    // ── Permission helpers ──────────────────────────────────────────────────

    private void ensureCanSubmitFeedback(Interview interview, User submitter) {
        if (submitter == null) {
            throw new ForbiddenException("Authentication required");
        }
        Set<UserRole> roles = submitter.getRoles();
        boolean privileged = roles.contains(UserRole.ADMIN) || roles.contains(UserRole.ERM);
        boolean isInterviewer = interview.getInterviewer() != null
                && submitter.getId().equals(interview.getInterviewer().getId());
        if (!privileged && !isInterviewer) {
            throw new ForbiddenException("Only the assigned interviewer, ERM, or ADMIN can submit feedback");
        }
    }

    private boolean belongsToCandidate(Interview interview, User candidate) {
        Application app = interview.getApplication();
        if (app == null || app.getCandidate() == null || app.getCandidate().getUser() == null) {
            return false;
        }
        return app.getCandidate().getUser().getId().equals(candidate.getId());
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private InterviewResponse toResponse(Interview i) {
        Application app = i.getApplication();
        Candidate c = app != null ? app.getCandidate() : null;
        User candidateUser = c != null ? c.getUser() : null;
        JobPosting jp = app != null ? app.getJobPosting() : null;
        User interviewer = i.getInterviewer();

        return InterviewResponse.builder()
                .id(i.getId())
                .applicationId(app != null ? app.getId() : null)
                .applicationStatus(app != null ? app.getStatus() : null)
                .candidateName(candidateUser != null ? candidateUser.getFullName() : null)
                .candidateEmail(candidateUser != null ? candidateUser.getEmail() : null)
                .jobPostingTitle(jp != null ? jp.getTitle() : null)
                .interviewerName(interviewer != null ? interviewer.getFullName() : null)
                .interviewerId(interviewer != null ? interviewer.getId() : null)
                .scheduledAt(i.getScheduledAt())
                .durationMinutes(i.getDurationMinutes())
                .type(i.getType())
                .status(i.getStatus())
                .meetingUrl(i.getMeetingUrl())
                .candidateNotes(i.getCandidateNotes())
                .feedbackOverallRating(i.getFeedbackOverallRating())
                .feedbackTechnicalRating(i.getFeedbackTechnicalRating())
                .feedbackCommunicationRating(i.getFeedbackCommunicationRating())
                .feedbackStrengths(i.getFeedbackStrengths())
                .feedbackConcerns(i.getFeedbackConcerns())
                .feedbackRecommendation(i.getFeedbackRecommendation())
                .feedbackSubmittedAt(i.getFeedbackSubmittedAt())
                .feedbackSubmittedByName(lookupUserName(i.getFeedbackSubmittedBy()))
                .createdAt(i.getCreatedAt())
                .createdByName(lookupUserName(i.getCreatedBy()))
                .build();
    }

    private InterviewSummaryResponse toSummary(Interview i) {
        Application app = i.getApplication();
        Candidate c = app != null ? app.getCandidate() : null;
        User candidateUser = c != null ? c.getUser() : null;
        JobPosting jp = app != null ? app.getJobPosting() : null;
        User interviewer = i.getInterviewer();
        return InterviewSummaryResponse.builder()
                .id(i.getId())
                .candidateName(candidateUser != null ? candidateUser.getFullName() : null)
                .jobPostingTitle(jp != null ? jp.getTitle() : null)
                .interviewerName(interviewer != null ? interviewer.getFullName() : null)
                .scheduledAt(i.getScheduledAt())
                .durationMinutes(i.getDurationMinutes())
                .type(i.getType())
                .status(i.getStatus())
                .hasFeedback(i.getFeedbackSubmittedAt() != null)
                .build();
    }

    private CandidateInterviewResponse toCandidateResponse(Interview i) {
        User interviewer = i.getInterviewer();
        return CandidateInterviewResponse.builder()
                .id(i.getId())
                .scheduledAt(i.getScheduledAt())
                .durationMinutes(i.getDurationMinutes())
                .type(i.getType())
                .status(i.getStatus())
                .meetingUrl(i.getMeetingUrl())
                .candidateNotes(i.getCandidateNotes())
                .interviewerName(interviewer != null ? interviewer.getFullName() : null)
                .build();
    }

    private String lookupUserName(UUID userId) {
        if (userId == null) return null;
        return userRepository.findById(userId).map(User::getFullName).orElse(null);
    }

    // ── Audit log ───────────────────────────────────────────────────────────

    private Map<String, Object> snapshot(Interview i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("applicationId", i.getApplication() != null ? i.getApplication().getId() : null);
        m.put("interviewerId", i.getInterviewer() != null ? i.getInterviewer().getId() : null);
        m.put("scheduledAt", i.getScheduledAt());
        m.put("durationMinutes", i.getDurationMinutes());
        m.put("type", i.getType());
        m.put("status", i.getStatus());
        m.put("meetingUrl", i.getMeetingUrl());
        m.put("candidateNotes", i.getCandidateNotes());
        m.put("feedbackOverallRating", i.getFeedbackOverallRating());
        m.put("feedbackTechnicalRating", i.getFeedbackTechnicalRating());
        m.put("feedbackCommunicationRating", i.getFeedbackCommunicationRating());
        m.put("feedbackStrengths", i.getFeedbackStrengths());
        m.put("feedbackConcerns", i.getFeedbackConcerns());
        m.put("feedbackRecommendation", i.getFeedbackRecommendation());
        m.put("feedbackSubmittedAt", i.getFeedbackSubmittedAt());
        m.put("feedbackSubmittedBy", i.getFeedbackSubmittedBy());
        return m;
    }

    private void writeAudit(String entityType, UUID entityId, String action, UUID userId,
                            Map<String, Object> before, Map<String, Object> after) {
        AuditLog entry = AuditLog.builder()
                .entityType(entityType)
                .entityId(entityId)
                .action(action)
                .userId(userId)
                .beforeJson(serialize(before))
                .afterJson(serialize(after))
                .build();
        auditLogRepository.save(entry);
    }

    private String serialize(Map<String, Object> snapshot) {
        if (snapshot == null) return null;
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize audit snapshot: {}", e.getMessage());
            return new HashMap<>(snapshot).toString();
        }
    }
}
