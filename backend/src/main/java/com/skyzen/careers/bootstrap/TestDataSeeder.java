package com.skyzen.careers.bootstrap;

import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.Interview;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.entity.WorkAuthorizationRecord;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.CompensationFrequency;
import com.skyzen.careers.enums.EmploymentType;
import com.skyzen.careers.enums.InternLifecycleStatus;
import com.skyzen.careers.enums.InterviewRecommendation;
import com.skyzen.careers.enums.InterviewStatus;
import com.skyzen.careers.enums.InterviewType;
import com.skyzen.careers.enums.JobPostingStatus;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.enums.WorkAuthTrack;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.InterviewRepository;
import com.skyzen.careers.repository.JobPostingRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.StaffingEntityRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.repository.WorkAuthorizationRecordRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Phase 8.3 — one-shot, idempotent dev/staging seeder that establishes a
 * complete environment ending at the Pending Document Assignment state:
 * 4 supporting users (ERM, Trainer, Evaluator, Manager), 1 OPEN job
 * posting, and 3 test interns whose pipeline runs from
 * applicant → application → interview SELECTED → offer SIGNED → employee
 * ID minted → reporting structure assigned. The next ERM action — for
 * each of the 3 interns — is to assign the document packet.
 *
 * <h2>Gating</h2>
 * Activated by {@code SEED_TEST_DATA=true} env var (or
 * {@code app.seed.test-data-enabled=true} Spring property). Default is
 * false; the body returns silently. NEVER set true in production.
 *
 * <h2>Idempotency</h2>
 * Every row is keyed by a stable identifier (user email, job posting
 * slug, application by candidate+posting, offer by docusign envelope_id).
 * Re-runs skip cleanly with INFO logs. Per-intern try-catch so a partial
 * failure on one intern doesn't block the others.
 *
 * <h2>Staggered timestamps</h2>
 * Application applied 30d ago, interviewed 21d ago, offer sent 14d ago.
 * Signed dates are staggered per intern (3 / 8 / 14 days ago) so the
 * "Awaiting document packet" urgent KPI (signed > 7d) lights up for
 * Priya and Kavya but not Aarav.
 */
@Component
@Order(50)
@Slf4j
public class TestDataSeeder implements CommandLineRunner {

    private static final String LOG_TAG = "[TestDataSeeder]";
    private static final String DEFAULT_PASSWORD = "Test1234!";

    private static final String ERM_EMAIL = "test-erm@skyzen.test";
    private static final String TRAINER_EMAIL = "test-trainer@skyzen.test";
    private static final String EVALUATOR_EMAIL = "test-evaluator@skyzen.test";
    private static final String MANAGER_EMAIL = "test-manager@skyzen.test";

    private static final String TEST_ENTITY_NAME = "Skyzen Test Entity (Phase 8.3)";
    private static final String TEST_POSTING_SLUG = "skyzen-test-java-fullstack-intern";

    private final boolean enabled;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CandidateRepository candidateRepository;
    private final StaffingEntityRepository staffingEntityRepository;
    private final JobPostingRepository jobPostingRepository;
    private final ApplicationRepository applicationRepository;
    private final InterviewRepository interviewRepository;
    private final OfferRepository offerRepository;
    private final InternLifecycleRepository lifecycleRepository;
    private final WorkAuthorizationRecordRepository workAuthRepository;
    private final JdbcTemplate jdbc;

    public TestDataSeeder(
            @Value("${app.seed.test-data-enabled:${SEED_TEST_DATA:false}}") boolean enabled,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            CandidateRepository candidateRepository,
            StaffingEntityRepository staffingEntityRepository,
            JobPostingRepository jobPostingRepository,
            ApplicationRepository applicationRepository,
            InterviewRepository interviewRepository,
            OfferRepository offerRepository,
            InternLifecycleRepository lifecycleRepository,
            WorkAuthorizationRecordRepository workAuthRepository,
            JdbcTemplate jdbc) {
        this.enabled = enabled;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.candidateRepository = candidateRepository;
        this.staffingEntityRepository = staffingEntityRepository;
        this.jobPostingRepository = jobPostingRepository;
        this.applicationRepository = applicationRepository;
        this.interviewRepository = interviewRepository;
        this.offerRepository = offerRepository;
        this.lifecycleRepository = lifecycleRepository;
        this.workAuthRepository = workAuthRepository;
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            log.info("{} SEED_TEST_DATA not set, skipping.", LOG_TAG);
            return;
        }
        log.info("{} Seeding dev test data (SEED_TEST_DATA=true)", LOG_TAG);

