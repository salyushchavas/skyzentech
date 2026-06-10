package com.skyzen.careers.erm.documents;

import com.skyzen.careers.entity.*;
import com.skyzen.careers.erm.documents.DocumentDtos.*;
import com.skyzen.careers.event.DocumentTaskSubmittedEvent;
import com.skyzen.careers.exception.BadRequestException;
import com.skyzen.careers.exception.ConflictException;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.intern.DocumentVaultService;
import com.skyzen.careers.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * ERM Phase 8.2 — intern-facing surface for the document packet
 * workflow. View the assigned packet + upload the filled, scanned-as-PDF
 * version. The blank template is served as a static Next.js asset at
 * {@code /document-templates/{filename}.pdf} — no backend download
 * endpoint exists for templates; the frontend builds the link from the
 * task's {@code documentKey}. All endpoints are scoped to the caller's
 * own lifecycle.
 *
 * <p>Upload is restricted to PDF only ({@code application/pdf}); the
 * intern is expected to print, fill by hand, and re-scan all pages into
 * a single PDF with their phone scanner app.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InternDocumentService {

    private static final long MAX_UPLOAD_BYTES = 10L * 1024 * 1024;
    private static final String PDF_MIME = "application/pdf";
    private static final String PDF_REJECT_MSG =
            "Only PDF files are accepted. Please scan all filled pages into a single PDF "
            + "using your phone's scanner app (Adobe Scan, Microsoft Lens, Apple Notes, etc.).";

    private final DocumentPacketRepository packetRepository;
    private final DocumentTaskRepository taskRepository;
    private final DocumentTaskReviewLogRepository reviewLogRepository;
    private final InternLifecycleRepository lifecycleRepository;
    private final DocumentVaultService documentVault;
    private final ApplicationEventPublisher eventPublisher;
    private final DocumentPacketService packetService;

    // ── Read ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Optional<InternPacketView> getMyPacket(User caller) {
        if (caller == null) throw new ForbiddenException("Caller required");
        InternLifecycle lc = lifecycleRepository.findByUserId(caller.getId()).orElse(null);
        if (lc == null) return Optional.empty();
        Optional<DocumentPacket> active = packetRepository.findActiveByLifecycle(lc.getId());
        if (active.isEmpty()) return Optional.empty();
        return Optional.of(toInternPacketView(active.get()));
    }

    // ── Upload filled file ───────────────────────────────────────────────

    @Transactional
    public InternTaskView uploadFilled(UUID taskId, MultipartFile file, User caller) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("file is required");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new BadRequestException("Upload exceeds 10 MB limit");
        }
        // ERM Phase 8.2 — strict PDF gate. Some browsers leave the MIME
        // null/empty on slow uploads; we still require the filename to
        // end in .pdf when no MIME is supplied.
        String mime = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean mimeOk = PDF_MIME.equalsIgnoreCase(mime);
        boolean filenameOk = filename != null
                && filename.toLowerCase().endsWith(".pdf");
        if (!mimeOk && !(mime == null && filenameOk)) {
            throw new BadRequestException(PDF_REJECT_MSG);
        }

        DocumentTask t = mustLoadOwnTask(taskId, caller);
        if (Set.of("ACCEPTED", "WAIVED").contains(t.getStatus())) {
            throw new ConflictException(
                    "Task is " + t.getStatus() + "; cannot upload");
        }

        SkyzenDocument doc = t.getDocumentKey();
        String sensitivity = doc != null ? doc.getSensitivity() : "GENERAL";
        String category = doc != null ? doc.getCategory() : "OTHER";

        try {
            byte[] bytes = file.getBytes();
            Document saved = documentVault.saveDocument(
                    caller.getId(),
                    filename != null ? filename : "filled.pdf",
                    PDF_MIME,
                    bytes,
                    category,
                    sensitivity,
                    caller.getId());
            String previous = t.getStatus();
            t.setUploadedFileId(saved.getId());
            t.setStatus("SUBMITTED");
            t.setSubmittedAt(Instant.now());
            // Clear any prior reviewer comments so the new round starts clean.
            // (Comments stay in audit log via review log entries.)
            t.setReviewedAt(null);
            t.setReviewedById(null);
            t.setReviewReasonCode(null);
            t.setReviewComments(null);
            DocumentTask savedTask = taskRepository.save(t);

            try {
                reviewLogRepository.save(DocumentTaskReviewLog.builder()
                        .taskId(savedTask.getId())
                        .actorUserId(caller.getId())
                        .eventType("INTERN_UPLOADED")
                        .previousStatus(previous)
                        .newStatus("SUBMITTED")
                        .build());
            } catch (Exception ignored) {}

            // Trigger packet-status side-effects (ASSIGNED → IN_PROGRESS,
            // pending → ALL_SUBMITTED when last one comes in, etc.).
            packetService.checkPacketCompletion(savedTask.getPacketId(), caller);

            // Notify ERM.
            UUID lifecycleId = packetRepository.findById(savedTask.getPacketId())
                    .map(DocumentPacket::getInternLifecycleId).orElse(null);
            String templateTitle = doc != null ? doc.getTitle() : "(unknown)";
            try {
                eventPublisher.publishEvent(new DocumentTaskSubmittedEvent(
                        savedTask.getId(), savedTask.getPacketId(),
                        lifecycleId, caller.getId(), templateTitle));
            } catch (Exception e) {
                log.warn("[InternDocument] submitted event publish failed: {}",
                        e.getMessage());
            }
            return toInternTaskView(savedTask);
        } catch (BadRequestException | ConflictException | ForbiddenException re) {
            throw re;
        } catch (Exception e) {
            log.warn("[InternDocument] upload failed: {}", e.getMessage());
            throw new RuntimeException("Upload failed: " + e.getMessage(), e);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private DocumentTask mustLoadOwnTask(UUID taskId, User caller) {
        if (caller == null) throw new ForbiddenException("Caller required");
        DocumentTask t = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Task not found: " + taskId));
        DocumentPacket pk = packetRepository.findById(t.getPacketId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Packet missing for task " + taskId));
        InternLifecycle lc = lifecycleRepository.findById(pk.getInternLifecycleId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "InternLifecycle missing"));
        if (!caller.getId().equals(lc.getUserId())) {
            throw new ForbiddenException(
                    "Task does not belong to caller");
        }
        return t;
    }

    private InternPacketView toInternPacketView(DocumentPacket pk) {
        List<InternTaskView> tasks = new ArrayList<>();
        int accepted = 0;
        for (DocumentTask t : taskRepository.findByPacketIdOrderByCreatedAtAsc(pk.getId())) {
            tasks.add(toInternTaskView(t));
            if ("ACCEPTED".equals(t.getStatus()) || "WAIVED".equals(t.getStatus())) {
                accepted++;
            }
        }
        return new InternPacketView(
                pk.getId(), pk.getStatus(), pk.getCustomInstructions(),
                pk.getAssignedAt(), pk.getCompletedAt(),
                tasks, tasks.size(), accepted);
    }

    private InternTaskView toInternTaskView(DocumentTask t) {
        SkyzenDocument d = t.getDocumentKey();
        return new InternTaskView(
                t.getId(),
                d,
                d != null ? d.getTitle() : "(unknown)",
                d != null ? d.getDescription() : null,
                d != null ? d.getCategory() : null,
                d != null ? d.getSensitivity() : null,
                d != null ? d.publicUrl() : null,
                t.getStatus(), t.getVersion(),
                t.getTaskInstructions(),
                t.getSubmittedAt(), t.getReviewedAt(),
                t.getReviewReasonCode(),
                t.getReviewComments(),
                null);
    }
}
