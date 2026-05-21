package com.skyzen.careers.service;

import com.skyzen.careers.dto.admin.AdminOverviewResponse;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.EVerifyStatus;
import com.skyzen.careers.enums.I9Status;
import com.skyzen.careers.enums.I983Status;
import com.skyzen.careers.enums.JobPostingStatus;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EVerifyCaseRepository;
import com.skyzen.careers.repository.I9FormRepository;
import com.skyzen.careers.repository.I983PlanRepository;
import com.skyzen.careers.repository.JobPostingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminOverviewService {

    /** Non-terminal E-Verify statuses considered "pending" for the dashboard. */
    private static final List<EVerifyStatus> EVERIFY_PENDING = List.of(
            EVerifyStatus.PENDING_SUBMISSION,
            EVerifyStatus.OPEN,
            EVerifyStatus.TENTATIVE_NONCONFIRMATION
    );

    private final CandidateRepository candidateRepository;
    private final ApplicationRepository applicationRepository;
    private final JobPostingRepository jobPostingRepository;
    private final I9FormRepository i9FormRepository;
    private final I983PlanRepository i983PlanRepository;
    private final EVerifyCaseRepository everifyCaseRepository;

    @Transactional(readOnly = true)
    public AdminOverviewResponse build() {
        // Applications by status — emit a zero-filled bucket for every enum
        // value so the frontend can iterate without missing-key checks.
        Map<String, Long> applicationsByStatus = new LinkedHashMap<>();
        for (ApplicationStatus s : ApplicationStatus.values()) {
            applicationsByStatus.put(s.name(), applicationRepository.countByStatus(s));
        }

        long totalHired = applicationsByStatus.getOrDefault(ApplicationStatus.HIRED.name(), 0L);
        long activeInterns = applicationRepository.countDistinctCandidatesByStatus(ApplicationStatus.HIRED);
        long openPostings = jobPostingRepository.findByStatus(JobPostingStatus.OPEN).size();
        long totalCandidates = candidateRepository.count();

        AdminOverviewResponse.ComplianceCounts compliance = AdminOverviewResponse.ComplianceCounts
                .builder()
                .i9Pending(i9FormRepository.countByStatusNot(I9Status.COMPLETED))
                .i983Pending(i983PlanRepository.countByStatusNot(I983Status.DSO_APPROVED))
                .everifyPending(everifyCaseRepository.countByStatusIn(EVERIFY_PENDING))
                .build();

        return AdminOverviewResponse.builder()
                .totalCandidates(totalCandidates)
                .totalHired(totalHired)
                .activeInterns(activeInterns)
                .openPostings(openPostings)
                .applicationsByStatus(applicationsByStatus)
                .compliance(compliance)
                .build();
    }
}
