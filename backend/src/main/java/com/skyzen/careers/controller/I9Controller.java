package com.skyzen.careers.controller;

import com.skyzen.careers.dto.i9.I9FormResponse;
import com.skyzen.careers.dto.i9.I9HistoryEntryResponse;
import com.skyzen.careers.dto.i9.I9SummaryResponse;
import com.skyzen.careers.dto.i9.ReopenRequest;
import com.skyzen.careers.dto.i9.Section1Request;
import com.skyzen.careers.dto.i9.Section2Request;
import com.skyzen.careers.dto.common.PagedResponse;
import com.skyzen.careers.entity.I9Form;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.I9Status;
import com.skyzen.careers.service.I9FormService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/i9")
@RequiredArgsConstructor
public class I9Controller {

    private final I9FormService service;

    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public I9FormResponse getMyForm(@AuthenticationPrincipal User user) {
        return service.toResponse(service.getMyForm(user));
    }

    @GetMapping("/candidate/{candidateId}")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ERM', 'ADMIN')")
    public I9FormResponse getForCandidate(@PathVariable UUID candidateId,
                                          @AuthenticationPrincipal User user) {
        I9Form form = service.getOrCreateForCandidate(candidateId, user);
        return service.toResponse(form);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('CANDIDATE', 'RECRUITER', 'ERM', 'HR_COMPLIANCE', 'TECHNICAL_EVALUATOR', 'ADMIN')")
    public I9FormResponse getOne(@PathVariable UUID id,
                                 @AuthenticationPrincipal User user) {
        // Service-side requireReadAccess enforces candidate ownership; the
        // controller guard rejects unauthenticated requests up front.
        return service.toResponse(service.getById(id, user));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ADMIN')")
    public PagedResponse<I9SummaryResponse> list(
            @RequestParam(required = false) I9Status status,
            @RequestParam(defaultValue = "false") boolean overdueOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.min(100, Math.max(1, size)),
                Sort.by(Sort.Direction.DESC, "updatedAt"));
        return PagedResponse.of(service.list(status, overdueOnly, pageable));
    }

    @PostMapping("/{id}/section1")
    @PreAuthorize("hasAnyRole('CANDIDATE', 'ADMIN')")
    public I9FormResponse saveSection1(@PathVariable UUID id,
                                       @Valid @RequestBody Section1Request req,
                                       @AuthenticationPrincipal User user) {
        return service.toResponse(service.saveSection1(id, req, user));
    }

    @PostMapping("/{id}/section2")
    @PreAuthorize("hasAnyRole('HR_COMPLIANCE', 'ADMIN')")
    public I9FormResponse saveSection2(@PathVariable UUID id,
                                       @Valid @RequestBody Section2Request req,
                                       @AuthenticationPrincipal User user) {
        return service.toResponse(service.saveSection2(id, req, user));
    }

    @PostMapping("/{id}/reopen")
    @PreAuthorize("hasRole('ADMIN')")
    public I9FormResponse reopen(@PathVariable UUID id,
                                 @Valid @RequestBody ReopenRequest req,
                                 @AuthenticationPrincipal User user) {
        return service.toResponse(service.reopenForm(id, req.getReason(), user));
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyRole('CANDIDATE', 'RECRUITER', 'ERM', 'HR_COMPLIANCE', 'TECHNICAL_EVALUATOR', 'ADMIN')")
    public List<I9HistoryEntryResponse> getHistory(@PathVariable UUID id,
                                                   @AuthenticationPrincipal User user) {
        return service.getHistory(id, user);
    }
}
