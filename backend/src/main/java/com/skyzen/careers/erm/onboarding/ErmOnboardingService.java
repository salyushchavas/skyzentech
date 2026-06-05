package com.skyzen.careers.erm.onboarding;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.OnboardingItem;
import com.skyzen.careers.entity.OnboardingPacket;
import com.skyzen.careers.entity.OnboardingReviewLog;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.InternLifecycleStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.erm.ReasonCode;
import com.skyzen.careers.event.OnboardingAcceptedEvent;
import com.skyzen.careers.event.OnboardingItemReviewedEvent;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.intern.InternLifecycleService;
import com.skyzen.careers.intern.OnboardingService;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.OnboardingItemRepository;
import com.skyzen.careers.repository.OnboardingPacketRepository;
import com.skyzen.careers.repository.OnboardingReviewLogRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * ERM Phase 5 — onboarding document review. Mirrors the offer/interview ERM
 * services: list/detail/decide actions, immutable history log, audit, and
 * AFTER_COMMIT events that the email + in-app listeners fan out.
 *
 * <p>The legacy intern {@link OnboardingService#reviewItem} is still wired
 * for in-app intern actions; this service is the ERM-grade variant with
 * mandatory reason codes + bulk-review + reopen + history.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ErmOnboardingService {

    private static final int ERM_COMMENTS_MIN_REJECT = 20;
    private static final int BULK_MAX = 25;
    private static final Set<String> VALID_DECISIONS =
            Set.of("ACCEPT", "REJECT", "RESEND");

    private final OnboardingItemRepository itemRepository;
    private final OnboardingPacketRepository packetRepository;
    private final OnboardingReviewLogRepository reviewLogRepository;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final OnboardingService internOnboardingService;
    private final InternLifecycleService internLifecycleService;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;

    // ── Reads ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ErmOnboardingDtos.ReviewQueuePage listReviewQueue(
            String category, String search, int page, int pageSize) {
        int p = Math.max(0, page);
        int ps = Math.min(100, Math.max(1, pageSize));

        StringBuilder where = new StringBuilder(" WHERE oi.status = 'SUBMITTED' ");
        List<Object> params = new ArrayList<>();
        if (category != null && !category.isBlank()) {
            where.append(" AND oi.category = ? ");
            params.add(category.trim().toUpperCase());
        }
        if (search != null && !search.isBlank()) {
            where.append(" AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ?) ");
            String s = "%" + search.trim().toLowerCase() + "%";
            params.add(s);
            params.add(s);
        }

        long total;
        try {
            Long c = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM onboarding_items oi "
                            + "JOIN onboarding_packets pk ON pk.id = oi.packet_id "
                            + "JOIN users u ON u.id = pk.user_id" + where,
                    Long.class,
                    params.toArray());
            total = c == null ? 0L : c;
        } catch (Exception e) {
            log.warn("[ErmOnboarding] review-queue count failed: {}", e.getMessage());
            total = 0L;
        }

        List<Object> pageParams = new ArrayList<>(params);
        pageParams.add(ps);
        pageParams.add(p * ps);
        List<ErmOnboardingDtos.ReviewQueueRow> rows;
        try {
            rows = jdbc.query(
                    "SELECT oi.id AS item_id, oi.packet_id, pk.user_id AS applicant_user_id, "
                            + "       u.full_name, u.applicant_id, u.email, "
                            + "       oi.category, oi.status, oi.required, "
                            + "       oi.submitted_at, oi.last_reviewed_at, "
                            + "       oi.last_review_reason_code, oi.review_count "
                            + "  FROM onboarding_items oi "
                            + "  JOIN onboarding_packets pk ON pk.id = oi.packet_id "
                            + "  JOIN users u ON u.id = pk.user_id"
                            + where
                            + " ORDER BY oi.submitted_at ASC NULLS LAST "
                            + " LIMIT ? OFFSET ?",
                    pageParams.toArray(),
                    (rs, n) -> new ErmOnboardingDtos.ReviewQueueRow(
                            nullableUuid(rs.getString("item_id")),
                            nullableUuid(rs.getString("packet_id")),
                            nullableUuid(rs.getString("applicant_user_id")),
                            rs.getString("full_name"),
                            rs.getString("applicant_id"),
                            rs.getString("email"),
                            rs.getString("category"),
                            rs.getString("status"),
                            rs.getBoolean("required"),
                            instantOf(rs.getTimestamp("submitted_at")),
                            instantOf(rs.getTimestamp("last_reviewed_at")),
                            rs.getString("last_review_reason_code"),
                            (Integer) rs.getObject("review_count"),
                            daysWaiting(instantOf(rs.getTimestamp("submitted_at")))));
        } catch (Exception e) {
            log.warn("[ErmOnboarding] review-queue page failed: {}", e.getMessage());
            rows = List.of();
        }

        int totalPages = ps == 0 ? 0 : (int) Math.ceil((double) total / ps);
        return new ErmOnboardingDtos.ReviewQueuePage(rows, p, ps, total, totalPages);
    }

    @Transactional(readOnly = true)
    public ErmOnboardingDtos.PacketListPage listPackets(
            String status, String search, int page, int pageSize) {
        int p = Math.max(0, page);
        int ps = Math.min(100, Math.max(1, pageSize));

        StringBuilder where = new StringBuilder(" WHERE 1=1 ");
        List<Object> params = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            where.append(" AND pk.status = ? ");
            params.add(status.trim().toUpperCase());
        }
        if (search != null && !search.isBlank()) {
            where.append(" AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ?) ");
            String s = "%" + search.trim().toLowerCase() + "%";
            params.add(s);
            params.add(s);
        }

        long total;
        try {
            Long c = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM onboarding_packets pk "
                            + "JOIN users u ON u.id = pk.user_id" + where,
                    Long.class, params.toArray());
            total = c == null ? 0L : c;
        } catch (Exception e) {
            log.warn("[ErmOnboarding] packet-list count failed: {}", e.getMessage());
            total = 0L;
        }

        List<Object> pageParams = new ArrayList<>(params);
        pageParams.add(ps);
        pageParams.add(p * ps);
        List<ErmOnboardingDtos.PacketRow> rows;
        try {
            rows = jdbc.query(
                    "SELECT pk.id AS packet_id, pk.user_id, u.full_name, u.applicant_id, pk.status, "
                            + "       (SELECT COUNT(*) FROM onboarding_items i WHERE i.packet_id = pk.id) AS total_items, "
                            + "       (SELECT COUNT(*) FROM onboarding_items i WHERE i.packet_id = pk.id AND i.status = 'ACCEPTED') AS accepted_items, "
                            + "       (SELECT COUNT(*) FROM onboarding_items i WHERE i.packet_id = pk.id AND i.status = 'SUBMITTED') AS pending_items, "
                            + "       (SELECT COUNT(*) FROM onboarding_items i WHERE i.packet_id = pk.id AND i.status IN ('REJECTED','RESEND_REQUESTED')) AS rejected_items, "
                            + "       pk.assigned_at, pk.accepted_at "
                            + "  FROM onboarding_packets pk "
                            + "  JOIN users u ON u.id = pk.user_id"
                            + where
                            + " ORDER BY pk.assigned_at DESC NULLS LAST "
                            + " LIMIT ? OFFSET ?",
                    pageParams.toArray(),
                    (rs, n) -> new ErmOnboardingDtos.PacketRow(
                            nullableUuid(rs.getString("packet_id")),
                            nullableUuid(rs.getString("user_id")),
                            rs.getString("full_name"),
                            rs.getString("applicant_id"),
                            rs.getString("status"),
                            rs.getInt("total_items"),
                            rs.getInt("accepted_items"),
                            rs.getInt("pending_items"),
                            rs.getInt("rejected_items"),
                            instantOf(rs.getTimestamp("assigned_at")),
                            instantOf(rs.getTimestamp("accepted_at"))));
        } catch (Exception e) {
            log.warn("[ErmOnboarding] packet-list page failed: {}", e.getMessage());
            rows = List.of();
        }

        int totalPages = ps == 0 ? 0 : (int) Math.ceil((double) total / ps);
        return new ErmOnboardingDtos.PacketListPage(rows, p, ps, total, totalPages);
    }

    @Transactional(readOnly = true)
    public ErmOnboardingDtos.PacketDetail getPacketDetail(UUID packetId) {
        OnboardingPacket packet = packetRepository.findById(packetId)
                .orElseThrow(() -> new ResourceNotFoundException("Packet not found: " + packetId));
        User applicant = userRepository.findById(packet.getUserId()).orElse(null);
        List<OnboardingItem> items = itemRepository.findByPacketIdOrderByCategoryAsc(packetId);
        List<ErmOnboardingDtos.ItemSummary> summaries = new ArrayList<>();
        for (OnboardingItem it : items) {
            summaries.add(new ErmOnboardingDtos.ItemSummary(
                    it.getId(), it.getCategory(), it.getStatus(), it.getRequired(),
                    it.getSubmittedAt(), it.getLastReviewedAt(),
                    it.getLastReviewReasonCode(), it.getReviewCount()));
        }
        return new ErmOnboardingDtos.PacketDetail(
                packet.getId(),
                packet.getUserId(),
                applicant != null ? applicant.getFullName() : null,
                applicant != null ? applicant.getApplicantId() : null,
                applicant != null ? applicant.getEmail() : null,
                packet.getStatus(),
                packet.getAssignedAt(),
                packet.getAcceptedAt(),
                summaries);
    }

    @Transactional
    public ErmOnboardingDtos.ItemDetail getItemDetail(UUID itemId, User caller) {
        requireErm(caller);
        OnboardingItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found: " + itemId));
        OnboardingPacket packet = packetRepository.findById(item.getPacketId()).orElse(null);
        User applicant = packet != null
                ? userRepository.findById(packet.getUserId()).orElse(null) : null;

        Map<String, Object> formData;
        try {
            formData = internOnboardingService.getItemFormData(itemId, caller);
        } catch (Exception e) {
            log.warn("[ErmOnboarding] getItemFormData failed for item {}: {}",
                    itemId, e.getMessage());
            formData = Map.of();
        }

        List<ErmOnboardingDtos.ReviewLogEntry> history = new ArrayList<>();
        try {
            for (OnboardingReviewLog l : reviewLogRepository
                    .findByOnboardingItemIdOrderByCreatedAtDesc(itemId)) {
                User actor = l.getActorUserId() != null
                        ? userRepository.findById(l.getActorUserId()).orElse(null) : null;
                history.add(new ErmOnboardingDtos.ReviewLogEntry(
                        l.getId(), l.getActorUserId(),
                        actor != null ? actor.getFullName() : null,
                        l.getDecision(), l.getReasonCode(), l.getReasonText(),
                        l.getPreviousStatus(), l.getNewStatus(),
                        l.getErmCommentsSnapshot(), l.getCreatedAt()));
            }
        } catch (Exception ignored) {}

        return new ErmOnboardingDtos.ItemDetail(
                item.getId(),
                item.getPacketId(),
                packet != null ? packet.getUserId() : null,
                applicant != null ? applicant.getFullName() : null,
                applicant != null ? applicant.getEmail() : null,
                item.getCategory(),
                item.getStatus(),
                item.getRequired(),
                item.getSubmittedAt(),
                item.getDocumentId(),
                item.getErmComments(),
                item.getInternalNotes(),
                item.getLastReviewedAt(),
                item.getLastReviewedById(),
                item.getLastReviewReasonCode(),
                item.getLastReviewReasonText(),
                item.getReviewCount(),
                formData,
                history);
    }

    // ── Decisions ────────────────────────────────────────────────────────

    @Transactional
    public ErmOnboardingDtos.ItemDetail reviewItem(
            UUID itemId, ErmOnboardingDtos.ReviewRequest req, User caller) {
        requireErm(caller);
        if (req == null || req.decision() == null) {
            throw new BadRequestException("decision is required");
        }
        String decision = req.decision().trim().toUpperCase();
        if (!VALID_DECISIONS.contains(decision)) {
            throw new BadRequestException(
                    "decision must be one of " + VALID_DECISIONS);
        }
        OnboardingItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found: " + itemId));
        if (!"SUBMITTED".equals(item.getStatus())) {
            throw new ConflictException("Item must be SUBMITTED to review (current: "
                    + item.getStatus() + ")");
        }
        if (!"ACCEPT".equals(decision)) {
            if (req.ermComments() == null
                    || req.ermComments().trim().length() < ERM_COMMENTS_MIN_REJECT) {
                throw new BadRequestException(
                        "erm_comments must be at least " + ERM_COMMENTS_MIN_REJECT
                                + " characters on REJECT/RESEND");
            }
        }
        ReasonCode reasonCode = resolveReason(req.reasonCode(), req.reasonText(), decision);

        String previousStatus = item.getStatus();
        switch (decision) {
            case "ACCEPT" -> item.setStatus("ACCEPTED");
            case "REJECT" -> item.setStatus("REJECTED");
            case "RESEND" -> item.setStatus("RESEND_REQUESTED");
        }
        Instant now = Instant.now();
        item.setReviewedAt(now);
        item.setReviewedById(caller.getId());
        item.setLastReviewedAt(now);
        item.setLastReviewedById(caller.getId());
        item.setLastReviewReasonCode(reasonCode != null ? reasonCode.name() : null);
        item.setLastReviewReasonText(safeTrim(req.reasonText()));
        item.setReviewCount((item.getReviewCount() == null ? 0 : item.getReviewCount()) + 1);
        if (req.ermComments() != null) item.setErmComments(req.ermComments().trim());
        if (req.internalNotes() != null) item.setInternalNotes(req.internalNotes().trim());
        OnboardingItem saved = itemRepository.save(item);

        appendReviewLog(saved.getId(), caller.getId(), decision,
                reasonCode, req.reasonText(),
                previousStatus, saved.getStatus(),
                saved.getErmComments());

        // Packet side effects: ACCEPT may complete the packet; REJECT/RESEND
        // bumps packet back to IN_REVIEW.
        OnboardingPacket packet = packetRepository.findById(saved.getPacketId()).orElse(null);
        if (packet != null) {
            if ("ACCEPT".equals(decision)) {
                maybeCompletePacket(packet, caller);
            } else if (!"ACCEPTED".equals(packet.getStatus())) {
                packet.setStatus("IN_REVIEW");
                packetRepository.save(packet);
            }
        }

        writeAudit("OnboardingItem", saved.getId(), "ERM_REVIEW_" + decision,
                caller.getId(),
                packet != null ? packet.getUserId() : null,
                Map.of("status", previousStatus, "version", saved.getVersion()),
                Map.of("status", saved.getStatus(),
                        "reasonCode", reasonCode != null ? reasonCode.name() : null));

        try {
            eventPublisher.publishEvent(new OnboardingItemReviewedEvent(
                    saved.getId(),
                    packet != null ? packet.getUserId() : null,
                    saved.getCategory(),
                    decision));
        } catch (Exception e) {
            log.warn("[ErmOnboarding] event publish failed: {}", e.getMessage());
        }
        return getItemDetail(saved.getId(), caller);
    }

    @Transactional
    public ErmOnboardingDtos.BulkReviewResult bulkReview(
            ErmOnboardingDtos.BulkReviewRequest req, User caller) {
        requireErm(caller);
        if (req == null || req.itemIds() == null || req.itemIds().isEmpty()) {
            throw new BadRequestException("itemIds is required");
        }
        if (req.itemIds().size() > BULK_MAX) {
            throw new BadRequestException("Bulk review limited to " + BULK_MAX + " items per call");
        }
        String decision = req.decision() == null ? "" : req.decision().trim().toUpperCase();
        if (!"ACCEPT".equals(decision)) {
            throw new BadRequestException(
                    "Bulk review only supports ACCEPT; reject/resend require per-item comments");
        }
        int accepted = 0;
        List<ErmOnboardingDtos.BulkSkipReason> skipped = new ArrayList<>();
        for (UUID id : req.itemIds()) {
            try {
                ErmOnboardingDtos.ReviewRequest single = new ErmOnboardingDtos.ReviewRequest(
                        "ACCEPT",
                        req.reasonCode(),
                        req.reasonText(),
                        null,
                        null);
                reviewItem(id, single, caller);
                accepted++;
            } catch (RuntimeException e) {
                skipped.add(new ErmOnboardingDtos.BulkSkipReason(id, e.getMessage()));
            }
        }
        return new ErmOnboardingDtos.BulkReviewResult(accepted, skipped.size(), skipped);
    }

    @Transactional
    public ErmOnboardingDtos.ItemDetail reopenItem(
            UUID itemId, String reasonText, User caller) {
        requireSuperAdmin(caller);
        if (reasonText == null || reasonText.trim().length() < 10) {
            throw new BadRequestException(
                    "reasonText must be at least 10 characters to reopen an item");
        }
        OnboardingItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found: " + itemId));
        if (!Set.of("ACCEPTED", "REJECTED", "RESEND_REQUESTED").contains(item.getStatus())) {
            throw new ConflictException("Only ACCEPTED/REJECTED/RESEND_REQUESTED items may be reopened");
        }
        String previousStatus = item.getStatus();
        item.setStatus("SUBMITTED");
        Instant now = Instant.now();
        item.setLastReviewedAt(now);
        item.setLastReviewedById(caller.getId());
        item.setLastReviewReasonCode(null);
        item.setLastReviewReasonText(reasonText.trim());
        OnboardingItem saved = itemRepository.save(item);

        appendReviewLog(saved.getId(), caller.getId(), "RE_OPEN",
                null, reasonText, previousStatus, saved.getStatus(),
                saved.getErmComments());

        OnboardingPacket packet = packetRepository.findById(saved.getPacketId()).orElse(null);
        if (packet != null && "ACCEPTED".equals(packet.getStatus())) {
            // Re-opening an item in an accepted packet drops the packet back
            // to IN_REVIEW. The lifecycle reversal is logged at INFO.
            packet.setStatus("IN_REVIEW");
            packet.setAcceptedAt(null);
            packetRepository.save(packet);
            log.info("[ErmOnboarding] packet={} dropped ACCEPTED→IN_REVIEW (SUPER_ADMIN reopen of item={})",
                    packet.getId(), saved.getId());
        }

        writeAudit("OnboardingItem", saved.getId(), "REOPEN",
                caller.getId(),
                packet != null ? packet.getUserId() : null,
                Map.of("status", previousStatus),
                Map.of("status", saved.getStatus()));

        return getItemDetail(saved.getId(), caller);
    }

    @Transactional
    public ErmOnboardingDtos.ItemDetail addInternalNote(
            UUID itemId, ErmOnboardingDtos.InternalNoteRequest req, User caller) {
        requireErm(caller);
        if (req == null || req.internalNotes() == null
                || req.internalNotes().trim().isEmpty()) {
            throw new BadRequestException("internalNotes is required");
        }
        OnboardingItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found: " + itemId));
        item.setInternalNotes(req.internalNotes().trim());
        OnboardingItem saved = itemRepository.save(item);

        appendReviewLog(saved.getId(), caller.getId(), "NOTE_ADDED",
                null, req.internalNotes(),
                saved.getStatus(), saved.getStatus(), saved.getErmComments());

        writeAudit("OnboardingItem", saved.getId(), "INTERNAL_NOTE",
                caller.getId(), null, null, null);
        return getItemDetail(saved.getId(), caller);
    }

    // ── Reason codes ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ErmOnboardingDtos.ReasonCodeGroup> listReasonCodes() {
        Set<ReasonCode.Category> cats =
                EnumSet.of(ReasonCode.Category.DOCUMENT_REJECT);
        Map<ReasonCode.Category, List<ErmOnboardingDtos.ReasonCodeOption>> bucket =
                new LinkedHashMap<>();
        for (ReasonCode rc : ReasonCode.values()) {
            if (!cats.contains(rc.category())) continue;
            bucket.computeIfAbsent(rc.category(), k -> new ArrayList<>())
                    .add(new ErmOnboardingDtos.ReasonCodeOption(
                            rc.name(), rc.humanLabel(), rc.requiresFreeText()));
        }
        List<ErmOnboardingDtos.ReasonCodeGroup> out = new ArrayList<>();
        for (var e : bucket.entrySet()) {
            out.add(new ErmOnboardingDtos.ReasonCodeGroup(e.getKey().name(), e.getValue()));
        }
        return out;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private ReasonCode resolveReason(String code, String freeText, String decision) {
        if ("ACCEPT".equals(decision)) return null;
        if (code == null || code.isBlank()) {
            throw new BadRequestException("reasonCode is required on REJECT/RESEND");
        }
        ReasonCode rc;
        try {
            rc = ReasonCode.valueOf(code.trim());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown reasonCode: " + code);
        }
        if (rc.category() != ReasonCode.Category.DOCUMENT_REJECT) {
            throw new BadRequestException(
                    "reasonCode must be in DOCUMENT_REJECT family for onboarding review");
        }
        if (rc.requiresFreeText() && (freeText == null || freeText.trim().length() < 10)) {
            throw new BadRequestException(
                    "reasonText is required (≥10 chars) for reasonCode " + rc.name());
        }
        return rc;
    }

    private void appendReviewLog(UUID itemId, UUID actorId, String decision,
                                  ReasonCode reasonCode, String reasonText,
                                  String previousStatus, String newStatus,
                                  String ermCommentsSnapshot) {
        try {
            reviewLogRepository.save(OnboardingReviewLog.builder()
                    .onboardingItemId(itemId)
                    .actorUserId(actorId)
                    .decision(decision)
                    .reasonCode(reasonCode != null ? reasonCode.name() : null)
                    .reasonText(safeTrim(reasonText))
                    .previousStatus(previousStatus)
                    .newStatus(newStatus)
                    .ermCommentsSnapshot(ermCommentsSnapshot)
                    .build());
        } catch (Exception e) {
            log.warn("[ErmOnboarding] review-log append failed for item {}: {}",
                    itemId, e.getMessage());
        }
    }

    private void maybeCompletePacket(OnboardingPacket packet, User actor) {
        long pendingRequired = itemRepository
                .countByPacketIdAndRequiredTrueAndStatusNot(packet.getId(), "ACCEPTED");
        if (pendingRequired > 0) {
            if (!"IN_REVIEW".equals(packet.getStatus())
                    && !"IN_PROGRESS".equals(packet.getStatus())) {
                packet.setStatus("IN_REVIEW");
                packetRepository.save(packet);
            }
            return;
        }
        packet.setStatus("ACCEPTED");
        packet.setAcceptedAt(Instant.now());
        packetRepository.save(packet);

        User applicant = userRepository.findById(packet.getUserId()).orElse(null);
        if (applicant != null) {
            try {
                internLifecycleService.advance(applicant,
                        InternLifecycleStatus.ONBOARDING_ACCEPTED,
                        actor != null ? actor.getId() : null);
            } catch (Exception e) {
                log.warn("[ErmOnboarding] lifecycle advance failed (non-fatal): {}",
                        e.getMessage());
            }
        }
        try {
            eventPublisher.publishEvent(new OnboardingAcceptedEvent(
                    packet.getId(), packet.getUserId()));
        } catch (Exception e) {
            log.warn("[ErmOnboarding] OnboardingAcceptedEvent publish failed: {}", e.getMessage());
        }
        log.info("[ErmOnboarding] packet={} ACCEPTED — user={} lifecycle ONBOARDING_ACCEPTED",
                packet.getId(), packet.getUserId());
    }

    private void requireErm(User caller) {
        if (caller == null) throw new ForbiddenException("Caller required");
        if (!caller.getRoles().contains(UserRole.ERM)
                && !caller.getRoles().contains(UserRole.SUPER_ADMIN)) {
            throw new ForbiddenException("ERM or SUPER_ADMIN required");
        }
    }

    private void requireSuperAdmin(User caller) {
        if (caller == null || !caller.getRoles().contains(UserRole.SUPER_ADMIN)) {
            throw new ForbiddenException("SUPER_ADMIN required for reopen");
        }
    }

    private void writeAudit(String entityType, UUID entityId, String action,
                             UUID actorId, UUID subjectUserId,
                             Map<String, Object> before, Map<String, Object> after) {
        try {
            AuditLog row = AuditLog.builder()
                    .userId(actorId)
                    .subjectUserId(subjectUserId)
                    .entityType(entityType)
                    .entityId(entityId)
                    .action(action)
                    .beforeJson(before != null ? objectMapper.writeValueAsString(before) : null)
                    .afterJson(after != null ? objectMapper.writeValueAsString(after) : null)
                    .build();
            auditLogRepository.save(row);
        } catch (Exception e) {
            log.warn("[ErmOnboarding] audit write failed: {}", e.getMessage());
        }
    }

    private static String safeTrim(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static UUID nullableUuid(String s) {
        if (s == null || s.isBlank()) return null;
        try { return UUID.fromString(s); } catch (Exception e) { return null; }
    }

    private static Instant instantOf(java.sql.Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    private static Integer daysWaiting(Instant submittedAt) {
        if (submittedAt == null) return null;
        long secs = Duration.between(submittedAt, Instant.now()).getSeconds();
        return Math.max(0, (int) (secs / 86_400));
    }
}
