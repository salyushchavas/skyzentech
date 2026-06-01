package com.skyzen.careers.bootstrap;

import com.skyzen.careers.dto.project.CreateProjectRequest;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Engagement;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.Project;
import com.skyzen.careers.entity.StaffingEntity;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.CompensationFrequency;
import com.skyzen.careers.enums.EmploymentType;
import com.skyzen.careers.enums.EngagementStatus;
import com.skyzen.careers.enums.JobPostingStatus;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.CandidateRepository;
import com.skyzen.careers.repository.EngagementRepository;
import com.skyzen.careers.repository.JobPostingRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.ProjectRepository;
import com.skyzen.careers.repository.StaffingEntityRepository;
import com.skyzen.careers.repository.UserRepository;
import com.skyzen.careers.service.ProjectService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;

/**
 * Dev-only seeder that lets a developer log in immediately as each of the
 * three two-role-workflow personas (Tech Evaluator + Reporting Manager +
 * Intern) without clicking through the admin UI.
 *
 * <h2>Idempotent</h2>
 * Every entity it touches is looked up by a stable identifier (email, slug,
 * project title scoped to engagement) before insert, so re-runs never
 * duplicate. First run logs CREATED for every step; subsequent runs log
 * "already exists, skipped" for everything.
 *
 * <h2>Gated</h2>
 * Activated by {@code app.seed.test-accounts-enabled=true} (or env var
 * {@code SEED_TEST_ACCOUNTS=true}). Default is false — the body returns
 * immediately and nothing is touched. NEVER set true in production.
 *
 * <h2>What it builds</h2>
 * <ol>
 *   <li>Three users (test-eval / test-rm / test-intern).</li>
 *   <li>The full upstream chain so an Engagement row can land:
 *       StaffingEntity → JobPosting → Application → Offer (ACCEPTED).</li>
 *   <li>One Engagement with supervisor=evaluator + reportingManager=RM.</li>
 *   <li>One Project allocated by the evaluator to the intern, via the
 *       existing {@link ProjectService#create} (the only step here that
 *       routes through a service, since the others have no service-layer
 *       blank-slate create method).</li>
 * </ol>
 */
@Component
@Order(10)
@Slf4j
public class TestAccountSeeder implements CommandLineRunner {

    // ── Stable identifiers (idempotency keys) ────────────────────────────────

    private static final String EVAL_EMAIL    = "test-eval@skyzen.test";
    private static final String RM_EMAIL      = "test-rm@skyzen.test";
    private static final String INTERN_EMAIL  = "test-intern@skyzen.test";
    private static final String EVAL_PASSWORD   = "eval12345";
    private static final String RM_PASSWORD     = "rm12345";
    private static final String INTERN_PASSWORD = "intern12345";

    private static final String TEST_ENTITY_NAME = "Skyzen Test Entity (Seeder)";
    private static final String TEST_POSTING_SLUG = "skyzen-test-seeder-posting";
    private static final String TEST_PROJECT_TITLE = "Test Workspace Project";

    private static final String LOG_TAG = "[TestAccountSeeder]";

    // ── Wiring ───────────────────────────────────────────────────────────────

    private final boolean enabled;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CandidateRepository candidateRepository;
    private final StaffingEntityRepository staffingEntityRepository;
    private final JobPostingRepository jobPostingRepository;
    private final ApplicationRepository applicationRepository;
    private final OfferRepository offerRepository;
    private final EngagementRepository engagementRepository;
    private final ProjectRepository projectRepository;
    private final ProjectService projectService;

    public TestAccountSeeder(
            @Value("${app.seed.test-accounts-enabled:false}") boolean enabled,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            CandidateRepository candidateRepository,
            StaffingEntityRepository staffingEntityRepository,
            JobPostingRepository jobPostingRepository,
            ApplicationRepository applicationRepository,
            OfferRepository offerRepository,
            EngagementRepository engagementRepository,
            ProjectRepository projectRepository,
            ProjectService projectService) {
        this.enabled = enabled;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.candidateRepository = candidateRepository;
        this.staffingEntityRepository = staffingEntityRepository;
        this.jobPostingRepository = jobPostingRepository;
        this.applicationRepository = applicationRepository;
        this.offerRepository = offerRepository;
        this.engagementRepository = engagementRepository;
        this.projectRepository = projectRepository;
        this.projectService = projectService;
    }