        User erm, trainer, evaluator, manager;
        StaffingEntity entity;
        JobPosting posting;
        try {
            erm = findOrCreateStaffUser(ERM_EMAIL, "Test ERM", UserRole.ERM, true);
            trainer = findOrCreateStaffUser(TRAINER_EMAIL, "Test Trainer", UserRole.TRAINER, true);
            evaluator = findOrCreateStaffUser(EVALUATOR_EMAIL, "Test Evaluator", UserRole.REPORTING_MANAGER, true);
            manager = findOrCreateStaffUser(MANAGER_EMAIL, "Test Manager", UserRole.MANAGER, true);

            entity = findOrCreateEntity();
            posting = findOrCreatePosting(entity, erm);
        } catch (Exception e) {
            log.warn("{} Supporting fixtures failed (non-fatal — skipping intern seed): {}",
                    LOG_TAG, e.getMessage(), e);
            return;
        }

        int created = 0;
        int skipped = 0;
        for (InternSpec spec : INTERN_SPECS) {
            try {
                Outcome outcome = seedIntern(spec, posting, erm, trainer, evaluator, manager);
                if (outcome == Outcome.CREATED) created++;
                else if (outcome == Outcome.SKIPPED) skipped++;
            } catch (Exception e) {
                log.warn("{} Intern {} seed failed (non-fatal): {}",
                        LOG_TAG, spec.email, e.getMessage(), e);
            }
        }

