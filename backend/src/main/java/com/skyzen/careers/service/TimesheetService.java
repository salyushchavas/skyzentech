package com.skyzen.careers.service;

import com.skyzen.careers.dto.supervised.LogTimesheetRequest;
import com.skyzen.careers.dto.supervised.RejectTimesheetRequest;
import com.skyzen.careers.dto.supervised.TimesheetListResponse;
import com.skyzen.careers.dto.supervised.TimesheetResponse;
import com.skyzen.careers.dto.supervised.UpdateTimesheetRequest;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.Timesheet;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.TimesheetStatus;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.TimesheetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TimesheetService {

    private static final BigDecimal MAX_HOURS = new BigDecimal("168");

    private final TimesheetRepository timesheetRepository;
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
}
