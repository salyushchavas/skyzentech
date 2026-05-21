package com.skyzen.careers.service;

import com.skyzen.careers.dto.supervised.AssignmentResponse;
import com.skyzen.careers.dto.supervised.CreateAssignmentRequest;
import com.skyzen.careers.dto.supervised.ReviewAssignmentRequest;
import com.skyzen.careers.dto.supervised.SubmitAssignmentRequest;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WorkAssignment;
import com.skyzen.careers.enums.WorkAssignmentStatus;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.WorkAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkAssignmentService {

    private final WorkAssignmentRepository workAssignmentRepository;
    private final CandidateRepository candidateRepository;

    @Transactional
    public AssignmentResponse create(UUID candidateId, CreateAssignmentRequest req, User caller) {
        if (req.getDueDate().isBefore(req.getWeekOf())) {
            throw new BadRequestException("dueDate cannot be before weekOf");
        }
        Candidate intern = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + candidateId));

        WorkAssignment wa = WorkAssignment.builder()
                .intern(intern)
                .assignedBy(caller)
                .title(req.getTitle())
                .description(req.getDescription())
                .weekOf(req.getWeekOf())
                .dueDate(req.getDueDate())
                .status(WorkAssignmentStatus.ASSIGNED)
                .build();
        wa = workAssignmentRepository.save(wa);
        // Re-read through the fetch-join so the response includes assignedByName.
        return toResponse(workAssignmentRepository.findByIdWithGraph(wa.getId())
                .orElseThrow(() -> new IllegalStateException("Just-created assignment vanished")));
    }

    @Transactional(readOnly = true)
    public List<AssignmentResponse> listForIntern(UUID candidateId) {
        if (!candidateRepository.existsById(candidateId)) {
            throw new ResourceNotFoundException("Candidate not found: " + candidateId);
        }
        return workAssignmentRepository.findForIntern(candidateId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<AssignmentResponse> listForCandidateUser(User caller) {
        return workAssignmentRepository.findForCandidateUser(caller.getId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public AssignmentResponse start(UUID id, User caller) {
        WorkAssignment wa = loadOwned(id, caller);
        // Idempotent for any already-progressed status; only flips ASSIGNED.
        if (wa.getStatus() == WorkAssignmentStatus.ASSIGNED) {
            wa.setStatus(WorkAssignmentStatus.IN_PROGRESS);
            workAssignmentRepository.save(wa);
        }
        return toResponse(wa);
    }

    @Transactional
    public AssignmentResponse submit(UUID id, SubmitAssignmentRequest req, User caller) {
        WorkAssignment wa = loadOwned(id, caller);
        if (wa.getStatus() == WorkAssignmentStatus.REVIEWED) {
            throw new BadRequestException("Assignment has already been reviewed");
        }
        wa.setSubmissionText(req.getSubmissionText());
        wa.setSubmissionLink(req.getSubmissionLink());
        wa.setSubmittedAt(Instant.now());
        wa.setStatus(WorkAssignmentStatus.SUBMITTED);
        workAssignmentRepository.save(wa);
        return toResponse(wa);
    }

    @Transactional
    public AssignmentResponse review(UUID id, ReviewAssignmentRequest req, User caller) {
        WorkAssignment wa = workAssignmentRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found: " + id));
        if (wa.getStatus() != WorkAssignmentStatus.SUBMITTED) {
            throw new BadRequestException(
                    "Only SUBMITTED assignments can be reviewed (current: " + wa.getStatus() + ")");
        }
        wa.setReviewNote(req.getReviewNote());
        wa.setReviewedAt(Instant.now());
        wa.setStatus(WorkAssignmentStatus.REVIEWED);
        workAssignmentRepository.save(wa);
        return toResponse(wa);
    }

    /**
     * Loads with the full fetch graph and verifies the caller is the intern
     * who owns the assignment. Keeps the candidate-side ownership check off
     * of any detached lazy proxy.
     */
    private WorkAssignment loadOwned(UUID id, User caller) {
        WorkAssignment wa = workAssignmentRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found: " + id));
        Candidate intern = wa.getIntern();
        if (intern == null || intern.getUser() == null
                || !intern.getUser().getId().equals(caller.getId())) {
            throw new ForbiddenException("Assignment does not belong to this user");
        }
        return wa;
    }

    private AssignmentResponse toResponse(WorkAssignment wa) {
        User assignedBy = wa.getAssignedBy();
        return AssignmentResponse.builder()
                .id(wa.getId())
                .title(wa.getTitle())
                .description(wa.getDescription())
                .weekOf(wa.getWeekOf())
                .dueDate(wa.getDueDate())
                .status(wa.getStatus())
                .submissionText(wa.getSubmissionText())
                .submissionLink(wa.getSubmissionLink())
                .submittedAt(wa.getSubmittedAt())
                .reviewNote(wa.getReviewNote())
                .reviewedAt(wa.getReviewedAt())
                .assignedByName(assignedBy != null ? assignedBy.getFullName() : null)
                .createdAt(wa.getCreatedAt())
                .build();
    }
}
