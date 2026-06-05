package com.skyzen.careers.erm.compliance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.EVerifyCase;
import com.skyzen.careers.entity.I9Form;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WorkAuthorizationRecord;
import com.skyzen.careers.enums.EVerifyClosureReason;
import com.skyzen.careers.enums.EVerifyStatus;
import com.skyzen.careers.enums.I9Status;
import com.skyzen.careers.enums.PhotoMatchResult;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.erm.exception.ExceptionSeverity;
import com.skyzen.careers.event.EverifyCaseOpenedEvent;
import com.skyzen.careers.event.EverifyStatusChangedEvent;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EVerifyCaseRepository;
import com.skyzen.careers.repository.I9FormRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.repository.WorkAuthorizationRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * ERM Phase 5 — Compliance Tracker service. Read path joins
 * {@code work_authorization_records}, {@code i9_forms}, and
 * {@code everify_cases} into a single pipeline row + a richer per-intern
 * timeline. Write path covers the four ERM mutations:
 * record/update work auth, record I-9 §2, record/open E-Verify case, and
 * update E-Verify status.
 *
 * <p>Encrypted fields ({@code ead_card_number}, E-Verify {@code case_number})
 * are masked on every read; full reveal goes through a dedicated audited
 * endpoint.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ErmComplianceService {

    private static final Set<EVerifyStatus> EVERIFY_OPEN_STATUSES = Set.of(
            EVerifyStatus.PENDING_SUBMISSION,
            EVerifyStatus.OPEN,
            EVerifyStatus.TENTATIVE_NONCONFIRMATION);

    private final WorkAuthorizationRecordRepository workAuthRepository;
    private final I9FormRepository i9FormRepository;
    private final EVerifyCaseRepository everifyCaseRepository;
    private final CandidateRepository candidateRepository;
    private final InternLifecycleRepository internLifecycleRepository;
    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final ComplianceCalculatorService calculator;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;

    // ── Reads ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ErmComplianceDtos.PipelinePage listPipeline(
            String filter, String search, int page, int pageSize) {
        int p = Math.max(0, page);
        int ps = Math.min(100, Math.max(1, pageSize));

        StringBuilder where = new StringBuilder(
                " WHERE il.active_status IN ('ACTIVE','PROSPECTIVE') ");
        List<Object> params = new ArrayList<>();
        if (search != null && !search.isBlank()) {
            where.append(" AND (LOWER(u.full_name) LIKE ? OR LOWER(u.email) LIKE ?) ");
            String s = "%" + search.trim().toLowerCase() + "%";
            params.add(s); params.add(s);
        }
        if (filter != null && !filter.isBlank()) {
            switch (filter.trim().toUpperCase()) {
                case "WORK_AUTH_EXPIRING" -> where.append(
                        " AND LEAST(COALESCE(w.authorized_until, CURRENT_DATE + INTERVAL '999 days')::date, "
                                + "    COALESCE(w.ead_expiration,    CURRENT_DATE + INTERVAL '999 days')::date, "
                                + "    COALESCE(w.i20_expiration,    CURRENT_DATE + INTERVAL '999 days')::date) "
                                + " <= CURRENT_DATE + INTERVAL '30 days' ");
                case "I9_DUE" -> where.append(
                        " AND f.first_day_of_employment IS NOT NULL "
                                + " AND f.section2_signed_at IS NULL ");
                case "EVERIFY_OPEN" -> where.append(
                        " AND ec.status IN ('PENDING_SUBMISSION','OPEN','TENTATIVE_NONCONFIRMATION') ");
                case "EVERIFY_TNC" -> where.append(
                        " AND ec.status = 'TENTATIVE_NONCONFIRMATION' ");
                case "I983" -> where.append(" AND w.i983_required = TRUE ");
                default -> { /* no-op filter */ }
            }
        }

        String fromClause =
                "  FROM users u "
                        + "  JOIN intern_lifecycles il ON il.user_id = u.id "
                        + "  LEFT JOIN work_authorization_records w ON w.user_id = u.id "
                        + "  LEFT JOIN candidates c ON c.user_id = u.id "
                        + "  LEFT JOIN i9_forms f ON f.candidate_id = c.id "
                        + "  LEFT JOIN everify_cases ec ON ec.i9_form_id = f.id ";

        long total;
        try {
            Long cnt = jdbc.queryForObject(
                    "SELECT COUNT(*) " + fromClause + where,
                    Long.class, params.toArray());
            total = cnt == null ? 0L : cnt;
        } catch (Exception e) {
            log.warn("[ErmCompliance] pipeline count failed: {}", e.getMessage());
            total = 0L;
        }

        List<Object> pageParams = new ArrayList<>(params);
        pageParams.add(ps);
        pageParams.add(p * ps);

        LocalDate today = LocalDate.now();
        List<ErmComplianceDtos.PipelineRow> rows;
        try {
            rows = jdbc.query(
                    "SELECT u.id AS user_id, u.full_name, u.applicant_id, u.email, "
                            + "       w.work_auth_type, w.authorized_until, w.i983_required, "
                            + "       w.ead_expiration, w.i20_expiration, "
                            + "       f.status AS i9_status, f.first_day_of_employment, "
                            + "       f.section2_signed_at, "
                            + "       ec.status AS everify_status, ec.due_by AS everify_due_by, "
                            + "       ec.expected_close_by "
                            + fromClause
                            + where
                            + " ORDER BY u.full_name ASC "
                            + " LIMIT ? OFFSET ?",
                    pageParams.toArray(),
                    (rs, n) -> mapPipelineRow(rs, today));
        } catch (Exception e) {
            log.warn("[ErmCompliance] pipeline page failed: {}", e.getMessage());
            rows = List.of();
        }

        int totalPages = ps == 0 ? 0 : (int) Math.ceil((double) total / ps);
        ErmComplianceDtos.PipelineKpi kpi = computeKpi();
        return new ErmComplianceDtos.PipelinePage(rows, p, ps, total, totalPages, kpi);
    }

    private ErmComplianceDtos.PipelineRow mapPipelineRow(
            java.sql.ResultSet rs, LocalDate today) throws java.sql.SQLException {
        LocalDate authUntil = toLocalDate(rs.getDate("authorized_until"));
        LocalDate eadExp = toLocalDate(rs.getDate("ead_expiration"));
        LocalDate i20Exp = toLocalDate(rs.getDate("i20_expiration"));
        LocalDate earliestExpiry = earliest(authUntil, eadExp, i20Exp);

        Integer waDays = calculator.daysUntil(earliestExpiry, today);
        ExceptionSeverity waSev = calculator.alertSeverity(waDays);

        LocalDate firstDay = toLocalDate(rs.getDate("first_day_of_employment"));
        LocalDate i9DueBy = calculator.i9Section2DueBy(firstDay);
        Integer i9DaysUntil = calculator.daysUntil(i9DueBy, today);
        ExceptionSeverity i9Sev = rs.getTimestamp("section2_signed_at") == null
                ? calculator.alertSeverity(i9DaysUntil) : null;

        LocalDate everifyDueBy = toLocalDate(rs.getDate("everify_due_by"));
        Integer everifyDays = calculator.daysUntil(everifyDueBy, today);
        String everifyStatus = rs.getString("everify_status");
        ExceptionSeverity everifySev = computeEverifySeverity(everifyStatus, everifyDays);

        return new ErmComplianceDtos.PipelineRow(
                nullableUuid(rs.getString("user_id")),
                rs.getString("full_name"),
                rs.getString("applicant_id"),
                rs.getString("email"),
                rs.getString("work_auth_type"),
                authUntil, waDays, waSev,
                rs.getString("i9_status"),
                i9DueBy, i9DaysUntil, i9Sev,
                everifyStatus, everifyDueBy, everifyDays, everifySev,
                (Boolean) rs.getObject("i983_required"));
    }

    private ExceptionSeverity computeEverifySeverity(String status, Integer daysUntil) {
        if (status == null) return null;
        return switch (status) {
            case "TENTATIVE_NONCONFIRMATION", "FINAL_NONCONFIRMATION" ->
                    ExceptionSeverity.URGENT;
            case "PENDING_SUBMISSION", "OPEN" ->
                    calculator.alertSeverity(daysUntil);
            default -> null;
        };
    }

    private ErmComplianceDtos.PipelineKpi computeKpi() {
        long workAuthExpiring = safeCount(
                "SELECT COUNT(*) FROM work_authorization_records w "
                        + " JOIN intern_lifecycles il ON il.user_id = w.user_id "
                        + " WHERE il.active_status IN ('ACTIVE','PROSPECTIVE') "
                        + "   AND LEAST(COALESCE(w.authorized_until, CURRENT_DATE + INTERVAL '999 days')::date, "
                        + "             COALESCE(w.ead_expiration,    CURRENT_DATE + INTERVAL '999 days')::date, "
                        + "             COALESCE(w.i20_expiration,    CURRENT_DATE + INTERVAL '999 days')::date) "
                        + "       <= CURRENT_DATE + INTERVAL '30 days'");
        long i9DueSoon = safeCount(
                "SELECT COUNT(*) FROM i9_forms f "
                        + " WHERE f.first_day_of_employment IS NOT NULL "
                        + "   AND f.section2_signed_at IS NULL "
                        + "   AND f.first_day_of_employment + INTERVAL '3 days' <= CURRENT_DATE + INTERVAL '2 days'");
        long everifyTncOrOverdue = safeCount(
                "SELECT COUNT(*) FROM everify_cases "
                        + " WHERE status = 'TENTATIVE_NONCONFIRMATION' "
                        + "    OR (status IN ('PENDING_SUBMISSION','OPEN') AND due_by < CURRENT_DATE)");
        long i983Required = safeCount(
                "SELECT COUNT(*) FROM work_authorization_records w "
                        + " JOIN intern_lifecycles il ON il.user_id = w.user_id "
                        + " WHERE il.active_status IN ('ACTIVE','PROSPECTIVE') AND w.i983_required = TRUE");
        return new ErmComplianceDtos.PipelineKpi(
                workAuthExpiring, i9DueSoon, everifyTncOrOverdue, i983Required);
    }

    private long safeCount(String sql) {
        try {
            Long c = jdbc.queryForObject(sql, Long.class);
            return c == null ? 0L : c;
        } catch (Exception e) {
            log.warn("[ErmCompliance] kpi count failed (non-fatal): {}", e.getMessage());
            return 0L;
        }
    }

    @Transactional(readOnly = true)
    public ErmComplianceDtos.InternTimeline getInternTimeline(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        WorkAuthorizationRecord war = workAuthRepository.findByUserId(userId).orElse(null);
        Candidate candidate = candidateRepository.findByUserId(userId).orElse(null);
        I9Form i9 = candidate != null
                ? i9FormRepository.findByCandidateId(candidate.getId()).orElse(null)
                : null;
        EVerifyCase ec = i9 != null
                ? everifyCaseRepository.findByI9FormId(i9.getId()).orElse(null)
                : null;

        LocalDate today = LocalDate.now();
        ErmComplianceDtos.WorkAuthCard waCard = toWorkAuthCard(war);
        ErmComplianceDtos.I9TimelineCard i9Card = toI9Card(i9, today);
        ErmComplianceDtos.EverifyCard ecCard = toEverifyCard(ec, today);
        ErmComplianceDtos.I983Card i983 = toI983Card(war, today);
        List<ErmComplianceDtos.TimelineEvent> events =
                buildUpcomingEvents(war, i9, ec, today);

        return new ErmComplianceDtos.InternTimeline(
                user.getId(), user.getFullName(), user.getEmail(),
                waCard, i9Card, ecCard, i983, events);
    }

    private ErmComplianceDtos.WorkAuthCard toWorkAuthCard(WorkAuthorizationRecord w) {
        if (w == null) return null;
        return new ErmComplianceDtos.WorkAuthCard(
                w.getId(), w.getWorkAuthType(),
                w.getAuthorizedFrom(), w.getAuthorizedUntil(),
                maskTail(w.getEadCardNumber()),
                w.getEadExpiration(), w.getI20Expiration(),
                w.getI983Required(), w.getI983Id(),
                w.getDsoName(), w.getDsoEmail(), w.getDsoPhone(),
                w.getErmNotes(), w.getLastUpdatedAt(), w.getLastUpdatedById());
    }

    private ErmComplianceDtos.I9TimelineCard toI9Card(I9Form f, LocalDate today) {
        if (f == null) return null;
        LocalDate dueBy = calculator.i9Section2DueBy(f.getFirstDayOfEmployment());
        Integer daysUntil = calculator.daysUntil(dueBy, today);
        ExceptionSeverity sev = f.getSection2SignedAt() == null
                ? calculator.alertSeverity(daysUntil) : null;
        return new ErmComplianceDtos.I9TimelineCard(
                f.getId(),
                f.getStatus() != null ? f.getStatus().name() : null,
                f.getFirstDayOfEmployment(),
                f.getSection1DueDate(),
                f.getSection2DueDate(),
                dueBy, daysUntil, sev,
                f.getSection1SignedAt(),
                f.getSection2SignedAt(),
                f.getEmployerName(),
                f.getEmployerTitle());
    }

    private ErmComplianceDtos.EverifyCard toEverifyCard(EVerifyCase ec, LocalDate today) {
        if (ec == null) return null;
        LocalDate closeBy = ec.getExpectedCloseBy();
        Integer daysUntilClose = calculator.daysUntil(closeBy, today);
        ExceptionSeverity sev = computeEverifySeverity(
                ec.getStatus() != null ? ec.getStatus().name() : null,
                daysUntilClose);
        return new ErmComplianceDtos.EverifyCard(
                ec.getId(),
                maskTail(ec.getCaseNumber()),
                ec.getStatus() != null ? ec.getStatus().name() : null,
                ec.getDueBy(),
                closeBy, daysUntilClose, sev,
                ec.getOpenedAt(), ec.getClosedAt(),
                ec.getClosureReason() != null ? ec.getClosureReason().name() : null,
                ec.getPhotoMatchRequired(),
                ec.getPhotoMatchResult() != null ? ec.getPhotoMatchResult().name() : null,
                ec.getErmNotes(),
                ec.getLastUpdatedAt());
    }

    private ErmComplianceDtos.I983Card toI983Card(WorkAuthorizationRecord w, LocalDate today) {
        if (w == null || !Boolean.TRUE.equals(w.getI983Required())) return null;
        // No dedicated I-983 entity yet — surface the requirement + DSO data;
        // detailed evaluation history will land alongside the I-983 form in
        // a later phase. Severity uses authorized_until as a proxy deadline.
        Integer daysUntil = calculator.daysUntil(w.getAuthorizedUntil(), today);
        ExceptionSeverity sev = calculator.alertSeverity(daysUntil);
        return new ErmComplianceDtos.I983Card(
                w.getI983Id(),
                w.getI983Id() != null ? "REQUIRED" : "NOT_LINKED",
                null, w.getAuthorizedUntil(), null,
                daysUntil, sev);
    }

    private List<ErmComplianceDtos.TimelineEvent> buildUpcomingEvents(
            WorkAuthorizationRecord w, I9Form f, EVerifyCase ec, LocalDate today) {
        List<ErmComplianceDtos.TimelineEvent> out = new ArrayList<>();
        if (w != null) {
            addEvent(out, "Work auth expires", w.getAuthorizedUntil(), today);
            addEvent(out, "EAD expires", w.getEadExpiration(), today);
            addEvent(out, "I-20 expires", w.getI20Expiration(), today);
        }
        if (f != null) {
            addEvent(out, "I-9 Section 2 due", calculator.i9Section2DueBy(
                    f.getFirstDayOfEmployment()), today);
        }
        if (ec != null) {
            addEvent(out, "E-Verify due by", ec.getDueBy(), today);
            addEvent(out, "E-Verify expected close", ec.getExpectedCloseBy(), today);
        }
        out.removeIf(e -> e.eventDate() == null || e.eventDate().isBefore(today.minusDays(30)));
        out.sort(java.util.Comparator.comparing(ErmComplianceDtos.TimelineEvent::eventDate));
        return out;
    }

    private void addEvent(List<ErmComplianceDtos.TimelineEvent> out,
                           String label, LocalDate date, LocalDate today) {
        if (date == null) return;
        Integer days = calculator.daysUntil(date, today);
        out.add(new ErmComplianceDtos.TimelineEvent(
                label, date, days, calculator.alertSeverity(days)));
    }

    // ── Mutations ────────────────────────────────────────────────────────

    @Transactional
    public ErmComplianceDtos.WorkAuthCard updateWorkAuth(
            UUID userId, ErmComplianceDtos.UpdateWorkAuthRequest req, User caller) {
        requireErm(caller);
        if (req == null) throw new BadRequestException("request body is required");
        WorkAuthorizationRecord existing = workAuthRepository.findByUserId(userId).orElse(null);
        WorkAuthorizationRecord w = existing != null
                ? existing
                : WorkAuthorizationRecord.builder()
                        .userId(userId)
                        .workAuthType(req.workAuthType() != null
                                ? req.workAuthType().trim().toUpperCase() : "OTHER")
                        .i983Required(Boolean.TRUE.equals(req.i983Required()))
                        .lastUpdatedById(caller.getId())
                        .build();
        Map<String, Object> before = snapshot(w);
        if (req.workAuthType() != null) {
            w.setWorkAuthType(req.workAuthType().trim().toUpperCase());
        }
        if (req.authorizedFrom() != null) w.setAuthorizedFrom(req.authorizedFrom());
        if (req.authorizedUntil() != null) w.setAuthorizedUntil(req.authorizedUntil());
        if (req.eadCardNumber() != null) w.setEadCardNumber(req.eadCardNumber().trim());
        if (req.eadExpiration() != null) w.setEadExpiration(req.eadExpiration());
        if (req.i20Expiration() != null) w.setI20Expiration(req.i20Expiration());
        if (req.i983Required() != null) w.setI983Required(req.i983Required());
        if (req.dsoName() != null) w.setDsoName(req.dsoName().trim());
        if (req.dsoEmail() != null) w.setDsoEmail(req.dsoEmail().trim());
        if (req.dsoPhone() != null) w.setDsoPhone(req.dsoPhone().trim());
        if (req.ermNotes() != null) w.setErmNotes(req.ermNotes().trim());
        w.setLastUpdatedById(caller.getId());
        WorkAuthorizationRecord saved = workAuthRepository.save(w);

        writeAudit("WorkAuthorizationRecord", saved.getId(),
                existing == null ? "CREATE" : "UPDATE",
                caller.getId(), userId, before, snapshot(saved));
        return toWorkAuthCard(saved);
    }

    @Transactional
    public ErmComplianceDtos.I9TimelineCard recordI9Section2(
            UUID userId, ErmComplianceDtos.RecordI9Section2Request req, User caller) {
        requireErm(caller);
        if (req == null) throw new BadRequestException("request body is required");
        Candidate candidate = candidateRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found for user: " + userId));
        I9Form f = i9FormRepository.findByCandidateId(candidate.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "I-9 form not yet started for user: " + userId));
        if (f.getSection2SignedAt() != null) {
            throw new ConflictException("I-9 Section 2 already signed on " + f.getSection2SignedAt());
        }
        boolean hasListA = notBlank(req.listATitle())
                && notBlank(req.listADocumentNumber());
        boolean hasListBC = notBlank(req.listBTitle())
                && notBlank(req.listCTitle());
        if (!hasListA && !hasListBC) {
            throw new BadRequestException(
                    "Must supply List A OR (List B + List C) document set");
        }
        Map<String, Object> before = Map.of(
                "status", f.getStatus() != null ? f.getStatus().name() : null,
                "section2SignedAt", f.getSection2SignedAt());
        if (req.firstDayOfEmployment() != null) {
            f.setFirstDayOfEmployment(req.firstDayOfEmployment());
            f.setSection2DueDate(calculator.i9Section2DueBy(req.firstDayOfEmployment()));
        }
        if (hasListA) {
            f.setListATitle(req.listATitle());
            f.setListAIssuingAuthority(req.listAIssuingAuthority());
            f.setListADocumentNumber(req.listADocumentNumber());
            f.setListAExpirationDate(req.listAExpirationDate());
        } else {
            f.setListBTitle(req.listBTitle());
            f.setListBIssuingAuthority(req.listBIssuingAuthority());
            f.setListBDocumentNumber(req.listBDocumentNumber());
            f.setListBExpirationDate(req.listBExpirationDate());
            f.setListCTitle(req.listCTitle());
            f.setListCIssuingAuthority(req.listCIssuingAuthority());
            f.setListCDocumentNumber(req.listCDocumentNumber());
        }
        f.setEmployerName(req.employerName());
        f.setEmployerTitle(req.employerTitle());
        f.setBusinessOrganizationName(req.businessOrganizationName());
        f.setBusinessAddress(req.businessAddress());
        f.setSection2SignedAt(Instant.now());
        f.setSection2SignedByUserId(caller.getId());
        f.setStatus(I9Status.COMPLETED);
        I9Form saved = i9FormRepository.save(f);

        writeAudit("I9Form", saved.getId(), "SECTION2_COMPLETED",
                caller.getId(), userId, before,
                Map.of("status", saved.getStatus().name(),
                        "section2SignedAt", saved.getSection2SignedAt()));
        return toI9Card(saved, LocalDate.now());
    }

    @Transactional
    public ErmComplianceDtos.EverifyCard recordEverifyCase(
            ErmComplianceDtos.RecordEverifyRequest req, User caller) {
        requireErm(caller);
        if (req == null || req.i9FormId() == null) {
            throw new BadRequestException("i9FormId is required");
        }
        I9Form f = i9FormRepository.findById(req.i9FormId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "I-9 form not found: " + req.i9FormId()));
        if (f.getSection2SignedAt() == null) {
            throw new ConflictException(
                    "Cannot open E-Verify case before I-9 Section 2 is signed");
        }
        Optional<EVerifyCase> existing = everifyCaseRepository.findByI9FormId(req.i9FormId());
        if (existing.isPresent()) {
            throw new ConflictException(
                    "E-Verify case already exists for I-9 form " + req.i9FormId());
        }
        EVerifyStatus status = parseStatus(req.status(), EVerifyStatus.OPEN);
        EVerifyCase ec = EVerifyCase.builder()
                .i9Form(f)
                .caseNumber(safeTrim(req.caseNumber()))
                .status(status)
                .openedAt(Instant.now())
                .dueBy(req.dueBy() != null ? req.dueBy()
                        : calculator.everifyDueBy(f.getFirstDayOfEmployment()))
                .expectedCloseBy(req.expectedCloseBy())
                .photoMatchRequired(Boolean.TRUE.equals(req.photoMatchRequired()))
                .photoMatchResult(parsePhotoMatch(req.photoMatchResult()))
                .ermNotes(safeTrim(req.ermNotes()))
                .lastUpdatedAt(Instant.now())
                .lastUpdatedById(caller.getId())
                .createdBy(caller.getId())
                .build();
        EVerifyCase saved = everifyCaseRepository.save(ec);

        writeAudit("EVerifyCase", saved.getId(), "OPEN",
                caller.getId(), userIdFromI9(f),
                null,
                Map.of("status", saved.getStatus().name(),
                        "dueBy", saved.getDueBy()));
        try {
            eventPublisher.publishEvent(new EverifyCaseOpenedEvent(
                    saved.getId(), f.getId(), userIdFromI9(f)));
        } catch (Exception e) {
            log.warn("[ErmCompliance] EverifyCaseOpenedEvent publish failed: {}",
                    e.getMessage());
        }
        return toEverifyCard(saved, LocalDate.now());
    }

    @Transactional
    public ErmComplianceDtos.EverifyCard updateEverifyStatus(
            UUID caseId, ErmComplianceDtos.UpdateEverifyStatusRequest req, User caller) {
        requireErm(caller);
        if (req == null || req.status() == null) {
            throw new BadRequestException("status is required");
        }
        EVerifyCase ec = everifyCaseRepository.findById(caseId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "E-Verify case not found: " + caseId));
        EVerifyStatus newStatus = parseStatus(req.status(), null);
        if (newStatus == null) {
            throw new BadRequestException("Unknown E-Verify status: " + req.status());
        }
        String previousStatus = ec.getStatus() != null ? ec.getStatus().name() : null;
        ec.setStatus(newStatus);
        if (req.closureReason() != null) {
            try {
                ec.setClosureReason(EVerifyClosureReason.valueOf(req.closureReason().trim()));
            } catch (IllegalArgumentException e) {
                throw new BadRequestException("Unknown closureReason: " + req.closureReason());
            }
        }
        if (req.expectedCloseBy() != null) ec.setExpectedCloseBy(req.expectedCloseBy());
        if (req.photoMatchResult() != null) {
            ec.setPhotoMatchResult(parsePhotoMatch(req.photoMatchResult()));
        }
        if (req.ermNotes() != null) ec.setErmNotes(req.ermNotes().trim());
        if (newStatus == EVerifyStatus.EMPLOYMENT_AUTHORIZED
                || newStatus == EVerifyStatus.CLOSED
                || newStatus == EVerifyStatus.FINAL_NONCONFIRMATION) {
            if (ec.getClosedAt() == null) ec.setClosedAt(Instant.now());
        }
        ec.setLastUpdatedAt(Instant.now());
        ec.setLastUpdatedById(caller.getId());
        EVerifyCase saved = everifyCaseRepository.save(ec);

        writeAudit("EVerifyCase", saved.getId(), "STATUS_UPDATE",
                caller.getId(), userIdFromI9(saved.getI9Form()),
                Map.of("status", previousStatus),
                Map.of("status", saved.getStatus().name()));
        try {
            eventPublisher.publishEvent(new EverifyStatusChangedEvent(
                    saved.getId(), userIdFromI9(saved.getI9Form()),
                    previousStatus,
                    saved.getStatus().name()));
        } catch (Exception e) {
            log.warn("[ErmCompliance] EverifyStatusChangedEvent publish failed: {}",
                    e.getMessage());
        }
        return toEverifyCard(saved, LocalDate.now());
    }

    @Transactional
    public ErmComplianceDtos.RevealCaseNumberResponse revealEverifyCaseNumber(
            UUID caseId, User caller) {
        requireErm(caller);
        EVerifyCase ec = everifyCaseRepository.findById(caseId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "E-Verify case not found: " + caseId));
        String plain = ec.getCaseNumber();
        writeAudit("EVerifyCase", caseId, "CASE_NUMBER_REVEAL",
                caller.getId(), userIdFromI9(ec.getI9Form()),
                null, Map.of("masked", maskTail(plain)));
        return new ErmComplianceDtos.RevealCaseNumberResponse(caseId, plain);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private void requireErm(User caller) {
        if (caller == null) throw new ForbiddenException("Caller required");
        if (!caller.getRoles().contains(UserRole.ERM)
                && !caller.getRoles().contains(UserRole.SUPER_ADMIN)) {
            throw new ForbiddenException("ERM or SUPER_ADMIN required");
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
            log.warn("[ErmCompliance] audit write failed: {}", e.getMessage());
        }
    }

    private Map<String, Object> snapshot(WorkAuthorizationRecord w) {
        if (w == null) return null;
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("workAuthType", w.getWorkAuthType());
        m.put("authorizedFrom", w.getAuthorizedFrom());
        m.put("authorizedUntil", w.getAuthorizedUntil());
        m.put("eadExpiration", w.getEadExpiration());
        m.put("i20Expiration", w.getI20Expiration());
        m.put("i983Required", w.getI983Required());
        m.put("eadCardNumberMasked", maskTail(w.getEadCardNumber()));
        return m;
    }

    private UUID userIdFromI9(I9Form f) {
        if (f == null) return null;
        try {
            Candidate c = f.getCandidate();
            return c != null && c.getUser() != null ? c.getUser().getId() : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private static EVerifyStatus parseStatus(String s, EVerifyStatus fallback) {
        if (s == null || s.isBlank()) return fallback;
        try { return EVerifyStatus.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) {
            if (fallback != null) return fallback;
            return null;
        }
    }

    private static PhotoMatchResult parsePhotoMatch(String s) {
        if (s == null || s.isBlank()) return null;
        try { return PhotoMatchResult.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { return null; }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private static String safeTrim(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String maskTail(String s) {
        if (s == null || s.isBlank()) return null;
        if (s.length() <= 4) return "••" + s;
        return "E••••" + s.substring(s.length() - 4);
    }

    private static UUID nullableUuid(String s) {
        if (s == null || s.isBlank()) return null;
        try { return UUID.fromString(s); } catch (Exception e) { return null; }
    }

    private static LocalDate toLocalDate(java.sql.Date d) {
        return d == null ? null : d.toLocalDate();
    }

    private static LocalDate earliest(LocalDate... dates) {
        LocalDate out = null;
        for (LocalDate d : dates) {
            if (d == null) continue;
            if (out == null || d.isBefore(out)) out = d;
        }
        return out;
    }
}
