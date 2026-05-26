package com.skyzen.careers.controller;

import com.skyzen.careers.dto.admin.AdminUserResponse;
import com.skyzen.careers.dto.admin.CreateUserRequest;
import com.skyzen.careers.dto.admin.UpdateUserRoleRequest;
import com.skyzen.careers.dto.admin.UpdateUserStatusRequest;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.service.AdminUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    @PreAuthorize("hasRole('OPERATIONS')")
    public List<AdminUserResponse> list(
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) String search) {
        return adminUserService.list(role, search);
    }

    @PostMapping
    @PreAuthorize("hasRole('OPERATIONS')")
    public ResponseEntity<AdminUserResponse> create(@Valid @RequestBody CreateUserRequest req) {
        AdminUserResponse created = adminUserService.create(req);
        return ResponseEntity.created(URI.create("/api/v1/admin/users/" + created.getId()))
                .body(created);
    }

    @PutMapping("/{id}/role")
    @PreAuthorize("hasRole('OPERATIONS')")
    public AdminUserResponse updateRole(@PathVariable UUID id,
                                        @Valid @RequestBody UpdateUserRoleRequest req,
                                        @AuthenticationPrincipal User caller) {
        return adminUserService.updateRole(id, req, caller);
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('OPERATIONS')")
    public AdminUserResponse updateStatus(@PathVariable UUID id,
                                          @Valid @RequestBody UpdateUserStatusRequest req,
                                          @AuthenticationPrincipal User caller) {
        return adminUserService.updateStatus(id, req, caller);
    }
}
