package com.skyzen.careers.erm.newhire;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.erm.offer.ErmOfferDtos;
import com.skyzen.careers.event.ReportingStructureAssignedEvent;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ERM Phase 4 — Prospective New Hire List + atomic reporting-structure
 * assignment. Per doc §3: ERM must wire Trainer + Evaluator + Manager
 * before the system advances lifecycle from EMPLOYEE_ID_CREATED to
 * ONBOARDING_ASSIGNED (enforcement happens server-side in
 * {@code OnboardingService.assignPacket}).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ErmNewHireService {

    private final InternLifecycleRepository lifecycleRepository;
    private final UserRepository userRepository;
    private final OfferRepository offerRepository;
    private final AuditLogRepository auditLogRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;

    // ── List ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ErmOfferDtos.NewHireListPage list(String tab, User caller,
                                              int page, int pageSize) {
        Pageable pageable = PageRequest.of(
                Math.max(0, page), Math.min(Math.max(1, pageSize), 100));
        StringBuilder where = new StringBuilder(
                " WHERE il.active_status = 'PROSPECTIVE' ");
        List<Object> params = new ArrayList<>();
        if ("pending".equalsIgnoreCase(tab)) {
            where.append(" AND il.reporting_structure_complete = FALSE ");
        } else if ("ready".equalsIgnoreCase(tab)
                || "pending-document-assignment".equalsIgnoreCase(tab)) {
            // ERM Phase 8.2 — interns waiting for ERM to send their docs:
            // reporting structure complete + no non-terminal packet.
            where.append(" AND il.reporting_structure_complete = TRUE "
                    + " AND NOT EXISTS (SELECT 1 FROM document_packets pk "
                    + "                   WHERE pk.intern_lifecycle_id = il.id "
                    + "                     AND pk.status NOT IN ('COMPLETED','CANCELLED')) ");
        } else if ("in-progress".equalsIgnoreCase(tab)) {
            // Packet assigned, intern actively filling / ERM actively reviewing.
            where.append(" AND EXISTS (SELECT 1 FROM document_packets pk "
                    + "                   WHERE pk.intern_lifecycle_id = il.id "
                    + "                     AND pk.status IN ('ASSIGNED','IN_PROGRESS','ALL_SUBMITTED')) ");
        }
        String base = "FROM intern_lifecycles il "
                + "JOIN users u ON u.id = il.user_id "
                + "LEFT JOIN users t ON t.id = il.trainer_id "
                + "LEFT JOIN users ev ON ev.id = il.evaluator_id "
                + "LEFT JOIN users m ON m.id = il.manager_id ";
        long total;
        try {
            Long v = jdbc.queryForObject("SELECT COUNT(*) " + base + where,
                    Long.class, params.toArray());
            total = v != null ? v : 0L;
        } catch (Exception e) {
            log.warn("[ErmNewHire] count failed: {}", e.getMessage());
            total = 0L;
        }
        String select = "SELECT il.id, il.user_id, il.employee_id, il.hired_at, "
                + "il.tentative_start_date, il.reporting_structure_complete, "
                + "u.full_name AS intern_name, u.email AS intern_email, "
                + "t.full_name AS trainer_name, ev.full_name AS evaluator_name, "
                + "m.full_name AS manager_name, "
                + "EXISTS (SELECT 1 FROM document_packets pk "
                + "          WHERE pk.intern_lifecycle_id = il.id) AS onboarding_assigned "
                + base + where
                + " ORDER BY il.hired_at DESC "
                + " LIMIT " + pageable.getPageSize()
                + " OFFSET " + (pageable.getPageNumber() * pageable.getPageSize());
        List<ErmOfferDtos.NewHireRow> rows = new ArrayList<>();
        try {
            rows = jdbc.query(select, params.toArray(), (rs, n) -> new ErmOfferDtos.NewHireRow(
                    UUID.fromString(rs.getString("id")),
                    UUID.fromString(rs.getString("user_id")),
                    rs.getString("intern_name"),
                    rs.getString("intern_email"),
                    rs.getString("employee_id"),
                    rs.getTimestamp("hired_at") != null ? rs.getTimestamp("hired_at").toInstant() : null,
                    rs.getDate("tentative_start_date") != null
                            ? rs.getDate("tentative_start_date").toLocalDate() : null,
                    rs.getString("trainer_name"),
                    rs.getString("evaluator_name"),
                    rs.getString("manager_name"),
                    rs.getBoolean("reporting_structure_complete"),
                    rs.getBoolean("onboarding_assigned")));
        } catch (Exception e) {
            log.warn("[ErmNewHire] list query failed: {}", e.getMessage());
        }
        Page<ErmOfferDtos.NewHireRow> p = new PageImpl<>(rows, pageable, total);
        return new ErmOfferDtos.NewHireListPage(p.getContent(), p.getNumber(),
                p.getSize(), p.getTotalElements(), p.getTotalPages());
    }

    // ── Detail ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ErmOfferDtos.NewHireDetail detail(UUID lifecycleId) {
        InternLifecycle lc = lifecycleRepository.findById(lifecycleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle not found: " + lifecycleId));
        User intern = userRepository.findById(lc.getUserId()).orElse(null);
        Offer signedOffer = null;
        if (intern != null) {
            signedOffer = offerRepository
                    .findByApplication_Candidate_User_IdOrderByCreatedAtDesc(intern.getId())
                    .stream()
                    .filter(o -> o.getSignedAt() != null)
                    .findFirst().orElse(null);
        }
        boolean onboardingAssigned = false;
        try {
            Long v = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM document_packets WHERE intern_lifecycle_id = ?",
                    Long.class, lc.getId());
            onboardingAssigned = v != null && v > 0;
        } catch (Exception ignored) {}

        return new ErmOfferDtos.NewHireDetail(
                lc.getId(),
                lc.getUserId(),
                intern != null ? intern.getFullName() : null,
                intern != null ? intern.getEmail() : null,
                lc.getEmployeeId(),
                lc.getActiveStatus(),
                lc.getHiredAt(),
                lc.getStartedAt(),
                lc.getTentativeStartDate(),
                Boolean.TRUE.equals(lc.getReportingStructureComplete()),
                lc.getReportingStructureCompletedAt(),
                lc.getReportingStructureCompletedById(),
                toStub(lc.getTrainerId()),
                toStub(lc.getEvaluatorId()),
                toStub(lc.getManagerId()),
                toStub(lc.getErmId()),
                signedOffer == null ? null : new ErmOfferDtos.OfferSummaryStub(
                        signedOffer.getId(), signedOffer.getRoleTitle(),
                        signedOffer.getCompensationSummary(), signedOffer.getWorksite(),
                        signedOffer.getExpectedHoursPerWeek(), signedOffer.getStartDate(),
                        signedOffer.getSignedAt(), signedOffer.getSignedPdfDocumentId()),
                onboardingAssigned);
    }

    // ── Assign reporting structure (atomic, the gate) ─────────────────────

    @Transactional
    public ErmOfferDtos.NewHireDetail assignReportingStructure(
            UUID lifecycleId, ErmOfferDtos.AssignReportingRequest req, User caller) {
        if (req == null) throw new BadRequestException("body required");
        if (req.trainerUserId() == null || req.evaluatorUserId() == null
                || req.managerUserId() == null) {
            throw new BadRequestException(
                    "trainerUserId + evaluatorUserId + managerUserId are all required");
        }
        InternLifecycle lc = lifecycleRepository.findById(lifecycleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle not found: " + lifecycleId));
        if (!"PROSPECTIVE".equals(lc.getActiveStatus())) {
            throw new ConflictException(
                    "Assignment allowed only when active_status=PROSPECTIVE (current: "
                            + lc.getActiveStatus() + ")");
        }
        User trainer = requireRole(req.trainerUserId(), UserRole.TRAINER, "Trainer");
        User evaluator = requireRole(req.evaluatorUserId(),
                UserRole.REPORTING_MANAGER, "Evaluator");
        User manager = requireRole(req.managerUserId(), UserRole.MANAGER, "Manager");

        lc.setTrainerId(trainer.getId());
        lc.setEvaluatorId(evaluator.getId());
        lc.setManagerId(manager.getId());
        lc.setReportingStructureComplete(Boolean.TRUE);
        lc.setReportingStructureCompletedAt(Instant.now());
        lc.setReportingStructureCompletedById(caller.getId());
        lifecycleRepository.save(lc);

        writeAudit(caller.getId(), lc.getUserId(),
                "REPORTING_STRUCTURE_ASSIGNED", "InternLifecycle", lc.getId(),
                null,
                Map.of("trainerId", trainer.getId().toString(),
                        "evaluatorId", evaluator.getId().toString(),
                        "managerId", manager.getId().toString()));
        try {
            eventPublisher.publishEvent(new ReportingStructureAssignedEvent(
                    lc.getId(), lc.getUserId(),
                    trainer.getId(), evaluator.getId(), manager.getId(),
                    caller.getId()));
        } catch (Exception e) {
            log.warn("[ErmNewHire] reporting structure event publish failed: {}", e.getMessage());
        }
        return detail(lifecycleId);
    }

    // ── Update tentative start date (lifecycle-side) ──────────────────────

    @Transactional
    public ErmOfferDtos.NewHireDetail updateTentativeStartDate(
            UUID lifecycleId, java.time.LocalDate newDate, User caller) {
        if (newDate == null || !newDate.isAfter(java.time.LocalDate.now())) {
            throw new BadRequestException("newDate must be at least tomorrow");
        }
        InternLifecycle lc = lifecycleRepository.findById(lifecycleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle not found: " + lifecycleId));
        java.time.LocalDate previous = lc.getTentativeStartDate();
        lc.setTentativeStartDate(newDate);
        lifecycleRepository.save(lc);
        writeAudit(caller.getId(), lc.getUserId(),
                "TENTATIVE_START_DATE_UPDATED", "InternLifecycle", lc.getId(),
                Map.of("tentativeStartDate", previous != null ? previous.toString() : null),
                Map.of("tentativeStartDate", newDate.toString()));
        try {
            eventPublisher.publishEvent(
                    new com.skyzen.careers.event.TentativeStartDateUpdatedEvent(
                            lc.getId(), lc.getUserId(), caller.getId(), previous, newDate));
        } catch (Exception e) {
            log.warn("[ErmNewHire] start-date event publish failed: {}", e.getMessage());
        }
        return detail(lifecycleId);
    }

    // ── Eligible users (with workload hint) ───────────────────────────────

    @Transactional(readOnly = true)
    public List<ErmOfferDtos.UserStub> listEligible(UserRole role) {
        List<User> users = userRepository.findByRole(role);
        List<ErmOfferDtos.UserStub> out = new ArrayList<>();
        for (User u : users) {
            if (u == null || !Boolean.TRUE.equals(u.getActive())) continue;
            int count = countAssignedInterns(u.getId(), role);
            out.add(new ErmOfferDtos.UserStub(
                    u.getId(), u.getFullName(), u.getEmail(), role.name(), count));
        }
        return out;
    }

    private int countAssignedInterns(UUID userId, UserRole role) {
        String col = switch (role) {
            case TRAINER -> "trainer_id";
            case REPORTING_MANAGER -> "evaluator_id";
            case MANAGER -> "manager_id";
            default -> null;
        };
        if (col == null) return 0;
        try {
            Long v = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM intern_lifecycles "
                            + "WHERE active_status IN ('PROSPECTIVE','ACTIVE') "
                            + "  AND " + col + " = ?",
                    Long.class, userId);
            return v != null ? v.intValue() : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private User requireRole(UUID userId, UserRole role, String label) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        label + " user not found: " + userId));
        if (u.getRoles() == null || !u.getRoles().contains(role)) {
            throw new BadRequestException(
                    label + " must hold role " + role.name() + " (user " + userId + ")");
        }
        return u;
    }

    private ErmOfferDtos.UserStub toStub(UUID userId) {
        if (userId == null) return null;
        User u = userRepository.findById(userId).orElse(null);
        if (u == null) return null;
        String role = u.getRoles() != null && !u.getRoles().isEmpty()
                ? u.getRoles().iterator().next().name() : null;
        return new ErmOfferDtos.UserStub(u.getId(), u.getFullName(), u.getEmail(), role, 0);
    }

    private void writeAudit(UUID actorId, UUID subjectUserId, String action,
                             String entityType, UUID entityId,
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
            log.warn("[ErmNewHire] audit write failed: {}", e.getMessage());
        }
    }
}
