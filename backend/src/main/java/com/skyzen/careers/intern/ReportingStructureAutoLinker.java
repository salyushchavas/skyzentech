package com.skyzen.careers.intern;

import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Resolves {@code DEFAULT_TRAINER_EMAIL} / {@code DEFAULT_EVALUATOR_EMAIL}
 * to user IDs and applies them to an {@link InternLifecycle} row's
 * {@code trainer_id} / {@code evaluator_id} columns.
 *
 * <p>Single source of truth for the org-wide T/E auto-link. Called by
 * {@link com.skyzen.careers.intern.OfferIdmsSigningService} on offer-
 * sign, the activation path ({@link InternActivationJob}), and the
 * one-time backfill in {@code SchemaFixupRunner} so the resolver runs
 * the same way wherever the lifecycle row is created or activated.</p>
 *
 * <p>The linker NEVER overwrites an existing non-null trainer_id /
 * evaluator_id — ERM's explicit assignments via the AssignManagerModal
 * / assign-reporting endpoint take precedence.</p>
 *
 * <p>Non-fatal: unset env vars or unresolvable emails emit INFO logs and
 * leave the column null. ERM can still set values manually via the
 * legacy /assign-reporting endpoint.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReportingStructureAutoLinker {

    private final UserRepository userRepository;

    @Value("${app.default-trainer-email:}")
    private String defaultTrainerEmail;

    @Value("${app.default-evaluator-email:}")
    private String defaultEvaluatorEmail;

    /**
     * Apply the default trainer/evaluator IDs to the supplied lifecycle
     * row. Mutates the row in-place — caller is responsible for saving.
     * Existing non-null assignments are preserved.
     *
     * <p>If both fields end up populated and {@code reporting_structure_complete}
     * was not already set, the actor id is stamped on the completion fields
     * so audit can distinguish system-driven linkage from human-driven.</p>
     *
     * @return true iff any field on the lifecycle row was actually
     *   changed by this call (so callers can decide whether to save).
     */
    public boolean apply(InternLifecycle lc, UUID actorId, Instant now) {
        if (lc == null) return false;

        boolean changed = false;
        if (lc.getTrainerId() == null) {
            changed |= tryAutoLink(lc::setTrainerId, defaultTrainerEmail, "trainer");
        }
        if (lc.getEvaluatorId() == null) {
            changed |= tryAutoLink(lc::setEvaluatorId, defaultEvaluatorEmail, "evaluator");
        }
        if (lc.getTrainerId() != null && lc.getEvaluatorId() != null
                && !Boolean.TRUE.equals(lc.getReportingStructureComplete())) {
            lc.setReportingStructureComplete(Boolean.TRUE);
            lc.setReportingStructureCompletedAt(now);
            lc.setReportingStructureCompletedById(actorId);
            changed = true;
        }
        return changed;
    }

    private boolean tryAutoLink(Consumer<UUID> setter, String email, String roleLabel) {
        if (email == null || email.isBlank()) {
            log.info("[AutoLink] {} default email not set — leaving {}_id null "
                    + "(non-blocking; ERM may set inline)", roleLabel, roleLabel);
            return false;
        }
        return userRepository.findByEmail(email.trim())
                .map(u -> {
                    setter.accept(u.getId());
                    log.info("[AutoLink] linked default {} = {} ({})",
                            roleLabel, u.getFullName(), u.getEmail());
                    return true;
                })
                .orElseGet(() -> {
                    log.info("[AutoLink] {} email '{}' did not resolve to a user — "
                            + "leaving null (non-blocking)", roleLabel, email);
                    return false;
                });
    }
}
