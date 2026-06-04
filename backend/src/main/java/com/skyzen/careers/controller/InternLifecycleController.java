package com.skyzen.careers.controller;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.User;
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
}
