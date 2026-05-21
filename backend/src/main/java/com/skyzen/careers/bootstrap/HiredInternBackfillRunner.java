package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.Application;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Group C foundation: guarantees the Supervised Interns roster has at least one
 * row to show in the demo. If no Application is in HIRED status, promote one
 * existing application (ACCEPTED -> ONBOARDING -> ACTIVE -> any) to HIRED.
 *
 * Idempotent — if any HIRED row already exists, this is a no-op. Runs after
 * SeedDemoDataRunner (Order 4).
 *
 * Demo-only. Remove or guard with a profile flag before any non-dev deploy.
 *
 * The body is wrapped in try/catch so any seed/backfill failure logs a WARN
 * and never crashes startup — non-essential demo data must never block boot.
 * Note: no class-level {@code @Transactional}. The single save runs in its own
 * short auto-transaction; this avoids the {@code UnexpectedRollbackException}
 * trap where Spring rolls back at commit time after we've already caught the
 * underlying JPA exception inside the method.
 */
@Component
@Order(5)
@RequiredArgsConstructor
@Slf4j
public class HiredInternBackfillRunner implements CommandLineRunner {

    private final ApplicationRepository applicationRepository;

    @Override
    public void run(String... args) {
        try {
            if (applicationRepository.existsByStatus(ApplicationStatus.HIRED)) {
                log.info("HIRED application already present — skipping Supervised Interns backfill.");
                return;
            }

            // Prefer the closest-to-hired existing status, falling back through the
            // post-offer pipeline. This is just to make sure the demo roster isn't
            // empty on the very first boot before any real HIRED transitions exist.
            Application target = pickPromotionCandidate();
            if (target == null) {
                log.info("No demo application to promote to HIRED — Supervised Interns roster will be empty.");
                return;
            }
            ApplicationStatus before = target.getStatus();
            target.setStatus(ApplicationStatus.HIRED);
            target.setStatusUpdatedAt(Instant.now());
            applicationRepository.save(target);
            log.warn("Promoted demo application {} from {} to HIRED so Supervised Interns roster is non-empty.",
                    target.getId(), before);
        } catch (Exception e) {
            log.warn("HIRED backfill failed (non-fatal): {}", e.getMessage(), e);
        }
    }

    private Application pickPromotionCandidate() {
        for (ApplicationStatus s : List.of(
                ApplicationStatus.ACTIVE,
                ApplicationStatus.ONBOARDING,
                ApplicationStatus.ACCEPTED,
                ApplicationStatus.OFFERED,
                ApplicationStatus.INTERVIEWED)) {
            List<Application> matches = applicationRepository.findAll().stream()
                    .filter(a -> a.getStatus() == s)
                    .toList();
            if (!matches.isEmpty()) return matches.get(0);
        }
        return null;
    }
}
