package com.skyzen.careers.controller;

import com.skyzen.careers.dto.admin.AdminEntityResponse;
import com.skyzen.careers.dto.admin.CreateEntityRequest;
import com.skyzen.careers.dto.admin.UpdateEntityRequest;
import com.skyzen.careers.service.AdminEntityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/entities")
@RequiredArgsConstructor
public class AdminEntityController {

    private final AdminEntityService adminEntityService;

    @GetMapping
    @PreAuthorize("hasRole('OPERATIONS')")
    public List<AdminEntityResponse> list() {
        return adminEntityService.list();
    }

    @PostMapping
    @PreAuthorize("hasRole('OPERATIONS')")
    public ResponseEntity<AdminEntityResponse> create(@Valid @RequestBody CreateEntityRequest req) {
        AdminEntityResponse created = adminEntityService.create(req);
        return ResponseEntity.created(URI.create("/api/v1/admin/entities/" + created.getId()))
                .body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OPERATIONS')")
    public AdminEntityResponse update(@PathVariable UUID id,
                                      @Valid @RequestBody UpdateEntityRequest req) {
        return adminEntityService.update(id, req);
    }
}