    @Override
    public void run(String... args) {
        if (!enabled) return; // Silent no-op in production / default config.
        log.info("{} Seeding test accounts (app.seed.test-accounts-enabled=true)", LOG_TAG);
        try {
            User evaluator = findOrCreateUser(EVAL_EMAIL,    "Test Evaluator",         EVAL_PASSWORD,   UserRole.TECHNICAL_SUPERVISOR);
            User rm        = findOrCreateUser(RM_EMAIL,      "Test Reporting Manager", RM_PASSWORD,     UserRole.REPORTING_MANAGER);
            User internU   = findOrCreateUser(INTERN_EMAIL,  "Test Intern",            INTERN_PASSWORD, UserRole.INTERN);

            Candidate internCandidate = findOrCreateCandidate(internU);
            StaffingEntity entity = findOrCreateEntity();
            JobPosting posting = findOrCreatePosting(entity);
            Application application = findOrCreateApplication(internCandidate, posting);
            Offer offer = findOrCreateOffer(application, evaluator);
            Engagement engagement = findOrCreateEngagement(
                    application, internCandidate, offer, entity, evaluator, rm);

            findOrCreateProject(internCandidate, engagement, evaluator);
            log.info("{} Seed complete.", LOG_TAG);
        } catch (Exception e) {
            // Never crash startup on a seeding failure — same defence used by
            // every other bootstrap runner in this package.
            log.warn("{} Seed failed (non-fatal): {}", LOG_TAG, e.getMessage(), e);
        }
    }

    // ── Users ────────────────────────────────────────────────────────────────

    private User findOrCreateUser(String email, String fullName, String rawPassword, UserRole role) {
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            log.info("{}   user {} → already exists, skipped", LOG_TAG, email);
            return existing.get();
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .fullName(fullName)
                .roles(EnumSet.of(role))
                .emailVerified(true) // Skip the 6-digit-code gate for seeded test accounts.
                .active(true)
                .build();
        user = userRepository.save(user);
        log.info("{}   user {} → CREATED", LOG_TAG, email);
        return user;
    }

    private Candidate findOrCreateCandidate(User internUser) {
        return candidateRepository.findByUserId(internUser.getId())
                .orElseGet(() -> {
                    Candidate c = Candidate.builder()
                            .user(internUser)
                            .build();
                    c = candidateRepository.save(c);
                    log.info("{}   candidate row for intern → CREATED", LOG_TAG);
                    return c;
                });
    }

    // ── Engagement upstream chain ────────────────────────────────────────────

