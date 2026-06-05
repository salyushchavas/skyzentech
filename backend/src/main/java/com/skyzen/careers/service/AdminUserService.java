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
