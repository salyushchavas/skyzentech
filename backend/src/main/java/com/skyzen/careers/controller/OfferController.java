package com.skyzen.careers.controller;

import com.skyzen.careers.dto.offer.CandidateOfferResponse;
import com.skyzen.careers.dto.offer.CreateOfferRequest;
import com.skyzen.careers.dto.offer.DeclineOfferRequest;
import com.skyzen.careers.dto.offer.OfferResponse;
import com.skyzen.careers.dto.offer.OfferSummaryResponse;
import com.skyzen.careers.dto.offer.UpdateOfferRequest;
import com.skyzen.careers.dto.common.PagedResponse;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.service.OfferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/offers")
@RequiredArgsConstructor
public class OfferController {

    /** Staff roles that get the full OfferResponse view. */
    private static final Set<UserRole> STAFF_ROLES = EnumSet.of(
            UserRole.ADMIN, UserRole.ERM, UserRole.HR_COMPLIANCE, UserRole.RECRUITER
    );

    private final OfferService offerService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public ResponseEntity<OfferResponse> create(
            @Valid @RequestBody CreateOfferRequest req,
            @AuthenticationPrincipal User user) {
        OfferResponse created = offerService.create(req, user);
        return ResponseEntity.created(URI.create("/api/v1/offers/" + created.getId()))
                .body(created);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('RECRUITER', 'ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public PagedResponse<OfferSummaryResponse> list(
            @RequestParam(required = false) OfferStatus status,
            @RequestParam(required = false) UUID applicationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.min(100, Math.max(1, size)),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return PagedResponse.of(offerService.list(status, applicationId, pageable));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public List<CandidateOfferResponse> listMine(@AuthenticationPrincipal User user) {
        return offerService.listForCandidate(user);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('CANDIDATE', 'RECRUITER', 'ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public Object getOne(@PathVariable UUID id,
                         @AuthenticationPrincipal User user) {
        // Candidate path returns the redacted view + enforces ownership in the
        // service; staff path returns the full offer. Controller guard keeps
        // unauthenticated requests out.
        if (isCandidateOnly(user)) {
            return offerService.getDetailCandidate(id, user);
        }
        return offerService.getDetailStaff(id, user);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public OfferResponse update(@PathVariable UUID id,
                                @Valid @RequestBody UpdateOfferRequest req,
                                @AuthenticationPrincipal User user) {
        return offerService.update(id, req, user);
    }

    @PostMapping("/{id}/send")
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public OfferResponse send(@PathVariable UUID id,
                              @AuthenticationPrincipal User user) {
        return offerService.send(id, user);
    }

    @PostMapping("/{id}/accept")
    @PreAuthorize("hasRole('CANDIDATE')")
    public CandidateOfferResponse accept(@PathVariable UUID id,
                                         @AuthenticationPrincipal User user) {
        Offer accepted = offerService.acceptInternal(id, user);
        return offerService.toCandidateResponse(accepted);
    }

    @PostMapping("/{id}/decline")
    @PreAuthorize("hasRole('CANDIDATE')")
    public CandidateOfferResponse decline(@PathVariable UUID id,
                                          @Valid @RequestBody(required = false) DeclineOfferRequest req,
                                          @AuthenticationPrincipal User user) {
        Offer declined = offerService.declineInternal(id, req, user);
        return offerService.toCandidateResponse(declined);
    }

    @PostMapping("/{id}/revoke")
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public OfferResponse revoke(@PathVariable UUID id,
                                @AuthenticationPrincipal User user) {
        return offerService.revoke(id, user);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'HR_COMPLIANCE', 'ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       @AuthenticationPrincipal User user) {
        offerService.delete(id, user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id,
                                           @AuthenticationPrincipal User user) {
        OfferService.LetterDownload payload = offerService.buildDownload(id, user);
        byte[] bytes = payload.body().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + payload.filename() + "\"")
                .contentType(MediaType.parseMediaType("text/plain; charset=utf-8"))
                .contentLength(bytes.length)
                .body(bytes);
    }

    private boolean isCandidateOnly(User user) {
        if (user == null || user.getRoles() == null) return false;
        boolean isCandidate = user.getRoles().contains(UserRole.CANDIDATE);
        boolean isStaff = user.getRoles().stream().anyMatch(STAFF_ROLES::contains);
        return isCandidate && !isStaff;
    }
}
