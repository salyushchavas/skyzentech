package com.skyzen.careers.erm.onboarding;

import com.skyzen.careers.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** ERM Phase 5 — onboarding review HTTP surface. */
@RestController
@RequestMapping("/api/v1/erm/onboarding")
@RequiredArgsConstructor
public class ErmOnboardingController {

    private final ErmOnboardingService service;

    @GetMapping("/review-queue")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOnboardingDtos.ReviewQueuePage reviewQueue(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return service.listReviewQueue(category, search, page, pageSize);
    }

    @GetMapping("/packets")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOnboardingDtos.PacketListPage packets(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return service.listPackets(status, search, page, pageSize);
    }

    @GetMapping("/packets/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOnboardingDtos.PacketDetail packetDetail(@PathVariable UUID id) {
        return service.getPacketDetail(id);
    }

    @GetMapping("/items/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOnboardingDtos.ItemDetail itemDetail(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        return service.getItemDetail(id, caller);
    }

    @PostMapping("/items/{id}/review")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOnboardingDtos.ItemDetail review(
            @PathVariable UUID id,
            @RequestBody ErmOnboardingDtos.ReviewRequest req,
            @AuthenticationPrincipal User caller) {
        return service.reviewItem(id, req, caller);
    }

    @PostMapping("/items/bulk-review")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOnboardingDtos.BulkReviewResult bulkReview(
            @RequestBody ErmOnboardingDtos.BulkReviewRequest req,
            @AuthenticationPrincipal User caller) {
        return service.bulkReview(req, caller);
    }

    @PostMapping("/items/{id}/reopen")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ErmOnboardingDtos.ItemDetail reopen(
            @PathVariable UUID id,
            @RequestBody ErmOnboardingDtos.InternalNoteRequest req,
            @AuthenticationPrincipal User caller) {
        return service.reopenItem(id, req != null ? req.internalNotes() : null, caller);
    }

    @PostMapping("/items/{id}/internal-note")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOnboardingDtos.ItemDetail internalNote(
            @PathVariable UUID id,
            @RequestBody ErmOnboardingDtos.InternalNoteRequest req,
            @AuthenticationPrincipal User caller) {
        return service.addInternalNote(id, req, caller);
    }

    @GetMapping("/reason-codes")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public List<ErmOnboardingDtos.ReasonCodeGroup> reasonCodes() {
        return service.listReasonCodes();
    }
}
