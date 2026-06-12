package com.skyzen.careers.intern;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.dto.offer.SendDocusignOfferRequest;
import com.skyzen.careers.entity.Application;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Candidate;
import com.skyzen.careers.entity.Document;
import com.skyzen.careers.entity.InternLifecycle;
import com.skyzen.careers.entity.JobPosting;
import com.skyzen.careers.entity.Offer;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.ApplicationStatus;
import com.skyzen.careers.enums.InternLifecycleStatus;
import com.skyzen.careers.enums.OfferStatus;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.event.OfferSentEvent;
import com.skyzen.careers.event.OfferSignedEvent;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.integration.docusign.DocuSignService;
import com.skyzen.careers.integration.docusign.EnvelopeRequest;
import com.skyzen.careers.integration.docusign.EnvelopeResponse;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.DocumentRepository;
import com.skyzen.careers.repository.InternLifecycleRepository;
import com.skyzen.careers.repository.OfferRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Phase 3 DocuSign-driven offer flow. Sits alongside the legacy
 * {@code OfferService} — that service handles the pre-DocuSign manual
 * accept / decline / revoke commands and stays in place for backward
 * compatibility. New endpoints route through this class for:
 *
 * <ul>
 *   <li>{@link #sendDocusignOffer} — atomic create + DocuSign envelope create
 *       + application stage advance + lifecycle advance.</li>
 *   <li>{@link #voidOffer} — VOID an envelope; refuse if SIGNED.</li>
 *   <li>{@link #getSigningUrl} — embedded recipient-view URL.</li>
 *   <li>{@link #downloadArchivedSignedPdf} — stream the archived PDF.</li>
 *   <li>{@link #refreshStatus} — manual reconcile if Connect webhook missed.</li>
 *   <li>{@link #handleWebhookCompleted} — webhook-triggered atomic finalize:
 *       Document archive, Employee ID mint, InternLifecycle insert,
 *       lifecycle advance to EMPLOYEE_ID_CREATED, OfferSignedEvent.</li>
 * </ul>
 *
 * Field-level RBAC: returns the raw Offer to callers; the controller is
 * responsible for shaping applicant-safe DTOs (no internal notes, no
 * voided_reason unless owner sees their own VOIDED offer).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OfferDocuSignService {

    private final OfferRepository offerRepository;
    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final InternLifecycleRepository internLifecycleRepository;
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    private final DocuSignService docuSignService;
    private final InternLifecycleService internLifecycleService;
    private final ApplicationEventPublisher eventPublisher;
    private final JdbcTemplate jdbcTemplate;
    private final com.skyzen.careers.erm.CommunicationTemplateService templateService;
    private final com.skyzen.careers.notification.EmailProvider emailProvider;

    @Value("${app.documents.storage-path:./uploads/documents}")
    private String storageRoot;

    @Value("${app.frontend.base-url:https://www.skyzentech.com}")
    private String frontendBaseUrl;

    // ── ERM commands ────────────────────────────────────────────────────────

    @Transactional
    public Offer sendDocusignOffer(SendDocusignOfferRequest req, User actor) {
        Application application = applicationRepository.findById(req.getApplicationId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Application not found: " + req.getApplicationId()));

        // Stage guard: INTERVIEWED is the post-completion state.
        if (application.getStatus() != ApplicationStatus.INTERVIEWED) {
            throw new ConflictException(
                    "Offer requires application stage INTERVIEWED (current: "
                            + application.getStatus() + ")");
        }
        if (offerRepository.existsByApplicationId(application.getId())) {
            throw new ConflictException("Application already has an offer");
        }

        Candidate candidate = application.getCandidate();
        User applicantUser = candidate != null ? candidate.getUser() : null;
        if (applicantUser == null) {
            throw new BadRequestException("Application has no resolvable applicant user");
        }
        JobPosting jp = application.getJobPosting();

        int expiryDays = req.getExpiryDays() != null ? req.getExpiryDays() : 7;
        Instant expiresAt = Instant.now().plus(expiryDays, ChronoUnit.DAYS);

        String compSummary = req.getCompensationSummary() != null
                ? req.getCompensationSummary().trim() : "TBD";

        Offer offer = Offer.builder()
                .application(application)
                .compensationAmount(java.math.BigDecimal.ZERO)
                .compensationCurrency("USD")
                .compensationFrequency(safeFrequency())
                .startDate(req.getTentativeStartDate())
                .expiresAt(expiresAt)
                .status(OfferStatus.SENT)
                .letterContent(buildPlainLetter(req, applicantUser, jp, actor))
                .roleTitle(req.getRoleTitle())
                .compensationSummary(compSummary)
                .worksite(req.getWorksite())
                .expectedHoursPerWeek(req.getExpectedHoursPerWeek())
                .sentAt(Instant.now())
                .createdBy(actor != null ? actor.getId() : null)
                .build();
        offer = offerRepository.save(offer);

        // Phase 8.6.2 — DocuSign integration is disabled. The applicant
        // signs in-house at /careers/intern/offer/sign/{offerId}. The
        // docusign_envelope_id / docusign_template_id columns stay null
        // on this row and the DocuSign call site is intentionally absent.
        log.info("[Offer] in-house signing flow — offer={} persisted with "
                        + "status=SENT; applicant signs at /careers/intern/offer/sign/{}",
                offer.getId(), offer.getId());

        // Application stage + applicant lifecycle.
        application.setStatus(ApplicationStatus.OFFERED);
        application.setStatusUpdatedAt(Instant.now());
        application.setStatusUpdatedBy(actor != null ? actor.getId() : null);
        applicationRepository.save(application);

        internLifecycleService.advance(applicantUser,
                InternLifecycleStatus.OFFER_SENT,
                actor != null ? actor.getId() : null);

        writeAudit("Offer", offer.getId(), "SEND_DOCUSIGN",
                actor != null ? actor.getId() : null, null, snapshot(offer));

        try {
            eventPublisher.publishEvent(new OfferSentEvent(
                    offer.getId(), application.getId(), applicantUser.getId()));
        } catch (Exception e) {
            log.warn("OfferSentEvent publish failed (non-fatal) for {}: {}",
                    offer.getId(), e.getMessage());
        }

        // Phase 8.6.2 — DocuSign no longer sends the applicant email, so we
        // render OFFER_LETTER ourselves and dispatch it with a signing link
        // pointing at the in-house page. Non-fatal: failure is logged so the
        // offer row stays SENT and ERM can re-send via the reminder action.
        try {
            String signingLink = frontendBaseUrl.replaceAll("/$", "")
                    + "/careers/intern/offer/sign/" + offer.getId();
            Map<String, Object> vars = new LinkedHashMap<>();
            String firstName = applicantUser.getFullName() != null
                    ? applicantUser.getFullName().split("\\s+", 2)[0] : "there";
            vars.put("firstName", firstName);
            vars.put("roleTitle", req.getRoleTitle() != null ? req.getRoleTitle() : "");
            vars.put("tentativeStartDate", req.getTentativeStartDate() != null
                    ? req.getTentativeStartDate().toString() : "TBD");
            vars.put("compensationSummary", compSummary);
            vars.put("worksite", req.getWorksite() != null ? req.getWorksite() : "");
            vars.put("expectedHoursPerWeek", req.getExpectedHoursPerWeek() != null
                    ? req.getExpectedHoursPerWeek().toString() : "TBD");
            vars.put("contingencies",
                    "Subject to verification of work authorization.");
            vars.put("expiryDays", String.valueOf(expiryDays));
            vars.put("ermName", actor != null && actor.getFullName() != null
                    ? actor.getFullName() : "Skyzen ERM");
            vars.put("signingLink", signingLink);
            templateService.render("OFFER_LETTER", "EMAIL", vars).ifPresent(r ->
                    emailProvider.sendRendered(applicantUser.getEmail(),
                            r.subject() != null ? r.subject() : "Your Skyzen offer",
                            r.body() != null ? r.body() : signingLink));
        } catch (Exception e) {
            log.warn("[Offer] applicant email render/send failed for offer={}: {}",
                    offer.getId(), e.getMessage());
        }
        return offer;
    }

    @Transactional
    public Offer voidOffer(UUID offerId, String reason, User actor) {
        if (reason == null || reason.trim().length() < 10) {
            throw new BadRequestException("voided_reason must be at least 10 characters");
        }
        Offer offer = offerRepository.findByIdWithGraph(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found: " + offerId));
        if (offer.getStatus() == OfferStatus.SIGNED) {
            throw new ConflictException(
                    "Cannot void a signed offer — cancel via DocuSign Admin and process refund manually");
        }
        if (offer.getStatus() == OfferStatus.VOIDED) {
            return offer; // idempotent
        }
        Map<String, Object> before = snapshot(offer);

        if (offer.getDocusignEnvelopeId() != null && docuSignService.isReady()) {
            try {
                docuSignService.voidEnvelope(offer.getDocusignEnvelopeId(), reason);
            } catch (Exception e) {
                log.warn("[DocuSign] voidEnvelope failed (non-fatal) for offer={}: {}",
                        offer.getId(), e.getMessage());
            }
        }

        offer.setStatus(OfferStatus.VOIDED);
        offer.setVoidedAt(Instant.now());
        offer.setVoidedReason(reason.trim());
        Offer saved = offerRepository.save(offer);
        writeAudit("Offer", saved.getId(), "VOID",
                actor != null ? actor.getId() : null, before, snapshot(saved));
        return saved;
    }

    @Transactional
    public void resendOffer(UUID offerId, User actor) {
        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found: " + offerId));
        if (offer.getStatus() != OfferStatus.SENT) {
            throw new ConflictException("Only SENT offers can be resent (current: " + offer.getStatus() + ")");
        }
        if (offer.getDocusignEnvelopeId() == null || !docuSignService.isReady()) {
            throw new BadRequestException("No DocuSign envelope linked to this offer");
        }
        docuSignService.resendEnvelope(offer.getDocusignEnvelopeId());
        writeAudit("Offer", offer.getId(), "RESEND",
                actor != null ? actor.getId() : null, null, snapshot(offer));
    }

    // ── Intern reads ────────────────────────────────────────────────────────

    public String getSigningUrl(UUID offerId, User caller) {
        Offer offer = mustOwnAsApplicant(offerId, caller);
        if (offer.getStatus() != OfferStatus.SENT) {
            throw new ConflictException("Offer not in a signable state (status="
                    + offer.getStatus() + ")");
        }
        if (offer.getDocusignEnvelopeId() == null || !docuSignService.isReady()) {
            return null; // controller surfaces fallbackMessage to the UI
        }
        String returnUrl = frontendBaseUrl.replaceAll("/$", "")
                + "/careers/intern/offer/return";
        return docuSignService.createRecipientViewUrl(
                offer.getDocusignEnvelopeId(),
                returnUrl,
                caller.getEmail(),
                caller.getFullName() != null ? caller.getFullName() : caller.getEmail(),
                caller.getId().toString());
    }

    public DownloadedPdf downloadArchivedSignedPdf(UUID offerId, User caller) {
        Offer offer = offerRepository.findByIdWithGraph(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found: " + offerId));
        ensureCanReadFull(offer, caller);
        if (offer.getStatus() != OfferStatus.SIGNED || offer.getSignedPdfDocumentId() == null) {
            throw new ConflictException("Signed PDF is not yet archived for this offer");
        }
        Document doc = documentRepository.findById(offer.getSignedPdfDocumentId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Signed PDF document missing for offer " + offerId));
        try {
            byte[] bytes = Files.readAllBytes(Paths.get(doc.getStorageKey()));
            return new DownloadedPdf(doc.getFileName(), bytes);
        } catch (Exception e) {
            throw new RuntimeException("Could not read archived PDF for offer " + offerId, e);
        }
    }

    /**
     * Manual reconciliation when the webhook didn't arrive. Anyone with read
     * access can hit this; if DocuSign now reports completed we run the same
     * finalize the webhook would.
     */
    @Transactional
    public Offer refreshStatus(UUID offerId, User caller) {
        Offer offer = offerRepository.findByIdWithGraph(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found: " + offerId));
        // INTERN owner OR staff
        boolean isOwner = isOwner(offer, caller);
        boolean isStaff = isStaff(caller);
        if (!isOwner && !isStaff) {
            throw new ForbiddenException("Not allowed to refresh this offer's status");
        }
        if (offer.getDocusignEnvelopeId() == null || !docuSignService.isReady()) {
            return offer;
        }
        EnvelopeResponse env = docuSignService.getEnvelope(offer.getDocusignEnvelopeId());
        if (env == null || env.status() == null) return offer;
        return applyDocusignStatus(offer, env.status(), env.statusChangedAt(),
                caller != null ? caller.getId() : null);
    }

    // ── Webhook completion handler ──────────────────────────────────────────

    /**
     * Idempotent, atomic finalize of a DocuSign envelope status change.
     * Called from {@link com.skyzen.careers.webhook.DocuSignWebhookController}
     * after HMAC verification. Returns the resulting Offer for logging.
     */
    @Transactional
    public Offer handleWebhookCompleted(String envelopeId, String envelopeStatus) {
        if (envelopeId == null || envelopeStatus == null) {
            throw new BadRequestException("envelopeId and status are required");
        }
        Offer offer = offerRepository.findByDocusignEnvelopeId(envelopeId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No offer for DocuSign envelope " + envelopeId));
        // Idempotency: SIGNED is terminal.
        if (offer.getStatus() == OfferStatus.SIGNED) {
            log.info("[DocuSign] webhook envelope={} already processed (status=SIGNED) — no-op",
                    envelopeId);
            return offer;
        }
        return applyDocusignStatus(offer, envelopeStatus, Instant.now(), null);
    }

    // ── Phase 8.6.2 — In-house signing entry points ────────────────────────

    /** Ownership-checked offer load for the applicant signing page. */
    @Transactional(readOnly = true)
    public Offer loadForApplicant(UUID offerId, User caller) {
        return mustOwnAsApplicant(offerId, caller);
    }

    /** Wraps {@link #finalizeInHouseSigning} with the ownership check the
     *  applicant signing endpoint needs. */
    @Transactional
    public Offer signInHouse(UUID offerId, String typedName, User caller) {
        Offer offer = mustOwnAsApplicant(offerId, caller);
        if (typedName == null || typedName.trim().isEmpty()) {
            throw new BadRequestException("typedName is required");
        }
        if (typedName.trim().length() > 200) {
            throw new BadRequestException("typedName must be at most 200 characters");
        }
        return finalizeInHouseSigning(offer.getId(), typedName.trim(), caller);
    }

    // ── Phase 8.6.2 — In-house signing finalize ────────────────────────────

    /**
     * Mirrors the SIGNED branch of {@link #applyDocusignStatus} but driven
     * by the applicant clicking "Sign Offer" on the in-house signing page
     * instead of a DocuSign webhook. Idempotent: re-calling on an already
     * SIGNED offer returns it unchanged.
     *
     * <p>Side-effects on first call:
     * <ul>
     *   <li>offer.status = SIGNED, signed_at = now, signed_by_typed_name = typed</li>
     *   <li>Mint employee_id and stamp it on the applicant user</li>
     *   <li>Advance user.lifecycle_status to EMPLOYEE_ID_CREATED</li>
     *   <li>Create InternLifecycle row (once per user)</li>
     *   <li>Advance application.status to HIRED</li>
     *   <li>Publish OfferSignedEvent for the downstream ERM notification fan-out</li>
     * </ul>
     *
     * <p>Skipped vs the DocuSign path: archiving a signed PDF (there is no
     * envelope to download from). signed_pdf_document_id stays null.
     */
    @Transactional
    public Offer finalizeInHouseSigning(UUID offerId, String typedName, User actor) {
        Offer offer = offerRepository.findByIdWithGraph(offerId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Offer not found: " + offerId));
        if (offer.getStatus() == OfferStatus.SIGNED) {
            return offer;
        }
        if (offer.getStatus() != OfferStatus.SENT) {
            throw new ConflictException(
                    "Offer not in a signable state (status=" + offer.getStatus() + ")");
        }
        Instant now = Instant.now();
        if (offer.getExpiresAt() != null && now.isAfter(offer.getExpiresAt())) {
            // Auto-flip to EXPIRED so the queue reflects reality, then refuse.
            offer.setStatus(OfferStatus.EXPIRED);
            offerRepository.save(offer);
            throw new ConflictException("Offer expired on " + offer.getExpiresAt());
        }

        Map<String, Object> before = snapshot(offer);
        UUID actorId = actor != null ? actor.getId() : null;
        offer.setStatus(OfferStatus.SIGNED);
        offer.setSignedAt(now);
        offer.setRespondedAt(now);
        offer.setSignedByTypedName(typedName != null ? typedName.trim() : null);
        Offer saved = offerRepository.save(offer);

        // Mint Employee ID + advance applicant lifecycle.
        Application application = saved.getApplication();
        User applicant = application != null && application.getCandidate() != null
                ? application.getCandidate().getUser() : null;
        String employeeId = null;
        if (applicant != null) {
            employeeId = nextEmployeeId();
            applicant.setEmployeeId(employeeId);
            userRepository.save(applicant);

            internLifecycleService.advance(applicant,
                    InternLifecycleStatus.EMPLOYEE_ID_CREATED, actorId);

            if (!internLifecycleRepository.existsByUserId(applicant.getId())) {
                InternLifecycle lc = InternLifecycle.builder()
                        .userId(applicant.getId())
                        .employeeId(employeeId)
                        .ermId(saved.getCreatedBy())
                        .activeStatus("PROSPECTIVE")
                        .hiredAt(now)
                        .build();
                internLifecycleRepository.save(lc);
            }
        }

        if (application != null) {
            application.setStatus(ApplicationStatus.ACCEPTED);
            application.setStatusUpdatedAt(now);
            if (actorId != null) application.setStatusUpdatedBy(actorId);
            applicationRepository.save(application);
        }

        writeAudit("Offer", saved.getId(), "SIGNED_IN_HOUSE",
                actorId, before, snapshot(saved));

        final UUID offerIdF = saved.getId();
        final UUID appIdF = application != null ? application.getId() : null;
        final UUID applicantIdF = applicant != null ? applicant.getId() : null;
        final String employeeIdF = employeeId;
        try {
            eventPublisher.publishEvent(new OfferSignedEvent(
                    offerIdF, appIdF, applicantIdF, employeeIdF));
        } catch (Exception e) {
            log.warn("OfferSignedEvent publish failed (non-fatal): {}", e.getMessage());
        }
        log.info("[Offer] in-house signed offer={} employee_id={} applicant={}",
                saved.getId(), employeeId, applicantIdF);
        return saved;
    }

    // ── Internals ───────────────────────────────────────────────────────────

    private Offer applyDocusignStatus(Offer offer, String envelopeStatus,
                                      Instant statusChangedAt, UUID actorId) {
        String s = envelopeStatus.toLowerCase();
        Instant now = statusChangedAt != null ? statusChangedAt : Instant.now();
        Map<String, Object> before = snapshot(offer);

        switch (s) {
            case "completed", "signed" -> {
                if (offer.getStatus() == OfferStatus.SIGNED) return offer;
                offer.setStatus(OfferStatus.SIGNED);
                offer.setSignedAt(now);
                Offer saved = offerRepository.save(offer);

                // 1) Download + archive signed PDF.
                Document archived = archiveSignedPdf(saved);
                if (archived != null) {
                    saved.setSignedPdfDocumentId(archived.getId());
                    saved = offerRepository.save(saved);
                }

                // 2) Mint Employee ID + advance applicant.
                Application application = saved.getApplication();
                User applicant = application != null && application.getCandidate() != null
                        ? application.getCandidate().getUser() : null;
                String employeeId = null;
                if (applicant != null) {
                    employeeId = nextEmployeeId();
                    applicant.setEmployeeId(employeeId);
                    userRepository.save(applicant);

                    internLifecycleService.advance(applicant,
                            InternLifecycleStatus.EMPLOYEE_ID_CREATED, actorId);

                    // 3) Create InternLifecycle row (once per user).
                    if (!internLifecycleRepository.existsByUserId(applicant.getId())) {
                        InternLifecycle lc = InternLifecycle.builder()
                                .userId(applicant.getId())
                                .employeeId(employeeId)
                                .ermId(saved.getCreatedBy())
                                .activeStatus("PROSPECTIVE")
                                .hiredAt(now)
                                .build();
                        internLifecycleRepository.save(lc);
                    }
                }

                // 4) Application stage = HIRED.
                if (application != null) {
                    application.setStatus(ApplicationStatus.HIRED);
                    application.setStatusUpdatedAt(now);
                    if (actorId != null) application.setStatusUpdatedBy(actorId);
                    applicationRepository.save(application);
                }

                writeAudit("Offer", saved.getId(), "SIGNED", actorId, before, snapshot(saved));

                final UUID offerIdF = saved.getId();
                final UUID appIdF = application != null ? application.getId() : null;
                final UUID applicantIdF = applicant != null ? applicant.getId() : null;
                final String employeeIdF = employeeId;
                try {
                    eventPublisher.publishEvent(new OfferSignedEvent(
                            offerIdF, appIdF, applicantIdF, employeeIdF));
                } catch (Exception e) {
                    log.warn("OfferSignedEvent publish failed (non-fatal): {}", e.getMessage());
                }
                log.info("[DocuSign] webhook envelope={} processed — offer={} signed, "
                                + "employee_id={} applicant={}",
                        offer.getDocusignEnvelopeId(), saved.getId(),
                        employeeId, applicantIdF);
                return saved;
            }
            case "voided" -> {
                if (offer.getStatus() == OfferStatus.VOIDED) return offer;
                offer.setStatus(OfferStatus.VOIDED);
                offer.setVoidedAt(now);
                Offer saved = offerRepository.save(offer);
                writeAudit("Offer", saved.getId(), "VOIDED_FROM_DOCUSIGN", actorId, before, snapshot(saved));
                return saved;
            }
            case "declined" -> {
                if (offer.getStatus() == OfferStatus.DECLINED) return offer;
                offer.setStatus(OfferStatus.DECLINED);
                Offer saved = offerRepository.save(offer);
                writeAudit("Offer", saved.getId(), "DECLINED_FROM_DOCUSIGN", actorId, before, snapshot(saved));
                return saved;
            }
            case "expired" -> {
                if (offer.getStatus() == OfferStatus.EXPIRED) return offer;
                offer.setStatus(OfferStatus.EXPIRED);
                Offer saved = offerRepository.save(offer);
                writeAudit("Offer", saved.getId(), "EXPIRED_FROM_DOCUSIGN", actorId, before, snapshot(saved));
                return saved;
            }
            default -> {
                log.info("[DocuSign] webhook envelope={} status={} — no-op", offer.getDocusignEnvelopeId(), envelopeStatus);
                return offer;
            }
        }
    }

    private Document archiveSignedPdf(Offer offer) {
        try {
            byte[] pdf = docuSignService.downloadSignedPdf(offer.getDocusignEnvelopeId());
            Path dir = Paths.get(storageRoot, "offers");
            Files.createDirectories(dir);
            String fileName = "signed-offer-" + offer.getId() + ".pdf";
            Path target = dir.resolve(fileName);
            Files.write(target, pdf);

            Candidate cand = offer.getApplication() != null
                    ? offer.getApplication().getCandidate() : null;
            UUID ownerId = cand != null && cand.getUser() != null
                    ? cand.getUser().getId() : null;
            Document doc = Document.builder()
                    .ownerUserId(ownerId)
                    .fileName(fileName)
                    .fileSize(pdf.length)
                    .mimeType("application/pdf")
                    .storageKey(target.toString())
                    .category("SIGNED_OFFER")
                    .sensitivity("PII")
                    .uploadedById(null) // system-driven write
                    .build();
            return documentRepository.save(doc);
        } catch (Exception e) {
            log.warn("[DocuSign] failed to archive signed PDF for offer={}: {}",
                    offer.getId(), e.getMessage());
            return null;
        }
    }

    private String nextEmployeeId() {
        // Postgres sequence; CACHE 1 to avoid skipped numbers per Phase 0 pattern.
        Long n = jdbcTemplate.queryForObject(
                "SELECT nextval('skyzen_employee_seq')", Long.class);
        long val = n == null ? 1000 : n;
        int year = LocalDate.now(ZoneOffset.UTC).getYear();
        return String.format("SKZ-EMP-%d-%06d", year, val);
    }

    // ── DTO mappers & access checks live mostly on the controller; helpers here.

    private Offer mustOwnAsApplicant(UUID offerId, User caller) {
        Offer offer = offerRepository.findByIdWithGraph(offerId)
                .orElseThrow(() -> new ResourceNotFoundException("Offer not found: " + offerId));
        if (!isOwner(offer, caller)) {
            throw new ForbiddenException("Not allowed to view this offer");
        }
        return offer;
    }

    private boolean isOwner(Offer offer, User caller) {
        if (caller == null || offer.getApplication() == null) return false;
        Candidate cand = offer.getApplication().getCandidate();
        if (cand == null || cand.getUser() == null) return false;
        return caller.getId().equals(cand.getUser().getId());
    }

    private boolean isStaff(User caller) {
        if (caller == null) return false;
        return caller.getRoles().contains(UserRole.ERM)
                || caller.getRoles().contains(UserRole.MANAGER)
                || caller.getRoles().contains(UserRole.SUPER_ADMIN);
    }

    private void ensureCanReadFull(Offer offer, User caller) {
        if (caller == null) throw new ForbiddenException("Authentication required");
        if (isOwner(offer, caller) || isStaff(caller)) return;
        throw new ForbiddenException("Not allowed to view this offer");
    }

    private Map<String, String> buildMergeFields(Offer offer, User applicant,
                                                  JobPosting jp, User actor) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("applicantName", safe(applicant.getFullName()));
        m.put("applicantEmail", safe(applicant.getEmail()));
        m.put("roleTitle", safe(offer.getRoleTitle()));
        m.put("tentativeStartDate", offer.getStartDate() != null
                ? DateTimeFormatter.ISO_LOCAL_DATE.format(offer.getStartDate()) : "");
        m.put("compensationSummary", safe(offer.getCompensationSummary()));
        m.put("worksite", safe(offer.getWorksite()));
        m.put("expectedHoursPerWeek", offer.getExpectedHoursPerWeek() != null
                ? offer.getExpectedHoursPerWeek().toString() : "");
        m.put("companyName", jp != null && jp.getEntity() != null
                ? safe(jp.getEntity().getName()) : "Skyzen");
        m.put("ermName", actor != null ? safe(actor.getFullName()) : "");
        m.put("sentDate", DateTimeFormatter.ISO_LOCAL_DATE.format(LocalDate.now(ZoneOffset.UTC)));
        m.put("expiryDate", offer.getExpiresAt() != null
                ? DateTimeFormatter.ISO_LOCAL_DATE.format(
                        offer.getExpiresAt().atZone(ZoneOffset.UTC).toLocalDate())
                : "");
        return m;
    }

    private String buildPlainLetter(SendDocusignOfferRequest req, User applicant,
                                    JobPosting jp, User actor) {
        // Letter content is required NOT NULL on the legacy Offer entity.
        // We populate a short plaintext summary so any legacy reader still
        // works; the real letter the applicant signs lives in the DocuSign
        // template populated via merge fields.
        return "Dear " + safe(applicant.getFullName()) + ",\n\n"
                + "We are pleased to offer you the role of " + safe(req.getRoleTitle())
                + " starting on " + req.getTentativeStartDate()
                + ". " + (req.getCompensationSummary() != null ? req.getCompensationSummary() : "")
                + "\n\nThis offer letter is delivered via DocuSign.";
    }

    private com.skyzen.careers.enums.CompensationFrequency safeFrequency() {
        // Phase 3 doc-spec doesn't capture frequency on the request — the
        // letter uses free-text compensation_summary instead. Pick a valid
        // enum default so the legacy column NOT NULL constraint is satisfied.
        com.skyzen.careers.enums.CompensationFrequency[] vals =
                com.skyzen.careers.enums.CompensationFrequency.values();
        return vals.length > 0 ? vals[0] : null;
    }

    private void writeAudit(String entityType, UUID entityId, String action, UUID userId,
                            Map<String, Object> before, Map<String, Object> after) {
        try {
            AuditLog entry = AuditLog.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .action(action)
                    .userId(userId)
                    .beforeJson(before == null ? null : objectMapper.writeValueAsString(before))
                    .afterJson(after == null ? null : objectMapper.writeValueAsString(after))
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("[OfferDocuSign] audit write failed: {}", e.getMessage());
        }
    }

    private Map<String, Object> snapshot(Offer offer) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", offer.getId());
        m.put("status", offer.getStatus());
        m.put("docusignEnvelopeId", offer.getDocusignEnvelopeId());
        m.put("signedAt", offer.getSignedAt());
        m.put("voidedAt", offer.getVoidedAt());
        return m;
    }

    private static String safe(String s) { return s == null ? "" : s; }

    public record DownloadedPdf(String fileName, byte[] bytes) {}

    // Convenience for the webhook controller wrt visibility-by-id.
    public Optional<Offer> findByEnvelopeId(String envelopeId) {
        return offerRepository.findByDocusignEnvelopeId(envelopeId);
    }
}
