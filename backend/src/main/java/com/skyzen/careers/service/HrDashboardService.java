package com.skyzen.careers.service;

import com.skyzen.careers.dto.hr.AuditFeedItemResponse;
import com.skyzen.careers.dto.hr.AuthExpiryItemResponse;
import com.skyzen.careers.dto.hr.ComplianceStatusBoardResponse;
import com.skyzen.careers.dto.hr.HrActionItemResponse;
import com.skyzen.careers.dto.hr.HrDashboardResponse;
import com.skyzen.careers.dto.hr.OfferStatusSummaryResponse;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.EVerifyCase;
import com.skyzen.careers.entity.I983Plan;
import com.skyzen.careers.entity.I9Form;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.EVerifyStatus;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.I983Status;
import com.skyzen.careers.enums.I9Status;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.EVerifyCaseRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.I983PlanRepository;
import com.skyzen.careers.repository.I9FormRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Aggregate read for the HR / Compliance command-center dashboard. Single
 * read-only transaction, pre-rendered summaries (no raw audit JSON), no
 * decrypted PII fields ever surfaced. Mirrors the
 * {@link CandidateDashboardService} / {@link OperationsDashboardService}
 * pattern: every dependency query runs inside the same transaction, the
 * response is always a fully-formed object.
 *
 * <h2>What this dashboard intentionally does NOT expose</h2>
 * <ul>
 *   <li>No raw SSN, A-Number, document numbers, DOB, or foreign passport —
 *       these live encrypted on the I-9 entity and are visible only on the
 *       gated detail pages.</li>
 *   <li>No audit-log export / download control — full audit-log export stays
 *       on the SUPER_ADMIN admin pages.</li>
 * </ul>
 *
 * <h2>Action queue (per task brief)</h2>
 * <ol>
 *   <li>I-9 §2 pending (employer step)</li>
 *   <li>E-Verify cases to create/resolve</li>
 *   <li>I-983 awaiting employer signature</li>
 *   <li>TNC cases to action</li>
 *   <li>Work-authorizations expiring soon (90-day window)</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class HrDashboardService {

    private static final int AUDIT_FEED_LIMIT = 12;
    private static final int AUTH_EXPIRY_LIMIT = 10;
    private static final int AUTH_EXPIRY_WINDOW_DAYS = 180;
    private static final int ACTION_QUEUE_EXPIRY_WINDOW_DAYS = 90;
    private static final long OFFER_ACCEPTED_WINDOW_MS = 30L * 86_400_000L;

    /** I-9 statuses that mean "HR must enter Section 2." */
    private static final Set<I9Status> I9_SECTION_2_PENDING_STATES = EnumSet.of(
            I9Status.SECTION_2_PENDING,
            I9Status.SECTION_1_COMPLETE);

    /** E-Verify states meaning "Open" — pending submission or in-progress. */
    private static final Set<EVerifyStatus> EVERIFY_OPEN_STATES = EnumSet.of(
            EVerifyStatus.PENDING_SUBMISSION,
            EVerifyStatus.OPEN);

    /** E-Verify states meaning "TNC needs action" — both flavours. */
    private static final Set<EVerifyStatus> EVERIFY_TNC_STATES = EnumSet.of(
            EVerifyStatus.TENTATIVE_NONCONFIRMATION,
            EVerifyStatus.FINAL_NONCONFIRMATION);

    /** I-983 states meaning "plan in flight" — anything that's not the
     *  DSO-approved terminal state or the DSO-rejected dead-end. */
    private static final Set<I983Status> I983_IN_PROGRESS_STATES = EnumSet.of(
            I983Status.DRAFT,
            I983Status.COMPLETE,
            I983Status.SUBMITTED_TO_DSO,
            I983Status.AMENDMENT_REQUESTED);

    /** Audit entity types treated as "compliance-relevant" for the feed. */
    private static final Set<String> COMPLIANCE_ENTITY_TYPES = Set.of(
            "I9Form", "I983Plan", "EVerifyCase", "Offer");

    private final I9FormRepository i9FormRepository;
    private final I983PlanRepository i983PlanRepository;
    private final EVerifyCaseRepository everifyCaseRepository;
    private final OfferRepository offerRepository;
    private final EngagementRepository engagementRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public HrDashboardResponse build(User caller) {
        String operatorName = (caller != null) ? caller.getFullName() : null;

        // Load lists once; every downstream method reads from these in-memory.
        // Acceptable for v1 demo scale — matches the existing
        // ComplianceOverviewService approach. When the data set grows, the
        // hot reads here become countBy* repository methods.
        List<I9Form> i9s = i9FormRepository.findAll();
        List<I983Plan> i983s = i983PlanRepository.findAll();
        List<EVerifyCase> everifys = everifyCaseRepository.findAll();
        List<Offer> offers = offerRepository.findAll();

        LocalDate today = LocalDate.now();

        List<HrActionItemResponse> needsAttention = buildActionQueue(i9s, i983s, everifys, today);
        ComplianceStatusBoardResponse statusBoard = buildStatusBoard(i9s, i983s, everifys);
        List<AuthExpiryItemResponse> authExpiry = buildAuthExpiry(i9s, i983s, today);
        OfferStatusSummaryResponse offerStatus = buildOfferStatus(offers);
        List<AuditFeedItemResponse> auditFeed = buildAuditFeed();

        return HrDashboardResponse.builder()
                .operatorName(operatorName)
                .needsAttention(needsAttention)
                .statusBoard(statusBoard)
                .authExpiry(authExpiry)
                .offerStatus(offerStatus)
                .auditFeed(auditFeed)
                .build();
    }

    // ── Action queue ────────────────────────────────────────────────────────

    private List<HrActionItemResponse> buildActionQueue(List<I9Form> i9s,
                                                       List<I983Plan> i983s,
                                                       List<EVerifyCase> everifys,
                                                       LocalDate today) {
        List<HrActionItemResponse> out = new ArrayList<>(5);

        long section2Pending = i9s.stream()
                .filter(f -> I9_SECTION_2_PENDING_STATES.contains(f.getStatus()))
                .count();
        out.add(HrActionItemResponse.builder()
                .key("I9_SECTION_2_PENDING")
                .label("I-9 Section 2 to complete")
                .count(section2Pending)
                .href("/careers/hr/i9-everify")
                .build());

        long everifyOpenOrPending = everifys.stream()
                .filter(c -> EVERIFY_OPEN_STATES.contains(c.getStatus()))
                .count();
        out.add(HrActionItemResponse.builder()
                .key("EVERIFY_TO_ACTION")
                .label("E-Verify cases to create or resolve")
                .count(everifyOpenOrPending)
                .href("/careers/hr/i9-everify")
                .build());

        // "Awaiting employer signature" = student has signed (or plan past
        // DRAFT), employer hasn't. employerSignedAt null + status != DSO_*
        // terminal is the cleanest predicate.
        long awaitingEmployerSig = i983s.stream()
                .filter(p -> p.getEmployerSignedAt() == null)
                .filter(p -> p.getStatus() != I983Status.DSO_APPROVED
                        && p.getStatus() != I983Status.DSO_REJECTED)
                .count();
        out.add(HrActionItemResponse.builder()
                .key("I983_AWAITING_EMPLOYER")
                .label("I-983 plans awaiting employer signature")
                .count(awaitingEmployerSig)
                .href("/careers/erm/training-plans")
                .build());

        long tncCases = everifys.stream()
                .filter(c -> EVERIFY_TNC_STATES.contains(c.getStatus()))
                .count();
        out.add(HrActionItemResponse.builder()
                .key("TNC_TO_ACTION")
                .label("Tentative Nonconfirmation cases to action")
                .count(tncCases)
                .href("/careers/hr/i9-everify")
                .build());

        LocalDate expiryCutoff = today.plusDays(ACTION_QUEUE_EXPIRY_WINDOW_DAYS);
        long expiringSoon = countDistinctCandidatesExpiringBefore(i9s, i983s, today, expiryCutoff);
        out.add(HrActionItemResponse.builder()
                .key("WORK_AUTH_EXPIRING")
                .label("Work authorizations expiring soon")
                .count(expiringSoon)
                .href("/careers/hr/compliance")
                .build());

        return out;
    }

    private long countDistinctCandidatesExpiringBefore(List<I9Form> i9s,
                                                       List<I983Plan> i983s,
                                                       LocalDate today,
                                                       LocalDate cutoff) {
        Set<UUID> candidates = new java.util.HashSet<>();
        for (I9Form f : i9s) {
            LocalDate d = f.getWorkAuthExpirationDate();
            if (d == null) continue;
            if (d.isBefore(today) || d.isAfter(cutoff)) continue;
            if (f.getCandidate() != null && f.getCandidate().getId() != null) {
                candidates.add(f.getCandidate().getId());
            }
        }
        for (I983Plan p : i983s) {
            LocalDate d = p.getOptEndDate();
            if (d == null) continue;
            if (d.isBefore(today) || d.isAfter(cutoff)) continue;
            if (p.getCandidate() != null && p.getCandidate().getId() != null) {
                candidates.add(p.getCandidate().getId());
            }
        }
        return candidates.size();
    }

    // ── Status board ────────────────────────────────────────────────────────

    private ComplianceStatusBoardResponse buildStatusBoard(List<I9Form> i9s,
                                                          List<I983Plan> i983s,
                                                          List<EVerifyCase> everifys) {
        long offerAccepted = engagementRepository.countByStatus(EngagementStatus.PENDING_COMPLIANCE);

        long i983InProgress = i983s.stream()
                .filter(p -> I983_IN_PROGRESS_STATES.contains(p.getStatus()))
                .count();

        long section1Pending = i9s.stream()
                .filter(f -> f.getStatus() == I9Status.NOT_STARTED)
                .count();

        long section2Pending = i9s.stream()
                .filter(f -> I9_SECTION_2_PENDING_STATES.contains(f.getStatus()))
                .count();

        long everifyOpen = everifys.stream()
                .filter(c -> EVERIFY_OPEN_STATES.contains(c.getStatus()))
                .count();

        long cleared = engagementRepository.countByStatus(EngagementStatus.ACTIVE);

        return ComplianceStatusBoardResponse.builder()
                .offerAccepted(offerAccepted)
                .i983InProgress(i983InProgress)
                .i9Section1Pending(section1Pending)
                .i9Section2Pending(section2Pending)
                .everifyOpen(everifyOpen)
                .cleared(cleared)
                .build();
    }

    // ── Authorization expiry reminders ──────────────────────────────────────

    private List<AuthExpiryItemResponse> buildAuthExpiry(List<I9Form> i9s,
                                                         List<I983Plan> i983s,
                                                         LocalDate today) {
        LocalDate window = today.plusDays(AUTH_EXPIRY_WINDOW_DAYS);
        List<AuthExpiryItemResponse> rows = new ArrayList<>();

        for (I9Form f : i9s) {
            LocalDate d = f.getWorkAuthExpirationDate();
            if (d == null || d.isAfter(window)) continue;
            // Past-expired rows stay in the list — they're the most urgent.
            String name = candidateName(f.getCandidate());
            UUID candidateId = (f.getCandidate() != null) ? f.getCandidate().getId() : null;
            rows.add(AuthExpiryItemResponse.builder()
                    .candidateId(candidateId)
                    .candidateName(name)
                    .authType("Work authorization")
                    .expirationDate(d)
                    .daysUntilExpiry((int) ChronoUnit.DAYS.between(today, d))
                    .linkUrl("/careers/hr/i9-everify/i9/" + f.getId())
                    .build());
        }

        for (I983Plan p : i983s) {
            LocalDate d = p.getOptEndDate();
            if (d == null || d.isAfter(window)) continue;
            String name = candidateName(p.getCandidate());
            UUID candidateId = (p.getCandidate() != null) ? p.getCandidate().getId() : null;
            rows.add(AuthExpiryItemResponse.builder()
                    .candidateId(candidateId)
                    .candidateName(name)
                    .authType("STEM OPT")
                    .expirationDate(d)
                    .daysUntilExpiry((int) ChronoUnit.DAYS.between(today, d))
                    .linkUrl("/careers/erm/training-plans/" + p.getId())
                    .build());
        }

        rows.sort(Comparator.comparing(AuthExpiryItemResponse::getExpirationDate,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return rows.size() > AUTH_EXPIRY_LIMIT ? rows.subList(0, AUTH_EXPIRY_LIMIT) : rows;
    }

    // ── Offer status summary ────────────────────────────────────────────────

    private OfferStatusSummaryResponse buildOfferStatus(List<Offer> offers) {
        Instant cutoff = Instant.now().minusMillis(OFFER_ACCEPTED_WINDOW_MS);

        long sent = offers.stream()
                .filter(o -> o.getStatus() == OfferStatus.SENT)
                .count();
        long pending = offers.stream()
                .filter(o -> o.getStatus() == OfferStatus.DRAFT)
                .count();
        long accepted = offers.stream()
                .filter(o -> o.getStatus() == OfferStatus.ACCEPTED
                        && o.getRespondedAt() != null
                        && !o.getRespondedAt().isBefore(cutoff))
                .count();

        return OfferStatusSummaryResponse.builder()
                .sent(sent)
                .accepted(accepted)
                .pending(pending)
                .build();
    }

    // ── Audit feed (read-only, compliance-only) ─────────────────────────────

    private List<AuditFeedItemResponse> buildAuditFeed() {
        List<AuditLog> entries = auditLogRepository.findTop25ByOrderByTimestampDesc();
        Map<UUID, User> userCache = new HashMap<>();
        List<AuditFeedItemResponse> out = new ArrayList<>(AUDIT_FEED_LIMIT);
        for (AuditLog a : entries) {
            if (a.getEntityType() == null || !COMPLIANCE_ENTITY_TYPES.contains(a.getEntityType())) {
                continue;
            }
            User performer = null;
            if (a.getUserId() != null) {
                performer = userCache.computeIfAbsent(
                        a.getUserId(),
                        id -> userRepository.findById(id).orElse(null));
            }
            String performerName = (performer != null) ? performer.getFullName() : "System";
            out.add(AuditFeedItemResponse.builder()
                    .timestamp(a.getTimestamp())
                    .summary(summarize(a, performerName))
                    .entityType(a.getEntityType())
                    .linkUrl(linkFor(a))
                    .build());
            if (out.size() >= AUDIT_FEED_LIMIT) break;
        }
        return out;
    }

    /**
     * Compact pre-rendered summary for an audit row. Mirrors the format
     * already used by {@link ComplianceOverviewService} so the two dashboards
     * read consistently — never includes raw before/after JSON or any PII.
     */
    private static String summarize(AuditLog a, String performerName) {
        String type = a.getEntityType();
        String action = a.getAction();
        if (type == null) return action;
        return switch (type) {
            case "I9Form" -> switch (action) {
                case "CREATE" -> "I-9 form created";
                case "SECTION_1_DRAFT_SAVE" -> "I-9 Section 1 draft saved";
                case "SECTION_1_SUBMIT" -> "I-9 Section 1 submitted by " + performerName;
                case "SECTION_2_DRAFT_SAVE" -> "I-9 Section 2 draft saved";
                case "SECTION_2_SUBMIT" -> "I-9 Section 2 completed by " + performerName;
                case "REOPEN" -> "I-9 reopened by " + performerName;
                default -> "I-9 " + action;
            };
            case "I983Plan" -> switch (action) {
                case "CREATE" -> "I-983 plan created by " + performerName;
                case "UPDATE_FIELDS" -> "I-983 fields updated by " + performerName;
                case "SIGN_EMPLOYER" -> "I-983 signed by employer (" + performerName + ")";
                case "SIGN_STUDENT" -> "I-983 signed by student (" + performerName + ")";
                case "SUBMIT_TO_DSO" -> "I-983 submitted to DSO by " + performerName;
                case "DSO_RESPONSE" -> "I-983 DSO response recorded by " + performerName;
                default -> "I-983 " + action;
            };
            case "EVerifyCase" -> switch (action) {
                case "CREATE" -> "E-Verify case created";
                case "UPDATE" -> "E-Verify case updated by " + performerName;
                case "STATUS_CHANGE" -> "E-Verify case status changed by " + performerName;
                case "CLOSE" -> "E-Verify case closed by " + performerName;
                default -> "E-Verify " + action;
            };
            case "Offer" -> switch (action) {
                case "CREATE" -> "Offer letter drafted by " + performerName;
                case "UPDATE" -> "Offer letter updated by " + performerName;
                case "SEND" -> "Offer sent by " + performerName;
                case "ACCEPT" -> "Offer accepted by " + performerName;
                case "DECLINE" -> "Offer declined by " + performerName;
                case "REVOKE" -> "Offer revoked by " + performerName;
                case "EXPIRE" -> "Offer expired";
                case "DELETE" -> "Offer deleted by " + performerName;
                default -> "Offer " + action;
            };
            default -> action + " (" + type + ")";
        };
    }

    private static String linkFor(AuditLog a) {
        if (a.getEntityType() == null || a.getEntityId() == null) return null;
        return switch (a.getEntityType()) {
            case "I9Form" -> "/careers/hr/i9-everify/i9/" + a.getEntityId();
            case "I983Plan" -> "/careers/erm/training-plans/" + a.getEntityId();
            case "Offer" -> "/careers/hr/offers/" + a.getEntityId();
            case "EVerifyCase" -> "/careers/hr/i9-everify/everify/" + a.getEntityId();
            default -> null;
        };
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static String candidateName(Candidate c) {
        if (c == null || c.getUser() == null) return "(unnamed candidate)";
        String name = c.getUser().getFullName();
        return name == null || name.isBlank() ? "(unnamed candidate)" : name;
    }
}
