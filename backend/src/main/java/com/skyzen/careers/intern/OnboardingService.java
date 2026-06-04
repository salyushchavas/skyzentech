package com.skyzen.careers.intern;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.OnboardingItem;
import com.skyzen.careers.entity.OnboardingPacket;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.InternLifecycleStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.enums.WorkAuthTrack;
import com.skyzen.careers.event.OnboardingAcceptedEvent;
import com.skyzen.careers.event.OnboardingAssignedEvent;
import com.skyzen.careers.event.OnboardingItemReviewedEvent;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.OnboardingItemRepository;
import com.skyzen.careers.repository.OnboardingPacketRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.security.PiiEncryptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 4 onboarding orchestration. Owns:
 *
 * <ul>
 *   <li>{@link #assignPacket} — ERM creates the packet + items; advances
 *       applicant lifecycle to {@code ONBOARDING_ASSIGNED}.</li>
 *   <li>{@link #submitItem} — intern submits a typed form; encrypts PII
 *       fields; sets item status to SUBMITTED.</li>
 *   <li>{@link #reviewItem} — ERM accepts / rejects / requests resubmit;
 *       drives the packet-level checkAllAccepted.</li>
 *   <li>{@link #checkAllAccepted} — when all required items are ACCEPTED,
 *       flips packet to ACCEPTED and applicant lifecycle to
 *       {@code ONBOARDING_ACCEPTED}.</li>
 * </ul>
 *
 * Sensitive form fields (SSN, DOB, bank/account numbers, government ID
 * numbers) are stored as a single AES-256-GCM-encrypted JSON envelope on
 * {@link OnboardingItem#getFormDataJson()}. PII categories (W4, I9, ACH)
 * write the envelope encrypted; non-PII categories (HANDBOOK_ACK,
 * EMERGENCY_CONTACT) store plain JSON. Every read by a staff actor writes
 * an AuditLog row.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingService {

    public static final List<String> BASE_REQUIRED_CATEGORIES = List.of(
            "W4", "I9", "ACH", "EMERGENCY_CONTACT", "HANDBOOK_ACK");
    public static final String I983_CATEGORY = "I983";

    private static final java.util.Set<String> PII_CATEGORIES = java.util.Set.of("W4", "I9", "ACH");

    private static final TypeReference<Map<String, Object>> JSON_MAP_TYPE =
            new TypeReference<>() {};

    private final OnboardingPacketRepository packetRepository;
    private final OnboardingItemRepository itemRepository;
    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final InternLifecycleRepository internLifecycleRepository;
    private final AuditLogRepository auditLogRepository;
    private final InternLifecycleService internLifecycleService;
    private final PiiEncryptionService piiEncryption;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    // ── ERM commands ────────────────────────────────────────────────────────

    /**
     * ERM-driven packet assignment. Caller must be ERM/SUPER_ADMIN; the
     * controller enforces that.
     */
    @Transactional
    public OnboardingPacket assignPacket(UUID applicantUserId, User actor) {
        User applicant = userRepository.findById(applicantUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found: " + applicantUserId));
        InternLifecycleStatus s = applicant.getLifecycleStatus();
        if (s != InternLifecycleStatus.EMPLOYEE_ID_CREATED) {
            throw new ConflictException(
                    "Packet assignment requires lifecycle_status=EMPLOYEE_ID_CREATED (current: "
                            + s + ")");
        }
        if (packetRepository.existsByUserId(applicantUserId)) {
            throw new ConflictException("User already has an onboarding packet");
        }
        InternLifecycle lc = internLifecycleRepository.findByUserId(applicantUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle missing for user " + applicantUserId
                                + " — Phase 3 should have created it on offer signature"));

        Candidate candidate = candidateRepository.findByUserId(applicantUserId).orElse(null);
        boolean stemOpt = candidate != null
                && candidate.getExpectedTrack() == WorkAuthTrack.STEM_OPT;

        OnboardingPacket packet = OnboardingPacket.builder()
                .userId(applicantUserId)
                .internLifecycleId(lc.getId())
                .status("ASSIGNED")
                .assignedById(actor != null ? actor.getId() : applicantUserId)
                .assignedAt(Instant.now())
                .build();
        packet = packetRepository.save(packet);

        List<String> categories = new ArrayList<>(BASE_REQUIRED_CATEGORIES);
        if (stemOpt) categories.add(I983_CATEGORY);
        for (String cat : categories) {
            OnboardingItem item = OnboardingItem.builder()
                    .packetId(packet.getId())
                    .category(cat)
                    .required(true)
                    .status("PENDING")
                    .version(1)
                    .build();
            itemRepository.save(item);
        }

        internLifecycleService.advance(applicant,
                InternLifecycleStatus.ONBOARDING_ASSIGNED,
                actor != null ? actor.getId() : null);

        writeAudit("OnboardingPacket", packet.getId(), "ASSIGN",
                actor != null ? actor.getId() : null, applicantUserId,
                null, Map.of("categories", categories));

        try {
            eventPublisher.publishEvent(new OnboardingAssignedEvent(
                    packet.getId(), applicantUserId));
        } catch (Exception e) {
            log.warn("OnboardingAssignedEvent publish failed (non-fatal): {}", e.getMessage());
        }
        log.info("[Onboarding] packet assigned user={} items={} stem_opt={}",
                applicantUserId, categories.size(), stemOpt);
        return packet;
    }

    /**
     * ERM review of a submitted item. {@code decision} is one of
     * {@code ACCEPT}, {@code REJECT}, {@code RESEND}.
     */
    @Transactional
    public OnboardingItem reviewItem(UUID itemId, String decision,
                                     String ermComments, String internalNotes,
                                     User actor) {
        if (decision == null) throw new BadRequestException("decision is required");
        String d = decision.trim().toUpperCase();
        if (!java.util.Set.of("ACCEPT", "REJECT", "RESEND").contains(d)) {
            throw new BadRequestException("decision must be ACCEPT, REJECT, or RESEND");
        }
        OnboardingItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found: " + itemId));
        if (!"SUBMITTED".equals(item.getStatus())) {
            throw new ConflictException(
                    "Item must be in SUBMITTED state to review (current: " + item.getStatus() + ")");
        }
        if (("REJECT".equals(d) || "RESEND".equals(d))
                && (ermComments == null || ermComments.trim().length() < 10)) {
            throw new BadRequestException("erm_comments must be at least 10 characters on REJECT/RESEND");
        }

        Map<String, Object> before = Map.of(
                "status", item.getStatus(),
                "version", item.getVersion());

        switch (d) {
            case "ACCEPT" -> item.setStatus("ACCEPTED");
            case "REJECT" -> item.setStatus("REJECTED");
            case "RESEND" -> item.setStatus("RESEND_REQUESTED");
        }
        item.setReviewedAt(Instant.now());
        item.setReviewedById(actor != null ? actor.getId() : null);
        if (ermComments != null) item.setErmComments(ermComments.trim());
        if (internalNotes != null) item.setInternalNotes(internalNotes.trim());
        OnboardingItem saved = itemRepository.save(item);

        // Packet status side effects.
        OnboardingPacket packet = packetRepository.findById(item.getPacketId()).orElse(null);
        if (packet != null) {
            if ("ACCEPT".equals(d)) {
                checkAllAccepted(packet, actor);
            } else if (!"ACCEPTED".equals(packet.getStatus())) {
                // REJECT/RESEND → packet returns to IN_REVIEW (or stays).
                packet.setStatus("IN_REVIEW");
                packetRepository.save(packet);
            }
        }

        writeAudit("OnboardingItem", saved.getId(), "REVIEW_" + d,
                actor != null ? actor.getId() : null,
                packet != null ? packet.getUserId() : null,
                before,
                Map.of("status", saved.getStatus()));

        try {
            eventPublisher.publishEvent(new OnboardingItemReviewedEvent(
                    saved.getId(),
                    packet != null ? packet.getUserId() : null,
                    saved.getCategory(),
                    d));
        } catch (Exception e) {
            log.warn("OnboardingItemReviewedEvent publish failed: {}", e.getMessage());
        }
        return saved;
    }

    /**
     * After an ACCEPT, check whether every required item is now ACCEPTED.
     * If so, flip packet status + applicant lifecycle and publish event.
     */
    private void checkAllAccepted(OnboardingPacket packet, User actor) {
        long pendingRequired = itemRepository
                .countByPacketIdAndRequiredTrueAndStatusNot(packet.getId(), "ACCEPTED");
        if (pendingRequired > 0) {
            // Still items outstanding — packet stays IN_PROGRESS or IN_REVIEW.
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
            internLifecycleService.advance(applicant,
                    InternLifecycleStatus.ONBOARDING_ACCEPTED,
                    actor != null ? actor.getId() : null);
        }
        try {
            eventPublisher.publishEvent(new OnboardingAcceptedEvent(
                    packet.getId(), packet.getUserId()));
        } catch (Exception e) {
            log.warn("OnboardingAcceptedEvent publish failed: {}", e.getMessage());
        }
        log.info("[Onboarding] packet={} ACCEPTED — user={} lifecycle ONBOARDING_ACCEPTED",
                packet.getId(), packet.getUserId());
    }

    // ── Intern commands ────────────────────────────────────────────────────

    @Transactional
    public OnboardingItem submitItem(UUID itemId, Map<String, Object> body, User caller) {
        OnboardingItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found: " + itemId));
        OnboardingPacket packet = packetRepository.findById(item.getPacketId())
                .orElseThrow(() -> new ResourceNotFoundException("Packet not found"));
        if (!caller.getId().equals(packet.getUserId())) {
            throw new ForbiddenException("Not your onboarding item");
        }
        // Allowed source states for a submit.
        java.util.Set<String> allowed = java.util.Set.of("PENDING", "REJECTED", "RESEND_REQUESTED");
        if (!allowed.contains(item.getStatus())) {
            throw new ConflictException(
                    "Item not submittable in status " + item.getStatus());
        }
        // Doc-spec: I-9 Section 1 cannot be completed before offer acceptance.
        if ("I9".equals(item.getCategory())) {
            InternLifecycleStatus s = caller.getLifecycleStatus();
            if (s == null || s.ordinal() < InternLifecycleStatus.EMPLOYEE_ID_CREATED.ordinal()) {
                throw new ConflictException(
                        "I-9 Section 1 requires offer acceptance (EMPLOYEE_ID_CREATED).");
            }
        }
        // Category-specific validation (light — full per-field validation
        // is enforced client-side; server enforces critical PII formats).
        validateBody(item.getCategory(), body);

        Map<String, Object> before = Map.of(
                "status", item.getStatus(),
                "version", item.getVersion());

        String json;
        try {
            json = objectMapper.writeValueAsString(body == null ? Map.of() : body);
        } catch (Exception e) {
            throw new BadRequestException("Invalid form body: " + e.getMessage());
        }
        String stored = PII_CATEGORIES.contains(item.getCategory())
                ? piiEncryption.encrypt(json)
                : json;
        item.setFormDataJson(stored);
        item.setStatus("SUBMITTED");
        item.setSubmittedAt(Instant.now());
        // Resubmit increments version.
        if ("REJECTED".equals(before.get("status"))
                || "RESEND_REQUESTED".equals(before.get("status"))) {
            item.setVersion(item.getVersion() == null ? 2 : item.getVersion() + 1);
        }
        OnboardingItem saved = itemRepository.save(item);

        // Packet status side effect: ASSIGNED → IN_PROGRESS on first submit.
        if ("ASSIGNED".equals(packet.getStatus())) {
            packet.setStatus("IN_PROGRESS");
            packetRepository.save(packet);
        }
        writeAudit("OnboardingItem", saved.getId(), "SUBMIT", caller.getId(),
                packet.getUserId(), before,
                Map.of("status", saved.getStatus(), "version", saved.getVersion()));
        return saved;
    }

    // ── Reads ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public OnboardingPacket getPacketForUser(UUID userId) {
        return packetRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No onboarding packet for user " + userId));
    }

    @Transactional(readOnly = true)
    public List<OnboardingItem> listItems(UUID packetId) {
        return itemRepository.findByPacketIdOrderByCategoryAsc(packetId);
    }

    /**
     * Returns decrypted form data for the caller's own item, or for an ERM /
     * MANAGER / SUPER_ADMIN with an audit-logged read. Trainer / Evaluator
     * never see encrypted-category data — 403.
     */
    @Transactional
    public Map<String, Object> getItemFormData(UUID itemId, User caller) {
        OnboardingItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found: " + itemId));
        OnboardingPacket packet = packetRepository.findById(item.getPacketId())
                .orElseThrow(() -> new ResourceNotFoundException("Packet not found"));

        boolean owner = caller.getId().equals(packet.getUserId());
        boolean staff = caller.getRoles().contains(UserRole.ERM)
                || caller.getRoles().contains(UserRole.MANAGER)
                || caller.getRoles().contains(UserRole.SUPER_ADMIN);
        if (!owner && !staff) {
            throw new ForbiddenException("Not allowed to read this onboarding item");
        }
        String stored = item.getFormDataJson();
        if (stored == null || stored.isBlank()) return Map.of();

        String json = PII_CATEGORIES.contains(item.getCategory())
                ? piiEncryption.decrypt(stored)
                : stored;
        Map<String, Object> result;
        try {
            result = objectMapper.readValue(json, JSON_MAP_TYPE);
        } catch (Exception e) {
            log.error("[Onboarding] decrypt/parse failed for item {}: {}", itemId, e.getMessage());
            throw new RuntimeException("Stored data unreadable for item " + itemId);
        }

        if (!owner && PII_CATEGORIES.contains(item.getCategory())) {
            writeAudit("OnboardingItem", item.getId(), "PII_DECRYPT",
                    caller.getId(), packet.getUserId(), null,
                    Map.of("category", item.getCategory(),
                           "sensitivity", "PII"));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Page<OnboardingItem> reviewQueue(Pageable pageable) {
        return itemRepository.findByStatusOrderBySubmittedAtAsc("SUBMITTED", pageable);
    }

    // ── Internals ──────────────────────────────────────────────────────────

    private void validateBody(String category, Map<String, Object> body) {
        if (body == null) throw new BadRequestException("body is required");
        switch (category) {
            case "W4" -> {
                requireString(body, "fullName");
                requireString(body, "addressLine1");
                requireString(body, "city");
                requireString(body, "state");
                requireString(body, "zip");
                String ssn = stringOrNull(body, "ssn");
                if (ssn == null || !ssn.replaceAll("[-\\s]", "").matches("^\\d{9}$")) {
                    throw new BadRequestException("ssn must be 9 digits");
                }
                requireString(body, "signatureName");
            }
            case "I9" -> {
                requireString(body, "legalFirstName");
                requireString(body, "legalLastName");
                requireString(body, "email");
                requireString(body, "citizenshipStatus");
                requireString(body, "employeeSignatureName");
            }
            case "ACH" -> {
                requireString(body, "accountHolderName");
                requireString(body, "bankName");
                String acctType = stringOrNull(body, "accountType");
                if (!"CHECKING".equals(acctType) && !"SAVINGS".equals(acctType)) {
                    throw new BadRequestException("accountType must be CHECKING or SAVINGS");
                }
                String routing = stringOrNull(body, "routingNumber");
                if (routing == null || !routing.matches("^\\d{9}$") || !abaChecksum(routing)) {
                    throw new BadRequestException("routingNumber must be 9 digits with valid ABA checksum");
                }
                String acct = stringOrNull(body, "accountNumber");
                if (acct == null || !acct.matches("^\\d{4,17}$")) {
                    throw new BadRequestException("accountNumber must be 4-17 digits");
                }
                // Derive last4 server-side so the intern never POSTs it separately.
                body.put("accountNumberLast4", acct.substring(acct.length() - 4));
            }
            case "EMERGENCY_CONTACT" -> {
                requireString(body, "contactName");
                requireString(body, "relationship");
                requireString(body, "phonePrimary");
            }
            case "HANDBOOK_ACK" -> {
                Object ack = body.get("acknowledged");
                if (!Boolean.TRUE.equals(ack)) {
                    throw new BadRequestException("acknowledged must be true");
                }
                requireString(body, "signatureName");
            }
            case "I983" -> {
                requireString(body, "trainingOpportunityTitle");
                requireString(body, "planStartDate");
                requireString(body, "planEndDate");
            }
            default -> throw new BadRequestException("Unknown category: " + category);
        }
    }

    private static boolean abaChecksum(String routing) {
        // Standard ABA checksum: 3*(d1+d4+d7) + 7*(d2+d5+d8) + (d3+d6+d9) mod 10 == 0.
        int[] d = new int[9];
        for (int i = 0; i < 9; i++) d[i] = routing.charAt(i) - '0';
        int sum = 3 * (d[0] + d[3] + d[6])
                + 7 * (d[1] + d[4] + d[7])
                + (d[2] + d[5] + d[8]);
        return sum % 10 == 0;
    }

    private static void requireString(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null || v.toString().trim().isEmpty()) {
            throw new BadRequestException(key + " is required");
        }
    }

    private static String stringOrNull(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private void writeAudit(String entityType, UUID entityId, String action,
                            UUID actorId, UUID subjectUserId,
                            Map<String, Object> before, Map<String, Object> after) {
        try {
            AuditLog entry = AuditLog.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .action(action)
                    .userId(actorId)
                    .subjectUserId(subjectUserId)
                    .beforeJson(before == null ? null : objectMapper.writeValueAsString(before))
                    .afterJson(after == null ? null : objectMapper.writeValueAsString(after))
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("[Onboarding] audit write failed: {}", e.getMessage());
        }
    }
}
