package com.skyzen.careers.controller;

import com.skyzen.careers.dto.onboarding.OnboardingSummaryResponse;
import com.skyzen.careers.dto.onboarding.OnboardingTaskResponse;
import com.skyzen.careers.dto.onboarding.UpdateTaskStatusRequest;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.service.OnboardingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/onboarding")
@RequiredArgsConstructor
public class OnboardingController {

    private final OnboardingService onboardingService;
    private final CandidateRepository candidateRepository;

    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public List<OnboardingTaskResponse> myTasks(@AuthenticationPrincipal User user) {
        return onboardingService.getMyTasks(user);
    }

    @GetMapping("/me/summary")
    @PreAuthorize("hasRole('CANDIDATE')")
    public OnboardingSummaryResponse mySummary(@AuthenticationPrincipal User user) {
        return candidateRepository.findByUserId(user.getId())
                .map(c -> onboardingService.getSummaryForCandidate(c.getId()))
                .orElseGet(() -> OnboardingSummaryResponse.builder()
                        .totalTasks(0)
                        .completedTasks(0)
                        .pendingTasks(0)
                        .inProgressTasks(0)
                        .blockedTasks(0)
                        .progressPercent(0)
                        .build());
    }

    @GetMapping("/candidate/{candidateId}")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ERM', 'ADMIN')")
    public List<OnboardingTaskResponse> tasksForCandidate(
            @PathVariable UUID candidateId,
            @AuthenticationPrincipal User user) {
        return onboardingService.getTasksForCandidate(candidateId, user);
    }

    @GetMapping("/candidate/{candidateId}/summary")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ERM', 'ADMIN')")
    public OnboardingSummaryResponse summaryForCandidate(@PathVariable UUID candidateId) {
        return onboardingService.getSummaryForCandidate(candidateId);
    }

    @PatchMapping("/tasks/{taskId}")
    public OnboardingTaskResponse updateStatus(
            @PathVariable UUID taskId,
            @Valid @RequestBody UpdateTaskStatusRequest req,
            @AuthenticationPrincipal User user) {
        return onboardingService.updateStatus(taskId, req, user);
    }

    @PostMapping("/candidate/{candidateId}/seed")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ADMIN')")
    public List<OnboardingTaskResponse> seedManual(
            @PathVariable UUID candidateId,
            @AuthenticationPrincipal User user) {
        return onboardingService.seedManual(candidateId, user);
    }
}
