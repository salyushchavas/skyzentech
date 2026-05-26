package com.skyzen.careers.service;

import com.skyzen.careers.dto.admin.AdminUserResponse;
import com.skyzen.careers.dto.admin.CreateUserRequest;
import com.skyzen.careers.dto.admin.UpdateUserRoleRequest;
import com.skyzen.careers.dto.admin.UpdateUserStatusRequest;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    /**
     * Roles an OPERATIONS admin may assign through the admin UI. APPLICANT and
     * INTERN are excluded by design — those are candidate-side roles set by
     * registration and the engagement-activation flip, not by the admin.
     */
    private static final Set<UserRole> STAFF_ROLES = EnumSet.of(
            UserRole.OPERATIONS,
            UserRole.HR_COMPLIANCE,
            UserRole.TECHNICAL_SUPERVISOR,
            UserRole.EXECUTIVE);

    private static final String STAFF_ROLE_MSG =
            "role must be a STAFF role (OPERATIONS / HR_COMPLIANCE / TECHNICAL_SUPERVISOR / EXECUTIVE)";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

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

        // Self-lockout guard: the acting OPERATIONS user can't demote themselves
        // out of the OPERATIONS role. Without this, the last operator could lock
        // the org out of admin actions by accident.
        if (caller != null && caller.getId().equals(target.getId())
                && target.getRoles().contains(UserRole.OPERATIONS)
                && req.getRole() != UserRole.OPERATIONS) {
            throw new ConflictException("You cannot remove your own OPERATIONS role");
        }

        target.setRoles(EnumSet.of(req.getRole()));
        userRepository.save(target);
        return toResponse(target);
    }

    @Transactional
    public AdminUserResponse updateStatus(UUID id, UpdateUserStatusRequest req, User caller) {
        User target = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));

        // Self-lockout guard: admins can't deactivate themselves.
        if (caller != null && caller.getId().equals(target.getId())
                && Boolean.FALSE.equals(req.getActive())) {
            throw new ConflictException("You cannot deactivate your own account");
        }

        // Idempotent — toggling to the same value is a no-op and still returns 200.
        if (!Boolean.valueOf(req.getActive()).equals(target.getActive())) {
            target.setActive(req.getActive());
            userRepository.save(target);
        }
        return toResponse(target);
    }

    private AdminUserResponse toResponse(User u) {
        return AdminUserResponse.builder()
                .id(u.getId())
                .name(u.getFullName())
                .email(u.getEmail())
                .roles(u.getRoles())
                .active(u.getActive() == null ? Boolean.TRUE : u.getActive())
                .createdAt(u.getCreatedAt())
                .build();
    }
}
