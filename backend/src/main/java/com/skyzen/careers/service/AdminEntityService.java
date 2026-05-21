package com.skyzen.careers.service;

import com.skyzen.careers.dto.admin.AdminEntityResponse;
import com.skyzen.careers.dto.admin.CreateEntityRequest;
import com.skyzen.careers.dto.admin.UpdateEntityRequest;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.StaffingEntityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminEntityService {

    private final StaffingEntityRepository repository;

    @Transactional(readOnly = true)
    public List<AdminEntityResponse> list() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional
    public AdminEntityResponse create(CreateEntityRequest req) {
        StaffingEntity e = StaffingEntity.builder()
                .name(req.getName().trim())
                .address(req.getAddress())
                .country(req.getCountry())
                .isActive(req.getIsActive() == null ? Boolean.TRUE : req.getIsActive())
                .build();
        e = repository.save(e);
        return toResponse(e);
    }

    @Transactional
    public AdminEntityResponse update(UUID id, UpdateEntityRequest req) {
        StaffingEntity e = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entity not found: " + id));
        e.setName(req.getName().trim());
        e.setAddress(req.getAddress());
        e.setCountry(req.getCountry());
        if (req.getIsActive() != null) {
            e.setIsActive(req.getIsActive());
        }
        repository.save(e);
        return toResponse(e);
    }

    private AdminEntityResponse toResponse(StaffingEntity e) {
        return AdminEntityResponse.builder()
                .id(e.getId())
                .name(e.getName())
                .address(e.getAddress())
                .country(e.getCountry())
                .isActive(e.getIsActive())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
