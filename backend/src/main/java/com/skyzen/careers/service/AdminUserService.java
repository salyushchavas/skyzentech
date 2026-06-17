package com.skyzen.careers.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.admin.AdminUserResponse;
import com.skyzen.careers.dto.admin.CreateUserRequest;
import com.skyzen.careers.dto.admin.UpdateUserRoleRequest;
import com.skyzen.careers.dto.admin.UpdateUserStatusRequest;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminUserService {

    /**
     * Roles a SUPER_ADMIN may assign through the admin UI. APPLICANT and INTERN
     * are excluded by design — those are candidate-side roles set by registration
     * and the engagement-activation flip, not by the admin.
     */
    private static final Set<UserRole> STAFF_ROLES = EnumSet.of(
            UserRole.SUPER_ADMIN,
            UserRole.ERM,
            UserRole.ERM,
            UserRole.TRAINER,
            UserRole.MANAGER);

    private static final String STAFF_ROLE_MSG =
            "role must be a STAFF role (SUPER_ADMIN / OPERATIONS / HR / TECHNICAL_EVALUATOR / EXECUTIVE)";

    /**
     * Surfaced both to the API caller (as a 409) and as the message the
     * frontend renders in its blocked-state UI. Keep the wording stable so
     * the frontend can match on it if it ever needs to.
     */
    public static final String LAST_SUPER_ADMIN_MSG =
            "Cannot remove the last active SUPER_ADMIN — promote another user first.";

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<AdminUserResponse> list(UserRole roleFilter, String search) {
        String q = (search != null && !search.isBlank()) ? search.trim().toLowerCase() : null;
        return userRepository.findAll().stream()
                .filter(u -> roleFilter == null || u.getRoles().contains(roleFilter))
                .filter(u -> q == null
                        || (u.getFullName() != null && u.getFullName().toLowerCase().contains(q))
                        || (u.getEmail() != null && u.getEmail().toLowerCase().contains(q)))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AdminUserResponse create(CreateUserRequest req) {
        UserRole role = req.getRole();
        if (!STAFF_ROLES.contains(role)) {
            throw new BadRequestException(STAFF_ROLE_MSG);
        }
        String email = req.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("A user with that email already exists");
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(req.getInitialPassword()))
                .fullName(req.getName().trim())
                .roles(EnumSet.of(role))
                .active(true)
                .build();
        user = userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public AdminUserResponse updateRole(UUID id, UpdateUserRoleRequest req, User caller) {
        if (!STAFF_ROLES.contains(req.getRole())) {
            throw new BadRequestException(STAFF_ROLE_MSG);
        }
        User target = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));

        Set<UserRole> beforeRoles = target.getRoles() != null
                ? EnumSet.copyOf(target.getRoles())
                : EnumSet.noneOf(UserRole.class);
        UserRole newRole = req.getRole();

        // Self-lockout guard: the acting SUPER_ADMIN can't demote themselves out
        // of the SUPER_ADMIN role. Without this, the last owner could lock the
        // org out of admin actions by accident.
        if (caller != null && caller.getId().equals(target.getId())
                && beforeRoles.contains(UserRole.SUPER_ADMIN)
                && newRole != UserRole.SUPER_ADMIN) {
            throw new ConflictException("You cannot remove your own SUPER_ADMIN role");
        }

        // Org-wide last-SA guard: if this change would remove SUPER_ADMIN from
        // the only remaining active SUPER_ADMIN, refuse. Counts ACTIVE accounts
        // only — a deactivated SA cannot log in, so they don't satisfy "there's
        // still an admin around."
        if (beforeRoles.contains(UserRole.SUPER_ADMIN)
                && newRole != UserRole.SUPER_ADMIN
                && countActiveSuperAdminsExcluding(target.getId()) == 0) {
            throw new ConflictException(LAST_SUPER_ADMIN_MSG);
        }

        target.setRoles(EnumSet.of(newRole));
        target = userRepository.save(target);

        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("from", rolesAsString(beforeRoles));
        snap.put("to", newRole.name());
        snap.put("targetEmail", target.getEmail());
        writeAudit("USER_ROLE_CHANGE", target, caller, snap);

        return toResponse(target);
    }

    @Transactional
    public AdminUserResponse updateStatus(UUID id, UpdateUserStatusRequest req, User caller) {
        User target = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));

        boolean nextActive = Boolean.TRUE.equals(req.getActive());
        Boolean currentActive = target.getActive();

        // Self-lockout guard: admins can't deactivate themselves.
        if (!nextActive
                && caller != null && caller.getId().equals(target.getId())) {
            throw new ConflictException("You cannot deactivate your own account");
        }

        // Org-wide last-SA guard: don't let the only active SA be deactivated.
        if (!nextActive
                && target.getRoles() != null
                && target.getRoles().contains(UserRole.SUPER_ADMIN)
                && countActiveSuperAdminsExcluding(target.getId()) == 0) {
            throw new ConflictException(LAST_SUPER_ADMIN_MSG);
        }

        // Idempotent — toggling to the same value is a no-op and still returns 200.
        // No audit row on a no-op either — keeps the audit log clean.
        if (currentActive == null || nextActive != currentActive) {
            target.setActive(nextActive);
            target = userRepository.save(target);
            Map<String, Object> snap = new LinkedHashMap<>();
            snap.put("active", nextActive);
            snap.put("targetEmail", target.getEmail());
            writeAudit("USER_ACTIVATION_CHANGE", target, caller, snap);
        }
        return toResponse(target);
    }

    /**
     * Hard-delete a candidate-side user (intern/applicant) AND every row
     * scoped to them. Surgical alternative to the boot-only
     * {@code CleanSlateRunner} full-wipe — lets the SUPER_ADMIN drop a
     * single test candidate from the admin panel between runs without
     * resetting every other candidate.
     *
     * <p>Refuses on:</p>
     * <ul>
     *   <li>self-delete (the caller cannot delete themselves)</li>
     *   <li>any user with a non-INTERN role (staff are protected)</li>
     *   <li>the last active SUPER_ADMIN (defence in depth — staff are
     *       already refused above, but the check is cheap)</li>
     * </ul>
     *
     * <p>The phased delete mirrors {@code CleanSlateRunner}'s table list
     * but scopes every DELETE to this user's {@code candidate_id} /
     * {@code intern_lifecycle_id} / {@code application_id} chain.
     * {@code audit_logs} rows referencing the deleted user are PRESERVED
     * so the forensic trail survives — consistent with the boot-time
     * runner's behaviour. Each per-table DELETE is wrapped so a missing
     * table on a partial deployment doesn't halt the operation.</p>
     */
    @Transactional
    public Map<String, Long> deleteUser(UUID id, User caller) {
        User target = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));

        if (caller != null && caller.getId().equals(target.getId())) {
            throw new ConflictException("You cannot delete your own account");
        }
        Set<UserRole> roles = target.getRoles();
        if (roles == null || roles.isEmpty()
                || roles.stream().anyMatch(r -> r != UserRole.INTERN)) {
            throw new ConflictException(
                    "Hard-delete is restricted to candidate/intern users (roles == {INTERN}). "
                            + "Use Deactivate for staff accounts.");
        }
        if (roles.contains(UserRole.SUPER_ADMIN)
                && countActiveSuperAdminsExcluding(target.getId()) == 0) {
            throw new ConflictException(LAST_SUPER_ADMIN_MSG);
        }

        UUID userId = target.getId();
        // SQL fragments resolved against the live tables — every DELETE is
        // self-contained against the user_id, so we never depend on a
        // Java-side cache of candidate_id / lifecycle_id (the prior
        // approach silently skipped phases when queryForUuid returned
        // null even though the rows existed).
        String candidateIds = "(SELECT id FROM candidates WHERE user_id = ?)";
        String lifecycleIds = "(SELECT id FROM intern_lifecycles WHERE user_id = ?)";
        String applicationIds = "(SELECT id FROM applications WHERE candidate_id IN "
                + candidateIds + ")";
        String projectIds = "(SELECT id FROM projects WHERE intern_lifecycle_id IN "
                + lifecycleIds + ")";
        String internEvalIds = "(SELECT id FROM intern_evaluations "
                + "WHERE intern_lifecycle_id IN " + lifecycleIds + ")";
        String offerIds = "(SELECT id FROM offers WHERE application_id IN "
                + applicationIds + ")";
        String interviewIds = "(SELECT id FROM interviews WHERE application_id IN "
                + applicationIds + ")";
        String screeningIds = "(SELECT id FROM screenings WHERE application_id IN "
                + applicationIds + ")";
        String timesheetIds = "(SELECT id FROM timesheets "
                + "WHERE intern_lifecycle_id IN " + lifecycleIds + ")";
        String documentPacketIds = "(SELECT id FROM document_packets "
                + "WHERE intern_lifecycle_id IN " + lifecycleIds + ")";
        String documentTaskIds = "(SELECT id FROM document_tasks "
                + "WHERE packet_id IN " + documentPacketIds + ")";
        String onboardingPacketIds = "(SELECT id FROM onboarding_packets "
                + "WHERE intern_lifecycle_id IN " + lifecycleIds + ")";
        String exitRecordIds = "(SELECT id FROM exit_records "
                + "WHERE intern_lifecycle_id IN " + lifecycleIds + ")";

        Map<String, Long> deleted = new LinkedHashMap<>();

        // Phase 1 — notification leaves
        del(deleted, "user_notifications",
                "DELETE FROM user_notifications "
                        + "WHERE recipient_user_id = ? OR subject_user_id = ?",
                userId, userId);
        del(deleted, "sent_notifications",
                "DELETE FROM sent_notifications WHERE LOWER(recipient) = LOWER(?)",
                target.getEmail());

        // Phase 2 — evaluation children + I-983
        del(deleted, "evaluation_rubric_scores",
                "DELETE FROM evaluation_rubric_scores "
                        + "WHERE evaluation_id IN " + internEvalIds, userId);
        del(deleted, "evaluation_self_reviews",
                "DELETE FROM evaluation_self_reviews "
                        + "WHERE evaluation_id IN " + internEvalIds, userId);
        del(deleted, "evaluation_amendments",
                "DELETE FROM evaluation_amendments "
                        + "WHERE evaluation_id IN " + internEvalIds, userId);
        del(deleted, "intern_evaluations",
                "DELETE FROM intern_evaluations "
                        + "WHERE intern_lifecycle_id IN " + lifecycleIds, userId);
        del(deleted, "i983_evaluations",
                "DELETE FROM i983_evaluations "
                        + "WHERE intern_lifecycle_id IN " + lifecycleIds, userId);

        // Phase 3 — project graph
        del(deleted, "project_assignment_event_logs",
                "DELETE FROM project_assignment_event_logs "
                        + "WHERE project_id IN " + projectIds, userId);
        del(deleted, "project_submissions",
                "DELETE FROM project_submissions "
                        + "WHERE project_id IN " + projectIds, userId);
        del(deleted, "project_workspace_files",
                "DELETE FROM project_workspace_files "
                        + "WHERE project_id IN " + projectIds, userId);
        del(deleted, "project_tasks",
                "DELETE FROM project_tasks "
                        + "WHERE project_id IN " + projectIds, userId);
        del(deleted, "project_repositories",
                "DELETE FROM project_repositories "
                        + "WHERE project_id IN " + projectIds, userId);
        del(deleted, "project_assignments",
                "DELETE FROM project_assignments "
                        + "WHERE intern_id IN " + lifecycleIds, userId);
        del(deleted, "qa_sessions",
                "DELETE FROM qa_sessions "
                        + "WHERE project_id IN " + projectIds, userId);
        del(deleted, "projects",
                "DELETE FROM projects "
                        + "WHERE intern_lifecycle_id IN " + lifecycleIds, userId);

        // Phase 4 — timesheets + weekly meetings
        del(deleted, "timesheet_days",
                "DELETE FROM timesheet_days "
                        + "WHERE timesheet_id IN " + timesheetIds, userId);
        del(deleted, "timesheets",
                "DELETE FROM timesheets "
                        + "WHERE intern_lifecycle_id IN " + lifecycleIds, userId);
        del(deleted, "weekly_meetings",
                "DELETE FROM weekly_meetings "
                        + "WHERE intern_lifecycle_id IN " + lifecycleIds, userId);

        // Phase 5 — document packets (Phase 8.2)
        del(deleted, "document_task_review_logs",
                "DELETE FROM document_task_review_logs "
                        + "WHERE task_id IN " + documentTaskIds, userId);
        del(deleted, "document_tasks",
                "DELETE FROM document_tasks "
                        + "WHERE packet_id IN " + documentPacketIds, userId);
        del(deleted, "document_packets",
                "DELETE FROM document_packets "
                        + "WHERE intern_lifecycle_id IN " + lifecycleIds, userId);

        // Phase 6 — onboarding_tasks FIRST (before offers), because
        // onboarding_tasks.offer_id → offers blocks the offers DELETE.
        // Split into TWO statements so a missing onboarding_packets
        // table on partial deployments doesn't poison the candidate_id
        // sweep (an OR-joined DELETE fails wholesale on grammar).
        del(deleted, "onboarding_tasks (via packet)",
                "DELETE FROM onboarding_tasks "
                        + "WHERE packet_id IN " + onboardingPacketIds, userId);
        del(deleted, "onboarding_tasks (via candidate)",
                "DELETE FROM onboarding_tasks "
                        + "WHERE candidate_id IN " + candidateIds, userId);
        del(deleted, "onboarding_packets",
                "DELETE FROM onboarding_packets "
                        + "WHERE intern_lifecycle_id IN " + lifecycleIds, userId);

        // Phase 7 — exit
        del(deleted, "exit_checklist_items",
                "DELETE FROM exit_checklist_items "
                        + "WHERE exit_record_id IN " + exitRecordIds, userId);
        del(deleted, "exit_feedback",
                "DELETE FROM exit_feedback "
                        + "WHERE exit_record_id IN " + exitRecordIds, userId);
        del(deleted, "exit_records",
                "DELETE FROM exit_records "
                        + "WHERE intern_lifecycle_id IN " + lifecycleIds, userId);

        // Phase 8 — offer + interview + screening LEAVES (children of
        // offers / interviews / screenings, NOT the parents
        // themselves). Parents come after engagements has died, since
        // engagement.offer_id and engagement.application_id block
        // offers and applications respectively.
        del(deleted, "offer_event_logs",
                "DELETE FROM offer_event_logs WHERE offer_id IN " + offerIds, userId);
        del(deleted, "offer_envelopes",
                "DELETE FROM offer_envelopes WHERE offer_id IN " + offerIds, userId);
        del(deleted, "interview_event_logs",
                "DELETE FROM interview_event_logs WHERE interview_id IN " + interviewIds, userId);
        del(deleted, "interview_scorecards",
                "DELETE FROM interview_scorecards WHERE interview_id IN " + interviewIds, userId);
        del(deleted, "interviews",
                "DELETE FROM interviews WHERE application_id IN " + applicationIds, userId);
        del(deleted, "screening_answers",
                "DELETE FROM screening_answers WHERE screening_id IN " + screeningIds, userId);
        del(deleted, "screenings",
                "DELETE FROM screenings WHERE application_id IN " + applicationIds, userId);
        del(deleted, "application_decision_logs",
                "DELETE FROM application_decision_logs WHERE application_id IN "
                        + applicationIds, userId);

        // Phase 9 — compliance. Order: everify_cases (via i9_form_id)
        // → i9_forms (which has engagement_id + candidate_id FKs to
        // free) → i983_plans / training_plans / work_authorization.
        del(deleted, "everify_cases",
                "DELETE FROM everify_cases WHERE i9_form_id IN "
                        + "(SELECT id FROM i9_forms WHERE candidate_id IN "
                        + candidateIds + ")", userId);
        del(deleted, "i9_forms",
                "DELETE FROM i9_forms WHERE candidate_id IN " + candidateIds, userId);
        del(deleted, "i983_plans",
                "DELETE FROM i983_plans WHERE candidate_id IN " + candidateIds, userId);
        del(deleted, "training_plans",
                "DELETE FROM training_plans WHERE candidate_id IN " + candidateIds, userId);
        del(deleted, "work_authorization_records",
                "DELETE FROM work_authorization_records WHERE user_id = ?", userId);

        // Phase 10 — engagements. Engagement has 3 outgoing FKs that
        // ALL must clear before its parents can be deleted:
        //   engagement.offer_id → offers      (blocks offers DELETE)
        //   engagement.application_id → applications (blocks applications)
        //   engagement.candidate_id → candidates     (blocks candidates)
        // So engagements MUST die before offers / applications.
        // Split application_id / candidate_id sweep so a missing
        // applications table doesn't poison the candidate_id branch.
        del(deleted, "engagements (via application)",
                "DELETE FROM engagements WHERE application_id IN " + applicationIds, userId);
        del(deleted, "engagements (via candidate)",
                "DELETE FROM engagements WHERE candidate_id IN " + candidateIds, userId);

        // Phase 11 — offers (after engagements + onboarding_tasks have
        // released their offer_id FKs).
        del(deleted, "offers",
                "DELETE FROM offers WHERE application_id IN " + applicationIds, userId);

        // Phase 12 — applications (after offers + engagements + every
        // application-keyed child has died).
        del(deleted, "applications",
                "DELETE FROM applications WHERE candidate_id IN " + candidateIds, userId);

        // Phase 13 — resumes. MUST come after applications because
        // applications.resume_id → resumes blocks resumes DELETE if
        // any application still references the row.
        del(deleted, "resumes",
                "DELETE FROM resumes WHERE candidate_id IN " + candidateIds, userId);

        // Phase 11 — identity rows pointing at the user (always run by
        // user_id directly so a previously-failed partial delete still
        // gets cleaned up on retry).
        del(deleted, "intern_lifecycles",
                "DELETE FROM intern_lifecycles WHERE user_id = ?", userId);
        del(deleted, "candidates",
                "DELETE FROM candidates WHERE user_id = ?", userId);

        // Phase 12 — auxiliary user-keyed rows
        del(deleted, "documents",
                "DELETE FROM documents WHERE owner_user_id = ?", userId);
        del(deleted, "password_reset_tokens",
                "DELETE FROM password_reset_tokens WHERE user_id = ?", userId);
        del(deleted, "user_sessions",
                "DELETE FROM user_sessions WHERE user_id = ?", userId);
        del(deleted, "support_ticket_replies",
                "DELETE FROM support_ticket_replies WHERE author_user_id = ? "
                        + "OR ticket_id IN "
                        + "(SELECT id FROM support_tickets WHERE opener_user_id = ?)",
                userId, userId);
        del(deleted, "support_tickets",
                "DELETE FROM support_tickets WHERE opener_user_id = ?", userId);

        // Audit the delete BEFORE we drop the user row — caller is the
        // actor; target is the subject. Both audit columns are plain
        // UUIDs (no FK), so the row survives the user delete and stays
        // as the forensic record. Total deleted-row count is the headline
        // value; per-table breakdown lives in afterJson for debugging.
        long totalRows = deleted.values().stream()
                .filter(n -> n != null && n > 0)
                .mapToLong(Long::longValue).sum();
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("targetEmail", target.getEmail());
        snap.put("targetUserId", userId.toString());
        snap.put("totalRowsDeleted", totalRows);
        snap.put("perTable", deleted);
        writeAudit("USER_HARD_DELETE", target, caller, snap);

        // Phase 13 — user_roles MUST be deleted explicitly. The
        // @ElementCollection cascade only fires for JPA deletes; raw
        // SQL bypasses it, so without this the FK from user_roles.user_id
        // → users.id blocks the terminal users delete. NOT wrapped in a
        // savepoint — if this fails the whole txn must rollback so we
        // don't silently leave a broken user row.
        long roleRows = jdbcTemplate.update(
                "DELETE FROM user_roles WHERE user_id = ?", userId);
        deleted.put("user_roles", roleRows);

        // Pre-flight: enumerate any child rows still referencing this
        // user via candidates / intern_lifecycles / any direct user FK.
        // Surfaces the real blocker in the error message instead of
        // letting the GlobalExceptionHandler swallow the FK violation
        // into a generic "data integrity violation".
        Map<String, Object> blockers = findBlockers(userId);
        if (!blockers.isEmpty()) {
            log.warn("[AdminUserService] pre-flight found blockers for user {} ({}): {}",
                    userId, target.getEmail(), blockers);
            throw new ConflictException(
                    "User row still referenced — wipe is incomplete. Blockers: "
                            + blockers + ". Per-table summary: " + deleted);
        }

        // Phase 14 — terminal user delete. NOT wrapped in a savepoint
        // either — if any FK still references this row we want to fail
        // the whole transaction so the caller sees the error instead of
        // a misleading 200 + a still-present user row.
        long userRows = jdbcTemplate.update(
                "DELETE FROM users WHERE id = ?", userId);
        deleted.put("users", userRows);
        if (userRows == 0) {
            // Defensive — should never happen because we loaded the user
            // by id above. If it does, throw so the txn rolls back.
            throw new ConflictException(
                    "User row was not removed (concurrent delete or FK retention). "
                            + "Per-table summary: " + deleted);
        }

        log.warn("[AdminUserService] hard-deleted user {} ({}) — totalRows={}, perTable={}",
                userId, target.getEmail(), totalRows, deleted);
        return deleted;
    }

    /**
     * Per-table DELETE wrapper. Each statement runs inside its own
     * PostgreSQL SAVEPOINT so a column-not-exists or missing-table
     * error rolls back ONLY that one statement instead of poisoning
     * the outer transaction (Postgres aborts every subsequent command
     * until the txn ends if any statement fails). Records the row
     * count under {@code tableName}; failed statements are recorded as
     * -1 so the per-table summary still shows what happened.
     */
    private void del(Map<String, Long> deleted, String tableName, String sql, Object... args) {
        String savepoint = "sp_" + tableName.replaceAll("[^a-zA-Z0-9_]", "_");
        try {
            jdbcTemplate.execute("SAVEPOINT " + savepoint);
        } catch (Exception spErr) {
            // No active transaction — fall back to the legacy try/catch
            // path. Should never happen for a @Transactional method call.
            try {
                long n = jdbcTemplate.update(sql, args);
                deleted.put(tableName, n);
            } catch (Exception e) {
                log.warn("[AdminUserService] delete {} FAILED (no savepoint, fallback): {}",
                        tableName, e.getMessage());
                deleted.put(tableName, -1L);
            }
            return;
        }
        try {
            long n = jdbcTemplate.update(sql, args);
            jdbcTemplate.execute("RELEASE SAVEPOINT " + savepoint);
            deleted.put(tableName, n);
        } catch (Exception e) {
            try {
                jdbcTemplate.execute("ROLLBACK TO SAVEPOINT " + savepoint);
                jdbcTemplate.execute("RELEASE SAVEPOINT " + savepoint);
            } catch (Exception rbErr) {
                log.warn("[AdminUserService] rollback to {} failed: {}",
                        savepoint, rbErr.getMessage());
            }
            // WARN (not DEBUG) so the row-cause shows up in Railway
            // logs and we can see which column/FK is breaking the wipe.
            log.warn("[AdminUserService] delete {} FAILED: {}", tableName, e.getMessage());
            deleted.put(tableName, -1L);
        }
    }

    /**
     * Pre-flight: count any rows still referencing this user via the
     * three primary identity tables (users / candidates /
     * intern_lifecycles) plus the standard child-FK tables we sweep.
     * Returns a map of {tableName -> rowCount} for everything still
     * holding on. Empty map ⇒ safe to issue the terminal users DELETE.
     */
    private Map<String, Object> findBlockers(UUID userId) {
        Map<String, Object> out = new LinkedHashMap<>();
        // Probe each suspect — wrap in savepoint so a missing table
        // doesn't poison the txn. The COUNT(*) sql is parameter-safe
        // because table/column names are hard-coded.
        Map<String, String> probes = new LinkedHashMap<>();
        probes.put("candidates",
                "SELECT COUNT(*) FROM candidates WHERE user_id = ?");
        probes.put("intern_lifecycles",
                "SELECT COUNT(*) FROM intern_lifecycles WHERE user_id = ?");
        probes.put("user_roles",
                "SELECT COUNT(*) FROM user_roles WHERE user_id = ?");
        probes.put("password_reset_tokens",
                "SELECT COUNT(*) FROM password_reset_tokens WHERE user_id = ?");
        probes.put("user_sessions",
                "SELECT COUNT(*) FROM user_sessions WHERE user_id = ?");
        probes.put("documents",
                "SELECT COUNT(*) FROM documents WHERE owner_user_id = ?");
        probes.put("user_notifications",
                "SELECT COUNT(*) FROM user_notifications "
                        + "WHERE recipient_user_id = ? OR subject_user_id = ?");
        probes.put("work_authorization_records",
                "SELECT COUNT(*) FROM work_authorization_records WHERE user_id = ?");
        probes.put("support_tickets",
                "SELECT COUNT(*) FROM support_tickets WHERE opener_user_id = ?");

        for (Map.Entry<String, String> e : probes.entrySet()) {
            String savepoint = "probe_" + e.getKey().replaceAll("[^a-zA-Z0-9_]", "_");
            try {
                jdbcTemplate.execute("SAVEPOINT " + savepoint);
                Long n;
                if (e.getKey().equals("user_notifications")) {
                    n = jdbcTemplate.queryForObject(e.getValue(), Long.class, userId, userId);
                } else {
                    n = jdbcTemplate.queryForObject(e.getValue(), Long.class, userId);
                }
                jdbcTemplate.execute("RELEASE SAVEPOINT " + savepoint);
                if (n != null && n > 0) out.put(e.getKey(), n);
            } catch (Exception probeErr) {
                try {
                    jdbcTemplate.execute("ROLLBACK TO SAVEPOINT " + savepoint);
                    jdbcTemplate.execute("RELEASE SAVEPOINT " + savepoint);
                } catch (Exception ignored) {}
                // Missing-table probe is harmless.
            }
        }
        return out;
    }

    private UUID queryForUuid(String sql, Object... args) {
        try {
            return jdbcTemplate.queryForObject(sql, (rs, n) -> {
                String s = rs.getString(1);
                return s != null ? UUID.fromString(s) : null;
            }, args);
        } catch (Exception e) {
            return null;
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Counts ACTIVE users whose role set contains SUPER_ADMIN, excluding the
     * target id. Drives both the role-change and deactivation last-SA guards
     * so the two refusals share semantics. In-memory walk — fine for staff
     * scale; if we ever ship to thousands of staff users this becomes a
     * native count query.
     */
    private long countActiveSuperAdminsExcluding(UUID excludeId) {
        return userRepository.findAll().stream()
                .filter(u -> u.getId() != null && !u.getId().equals(excludeId))
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .filter(u -> u.getRoles() != null
                        && u.getRoles().contains(UserRole.SUPER_ADMIN))
                .count();
    }

    private static String rolesAsString(Set<UserRole> roles) {
        if (roles == null || roles.isEmpty()) return "(none)";
        StringBuilder sb = new StringBuilder();
        for (UserRole r : roles) {
            if (sb.length() > 0) sb.append(',');
            sb.append(r.name());
        }
        return sb.toString();
    }

    private void writeAudit(String action, User target, User caller, Map<String, Object> snapshot) {
        Map<String, Object> after = snapshot != null
                ? new LinkedHashMap<>(snapshot) : new LinkedHashMap<>();
        AuditLog entry = AuditLog.builder()
                .entityType("User")
                .entityId(target.getId())
                .action(action)
                .userId(caller != null ? caller.getId() : null)
                .afterJson(serializeJson(after))
                .build();
        try {
            auditLogRepository.save(entry);
        } catch (Exception e) {
            // Audit failure is best-effort — never block the user-management
            // mutation itself. (Same pattern as WeeklyReport +
            // SuperAdminPromotionRunner.)
            log.warn("Failed to write {} audit row (non-fatal): {}", action, e.getMessage());
        }
    }

    private String serializeJson(Map<String, Object> snapshot) {
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize audit snapshot: {}", e.getMessage());
            return String.valueOf(snapshot);
        }
    }

    private AdminUserResponse toResponse(User u) {
        return AdminUserResponse.builder()
                .id(u.getId())
                .name(u.getFullName())
                .email(u.getEmail())
                .roles(u.getRoles())
                .active(u.getActive() == null ? Boolean.TRUE : u.getActive())
                .createdAt(u.getCreatedAt())
                .applicantId(u.getApplicantId())
                .build();
    }
}
