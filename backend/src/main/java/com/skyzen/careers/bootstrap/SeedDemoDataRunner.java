package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Resume;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.JobPostingRepository;
import com.skyzen.careers.repository.ResumeRepository;
import com.skyzen.careers.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Populates the database with realistic demo candidates, resumes and applications
 * spread across the recruitment pipeline so the Kanban at /careers/recruiter shows
 * cards in every column for the demo.
 *
 * Idempotent — if the sentinel demo candidate ({@code priya.sharma@example.com})
 * already exists, the whole seeder is a no-op. Otherwise it creates the full set.
 *
 * Demo-only. Remove or guard with a profile flag before any non-dev deploy.
 */
@Component
@Order(4)
@RequiredArgsConstructor
@Slf4j
public class SeedDemoDataRunner implements CommandLineRunner {

    private static final String SENTINEL_EMAIL = "priya.sharma@example.com";
    private static final String DEMO_PASSWORD = "demo12345";

    private final UserRepository userRepository;
    private final CandidateRepository candidateRepository;
    private final ResumeRepository resumeRepository;
    private final JobPostingRepository jobPostingRepository;
    private final ApplicationRepository applicationRepository;
    private final PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${app.resume.storage-path:./uploads/resumes}")
    private String resumeStoragePath;

    /** A candidate to seed: full name + email. */
    private record DemoCandidate(String firstName, String lastName, String email) {
        String fullName() {
            return firstName + " " + lastName;
        }
        String resumeFileName() {
            return firstName + "_" + lastName + "_Resume.pdf";
        }
    }

    /** An application to seed: candidate key + posting slug + status + timestamps + notes. */
    private record DemoApp(
            String candidateEmail,
            String postingSlug,
            ApplicationStatus status,
            int appliedDaysAgo,
            int statusUpdatedDaysAgo,
            String recruiterNotes) {}

    // 10 demo candidates ----------------------------------------------------
    private static final List<DemoCandidate> CANDIDATES = List.of(
            new DemoCandidate("Priya", "Sharma", "priya.sharma@example.com"),
            new DemoCandidate("Marcus", "Chen", "marcus.chen@example.com"),
            new DemoCandidate("Aisha", "Patel", "aisha.patel@example.com"),
            new DemoCandidate("Jamal", "Williams", "jamal.williams@example.com"),
            new DemoCandidate("Lin", "Zhou", "lin.zhou@example.com"),
            new DemoCandidate("Devon", "King", "devon.king@example.com"),
            new DemoCandidate("Sarah", "Kim", "sarah.kim@example.com"),
            new DemoCandidate("Tom", "Garcia", "tom.garcia@example.com"),
            new DemoCandidate("Olivia", "Brown", "olivia.brown@example.com"),
            new DemoCandidate("Rachel", "Lee", "rachel.lee@example.com")
    );

    /*
     * Status mapping (spec name -> backend enum value):
     *   OFFER_EXTENDED -> OFFERED
     *   HIRED          -> ACCEPTED
     *   INTERVIEWED    -> INTERVIEWED  (matches backend)
     *
     * The other spec statuses (APPLIED / SHORTLISTED / INTERVIEW_SCHEDULED /
     * REJECTED) are identical to backend values.
     */
    private static final List<DemoApp> APPLICATIONS = List.of(
            // APPLIED — 3
            new DemoApp("priya.sharma@example.com",   "backend-developer-intern", ApplicationStatus.APPLIED, 1, 1, null),
            new DemoApp("sarah.kim@example.com",      "backend-developer-intern", ApplicationStatus.APPLIED, 2, 2, null),
            new DemoApp("tom.garcia@example.com",     "frontend-developer-intern", ApplicationStatus.APPLIED, 3, 3, null),

            // SHORTLISTED — 2
            new DemoApp("aisha.patel@example.com",    "cloud-engineer-intern",    ApplicationStatus.SHORTLISTED, 5, 2,
                    "Solid AWS background. Shortlisted for ERM interview."),
            new DemoApp("olivia.brown@example.com",   "cloud-engineer-intern",    ApplicationStatus.SHORTLISTED, 6, 3,
                    "Strong DevOps fundamentals. Moving to interview round."),

            // INTERVIEW_SCHEDULED — 2
            new DemoApp("marcus.chen@example.com",    "frontend-developer-intern", ApplicationStatus.INTERVIEW_SCHEDULED, 8, 1,
                    "Excellent React portfolio. Technical interview scheduled for tomorrow."),
            new DemoApp("jamal.williams@example.com", "backend-developer-intern", ApplicationStatus.INTERVIEW_SCHEDULED, 9, 2,
                    "Good cultural fit. Strong Node.js fundamentals."),

            // INTERVIEWED — 1
            new DemoApp("devon.king@example.com",     "backend-developer-intern", ApplicationStatus.INTERVIEWED, 10, 1,
                    "Strong technical interview. Team debrief tomorrow."),

            // OFFERED — 2 (spec calls these "OFFER_EXTENDED")
            new DemoApp("priya.sharma@example.com",   "frontend-developer-intern", ApplicationStatus.OFFERED, 12, 1,
                    "Top performer. Offer extended with 7-day window."),
            new DemoApp("marcus.chen@example.com",    "backend-developer-intern", ApplicationStatus.OFFERED, 11, 2,
                    "Offer for backend role; candidate also interviewing for frontend."),

            // ACCEPTED — 1 (spec calls this "HIRED")
            new DemoApp("lin.zhou@example.com",       "frontend-developer-intern", ApplicationStatus.ACCEPTED, 21, 5,
                    "Offer accepted. Starting Mon Jun 2."),

            // REJECTED — 1 (archived column)
            new DemoApp("rachel.lee@example.com",     "frontend-developer-intern", ApplicationStatus.REJECTED, 15, 4,
                    "Technical bar not met. Recommended to reapply in 6 months.")
    );

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Starting demo data seeder...");
        if (userRepository.existsByEmail(SENTINEL_EMAIL)) {
            log.info("Demo data already seeded ({} exists), skipping.", SENTINEL_EMAIL);
            return;
        }

