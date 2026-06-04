package com.skyzen.careers.service;

import com.skyzen.careers.dto.supervised.AssignEvaluatorRequest;
import com.skyzen.careers.dto.supervised.CompleteEvaluationRequest;
import com.skyzen.careers.dto.supervised.EvaluationSessionResponse;
import com.skyzen.careers.dto.supervised.EvaluatorOption;
import com.skyzen.careers.dto.supervised.InternSummaryResponse;
import com.skyzen.careers.dto.supervised.ScheduleEvaluationRequest;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.EvaluationSession;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.EvaluationSessionStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EvaluationSessionRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EvaluationSessionService {

    private final EvaluationSessionRepository sessionRepository;
    private final CandidateRepository candidateRepository;
    private final UserRepository userRepository;
    private final EngagementService engagementService;

    @Transactional(readOnly = true)
    public List<EvaluatorOption> listEvaluators() {
        return userRepository.findByRole(UserRole.TRAINER).stream()
                .map(u -> EvaluatorOption.builder()
                        .id(u.getId())
                        .name(u.getFullName())
                        .build())
                .toList();
    }

    /**
     * Sets {@link Candidate#getAssignedEvaluator()} and returns the refreshed
     * intern summary so the staff view can update its header in one round-trip.
     */
    @Transactional
    public InternSummaryResponse assignEvaluator(UUID candidateId, AssignEvaluatorRequest req) {
        Candidate intern = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + candidateId));
        User evaluator = userRepository.findById(req.getEvaluatorId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Evaluator user not found: " + req.getEvaluatorId()));
        if (!evaluator.getRoles().contains(UserRole.TRAINER)) {
            throw new BadRequestException("Selected user is not a Technical Evaluator");
        }
        intern.setAssignedEvaluator(evaluator);
        candidateRepository.save(intern);

        User u = intern.getUser();
        return InternSummaryResponse.builder()
                .candidateId(intern.getId())
                .name(u != null ? u.getFullName() : null)
                .email(u != null ? u.getEmail() : null)
                .assignedEvaluatorName(evaluator.getFullName())
                .build();
    }

    @Transactional
    public EvaluationSessionResponse schedule(UUID candidateId,
                                              ScheduleEvaluationRequest req) {
        Candidate intern = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Candidate not found: " + candidateId));

        User evaluator = null;
        if (req.getEvaluatorId() != null) {
            evaluator = userRepository.findById(req.getEvaluatorId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Evaluator user not found: " + req.getEvaluatorId()));
            if (!evaluator.getRoles().contains(UserRole.TRAINER)) {
                throw new BadRequestException("Selected user is not a Technical Evaluator");
            }
        } else if (intern.getAssignedEvaluator() != null) {
            evaluator = intern.getAssignedEvaluator();
        }

        // Phase 3 step 8 — link to the intern's active engagement when one
        // exists. Null is fine: row stays reachable via the intern-keyed
        // queries; step-11 backfill (opt-in) handles legacy rows.
        Engagement engagement = engagementService
                .resolveActiveForCandidate(intern.getId())
                .orElse(null);
        EvaluationSession s = EvaluationSession.builder()
                .intern(intern)
                .engagement(engagement)
                .evaluator(evaluator)
                .scheduledAt(req.getScheduledAt())
                .status(EvaluationSessionStatus.SCHEDULED)
                .build();
        s = sessionRepository.save(s);
        return toResponse(sessionRepository.findByIdWithGraph(s.getId())
                .orElseThrow(() -> new IllegalStateException("Just-created session vanished")));
    }

    @Transactional(readOnly = true)
    public List<EvaluationSessionResponse> listForIntern(UUID candidateId) {
        if (!candidateRepository.existsById(candidateId)) {
            throw new ResourceNotFoundException("Candidate not found: " + candidateId);
        }
        return sessionRepository.findForIntern(candidateId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<EvaluationSessionResponse> listForCandidateUser(User caller) {
        return sessionRepository.findForCandidateUser(caller.getId()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public EvaluationSessionResponse complete(UUID id, CompleteEvaluationRequest req) {
        EvaluationSession s = sessionRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Evaluation session not found: " + id));
        if (s.getStatus() == EvaluationSessionStatus.COMPLETED) {
            // Idempotent: re-completing simply overwrites the rating/notes — useful
            // if the evaluator hits Save twice or wants to amend the feedback.
        } else if (s.getStatus() != EvaluationSessionStatus.SCHEDULED) {
            throw new BadRequestException(
                    "Only SCHEDULED sessions can be completed (current: " + s.getStatus() + ")");
        }
        s.setOverallRating(req.getOverallRating());
        s.setStrengths(req.getStrengths());
        s.setAreasForImprovement(req.getAreasForImprovement());
        s.setNotes(req.getNotes());
        s.setStatus(EvaluationSessionStatus.COMPLETED);
        s.setCompletedAt(Instant.now());
        sessionRepository.save(s);
        return toResponse(s);
    }

    @Transactional
    public EvaluationSessionResponse miss(UUID id) {
        EvaluationSession s = sessionRepository.findByIdWithGraph(id)
                .orElseThrow(() -> new ResourceNotFoundException("Evaluation session not found: " + id));
        if (s.getStatus() != EvaluationSessionStatus.SCHEDULED) {
            throw new BadRequestException(
                    "Only SCHEDULED sessions can be marked missed (current: " + s.getStatus() + ")");
        }
        s.setStatus(EvaluationSessionStatus.MISSED);
        sessionRepository.save(s);
        return toResponse(s);
    }

    private EvaluationSessionResponse toResponse(EvaluationSession s) {
        User evaluator = s.getEvaluator();
        return EvaluationSessionResponse.builder()
                .id(s.getId())
                .scheduledAt(s.getScheduledAt())
                .status(s.getStatus())
                .evaluatorName(evaluator != null ? evaluator.getFullName() : null)
                .evaluatorId(evaluator != null ? evaluator.getId() : null)
                .overallRating(s.getOverallRating())
                .strengths(s.getStrengths())
                .areasForImprovement(s.getAreasForImprovement())
                .notes(s.getNotes())
                .completedAt(s.getCompletedAt())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
