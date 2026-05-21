package com.skyzen.careers.service;

import com.skyzen.careers.dto.supervised.InternSummaryResponse;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SupervisedInternsService {

    private final ApplicationRepository applicationRepository;

    @Transactional(readOnly = true)
    public List<InternSummaryResponse> listHiredInterns(UUID entityId, String search) {
        String normalized = (search != null && !search.isBlank()) ? search.trim() : null;
        List<Application> apps = applicationRepository.findHiredInterns(entityId, normalized);

        // Dedupe by candidate id; first occurrence wins because the query is
        // ordered by statusUpdatedAt DESC (most recent HIRED transition first).
        Set<UUID> seen = new HashSet<>();
        List<InternSummaryResponse> out = new ArrayList<>(apps.size());
        for (Application app : apps) {
            Candidate c = app.getCandidate();
            if (c == null || !seen.add(c.getId())) continue;
            User u = c.getUser();
            JobPosting jp = app.getJobPosting();
            StaffingEntity e = jp != null ? jp.getEntity() : null;
            User ae = c.getAssignedEvaluator();

            out.add(InternSummaryResponse.builder()
                    .candidateId(c.getId())
                    .name(u != null ? u.getFullName() : null)
                    .email(u != null ? u.getEmail() : null)
                    .position(jp != null ? jp.getTitle() : null)
                    .entityName(e != null ? e.getName() : null)
                    .hiredDate(app.getStatusUpdatedAt())
                    .assignedEvaluatorName(ae != null ? ae.getFullName() : null)
                    .build());
        }
        return out;
    }
}
