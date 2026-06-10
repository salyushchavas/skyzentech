package com.skyzen.careers.erm.documents;

import com.skyzen.careers.entity.DocumentTemplate;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.repository.DocumentTemplateRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * ERM Phase 8 — boot-time seeder for the 13 ANVI document templates.
 * Idempotent: existing rows (matched by title) are left untouched so
 * ERM file uploads + version bumps survive redeploys.
 *
 * <p>Template file (the actual PDF/DOCX) stays null after seeding —
 * ERM uploads via {@code POST /api/v1/erm/document-templates/{id}/file}.
 * Optional pre-staging from {@code resources/seed-templates/} can be
 * wired later; for Phase 8 ship the metadata + let ERM upload.</p>
 */
@Component
@Order(20)
@RequiredArgsConstructor
@Slf4j
public class DocumentTemplateSeeder implements CommandLineRunner {

    private final DocumentTemplateRepository repository;
    private final UserRepository userRepository;

    private record Seed(
            String title,
            String category,
            String fileKind,
            String sensitivity,
            String description
    ) {}

    private static final List<Seed> SEEDS = List.of(
            new Seed("Employee Data Sheet", "EMPLOYMENT", "PDF", "NORMAL",
                    "Employee profile and HR details form."),
            new Seed("Employee Handbook", "INFORMATIONAL", "PDF", "NORMAL",
                    "Company handbook; intern uploads signed acknowledgment."),
            new Seed("H1 Offer Letter", "LEGAL", "PDF", "NORMAL",
                    "Offer letter template for H1B candidates."),
            new Seed("I-9 Authorized Agent 2026", "IMMIGRATION", "PDF", "GOVERNMENT_ID",
                    "I-9 form filled with authorized agent procedures."),
            new Seed("Weekly Status Report Instructions", "INFORMATIONAL", "PDF", "NORMAL",
                    "Instructions for the weekly status report cadence."),
            new Seed("Leave of Absence Form", "EMPLOYMENT", "PDF", "NORMAL",
                    "Time-off / leave request form."),
            new Seed("MSA Template", "LEGAL", "PDF", "NORMAL",
                    "Master Service Agreement template."),
            new Seed("Offer Letter Software Developer", "LEGAL", "PDF", "NORMAL",
                    "Offer letter template for software developer roles."),
            new Seed("PO Template", "INFORMATIONAL", "PDF", "NORMAL",
                    "Purchase Order template."),
            new Seed("W-9 (fw9)", "TAX", "PDF", "FINANCIAL",
                    "IRS W-9 for contractor / 1099 tax information."),
            new Seed("I-9 Form 2026", "IMMIGRATION", "PDF", "GOVERNMENT_ID",
                    "IRS / DHS I-9 employment eligibility form, 2026 version."),
            new Seed("I-983 (2029)", "IMMIGRATION", "PDF", "GOVERNMENT_ID",
                    "DHS I-983 STEM OPT training plan."),
            new Seed("W-4 2026", "TAX", "PDF", "FINANCIAL",
                    "IRS W-4 employee withholding certificate, 2026 version.")
    );

    @Override
    public void run(String... args) {
        UUID systemActorId = resolveSystemActor();
        int seeded = 0;
        int skipped = 0;
        int filePending = 0;
        for (Seed s : SEEDS) {
            try {
                if (repository.existsByTitle(s.title())) {
                    skipped++;
                    continue;
                }
                DocumentTemplate t = DocumentTemplate.builder()
                        .title(s.title())
                        .description(s.description())
                        .category(s.category())
                        .fileKind(s.fileKind())
                        .sensitivity(s.sensitivity())
                        .version(1)
                        .isActive(true)
                        .createdById(systemActorId)
                        .build();
                repository.save(t);
                seeded++;
                filePending++;
                log.info("[DocumentTemplateSeeder] Template '{}' metadata seeded; "
                        + "file pending ERM upload", s.title());
            } catch (Exception e) {
                log.warn("[DocumentTemplateSeeder] seed failed for {} (non-fatal): {}",
                        s.title(), e.getMessage());
            }
        }
        log.info("[DocumentTemplateSeeder] {} new + {} pre-existing; {} awaiting file upload",
                seeded, skipped, filePending);
    }

    /** Resolve a stable created_by_id. Prefers the first SUPER_ADMIN
     *  user; falls back to the deterministic system UUID. */
    private UUID resolveSystemActor() {
        try {
            return userRepository.findAll().stream()
                    .filter(u -> u.getRoles() != null
                            && u.getRoles().stream().anyMatch(r -> "SUPER_ADMIN".equals(r.name())))
                    .findFirst()
                    .map(User::getId)
                    .orElse(UUID.fromString("00000000-0000-0000-0000-000000000001"));
        } catch (Exception e) {
            return UUID.fromString("00000000-0000-0000-0000-000000000001");
        }
    }
}
