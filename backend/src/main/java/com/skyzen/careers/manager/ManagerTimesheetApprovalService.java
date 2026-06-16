package com.skyzen.careers.manager;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.supervised.RejectTimesheetRequest;
import com.skyzen.careers.dto.supervised.TimesheetResponse;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.Timesheet;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.TimesheetRepository;
import com.skyzen.careers.service.TimesheetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Manager Phase 3B — write side. Wraps the existing
 * {@link TimesheetService#approve(UUID, User)} and
 * {@link TimesheetService#reject(UUID, RejectTimesheetRequest, User)} with a
 * resource-ownership gate: a MANAGER may approve/reject ONLY when the
 * timesheet's intern is assigned to them via
 * {@code intern_lifecycles.manager_id}. SUPER_ADMIN bypasses the gate.
 *
 * <p>The gate runs at the service layer (not just {@code @PreAuthorize}),
 * so a direct API call with a valid session token still 403s when the
 * caller isn't the assigned manager. The actual SUBMITTED → APPROVED /
 * REJECTED transition is delegated to {@code TimesheetService} unchanged,
 * preserving the single state machine + approver-id wiring + (any
 * future) notification path.</p>
 *
 * <p>An audit row is written before delegation so Manager actions are
 * recorded even though the legacy timesheet approval path doesn't write
 * audits today — a small, additive improvement scoped to Manager
 * decisions only.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ManagerTimesheetApprovalService {

    private final TimesheetRepository timesheetRepository;
    private final InternLifecycleRepository internLifecycleRepository;
    private final TimesheetService timesheetService;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public TimesheetResponse approve(UUID timesheetId, User caller) {
        gate(timesheetId, caller, "approve");
        TimesheetResponse out = timesheetService.approve(timesheetId, caller);
        writeAudit(caller, timesheetId, "TIMESHEET_APPROVED_BY_MANAGER", null);
        return out;
    }

    @Transactional
    public TimesheetResponse reject(UUID timesheetId,
                                     RejectTimesheetRequest req,
                                     User caller) {
        gate(timesheetId, caller, "reject");
        TimesheetResponse out = timesheetService.reject(timesheetId, req, caller);
        writeAudit(caller, timesheetId, "TIMESHEET_REJECTED_BY_MANAGER",
                req != null ? req.getReason() : null);
        return out;
    }

    /**
     * Phase B2 — batch-approve every VERIFIED timesheet the caller is
     * the assigned Manager for. Skips wrong-state rows silently (returns
     * a per-id outcome map). Each row is approved via the per-row
     * service so the state-machine gate + audit + AFTER_COMMIT notify
     * chain run identically to the single-action path.
     */
    @Transactional
    public java.util.Map<UUID, String> approveBatch(java.util.List<UUID> ids, User caller) {
        java.util.Map<UUID, String> out = new java.util.LinkedHashMap<>();
        if (ids == null || ids.isEmpty()) return out;
        for (UUID id : ids) {
            try {
                approve(id, caller);
                out.put(id, "APPROVED");
            } catch (ForbiddenException fe) {
                out.put(id, "FORBIDDEN");
            } catch (Exception e) {
                String msg = e.getMessage() != null ? e.getMessage() : "FAILED";
                // Cap so the response doesn't carry pages of stack traces.
                out.put(id, msg.length() > 200 ? msg.substring(0, 200) : msg);
            }
        }
        return out;
    }

    // ── Resource ownership gate ──────────────────────────────────────────

    /**
     * Loads the timesheet, resolves the intern's lifecycle, and confirms
     * the caller is the assigned manager OR a SUPER_ADMIN. Throws
     * ForbiddenException otherwise — same behavior whether the caller is
     * a manager hitting their own UI or hand-crafting a request.
     */
    private void gate(UUID timesheetId, User caller, String action) {
        if (caller == null) throw new ForbiddenException("Authentication required");
        boolean superAdmin = caller.getRoles() != null
                && caller.getRoles().contains(UserRole.SUPER_ADMIN);
        if (superAdmin) return;
        if (caller.getRoles() == null
                || !caller.getRoles().contains(UserRole.MANAGER)) {
            throw new ForbiddenException("MANAGER role required to " + action + " a timesheet");
        }

        Timesheet ts = timesheetRepository.findByIdWithGraph(timesheetId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Timesheet not found: " + timesheetId));
        UUID internUserId = ts.getIntern() != null && ts.getIntern().getUser() != null
                ? ts.getIntern().getUser().getId() : null;
        if (internUserId == null) {
            throw new ForbiddenException(
                    "Cannot resolve intern for timesheet " + timesheetId);
        }
        InternLifecycle lc = internLifecycleRepository.findByUserId(internUserId)
                .orElseThrow(() -> new ForbiddenException(
                        "No InternLifecycle for intern — cannot verify ownership"));
        if (lc.getManagerId() == null
                || !caller.getId().equals(lc.getManagerId())) {
            throw new ForbiddenException(
                    "Not the assigned Manager for this intern (" + action + ")");
        }
    }

    // ── Audit ────────────────────────────────────────────────────────────

    private void writeAudit(User caller, UUID timesheetId,
                             String action, String reason) {
        try {
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("timesheetId", timesheetId.toString());
            if (reason != null) after.put("reason", reason);
            AuditLog row = AuditLog.builder()
                    .userId(caller != null ? caller.getId() : null)
                    .entityType("Timesheet")
                    .entityId(timesheetId)
                    .action(action)
                    .afterJson(objectMapper.writeValueAsString(after))
                    .build();
            auditLogRepository.save(row);
        } catch (Exception e) {
            log.warn("[ManagerTimesheetApproval] audit write failed: {}", e.getMessage());
        }
    }
}
