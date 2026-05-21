package com.skyzen.careers.controller;

import com.skyzen.careers.dto.interview.CandidateInterviewResponse;
import com.skyzen.careers.dto.interview.InterviewResponse;
import com.skyzen.careers.dto.interview.InterviewSummaryResponse;
import com.skyzen.careers.dto.interview.ScheduleInterviewRequest;
import com.skyzen.careers.dto.interview.SubmitFeedbackRequest;
import com.skyzen.careers.dto.interview.UpdateInterviewRequest;
import com.skyzen.careers.dto.interview.UpdateStatusRequest;
import com.skyzen.careers.dto.common.PagedResponse;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.service.InterviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/interviews")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewService interviewService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ERM', 'ADMIN')")
    public ResponseEntity<InterviewResponse> schedule(
            @Valid @RequestBody ScheduleInterviewRequest req,
            @AuthenticationPrincipal User user) {
        InterviewResponse created = interviewService.schedule(req, user);
        return ResponseEntity.created(URI.create("/api/v1/interviews/" + created.getId()))
                .body(created);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('RECRUITER', 'ERM', 'HR_COMPLIANCE', 'ADMIN', 'TECHNICAL_EVALUATOR')")
    public PagedResponse<InterviewSummaryResponse> list(
            @RequestParam(required = false) UUID applicationId,
            @RequestParam(required = false) InterviewStatus status,
            @RequestParam(required = false) UUID interviewerId,
            @RequestParam(required = false) Boolean upcoming,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Sort sort = Boolean.FALSE.equals(upcoming)
                ? Sort.by(Sort.Direction.DESC, "scheduledAt")
                : Sort.by(Sort.Direction.ASC, "scheduledAt");
        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.min(100, Math.max(1, size)),
                sort);
        return PagedResponse.of(
                interviewService.list(applicationId, status, interviewerId, upcoming, pageable));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public List<CandidateInterviewResponse> listMine(@AuthenticationPrincipal User user) {
        return interviewService.listForCandidate(user);
    }

    @GetMapping("/{id}")
    public InterviewResponse getOne(@PathVariable UUID id,
                                    @AuthenticationPrincipal User user) {
        return interviewService.getDetail(id, user);
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'ADMIN')")
    public InterviewResponse update(@PathVariable UUID id,
                                    @Valid @RequestBody UpdateInterviewRequest req,
                                    @AuthenticationPrincipal User user) {
        return interviewService.update(id, req, user);
    }

    @PostMapping("/{id}/feedback")
    public InterviewResponse submitFeedback(@PathVariable UUID id,
                                            @Valid @RequestBody SubmitFeedbackRequest req,
                                            @AuthenticationPrincipal User user) {
        return interviewService.submitFeedback(id, req, user);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ERM', 'ADMIN')")
    public InterviewResponse updateStatus(@PathVariable UUID id,
                                          @Valid @RequestBody UpdateStatusRequest req,
                                          @AuthenticationPrincipal User user) {
        return interviewService.updateStatus(id, req.getStatus(), user);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       @AuthenticationPrincipal User user) {
        interviewService.delete(id, user);
        return ResponseEntity.noContent().build();
    }
}