        // Resolve postings up-front. If any are missing, the SeedJobPostingsRunner
        // hasn't run yet (or someone deleted them) — fail loudly.
        Map<String, JobPosting> postings = new HashMap<>();
        for (String slug : List.of("backend-developer-intern", "frontend-developer-intern", "cloud-engineer-intern")) {
            JobPosting p = jobPostingRepository.findBySlug(slug)
                    .orElseThrow(() -> new IllegalStateException(
                            "Demo seeder needs posting '" + slug + "' — run SeedJobPostingsRunner first."));
            postings.put(slug, p);
        }

        // 1) Candidates + Users
        Map<String, Candidate> candidatesByEmail = new HashMap<>();
        for (DemoCandidate dc : CANDIDATES) {
            User u = User.builder()
                    .email(dc.email())
                    .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                    .fullName(dc.fullName())
                    .roles(EnumSet.of(UserRole.CANDIDATE))
                    .build();
            u = userRepository.save(u);

            Candidate c = Candidate.builder()
                    .user(u)
                    .build();
            c = candidateRepository.save(c);
            candidatesByEmail.put(dc.email(), c);
        }

        // 2) Resumes (one per candidate, marked default)
        Map<String, Resume> resumesByEmail = new HashMap<>();
        for (DemoCandidate dc : CANDIDATES) {
            Candidate c = candidatesByEmail.get(dc.email());
            String stored = UUID.randomUUID() + ".pdf";
            long size = 145_000L + ThreadLocalRandom.current().nextLong(235_000L); // 145 KB .. ~380 KB
            String path = resumeStoragePath.replaceAll("/+$", "") + "/" + stored;

            Resume r = Resume.builder()
                    .candidate(c)
                    .fileName(dc.resumeFileName())
                    .storedFileName(stored)
                    .filePath(path)
                    .fileUrl(stored)
                    .fileSize(size)
                    .contentType("application/pdf")
                    .version(1)
                    .isDefault(true)
                    .build();
            r = resumeRepository.save(r);
            resumesByEmail.put(dc.email(), r);

            // Mirror what ResumeService does — point Candidate.defaultResumeId at it.
            c.setDefaultResumeId(r.getId());
            candidateRepository.save(c);
        }

        // 3) Applications, with historical timestamps applied via bulk UPDATE
        //    (bypasses @PrePersist / @PreUpdate which would otherwise stamp "now").
        Instant now = Instant.now();
        List<UUID> savedIds = new ArrayList<>();
        List<Instant[]> savedTimestamps = new ArrayList<>();

        for (DemoApp da : APPLICATIONS) {
            Candidate c = candidatesByEmail.get(da.candidateEmail());
            JobPosting p = postings.get(da.postingSlug());
            Resume r = resumesByEmail.get(da.candidateEmail());
            if (c == null || p == null || r == null) {
                throw new IllegalStateException("Demo data wiring error for " + da.candidateEmail() + " -> " + da.postingSlug());
            }

            Application app = Application.builder()
                    .candidate(c)
                    .jobPosting(p)
                    .resume(r)
                    .status(da.status())
                    .recruiterNotes(da.recruiterNotes())
                    .build();
            app = applicationRepository.save(app);

            Instant applied = now.minus(da.appliedDaysAgo(), ChronoUnit.DAYS);
            Instant updated = now.minus(da.statusUpdatedDaysAgo(), ChronoUnit.DAYS);
            savedIds.add(app.getId());
            savedTimestamps.add(new Instant[] { applied, updated });
        }

        // Flush so the rows exist before the bulk UPDATE runs against them.
        entityManager.flush();

        for (int i = 0; i < savedIds.size(); i++) {
            UUID id = savedIds.get(i);
            Instant[] ts = savedTimestamps.get(i);
            entityManager.createQuery(
                    "UPDATE Application a " +
                    "SET a.appliedAt = :applied, a.statusUpdatedAt = :updated " +
                    "WHERE a.id = :id")
                    .setParameter("applied", ts[0])
                    .setParameter("updated", ts[1])
                    .setParameter("id", id)
                    .executeUpdate();
        }
        // Bulk UPDATE bypasses the persistence context; clear so any later reads
        // in this transaction see the new timestamps.
        entityManager.clear();

        log.info("Demo data seeded: {} candidates, {} resumes, {} applications across 7 statuses",
                CANDIDATES.size(), CANDIDATES.size(), APPLICATIONS.size());
        log.info("Demo candidate password: {} (all candidates share this for demo purposes)", DEMO_PASSWORD);
        log.warn("DO NOT enable demo data in production — these are sample accounts with a known password");
    }
}
