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
 * ERM Phase 8 — intern-facing surface for the document packet
 * workflow. View the assigned packet, download each template,
 * upload the filled version. All endpoints are scoped to the
 * caller's own lifecycle — no cross-intern access.
 *
 * <p>The intern DTO ({@link InternTaskView}) intentionally omits
 * {@code internalNote} and never exposes ERM-only fields.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InternDocumentService {

    private static final long MAX_UPLOAD_BYTES = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_MIME = Set.of(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "image/jpeg",
            "image/png");

    private final DocumentPacketRepository packetRepository;
    private final DocumentTaskRepository taskRepository;
    private final DocumentTaskReviewLogRepository reviewLogRepository;
    private final DocumentTemplateRepository templateRepository;
    private final DocumentRepository documentRepository;
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

    // ── Download template (audit + count) ────────────────────────────────

    @Transactional
    public byte[] downloadTemplate(UUID taskId, User caller) {
        DocumentTask t = mustLoadOwnTask(taskId, caller);
        if (t.getTemplateSnapshotFileId() == null) {
            throw new ResourceNotFoundException(
                    "Template file not available for this task");
        }
        byte[] bytes = documentVault.readDocument(t.getTemplateSnapshotFileId(), caller);
        t.setDownloadCount(t.getDownloadCount() == null ? 1 : t.getDownloadCount() + 1);
        t.setLastDownloadedAt(Instant.now());
        taskRepository.save(t);
        try {
            reviewLogRepository.save(DocumentTaskReviewLog.builder()
                    .taskId(t.getId())
                    .actorUserId(caller.getId())
                    .eventType("INTERN_DOWNLOADED")
                    .previousStatus(t.getStatus())
                    .newStatus(t.getStatus())
                    .build());
        } catch (Exception ignored) {}
        return bytes;
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
        String mime = file.getContentType();
        if (mime != null && !ALLOWED_MIME.contains(mime)) {
            throw new BadRequestException(
                    "Unsupported MIME (allowed: PDF, DOCX, JPG, PNG). Got: " + mime);
        }

        DocumentTask t = mustLoadOwnTask(taskId, caller);
        if (Set.of("ACCEPTED", "WAIVED").contains(t.getStatus())) {
            throw new ConflictException(
                    "Task is " + t.getStatus() + "; cannot upload");
        }

        // Sensitivity inherits from the template.
        DocumentTemplate template = t.getTemplateId() != null
                ? templateRepository.findById(t.getTemplateId()).orElse(null) : null;
        String sensitivity = template != null ? template.getSensitivity() : "NORMAL";
        String category = template != null ? template.getCategory() : "OTHER";

        try {
            byte[] bytes = file.getBytes();
            Document doc = documentVault.saveDocument(
                    caller.getId(),
                    file.getOriginalFilename(),
                    mime,
                    bytes,
                    category,
                    sensitivity,
                    caller.getId());
            String previous = t.getStatus();
            t.setUploadedFileId(doc.getId());
            t.setStatus("SUBMITTED");
            t.setSubmittedAt(Instant.now());
            // Clear any prior reviewer comments so the new round starts clean.
            // (Comments stay in audit log via review log entries.)
            t.setReviewedAt(null);
            t.setReviewedById(null);
            t.setReviewReasonCode(null);
            t.setReviewComments(null);
            DocumentTask saved = taskRepository.save(t);

            try {
                reviewLogRepository.save(DocumentTaskReviewLog.builder()
                        .taskId(saved.getId())
                        .actorUserId(caller.getId())
                        .eventType("INTERN_UPLOADED")
                        .previousStatus(previous)
                        .newStatus("SUBMITTED")
                        .build());
            } catch (Exception ignored) {}

            // Trigger packet-status side-effects (ASSIGNED → IN_PROGRESS,
            // pending → ALL_SUBMITTED when last one comes in, etc.).
            packetService.checkPacketCompletion(saved.getPacketId(), caller);

            // Notify ERM.
            UUID lifecycleId = packetRepository.findById(saved.getPacketId())
                    .map(DocumentPacket::getInternLifecycleId).orElse(null);
            String templateTitle = template != null ? template.getTitle() : "(unknown)";
            try {
                eventPublisher.publishEvent(new DocumentTaskSubmittedEvent(
                        saved.getId(), saved.getPacketId(),
                        lifecycleId, caller.getId(), templateTitle));
            } catch (Exception e) {
                log.warn("[InternDocument] submitted event publish failed: {}",
                        e.getMessage());
            }
            return toInternTaskView(saved);
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
        DocumentTemplate tpl = t.getTemplateId() != null
                ? templateRepository.findById(t.getTemplateId()).orElse(null) : null;
        return new InternTaskView(
                t.getId(), t.getTemplateId(),
                tpl != null ? tpl.getTitle() : "(unknown)",
                tpl != null ? tpl.getDescription() : null,
                tpl != null ? tpl.getCategory() : null,
                tpl != null ? tpl.getFileKind() : null,
                t.getStatus(), t.getVersion(),
                t.getTaskInstructions(),
                t.getTemplateSnapshotFileId(),
                t.getSubmittedAt(), t.getReviewedAt(),
                t.getReviewReasonCode(),
                t.getReviewComments());
    }
}
