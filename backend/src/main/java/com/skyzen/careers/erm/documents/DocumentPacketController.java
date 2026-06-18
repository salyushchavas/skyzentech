package com.skyzen.careers.erm.documents;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.intern.DocumentVaultService;
import com.skyzen.careers.repository.DocumentTaskRepository;
import com.skyzen.careers.repository.DocumentRepository;
import com.skyzen.careers.entity.DocumentTask;
import com.skyzen.careers.entity.Document;
import com.skyzen.careers.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** ERM Phase 8 — document packets + review queue HTTP surface. */
@RestController
@RequestMapping("/api/v1/erm")
@RequiredArgsConstructor
public class DocumentPacketController {

    private final DocumentPacketService service;
    private final DocumentTaskRepository taskRepository;
    private final DocumentRepository documentRepository;
    private final DocumentVaultService documentVault;

    // ── Packet list + detail + assign + admin actions ────────────────────

    @GetMapping("/document-packets")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentPacketListPage listPackets(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return service.listPackets(status, search, page, pageSize);
    }

    @GetMapping("/document-packets/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentPacketDetail get(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.getPacket(id, caller);
    }

    @GetMapping("/document-packets/by-lifecycle/{lifecycleId}")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ResponseEntity<DocumentDtos.DocumentPacketDetail> findActiveByLifecycle(
            @PathVariable UUID lifecycleId, @AuthenticationPrincipal User caller) {
        return service.findActiveForLifecycle(lifecycleId, caller)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/document-packets/assign")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentPacketDetail assign(
            @RequestBody DocumentDtos.AssignPacketRequest req,
            @AuthenticationPrincipal User caller) {
        return service.assignPacket(req, caller);
    }

    @PostMapping("/document-packets/{id}/cancel")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public DocumentDtos.DocumentPacketDetail cancel(
            @PathVariable UUID id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal User caller) {
        return service.cancelPacket(id, body == null ? null : body.get("reason"), caller);
    }

    @PostMapping("/document-packets/{id}/waive-pending")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public DocumentDtos.DocumentPacketDetail waivePending(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User caller) {
        return service.waivePendingTasks(id, body == null ? null : body.get("reason"), caller);
    }

    // ── Review queue + task detail + decision + bulk ─────────────────────

    @GetMapping("/document-review/queue")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTaskListPage queue(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID internLifecycleId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return service.listReviewQueue(
                category, search, internLifecycleId, page, pageSize);
    }

    /**
     * Person-first queue — one row per intern with documents awaiting
     * review. The per-document detail lives at
     * {@code /document-review/queue?internLifecycleId=…}.
     */
    @GetMapping("/document-review/queue/by-intern")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.InternReviewQueuePage queueByIntern(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int pageSize) {
        return service.listReviewQueueByIntern(search, page, pageSize);
    }

    @GetMapping("/document-review/tasks/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTaskDetail getTask(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        return service.getTaskDetail(id, caller);
    }

    @GetMapping("/document-review/tasks/{id}/file")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ResponseEntity<byte[]> downloadUpload(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        DocumentTask t = taskRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found: " + id));
        if (t.getUploadedFileId() == null) {
            throw new ResourceNotFoundException("No upload for task " + id);
        }
        byte[] bytes = documentVault.readDocument(t.getUploadedFileId(), caller);
        Document meta = documentRepository.findById(t.getUploadedFileId()).orElse(null);
        String name = meta != null && meta.getFileName() != null
                ? meta.getFileName() : "upload";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }

    @PostMapping("/document-review/tasks/{id}/review")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTaskDetail review(
            @PathVariable UUID id,
            @RequestBody DocumentDtos.ReviewTaskRequest req,
            @AuthenticationPrincipal User caller) {
        return service.reviewTask(id, req, caller);
    }

    @PostMapping("/document-review/tasks/bulk-review")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.BulkReviewResult bulkReview(
            @RequestBody DocumentDtos.BulkReviewRequest req,
            @AuthenticationPrincipal User caller) {
        return service.bulkReview(req, caller);
    }

    @GetMapping("/document-review/reason-codes")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public List<DocumentDtos.ReasonCodeGroup> reasonCodes() {
        return service.listReasonCodes();
    }
}
