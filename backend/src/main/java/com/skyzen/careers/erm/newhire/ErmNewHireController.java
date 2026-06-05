package com.skyzen.careers.erm.newhire;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.erm.offer.ErmOfferDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** ERM Phase 4 — Prospective New Hire List HTTP surface. */
@RestController
@RequestMapping("/api/v1/erm/new-hire")
@RequiredArgsConstructor
public class ErmNewHireController {

    private final ErmNewHireService ermNewHireService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOfferDtos.NewHireListPage list(
            @RequestParam(required = false, defaultValue = "pending") String tab,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize,
            @AuthenticationPrincipal User caller) {
        return ermNewHireService.list(tab, caller, page, pageSize);
    }

    @GetMapping("/{lifecycleId}")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOfferDtos.NewHireDetail detail(@PathVariable UUID lifecycleId) {
        return ermNewHireService.detail(lifecycleId);
    }

    @PostMapping("/{lifecycleId}/assign-reporting")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOfferDtos.NewHireDetail assignReporting(
            @PathVariable UUID lifecycleId,
            @RequestBody ErmOfferDtos.AssignReportingRequest req,
            @AuthenticationPrincipal User caller) {
        return ermNewHireService.assignReportingStructure(lifecycleId, req, caller);
    }

    @PostMapping("/{lifecycleId}/update-start-date")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ErmOfferDtos.NewHireDetail updateStartDate(
            @PathVariable UUID lifecycleId,
            @RequestBody ErmOfferDtos.UpdateStartDateRequest req,
            @AuthenticationPrincipal User caller) {
        return ermNewHireService.updateTentativeStartDate(lifecycleId,
                req != null ? req.newDate() : null, caller);
    }

    @GetMapping("/eligible-trainers")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public List<ErmOfferDtos.UserStub> eligibleTrainers() {
        return ermNewHireService.listEligible(UserRole.TRAINER);
    }

    @GetMapping("/eligible-evaluators")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public List<ErmOfferDtos.UserStub> eligibleEvaluators() {
        return ermNewHireService.listEligible(UserRole.REPORTING_MANAGER);
    }

    @GetMapping("/eligible-managers")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public List<ErmOfferDtos.UserStub> eligibleManagers() {
        return ermNewHireService.listEligible(UserRole.MANAGER);
    }
}
