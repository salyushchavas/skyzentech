package com.skyzen.careers.controller;

import com.skyzen.careers.entity.OnboardingItem;
import com.skyzen.careers.entity.OnboardingPacket;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.intern.OnboardingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 4 onboarding endpoints. Distinct from the older legacy
 * {@code OnboardingController} (tasks-based pre-DocuSign flow); this controller
 * binds at {@code /api/v1/onboarding/packets} + {@code /items} so the new
 * packet model lives alongside without colliding with the legacy paths.
 */
@RestController
@RequestMapping("/api/v1/onboarding")
@RequiredArgsConstructor
public class OnboardingPacketController {

    private final OnboardingService onboardingService;

    // ── ERM ─────────────────────────────────────────────────────────────────

    @PostMapping("/packets")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public Map<String, Object> assignPacket(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User actor) {
        Object uid = body == null ? null : body.get("userId");
        if (uid == null) {
            throw new com.skyzen.careers.exception.BadRequestException("userId is required");
        }
        UUID applicantUserId = UUID.fromString(uid.toString());
        OnboardingPacket p = onboardingService.assignPacket(applicantUserId, actor);
        return packetToMap(p, onboardingService.listItems(p.getId()), false);
    }

    @PostMapping("/items/{itemId}/review")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public Map<String, Object> reviewItem(
            @PathVariable UUID itemId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User actor) {
        String decision = body == null ? null : body.get("decision");
        String ermComments = body == null ? null : body.get("ermComments");
        String internalNotes = body == null ? null : body.get("internalNotes");
        OnboardingItem item = onboardingService.reviewItem(itemId, decision, ermComments, internalNotes, actor);
        return itemToMap(item, true);
    }

    @GetMapping("/review-queue")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN', 'MANAGER')")
    public Map<String, Object> reviewQueue(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.min(100, Math.max(1, size)));
        Page<OnboardingItem> p = onboardingService.reviewQueue(pageable);
        List<Map<String, Object>> rows = p.getContent().stream()
                .map(i -> itemToMap(i, true))
                .toList();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("content", rows);
        resp.put("totalElements", p.getTotalElements());
        resp.put("totalPages", p.getTotalPages());
        resp.put("page", p.getNumber());
        resp.put("size", p.getSize());
        return resp;
    }

    @GetMapping("/items/{itemId}/decrypted")
    @PreAuthorize("hasAnyRole('ERM', 'MANAGER', 'SUPER_ADMIN')")
    public Map<String, Object> decryptForErm(
            @PathVariable UUID itemId,
            @AuthenticationPrincipal User caller) {
        // Service writes the PII_DECRYPT audit row for non-owner reads.
        return onboardingService.getItemFormData(itemId, caller);
    }

    // ── Intern ─────────────────────────────────────────────────────────────

    @GetMapping("/packet")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> myPacket(@AuthenticationPrincipal User caller) {
        OnboardingPacket p = onboardingService.getPacketForUser(caller.getId());
        return packetToMap(p, onboardingService.listItems(p.getId()), false);
    }

    @GetMapping("/items/{itemId}")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> myItem(@PathVariable UUID itemId,
                                       @AuthenticationPrincipal User caller) {
        Map<String, Object> data = onboardingService.getItemFormData(itemId, caller);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("itemId", itemId);
        body.put("formData", data);
        return body;
    }

    @PostMapping("/items/{itemId}/submit")
    @PreAuthorize("hasRole('INTERN')")
    public Map<String, Object> submitItem(
            @PathVariable UUID itemId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User caller) {
        OnboardingItem item = onboardingService.submitItem(itemId, body, caller);
        return itemToMap(item, false);
    }

    // ── DTO shaping ────────────────────────────────────────────────────────

    private Map<String, Object> packetToMap(OnboardingPacket p,
                                            List<OnboardingItem> items,
                                            boolean includeInternalNotes) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("userId", p.getUserId());
        m.put("status", p.getStatus());
        m.put("assignedAt", p.getAssignedAt());
        m.put("acceptedAt", p.getAcceptedAt());
        long total = items.stream().filter(i -> Boolean.TRUE.equals(i.getRequired())).count();
        long accepted = items.stream()
                .filter(i -> Boolean.TRUE.equals(i.getRequired())
                        && "ACCEPTED".equals(i.getStatus()))
                .count();
        m.put("requiredCount", total);
        m.put("acceptedCount", accepted);
        m.put("items", items.stream()
                .map(i -> itemToMap(i, includeInternalNotes))
                .toList());
        return m;
    }

    private Map<String, Object> itemToMap(OnboardingItem i, boolean includeInternalNotes) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("packetId", i.getPacketId());
        m.put("category", i.getCategory());
        m.put("required", i.getRequired());
        m.put("status", i.getStatus());
        m.put("documentId", i.getDocumentId());
        m.put("submittedAt", i.getSubmittedAt());
        m.put("reviewedAt", i.getReviewedAt());
        m.put("ermComments", i.getErmComments());
        if (includeInternalNotes) m.put("internalNotes", i.getInternalNotes());
        m.put("version", i.getVersion());
        m.put("updatedAt", i.getUpdatedAt());
        // formDataJson intentionally NOT in this DTO; clients call /items/{id}
        // for decrypted data so reads are audit-logged.
        return m;
    }

    /** Convenience: never used directly, but keeps Instant import non-dead. */
    @SuppressWarnings("unused")
    private static Instant nowMarker() { return Instant.now(); }
}