        log.info("{} Seed complete. {} created, {} pre-existing. "
                + "{} interns ready in Pending Document Assignment tab.",
                LOG_TAG, created, skipped, created + skipped);
    }

    // ── Supporting users + entity + posting ────────────────────────────────

    private User findOrCreateStaffUser(String email, String fullName, UserRole role,
                                        boolean setZoomEmail) {
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            log.info("{}   staff {} → already exists, skipped", LOG_TAG, email);
            return existing.get();
        }
        User u = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(DEFAULT_PASSWORD))
                .fullName(fullName)
                .roles(EnumSet.of(role))
                .emailVerified(true)
                .active(true)
                .lifecycleStatus(InternLifecycleStatus.REGISTERED)
                .build();
        if (setZoomEmail) {
            // Mirror the staff user's email as their Zoom host email so the
            // interview + meeting flows have a valid host id when they fire
            // against the seeded users.
            u.setZoomEmail(email);
        }
        u = userRepository.save(u);
        log.info("{}   staff {} → CREATED (id={})", LOG_TAG, email, u.getId());
        return u;
    }

    private StaffingEntity findOrCreateEntity() {
        return staffingEntityRepository.findAll().stream()
                .filter(e -> TEST_ENTITY_NAME.equals(e.getName()))
                .findFirst()
                .orElseGet(() -> {
                    StaffingEntity e = StaffingEntity.builder()
                            .name(TEST_ENTITY_NAME)
                            .isActive(true)
                            .build();
                    e = staffingEntityRepository.save(e);
                    log.info("{}   staffing entity \"{}\" → CREATED", LOG_TAG, TEST_ENTITY_NAME);
                    return e;
                });
    }

    private JobPosting findOrCreatePosting(StaffingEntity entity, User erm) {
        return jobPostingRepository.findBySlug(TEST_POSTING_SLUG)
                .orElseGet(() -> {
                    JobPosting p = JobPosting.builder()
                            .entity(entity)
                            .slug(TEST_POSTING_SLUG)
                            .title("Java Full Stack Developer Intern")
                            .description("Build features end-to-end across our Java 21 / Spring Boot 3 "
                                    + "backend and Next.js 14 frontend. 12-month internship.")
                            .requirements("Java fundamentals, basic SQL, comfort with one frontend framework. "
                                    + "Bonus: Spring Boot, JPA, React.")
                            .location("Remote (US)")
                            .employmentType(EmploymentType.INTERNSHIP)
                            .status(JobPostingStatus.OPEN)
                            .publishedById(erm.getId())
                            .publishedAt(Instant.now())
                            .build();
                    p = jobPostingRepository.save(p);
                    log.info("{}   job posting \"{}\" → CREATED (id={})",
                            LOG_TAG, TEST_POSTING_SLUG, p.getId());
                    return p;
                });
    }

    // ── Per-intern chain ────────────────────────────────────────────────────

    private enum Outcome { CREATED, SKIPPED }

    @Transactional
    private Outcome seedIntern(InternSpec spec, JobPosting posting,
                                User erm, User trainer, User evaluator, User manager) {
        if (userRepository.findByEmail(spec.email).isPresent()) {
            log.info("{}   intern {} ({}) → already exists, skipping",
                    LOG_TAG, spec.fullName, spec.email);
            return Outcome.SKIPPED;
        }

        Instant now = Instant.now();
        Instant appliedAt = now.minus(30, ChronoUnit.DAYS);
        Instant interviewedAt = now.minus(21, ChronoUnit.DAYS);
        Instant offerSentAt = now.minus(14, ChronoUnit.DAYS);
        Instant signedAt = now.minus(spec.signedDaysAgo, ChronoUnit.DAYS);

        // 1) User row — already at EMPLOYEE_ID_CREATED lifecycle status.
        String employeeId = nextEmployeeId();
        User user = User.builder()
                .email(spec.email)
                .passwordHash(passwordEncoder.encode(DEFAULT_PASSWORD))
                .fullName(spec.fullName)
                .phoneNumber(spec.phone)
                .roles(EnumSet.of(UserRole.INTERN))
                .emailVerified(true)
                .active(true)
                .applicantId(nextApplicantId())
                .applicantIdCreatedAt(appliedAt)
                .employeeId(employeeId)
                .lifecycleStatus(InternLifecycleStatus.EMPLOYEE_ID_CREATED)
                .build();
        user = userRepository.save(user);

        // 2) Candidate row — work auth + education metadata.
        Candidate candidate = Candidate.builder()
                .user(user)
                .legalName(spec.fullName)
                .preferredName(spec.fullName.split(" ")[0])
                .school(spec.school)
                .degree(spec.degree)
                .education(spec.degree + ", " + spec.school)
                .skillset(spec.skillset)
                .authorizedToWork(Boolean.TRUE)
                .sponsorshipNeeded(spec.workAuthTrack != WorkAuthTrack.OTHER)
                .expectedTrack(spec.workAuthTrack)
                .build();
        candidate = candidateRepository.save(candidate);

        // 3) Application — saved first with default applied_at = now()
        //    (JPA @PrePersist), then back-dated via raw UPDATE.
        Application app = Application.builder()
                .candidate(candidate)
                .jobPosting(posting)
                .status(ApplicationStatus.HIRED)
                .statementOfInterest(spec.statementOfInterest)
                .ermOwnerId(erm.getId())
                .lastDecisionReasonCode("SELECTED")
                .lastDecisionAt(interviewedAt)
                .lastDecisionById(erm.getId())
                .recruiterRating(8)
                .build();
        app = applicationRepository.save(app);
        backdate("applications", "applied_at", app.getId(), appliedAt);
        backdate("applications", "status_updated_at", app.getId(), signedAt);

        // 4) Interview — COMPLETED + SELECTED with realistic feedback.
        Interview interview = Interview.builder()
                .application(app)
                .interviewer(erm)
                .scheduledAt(interviewedAt)
                .durationMinutes(60)
                .type(InterviewType.TECHNICAL)
                .status(InterviewStatus.COMPLETED)
                .timezone("America/Chicago")
                .decision("SELECTED")
                .feedbackOverallRating(8)
                .feedbackTechnicalRating(8)
                .feedbackCommunicationRating(8)
                .feedbackProblemSolvingRating(8)
                .feedbackStrengths("Strong fundamentals; thoughtful trade-off discussion.")
                .feedbackComments("Recommended for offer. Good cultural fit.")
                .feedbackRecommendation(InterviewRecommendation.HIRE)
                .feedbackSubmittedAt(interviewedAt.plus(2, ChronoUnit.HOURS))
                .feedbackSubmittedBy(erm.getId())
                .applicantVisibleNotes("Thanks for the great conversation!")
                .build();
        interview = interviewRepository.save(interview);

        // 5) Offer — SIGNED via simulated DocuSign envelope.
        String envelopeId = "test-envelope-" + slugify(spec.fullName) + "-" + signedAt.getEpochSecond();
        LocalDate startDate = LocalDate.now().plus(14, ChronoUnit.DAYS);
        Offer offer = Offer.builder()
                .application(app)
                .compensationAmount(new BigDecimal("28.50"))
                .compensationFrequency(CompensationFrequency.HOURLY)
                .compensationCurrency("USD")
                .startDate(startDate)
                .expectedEndDate(startDate.plusMonths(12))
                .expiresAt(offerSentAt.plus(30, ChronoUnit.DAYS))
                .status(OfferStatus.SIGNED)
                .letterContent("Seeded test offer for " + spec.fullName + ". Not a real employment offer.")
                .createdBy(erm.getId())
                .sentAt(offerSentAt)
                .respondedAt(signedAt)
                .signedAt(signedAt)
                .docusignEnvelopeId(envelopeId)
                .roleTitle("Java Full Stack Developer Intern")
                .compensationSummary("$28.50 / hr")
                .worksite("Remote (US)")
                .expectedHoursPerWeek(40)
                .build();
        offer = offerRepository.save(offer);

        // 6) InternLifecycle — PROSPECTIVE + reporting structure complete +
        //    no document packet. Hired_at backdated to the signed moment so
        //    the "signed > 7d ago" urgent KPI math matches.
        InternLifecycle lc = InternLifecycle.builder()
                .userId(user.getId())
                .employeeId(employeeId)
                .activeStatus("PROSPECTIVE")
                .ermId(erm.getId())
                .trainerId(trainer.getId())
                .evaluatorId(evaluator.getId())
                .managerId(manager.getId())
                .hiredAt(signedAt)
                .tentativeStartDate(startDate)
                .reportingStructureComplete(Boolean.TRUE)
                .reportingStructureCompletedAt(signedAt.plus(1, ChronoUnit.HOURS))
                .reportingStructureCompletedById(erm.getId())
                .build();
        lc = lifecycleRepository.save(lc);
        // hired_at, reporting_structure_completed_at, created_at all default
        // to NOW() via @PrePersist on InternLifecycle. Back-date them so the
        // Phase 8.2 "signed > 7d ago" urgent gate fires as the spec demands.
        backdate("intern_lifecycles", "hired_at", lc.getId(), signedAt);
        backdate("intern_lifecycles", "reporting_structure_completed_at",
                lc.getId(), signedAt.plus(1, ChronoUnit.HOURS));
        backdate("intern_lifecycles", "created_at", lc.getId(), signedAt);

        // 7) WorkAuthorizationRecord — needed for the Compliance Tracker
        //    KPI math; sensitivity to work_auth_type from the spec.
        WorkAuthorizationRecord war = WorkAuthorizationRecord.builder()
                .userId(user.getId())
                .workAuthType(spec.workAuthType)
                .authorizedFrom(LocalDate.now().minusMonths(2))
                .authorizedUntil(LocalDate.now().plusYears(2))
                .i983Required(spec.workAuthTrack == WorkAuthTrack.STEM_OPT)
                .dsoName(spec.dsoName)
                .dsoEmail(spec.dsoEmail)
                .dsoPhone(spec.dsoPhone)
                .lastUpdatedAt(now)
                .lastUpdatedById(erm.getId())
                .build();
        workAuthRepository.save(war);

        log.info("{}   Created intern {} ({}) → lifecycle={}, employeeId={}, "
                + "signed {}d ago, ready for document packet assignment",
                LOG_TAG, spec.fullName, spec.email,
                lc.getId(), employeeId, spec.signedDaysAgo);
        return Outcome.CREATED;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private String nextEmployeeId() {
        try {
            Long n = jdbc.queryForObject(
                    "SELECT nextval('skyzen_employee_seq')", Long.class);
            long val = n == null ? 1000 : n;
            int year = LocalDate.now(ZoneOffset.UTC).getYear();
            return String.format("SKZ-EMP-%d-%06d", year, val);
        } catch (Exception e) {
            // Sequence not available — fall back to UUID-suffixed string so the
            // seeder doesn't bail on a fresh DB before SchemaFixupRunner runs.
            return "SKZ-EMP-TEST-" + UUID.randomUUID().toString().substring(0, 8);
        }
    }

    private String nextApplicantId() {
        try {
            Long n = jdbc.queryForObject(
                    "SELECT nextval('skyzen_applicant_seq')", Long.class);
            long val = n == null ? 1000 : n;
            int year = LocalDate.now(ZoneOffset.UTC).getYear();
            return String.format("SKZ-INT-%d-%06d", year, val);
        } catch (Exception e) {
            return "SKZ-INT-TEST-" + UUID.randomUUID().toString().substring(0, 8);
        }
    }

    private void backdate(String table, String column, UUID id, Instant target) {
        try {
            jdbc.update("UPDATE " + table + " SET " + column + " = ? WHERE id = ?",
                    java.sql.Timestamp.from(target), id);
        } catch (Exception e) {
            log.warn("{}   backdate {}.{} on {} skipped (non-fatal): {}",
                    LOG_TAG, table, column, id, e.getMessage());
        }
    }

    private static String slugify(String s) {
        return s == null ? "intern"
                : s.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    // ── Intern fixtures ─────────────────────────────────────────────────────

    private record InternSpec(
            String email,
            String fullName,
            String phone,
            int signedDaysAgo,
            WorkAuthTrack workAuthTrack,
            String workAuthType,
            String school,
            String degree,
            String skillset,
            String statementOfInterest,
            String dsoName,
            String dsoEmail,
            String dsoPhone
    ) {}

    private static final List<InternSpec> INTERN_SPECS = List.of(
            new InternSpec(
                    "aarav.test@skyzen.test",
                    "Aarav Sharma",
                    "+1-555-0101",
                    3,
                    WorkAuthTrack.OTHER,
                    "US_CITIZEN",
                    "Sample University",
                    "BS Computer Science",
                    "Java, Spring Boot, React, PostgreSQL",
                    "Excited to join a fast-moving full-stack team and ship features end-to-end.",
                    null, null, null),
            new InternSpec(
                    "priya.test@skyzen.test",
                    "Priya Patel",
                    "+1-555-0102",
                    8,
                    WorkAuthTrack.OPT,
                    "F1_OPT",
                    "Carnegie Mellon University",
                    "MS Data Science",
                    "Python, scikit-learn, TensorFlow, SQL, AWS",
                    "Looking forward to applying my ML coursework on real production data pipelines.",
                    null, null, null),
            new InternSpec(
                    "kavya.test@skyzen.test",
                    "Kavya Reddy",
                    "+1-555-0103",
                    14,
                    WorkAuthTrack.STEM_OPT,
                    "F1_STEM_OPT",
                    "University of Illinois Urbana-Champaign",
                    "MS Computer Engineering",
                    "Java, Kafka, Spark, Airflow, Snowflake",
                    "Eager to contribute to data engineering infrastructure work.",
                    "Dr. Sample DSO",
                    "dso@illinois.test",
                    "+1-217-555-0100")
    );
}