    private StaffingEntity findOrCreateEntity() {
        // No name-uniqueness constraint on entities — match-by-name still works
        // because we control the test fixture's name string.
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

    private JobPosting findOrCreatePosting(StaffingEntity entity) {
        return jobPostingRepository.findBySlug(TEST_POSTING_SLUG)
                .orElseGet(() -> {
                    JobPosting p = JobPosting.builder()
                            .entity(entity)
                            .slug(TEST_POSTING_SLUG)
                            .title("Test seeder posting")
                            .description("Seeder-only posting; never published publicly.")
                            .employmentType(EmploymentType.INTERNSHIP)
                            .status(JobPostingStatus.CLOSED)
                            .build();
                    p = jobPostingRepository.save(p);
                    log.info("{}   job posting \"{}\" → CREATED", LOG_TAG, TEST_POSTING_SLUG);
                    return p;
                });
    }

    private Application findOrCreateApplication(Candidate candidate, JobPosting posting) {
        Optional<Application> existing = applicationRepository.findByCandidateId(candidate.getId())
                .stream()
                .filter(a -> a.getJobPosting() != null
                        && posting.getId().equals(a.getJobPosting().getId()))
                .findFirst();
        if (existing.isPresent()) return existing.get();
        Application a = Application.builder()
                .candidate(candidate)
                .jobPosting(posting)
                .status(ApplicationStatus.ACCEPTED)
                .build();
        a = applicationRepository.save(a);
        log.info("{}   application (intern → test posting) → CREATED", LOG_TAG);
        return a;
    }

    private Offer findOrCreateOffer(Application application, User createdBy) {
        return offerRepository.findByApplicationIdOrderByCreatedAtDesc(application.getId())
                .stream().findFirst()
                .orElseGet(() -> {
                    Instant now = Instant.now();
                    Offer o = Offer.builder()
                            .application(application)
                            .compensationAmount(new BigDecimal("25.00"))
                            .compensationFrequency(CompensationFrequency.HOURLY)
                            .compensationCurrency("USD")
                            .startDate(LocalDate.now())
                            .expiresAt(now.plus(180, ChronoUnit.DAYS))
                            .status(OfferStatus.ACCEPTED)
                            .letterContent("Seeded test offer — not a real employment offer.")
                            .createdBy(createdBy.getId())
                            .respondedAt(now)
                            .build();
                    o = offerRepository.save(o);
                    log.info("{}   offer (ACCEPTED) → CREATED", LOG_TAG);
                    return o;
                });
    }

    private Engagement findOrCreateEngagement(Application application, Candidate candidate,
                                              Offer offer, StaffingEntity entity,
                                              User supervisor, User reportingManager) {
        Optional<Engagement> existing = engagementRepository.findByApplicationId(application.getId());
        Engagement engagement;
        if (existing.isPresent()) {
            engagement = existing.get();
            log.info("{}   engagement → already exists, skipped (id={})", LOG_TAG, engagement.getId());
        } else {
            engagement = Engagement.builder()
                    .application(application)
                    .candidate(candidate)
                    .offer(offer)
                    .entity(entity)
                    .status(EngagementStatus.ACTIVE)
                    .plannedStartDate(LocalDate.now())
                    .actualStartDate(LocalDate.now())
                    .supervisor(supervisor)
                    .reportingManager(reportingManager)
                    .createdBy(supervisor.getId())
                    .build();
            engagement = engagementRepository.save(engagement);
            log.info("{}   engagement → CREATED (id={})", LOG_TAG, engagement.getId());
        }

        // Re-stamp supervisor + reporting manager if they drifted (e.g. a prior
        // run created the engagement before the RM existed). Idempotent: save
        // is a no-op when nothing changed.
        boolean dirty = false;
        if (engagement.getSupervisor() == null
                || !supervisor.getId().equals(engagement.getSupervisor().getId())) {
            engagement.setSupervisor(supervisor);
            dirty = true;
        }
        if (engagement.getReportingManager() == null
                || !reportingManager.getId().equals(engagement.getReportingManager().getId())) {
            engagement.setReportingManager(reportingManager);
            dirty = true;
            log.info("{}   reporting manager assigned → CREATED", LOG_TAG);
        } else {
            log.info("{}   reporting manager → already assigned, skipped", LOG_TAG);
        }
        if (dirty) engagementRepository.save(engagement);
        return engagement;
    }

    // ── Project ─────────────────────────────────────────────────────────────

    private void findOrCreateProject(Candidate intern, Engagement engagement, User evaluator) {
        List<Project> existingProjects = projectRepository.findByInternIdWithGraph(intern.getId());
        Optional<Project> match = existingProjects.stream()
                .filter(p -> TEST_PROJECT_TITLE.equals(p.getTitle()))
                .findFirst();
        if (match.isPresent()) {
            log.info("{}   project \"{}\" → already exists, skipped (id={})",
                    LOG_TAG, TEST_PROJECT_TITLE, match.get().getId());
            return;
        }
        // Route through the existing ProjectService.create so the audit row,
        // task-checklist plumbing, and notification side-effect all behave
        // exactly like a real supervisor allocation.
        CreateProjectRequest req = CreateProjectRequest.builder()
                .title(TEST_PROJECT_TITLE)
                .candidateId(intern.getId())
                .description("Seeded project for end-to-end testing of the workspace + two-role workflow.")
                .deliverables("A working solution that exercises the workspace editor, submission, tech approval, and viva sign-off.")
                .build();
        var resp = projectService.create(req, evaluator);
        log.info("{}   project \"{}\" → CREATED (id={})",
                LOG_TAG, TEST_PROJECT_TITLE, resp.getId());
    }
}
