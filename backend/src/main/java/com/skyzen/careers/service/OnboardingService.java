package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.onboarding.OnboardingSummaryResponse;
import com.skyzen.careers.dto.onboarding.OnboardingTaskResponse;
import com.skyzen.careers.dto.onboarding.UpdateTaskStatusRequest;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.OnboardingTask;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.enums.OnboardingCategory;
import com.skyzen.careers.enums.OnboardingTaskStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.OnboardingTaskRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingService {

    private final OnboardingTaskRepository taskRepository;
    private final CandidateRepository candidateRepository;
    private final OfferRepository offerRepository;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    // ── Templates ───────────────────────────────────────────────────────────

    private record TaskTemplate(
            String taskKey,
            String title,
            String description,
            OnboardingCategory category,
            int sortOrder,
            Integer dueDateOffsetFromStartDays,
            String linkUrl,
            boolean autoComplete
    ) {}

    private static final List<TaskTemplate> TEMPLATES = List.of(
            new TaskTemplate(
                    "SIGN_OFFER",
                    "Sign your offer letter",
                    "Review and sign the offer letter from your hiring entity. You've already completed this — congratulations!",
                    OnboardingCategory.PAPERWORK,
                    10,
                    null,
                    "/careers/candidate/offers/{offerId}",
                    true
            ),
            new TaskTemplate(
                    "I9_SECTION_1",
                    "Complete Form I-9 Section 1",
                    "Federal employment eligibility verification. You'll provide ID documents and personal information. Required by your first day of work.",
                    OnboardingCategory.COMPLIANCE,
                    20,
                    0,
                    "/careers/candidate/i9",
                    false
            ),
            new TaskTemplate(
                    "I9_SECTION_2",
                    "Complete Form I-9 Section 2 with HR",
                    "HR will verify your identification documents in person or via secure video call. Required within 3 business days of your start date.",
                    OnboardingCategory.COMPLIANCE,
                    30,
                    3,
                    null,
                    false
            ),
            new TaskTemplate(
                    "I983_PLAN",
                    "Sign your Form I-983 Training Plan",
                    "Your ERM will prepare and send your STEM OPT Training Plan for review. Coordinate with them to complete and submit to your DSO.",
                    OnboardingCategory.COMPLIANCE,
                    40,
                    10,
                    "/careers/candidate/training-plans",
                    false
            ),
            new TaskTemplate(
                    "BACKGROUND_CHECK",
                    "Background check authorization",
                    "Provide consent for our standard background verification. Includes employment history and education verification.",
                    OnboardingCategory.PAPERWORK,
                    50,
                    -3,
                    "/careers/candidate/background-check",
                    false
            ),
            new TaskTemplate(
                    "TEAM_INTRO",
                    "Meet your team",
                    "Introductory session with your assigned Technical Evaluator and immediate team members. Your ERM will schedule this.",
                    OnboardingCategory.INTRODUCTION,
                    60,
                    0,
                    null,
                    false
            ),
            new TaskTemplate(
                    "GITLAB_ACCESS",
                    "GitLab and tooling access",
                    "IT will provision your GitLab account, development environment, and necessary tool access. Confirm when you've received credentials and successfully signed in.",
                    OnboardingCategory.SETUP,
                    70,
                    1,
                    null,
                    false
            ),
            new TaskTemplate(
                    "ORIENTATION",
                    "First-week orientation",
                    "Welcome session with HR covering company policies, benefits, evaluator-intern program structure, and supervised work expectations.",
                    OnboardingCategory.INTRODUCTION,
                    80,
                    5,
                    null,
                    false
            ),
            new TaskTemplate(
                    "FIRST_TIMESHEET",
                    "Submit your first weekly timesheet",
                    "Log your first week of hours and a brief summary of work completed. This kicks off the supervised work program.",
                    OnboardingCategory.SETUP,
                    90,
                    7,
                    "/careers/candidate/timesheets",
                    false
            )
    );

    /**
     * Phase 3 step 4 — per-track add-on tasks. Keyed by the spec's exact
     * task_key strings so audit + tests can grep for them. The standard seed
     * ({@link #TEMPLATES}) already covers the universal I-9 §1/§2 + I-983
     * plan tasks for everyone; these templates are layered on top by the
     * track router based on the candidate's expected work-auth track.
     */
    private static final Map<String, TaskTemplate> TRACK_TEMPLATES = Map.ofEntries(
            Map.entry("HR_AUTHORIZATION_REVIEW", new TaskTemplate(
                    "HR_AUTHORIZATION_REVIEW",
                    "HR review — work-authorization follow-up",
                    "The candidate has not self-attested work authorization. HR/legal must review before any compliance steps proceed. This is a process route, NOT a hiring decision.",
                    OnboardingCategory.COMPLIANCE,
                    15,
                    null,
                    null,
                    false)),
            Map.entry("I983_DRAFT", new TaskTemplate(
                    "I983_DRAFT",
                    "Draft Form I-983 Training Plan",
                    "STEM OPT requires a signed I-983. ERM drafts the plan; the candidate and employer sign before submission to the DSO.",
                    OnboardingCategory.COMPLIANCE,
                    45,
                    -7,
                    "/careers/candidate/training-plans",
                    false)),
            Map.entry("I983_DSO_APPROVAL", new TaskTemplate(
                    "I983_DSO_APPROVAL",
                    "Submit I-983 to DSO for approval",
                    "Once both parties have signed, submit the I-983 to the candidate's DSO. Engagement cannot reach READY_TO_START until DSO approval is recorded.",
                    OnboardingCategory.COMPLIANCE,
                    46,
                    0,
                    "/careers/candidate/training-plans",
                    false)),
            Map.entry("EVERIFY_BY_DAY_3", new TaskTemplate(
                    "EVERIFY_BY_DAY_3",
                    "Open E-Verify case",
                    "Required by the 3rd business day after the candidate's first day. HR opens the case after Form I-9 is complete.",
                    OnboardingCategory.COMPLIANCE,
                    35,
                    3,
                    null,
                    false)),
            Map.entry("CPT_I20_VERIFY", new TaskTemplate(
                    "CPT_I20_VERIFY",
                    "Verify DSO-authorized CPT on Form I-20",
                    "CPT employment must be authorized on the candidate's Form I-20 by their DSO. HR verifies before the engagement can start. No I-983 required for CPT.",
                    OnboardingCategory.COMPLIANCE,
                    25,
                    -3,
                    null,
                    false))
    );

    // ── Seeding ─────────────────────────────────────────────────────────────

    /**
     * Seeds the 9 standard onboarding tasks for an accepted offer. Idempotent.
     *
     * Uses {@code REQUIRES_NEW} so a seeding failure rolls back only the task inserts,
     * not the surrounding accept transaction. The caller in {@code OfferService}
     * catches any exception, so a downstream onboarding bug never blocks a candidate
     * from accepting their offer.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void seedTasksForAcceptedOffer(Offer offer) {
        if (offer == null || offer.getApplication() == null
                || offer.getApplication().getCandidate() == null) {
            log.warn("Cannot seed onboarding tasks — offer or application/candidate is null");
            return;
        }
        Candidate candidate = offer.getApplication().getCandidate();
        UUID candidateId = candidate.getId();
        UUID offerId = offer.getId();

        if (taskRepository.existsByCandidateIdAndOfferId(candidateId, offerId)) {
            log.info("Onboarding tasks already seeded for candidate {} and offer {}, skipping",
                    candidateId, offerId);
            return;
        }

        LocalDate startDate = offer.getStartDate();
        Application application = offer.getApplication();
        UUID candidateUserId = candidate.getUser() != null ? candidate.getUser().getId() : null;
        Instant now = Instant.now();

        int created = 0;
        for (TaskTemplate t : TEMPLATES) {
            LocalDate due = (t.dueDateOffsetFromStartDays() != null && startDate != null)
                    ? startDate.plusDays(t.dueDateOffsetFromStartDays())
                    : null;
            String linkUrl = t.linkUrl();
            if (linkUrl != null && linkUrl.contains("{offerId}")) {
                linkUrl = linkUrl.replace("{offerId}", offerId.toString());
            }
            OnboardingTaskStatus status = t.autoComplete()
                    ? OnboardingTaskStatus.COMPLETED
                    : OnboardingTaskStatus.PENDING;

            OnboardingTask task = OnboardingTask.builder()
                    .candidate(candidate)
                    .application(application)
                    .offer(offer)
                    .taskKey(t.taskKey())
                    .title(t.title())
                    .description(t.description())
                    .category(t.category())
                    .status(status)
                    .sortOrder(t.sortOrder())
                    .dueDate(due)
                    .linkUrl(linkUrl)
                    .completedAt(t.autoComplete() ? now : null)
                    .completedBy(t.autoComplete() ? candidateUserId : null)
                    .build();
            task = taskRepository.save(task);
            writeAudit("OnboardingTask", task.getId(), "CREATE", null,
                    null, snapshot(task));
            created += 1;
        }
        log.info("Seeded {} onboarding tasks for candidate {} (offer {})",
                created, candidateId, offerId);
    }

    /**
     * Phase 3 step 4 — idempotently add per-track onboarding tasks for an
     * engagement. Each {@code taskKey} must exist in {@link #TRACK_TEMPLATES}.
     * If a task with the same key already exists for the engagement's
     * (candidate, offer) pair, this is a no-op for that key — the DB unique
     * constraint is the safety net even if the in-memory check races.
     *
     * Caller responsibility: pick the right keys per track. The router
     * ({@link ComplianceRoutingService}) is the only caller today.
     */
    @Transactional
    public void augmentTasksForTrack(Engagement engagement, List<String> taskKeys) {
        if (engagement == null || engagement.getOffer() == null
                || engagement.getCandidate() == null) {
            log.warn("Cannot augment onboarding tasks — engagement missing offer/candidate");
            return;
        }
        if (taskKeys == null || taskKeys.isEmpty()) return;

        Offer offer = engagement.getOffer();
        Candidate candidate = engagement.getCandidate();
        Application application = engagement.getApplication();
        UUID candidateId = candidate.getId();
        UUID offerId = offer.getId();
        LocalDate startDate = offer.getStartDate();

        int added = 0;
        for (String key : taskKeys) {
            TaskTemplate t = TRACK_TEMPLATES.get(key);
            if (t == null) {
                log.warn("Unknown track task key '{}', skipping", key);
                continue;
            }
            // Idempotency check — the unique constraint on (candidate, taskKey,
            // offer) prevents duplicates even under concurrent calls.
            if (taskRepository.findByCandidateIdAndTaskKeyAndOfferId(
                    candidateId, key, offerId).isPresent()) {
                continue;
            }
            LocalDate due = (t.dueDateOffsetFromStartDays() != null && startDate != null)
                    ? startDate.plusDays(t.dueDateOffsetFromStartDays())
                    : null;
            OnboardingTask task = OnboardingTask.builder()
                    .candidate(candidate)
                    .application(application)
                    .offer(offer)
                    .taskKey(t.taskKey())
                    .title(t.title())
                    .description(t.description())
                    .category(t.category())
                    .status(OnboardingTaskStatus.PENDING)
                    .sortOrder(t.sortOrder())
                    .dueDate(due)
                    .linkUrl(t.linkUrl())
                    .build();
            task = taskRepository.save(task);
            writeAudit("OnboardingTask", task.getId(), "CREATE", null,
                    null, snapshot(task));
            added++;
        }
        if (added > 0) {
            log.info("Augmented {} track-specific onboarding task(s) for engagement {}",
                    added, engagement.getId());
        }
    }

    @Transactional
    public List<OnboardingTaskResponse> seedManual(UUID candidateId, User adminActor) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + candidateId));

        Offer accepted = offerRepository
                .findByApplication_Candidate_IdOrderByCreatedAtDesc(candidate.getId())
                .stream()
                .filter(o -> o.getStatus() == OfferStatus.ACCEPTED)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No accepted offer found for this candidate"));

        seedTasksForAcceptedOffer(accepted);
        log.info("Manual onboarding seed by user {} for candidate {} (offer {})",
                adminActor != null ? adminActor.getId() : null, candidateId, accepted.getId());

        return taskRepository.findByCandidateIdAndOfferIdOrderBySortOrderAsc(
                        candidate.getId(), accepted.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // ── Queries ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OnboardingTaskResponse> getMyTasks(User candidateUser) {
        Candidate candidate = candidateRepository.findByUserId(candidateUser.getId())
                .orElse(null);
        if (candidate == null) return List.of();
        return taskRepository.findByCandidateIdOrderBySortOrderAsc(candidate.getId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<OnboardingTaskResponse> getTasksForCandidate(UUID candidateId, User caller) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + candidateId));
        return taskRepository.findByCandidateIdOrderBySortOrderAsc(candidate.getId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public OnboardingSummaryResponse getSummaryForCandidate(UUID candidateId) {
        List<OnboardingTask> tasks =
                taskRepository.findByCandidateIdOrderBySortOrderAsc(candidateId);
        long total = tasks.size();
        long completed = 0, pending = 0, inProgress = 0, blocked = 0, notApplicable = 0;
        for (OnboardingTask t : tasks) {
            switch (t.getStatus()) {
                case COMPLETED -> completed++;
                case PENDING -> pending++;
                case IN_PROGRESS -> inProgress++;
                case BLOCKED -> blocked++;
                case NOT_APPLICABLE -> notApplicable++;
            }
        }
        long denominator = total - notApplicable;
        int progress = denominator > 0
                ? (int) Math.round((completed * 100.0) / denominator)
                : 0;

        LocalDate today = LocalDate.now();
        OnboardingTask next = tasks.stream()
                .filter(t -> t.getStatus() == OnboardingTaskStatus.PENDING
                        || t.getStatus() == OnboardingTaskStatus.IN_PROGRESS)
                .filter(t -> t.getDueDate() != null)
                .min(Comparator.comparing(OnboardingTask::getDueDate))
                .orElse(null);

        return OnboardingSummaryResponse.builder()
                .totalTasks(total)
                .completedTasks(completed)
                .pendingTasks(pending)
                .inProgressTasks(inProgress)
                .blockedTasks(blocked)
                .progressPercent(progress)
                .nextDueTask(next != null ? toResponse(next) : null)
                .build();
    }

    // ── Update ──────────────────────────────────────────────────────────────

    @Transactional
    public OnboardingTaskResponse updateStatus(UUID taskId,
                                               UpdateTaskStatusRequest req,
                                               User actor) {
        OnboardingTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Onboarding task not found: " + taskId));
        ensureCanModify(task, actor);

        OnboardingTaskStatus before = task.getStatus();
        OnboardingTaskStatus next = req.getStatus();
        if (before == next) {
            return toResponse(task);
        }

        Map<String, Object> beforeSnap = snapshot(task);
        task.setStatus(next);

        if (next == OnboardingTaskStatus.COMPLETED) {
            task.setCompletedAt(Instant.now());
            task.setCompletedBy(actor != null ? actor.getId() : null);
        } else if (before == OnboardingTaskStatus.COMPLETED) {
            // Transitioning out of COMPLETED — clear the completion stamp.
            task.setCompletedAt(null);
            task.setCompletedBy(null);
        }

        task = taskRepository.save(task);
        writeAudit("OnboardingTask", task.getId(), "STATUS_CHANGE",
                actor != null ? actor.getId() : null,
                beforeSnap, snapshot(task));
        return toResponse(task);
    }

    // ── Permissions ─────────────────────────────────────────────────────────

    private void ensureCanModify(OnboardingTask task, User actor) {
        if (actor == null) {
            throw new AccessDeniedException("Authentication required");
        }
        var roles = actor.getRoles();
        boolean staff = roles != null && (roles.contains(UserRole.ADMIN)
                || roles.contains(UserRole.ERM)
                || roles.contains(UserRole.HR_COMPLIANCE));
        if (staff) return;

        // Candidates may update their own tasks.
        boolean isOwner = task.getCandidate() != null
                && task.getCandidate().getUser() != null
                && task.getCandidate().getUser().getId().equals(actor.getId());
        if (isOwner) return;

        throw new AccessDeniedException("Not allowed to update this onboarding task");
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    public OnboardingTaskResponse toResponse(OnboardingTask t) {
        LocalDate today = LocalDate.now();
        boolean overdue = t.getDueDate() != null
                && t.getStatus() != OnboardingTaskStatus.COMPLETED
                && t.getStatus() != OnboardingTaskStatus.NOT_APPLICABLE
                && t.getDueDate().isBefore(today);
        return OnboardingTaskResponse.builder()
                .id(t.getId())
                .taskKey(t.getTaskKey())
                .title(t.getTitle())
                .description(t.getDescription())
                .category(t.getCategory())
                .status(t.getStatus())
                .sortOrder(t.getSortOrder())
                .dueDate(t.getDueDate())
                .linkUrl(t.getLinkUrl())
                .completedAt(t.getCompletedAt())
                .completedByName(lookupUserName(t.getCompletedBy()))
                .offerId(t.getOffer() != null ? t.getOffer().getId() : null)
                .applicationId(t.getApplication() != null ? t.getApplication().getId() : null)
                .overdue(overdue)
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    private String lookupUserName(UUID userId) {
        if (userId == null) return null;
        return userRepository.findById(userId).map(User::getFullName).orElse(null);
    }

    // ── Audit log ───────────────────────────────────────────────────────────

    private Map<String, Object> snapshot(OnboardingTask t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("candidateId", t.getCandidate() != null ? t.getCandidate().getId() : null);
        m.put("offerId", t.getOffer() != null ? t.getOffer().getId() : null);
        m.put("applicationId", t.getApplication() != null ? t.getApplication().getId() : null);
        m.put("taskKey", t.getTaskKey());
        m.put("title", t.getTitle());
        m.put("category", t.getCategory());
        m.put("status", t.getStatus());
        m.put("sortOrder", t.getSortOrder());
        m.put("dueDate", t.getDueDate());
        m.put("linkUrl", t.getLinkUrl());
        m.put("completedAt", t.getCompletedAt());
        m.put("completedBy", t.getCompletedBy());
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
