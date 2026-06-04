package com.skyzen.careers.service;

import com.skyzen.careers.dto.supervised.LogTimesheetRequest;
import com.skyzen.careers.dto.supervised.RejectTimesheetRequest;
import com.skyzen.careers.dto.supervised.TimesheetDayResponse;
import com.skyzen.careers.dto.supervised.TimesheetListResponse;
import com.skyzen.careers.dto.supervised.TimesheetResponse;
import com.skyzen.careers.dto.supervised.TimesheetWeekResponse;
import com.skyzen.careers.dto.supervised.UpdateTimesheetRequest;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Timesheet;
import com.skyzen.careers.entity.TimesheetDay;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.TimesheetStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.TimesheetDayRepository;
import com.skyzen.careers.repository.TimesheetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TimesheetService {

    private static final BigDecimal MAX_HOURS = new BigDecimal("168");

    private final TimesheetRepository timesheetRepository;
    private final TimesheetDayRepository timesheetDayRepository;
    private final CandidateRepository candidateRepository;
    private final EngagementService engagementService;

    @Transactional
    public TimesheetResponse logHours(LogTimesheetRequest req, User caller) {
        validateHours(req.getHours());
        Candidate intern = candidateRepository.findByUserId(caller.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate profile not found for user " + caller.getId()));

        boolean submitNow = Boolean.TRUE.equals(req.getSubmit());
        // Phase 3 step 8 — link to the intern's active engagement when one
        // exists. Null is fine: row stays reachable via the intern-keyed
        // queries; step-11 backfill (opt-in) handles legacy rows.
        Engagement engagement = engagementService
                .resolveActiveForCandidate(intern.getId())
                .orElse(null);
        Timesheet t = Timesheet.builder()
                .intern(intern)
                .engagement(engagement)
                .weekStart(req.getWeekStart())
                .hours(req.getHours())
                .description(req.getDescription())
                .status(submitNow ? TimesheetStatus.SUBMITTED : TimesheetStatus.DRAFT)
                .build();
        t = timesheetRepository.save(t);
        return toResponse(timesheetRepository.findByIdWithGraph(t.getId())
                .orElseThrow(() -> new IllegalStateException("Just-created timesheet vanished")));
    }

    @Transactional
    public TimesheetResponse update(UUID id, UpdateTimesheetRequest req, User caller) {
        validateHours(req.getHours());
        Timesheet t = loadOwned(id, caller);
        if (t.getStatus() != TimesheetStatus.DRAFT && t.getStatus() != TimesheetStatus.REJECTED) {
            throw new BadRequestException(
                    "Only DRAFT or REJECTED timesheets can be edited (current: " + t.getStatus() + ")");
        }
        t.setHours(req.getHours());
        t.setDescription(req.getDescription());
        timesheetRepository.save(t);
        return toResponse(t);
    }

    @Transactional
    public TimesheetResponse submit(UUID id, User caller) {
        Timesheet t = loadOwned(id, caller);
        if (t.getStatus() == TimesheetStatus.SUBMITTED || t.getStatus() == TimesheetStatus.APPROVED) {
            // Idempotent for SUBMITTED; APPROVED is a no-op too.
            return toResponse(t);
        }
        if (t.getStatus() != TimesheetStatus.DRAFT && t.getStatus() != TimesheetStatus.REJECTED) {
            throw new BadRequestException(
                    "Only DRAFT or REJECTED timesheets can be submitted (current: " + t.getStatus() + ")");
        }
        // Clear any stale rejection reason on resubmit.
        t.setReviewNote(null);
        t.setStatus(TimesheetStatus.SUBMITTED);
        timesheetRepository.save(t);
        return toResponse(t);
    }

    @Transactional(readOnly = true)
    public TimesheetListResponse listMine(User caller) {
        List<TimesheetResponse> entries = timesheetRepository.findForCandidateUser(caller.getId())
                .stream().map(this::toResponse).toList();
        BigDecimal total = timesheetRepository.sumApprovedHoursForCandidateUser(caller.getId());
        return TimesheetListResponse.builder()
                .entries(entries)
                .totalApprovedHours(total != null ? total : BigDecimal.ZERO)
                .build();
    }

    @Transactional(readOnly = true)
    public TimesheetListResponse listForIntern(UUID candidateId) {
        if (!candidateRepository.existsById(candidateId)) {
            throw new ResourceNotFoundException("Candidate not found: " + candidateId);
        }
        List<TimesheetResponse> entries = timesheetRepository.findForIntern(candidateId)
                .stream().map(this::toResponse).toList();
        BigDecimal total = timesheetRepository.sumApprovedHoursForIntern(candidateId);
        return TimesheetListResponse.builder()
                .entries(entries)
                .totalApprovedHours(total != null ? total : BigDecimal.ZERO)
                .build();
    }

    @Transactional
    public TimesheetResponse approve(UUID id, User caller) {
        Timesheet t = timesheetRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Timesheet not found: " + id));
        if (t.getStatus() != TimesheetStatus.SUBMITTED) {
            throw new BadRequestException(
                    "Only SUBMITTED timesheets can be approved (current: " + t.getStatus() + ")");
        }
        t.setStatus(TimesheetStatus.APPROVED);
        t.setApprovedBy(caller);
        t.setApprovedAt(Instant.now());
        t.setReviewNote(null);
        timesheetRepository.save(t);
        return toResponse(t);
    }

    @Transactional
    public TimesheetResponse reject(UUID id, RejectTimesheetRequest req, User caller) {
        Timesheet t = timesheetRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Timesheet not found: " + id));
        if (t.getStatus() != TimesheetStatus.SUBMITTED) {
            throw new BadRequestException(
                    "Only SUBMITTED timesheets can be rejected (current: " + t.getStatus() + ")");
        }
        t.setStatus(TimesheetStatus.REJECTED);
        t.setReviewNote(req.getReason());
        // Reviewer attribution lives on approvedBy/approvedAt only when actually
        // approved; clear them on reject so the response doesn't show a stale
        // "approved by" line for a rejected row.
        t.setApprovedBy(null);
        t.setApprovedAt(null);
        timesheetRepository.save(t);
        return toResponse(t);
    }

    /**
     * Loads with the full graph so the candidate-side ownership check on
     * {@code t.intern.user.id} doesn't hit a detached lazy proxy (resume-download
     * lesson — fetch what we touch).
     */
    private Timesheet loadOwned(UUID id, User caller) {
        Timesheet t = timesheetRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Timesheet not found: " + id));
        Candidate intern = t.getIntern();
        if (intern == null || intern.getUser() == null
                || !intern.getUser().getId().equals(caller.getId())) {
            throw new ForbiddenException("Timesheet does not belong to this user");
        }
        return t;
    }

    private void validateHours(BigDecimal hours) {
        if (hours == null
                || hours.compareTo(BigDecimal.ZERO) <= 0
                || hours.compareTo(MAX_HOURS) > 0) {
            throw new BadRequestException("hours must be > 0 and <= 168");
        }
    }

    private TimesheetResponse toResponse(Timesheet t) {
        User approver = t.getApprovedBy();
        return TimesheetResponse.builder()
                .id(t.getId())
                .weekStart(t.getWeekStart())
                .hours(t.getHours())
                .description(t.getDescription())
                .status(t.getStatus())
                .approvedByName(approver != null ? approver.getFullName() : null)
                .approvedAt(t.getApprovedAt())
                .reviewNote(t.getReviewNote())
                .createdAt(t.getCreatedAt())
                .build();
    }

    // ─── Day-by-day week-mode API ───────────────────────────────────────────
    //
    // Additive surface for the intern timesheet entry page + the RM approval
    // queue. The parent {@link Timesheet} row is reused as the weekly
    // container — its {@code hours} is recomputed from the day rows on every
    // PATCH so the legacy weekly-total readers stay correct.

    /**
     * Find-or-create the intern caller's timesheet for {@code weekStart}. A
     * weekStart must be a Monday — otherwise we'd risk multiple rows pointing
     * at overlapping weeks. Newly-created weeks start in DRAFT with no day
     * rows; the UI calls {@link #patchDay} for each cell as the intern types.
     */
    @Transactional
    public TimesheetWeekResponse getOrCreateWeek(LocalDate weekStart, User caller) {
        if (weekStart == null) {
            throw new BadRequestException("weekStart is required.");
        }
        if (weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new BadRequestException("weekStart must fall on a Monday.");
        }
        Timesheet t = timesheetRepository
                .findByCandidateUserAndWeek(caller.getId(), weekStart)
                .orElse(null);
        if (t == null) {
            Candidate intern = candidateRepository.findByUserId(caller.getId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Candidate profile not found for user " + caller.getId()));
            Engagement engagement = engagementService
                    .resolveActiveForCandidate(intern.getId())
                    .orElse(null);
            t = Timesheet.builder()
                    .intern(intern)
                    .engagement(engagement)
                    .weekStart(weekStart)
                    .hours(BigDecimal.ZERO)
                    .status(TimesheetStatus.DRAFT)
                    .build();
            t = timesheetRepository.save(t);
        }
        return toWeekResponse(t);
    }

    /**
     * Intern upserts one day of their own week. Recomputes the parent's
     * {@code hours} total. Only DRAFT / REJECTED weeks are editable —
     * SUBMITTED + APPROVED are locked (server enforced).
     */
    @Transactional
    public TimesheetWeekResponse patchDay(UUID timesheetId, DayOfWeek dayOfWeek,
                                          BigDecimal hours, String notes, User caller) {
        if (dayOfWeek == null) {
            throw new BadRequestException("dayOfWeek is required.");
        }
        if (hours == null || hours.compareTo(BigDecimal.ZERO) < 0
                || hours.compareTo(MAX_DAILY_HOURS) > 0) {
            throw new BadRequestException("hours must be between 0 and 24.");
        }
        Timesheet t = loadOwned(timesheetId, caller);
        if (t.getStatus() != TimesheetStatus.DRAFT
                && t.getStatus() != TimesheetStatus.REJECTED) {
            throw new BadRequestException(
                    "Only DRAFT or REJECTED weeks can be edited (current: " + t.getStatus() + ")");
        }

        TimesheetDay day = timesheetDayRepository
                .findByTimesheetIdAndDayOfWeek(t.getId(), dayOfWeek)
                .orElseGet(() -> TimesheetDay.builder()
                        .timesheet(t)
                        .dayOfWeek(dayOfWeek)
                        .hours(BigDecimal.ZERO)
                        .build());
        day.setHours(hours);
        day.setNotes(trimToNull(notes));
        timesheetDayRepository.save(day);

        // Recompute the parent total so legacy readers stay accurate.
        BigDecimal total = timesheetDayRepository.findByTimesheetIdOrderByDayOfWeekAsc(t.getId())
                .stream()
                .map(d -> d.getId() != null && d.getId().equals(day.getId()) ? hours : d.getHours())
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        if (total.compareTo(MAX_HOURS) > 0) {
            throw new BadRequestException("Weekly total cannot exceed 168 hours.");
        }
        t.setHours(total);
        timesheetRepository.save(t);

        return toWeekResponse(t);
    }

    /**
     * Queue of SUBMITTED timesheets — any REPORTING_MANAGER (or SUPER_ADMIN)
     * sees the full queue across all engagements. Per-engagement RM FK is
     * no longer the filter.
     */
    @Transactional(readOnly = true)
    public List<TimesheetWeekResponse> listPendingApproval(User caller) {
        if (caller == null) throw new ForbiddenException("Authentication required.");
        if (!isSuperAdmin(caller) && !hasRole(caller, UserRole.REPORTING_MANAGER)) {
            throw new ForbiddenException(
                    "Only REPORTING_MANAGER or SUPER_ADMIN can view the approval queue.");
        }
        return timesheetRepository.findAllSubmitted().stream()
                .map(this::toWeekResponse)
                .toList();
    }

    /**
     * Detail view for the RM approval page. Role-based: the intern who owns
     * the row, any TECHNICAL_EVALUATOR / REPORTING_MANAGER / OPERATIONS /
     * HR / SUPER_ADMIN. No per-engagement FK match.
     */
    @Transactional(readOnly = true)
    public TimesheetWeekResponse getWeek(UUID timesheetId, User caller) {
        Timesheet t = timesheetRepository.findByIdWithGraph(timesheetId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Timesheet not found: " + timesheetId));
        if (caller == null) throw new ForbiddenException("Authentication required.");
        UUID callerId = caller.getId();
        boolean isOwner = t.getIntern() != null
                && t.getIntern().getUser() != null
                && t.getIntern().getUser().getId().equals(callerId);
        if (!isOwner
                && !isSuperAdmin(caller)
                && !hasRole(caller, UserRole.REPORTING_MANAGER)
                && !hasRole(caller, UserRole.TRAINER)
                && !hasRole(caller, UserRole.ERM)
                && !hasRole(caller, UserRole.ERM)) {
            throw new ForbiddenException("Not authorised to view this timesheet.");
        }
        return toWeekResponse(t);
    }

    private TimesheetWeekResponse toWeekResponse(Timesheet t) {
        List<TimesheetDay> days = timesheetDayRepository
                .findByTimesheetIdOrderByDayOfWeekAsc(t.getId());
        List<TimesheetDayResponse> dayDtos = new ArrayList<>(days.size());
        for (TimesheetDay d : days) {
            dayDtos.add(new TimesheetDayResponse(
                    d.getId(), d.getDayOfWeek(), d.getHours(), d.getNotes()));
        }
        dayDtos.sort(Comparator.comparing(TimesheetDayResponse::dayOfWeek));
        User approver = t.getApprovedBy();
        var intern = t.getIntern();
        var internUser = intern != null ? intern.getUser() : null;
        return new TimesheetWeekResponse(
                t.getId(),
                internUser != null ? internUser.getId() : null,
                internUser != null ? internUser.getFullName() : null,
                t.getWeekStart(),
                t.getStatus(),
                t.getHours(),
                dayDtos,
                t.getReviewNote(),
                approver != null ? approver.getFullName() : null,
                t.getApprovedAt(),
                null,
                t.getCreatedAt()
        );
    }

    private static final BigDecimal MAX_DAILY_HOURS = new BigDecimal("24");

    private static boolean isSuperAdmin(User u) {
        return u.getRoles() != null && u.getRoles().contains(UserRole.SUPER_ADMIN);
    }

    private static boolean hasRole(User u, UserRole role) {
        return u.getRoles() != null && u.getRoles().contains(role);
    }

    private static String trimToNull(String raw) {
        if (raw == null) return null;
        String t = raw.trim();
        return t.isEmpty() ? null : t;
    }
}
