package com.skyzen.careers.controller;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.intern.InternActivationJob;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 4 — ERM override endpoint for manual intern activation (bypasses
 * the start-date gate). The scheduled {@link InternActivationJob} handles
 * the standard automatic flip.
 */
@RestController
@RequestMapping("/api/v1/intern-lifecycles")
@RequiredArgsConstructor
public class InternLifecycleController {

    private final InternLifecycleRepository internLifecycleRepository;
    private final UserRepository userRepository;
    private final InternActivationJob activationJob;

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public Map<String, Object> activate(@PathVariable UUID id,
                                         @AuthenticationPrincipal User actor) {
        InternLifecycle lc = internLifecycleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle not found: " + id));
        User user = userRepository.findById(lc.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found for lifecycle " + id));
        boolean advanced = activationJob.activateNow(user, actor != null ? actor.getId() : null);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("activated", advanced);
        body.put("userId", user.getId());
        body.put("lifecycleStatus", user.getLifecycleStatus());
        body.put("internLifecycleId", lc.getId());
        body.put("activeStatus", lc.getActiveStatus());
        body.put("startedAt", lc.getStartedAt());
        return body;
    }

    // ── Phase 5 — ERM wires trainer / evaluator / manager assignments ────

    @PostMapping("/{id}/assign-trainer")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public Map<String, Object> assignTrainer(@PathVariable UUID id,
                                              @RequestBody Map<String, String> body) {
        return assignRole(id, body, "trainerUserId", UserRole.TRAINER, "trainer_id");
    }

    @PostMapping("/{id}/assign-evaluator")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public Map<String, Object> assignEvaluator(@PathVariable UUID id,
                                                @RequestBody Map<String, String> body) {
        // EVALUATOR was renamed to TRAINER in some earlier refactor; the
        // doc-spec ROLE for "evaluator" here is REPORTING_MANAGER per the
        // six-role taxonomy. Accept either token from the wire and map back.
        return assignRole(id, body, "evaluatorUserId",
                UserRole.REPORTING_MANAGER, "evaluator_id");
    }

    @PostMapping("/{id}/assign-manager")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public Map<String, Object> assignManager(@PathVariable UUID id,
                                              @RequestBody Map<String, String> body) {
        return assignRole(id, body, "managerUserId", UserRole.MANAGER, "manager_id");
    }

    private Map<String, Object> assignRole(UUID lifecycleId,
                                            Map<String, String> body,
                                            String bodyKey,
                                            UserRole requiredRole,
                                            String column) {
        String raw = body == null ? null : body.get(bodyKey);
        if (raw == null || raw.isBlank()) {
            throw new BadRequestException(bodyKey + " is required");
        }
        UUID targetUserId;
        try {
            targetUserId = UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException(bodyKey + " must be a UUID");
        }
        InternLifecycle lc = internLifecycleRepository.findById(lifecycleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle not found: " + lifecycleId));
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found: " + targetUserId));
        if (target.getRoles() == null || !target.getRoles().contains(requiredRole)) {
            throw new BadRequestException(
                    "User " + targetUserId + " does not hold role " + requiredRole);
        }
        switch (column) {
            case "trainer_id"   -> lc.setTrainerId(targetUserId);
            case "evaluator_id" -> lc.setEvaluatorId(targetUserId);
            case "manager_id"   -> lc.setManagerId(targetUserId);
            default             -> throw new BadRequestException("unknown column " + column);
        }
        internLifecycleRepository.save(lc);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("lifecycleId", lc.getId());
        resp.put("userId", lc.getUserId());
        resp.put("trainerId", lc.getTrainerId());
        resp.put("evaluatorId", lc.getEvaluatorId());
        resp.put("managerId", lc.getManagerId());
        resp.put("ermId", lc.getErmId());
        return resp;
    }
}
