package com.skyzen.careers.erm.documents;

import com.skyzen.careers.entity.Document;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.erm.documents.DocumentDtos.InternPacketView;
import com.skyzen.careers.erm.documents.DocumentDtos.InternTaskView;
import com.skyzen.careers.repository.DocumentRepository;
import com.skyzen.careers.repository.DocumentTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/** ERM Phase 8 — intern-facing document packet HTTP surface. */
@RestController
@RequestMapping("/api/v1/intern/documents")
@RequiredArgsConstructor
public class InternDocumentController {

    private final InternDocumentService service;
    private final DocumentTaskRepository taskRepository;
    private final DocumentRepository documentRepository;

    @GetMapping("/packet")
    @PreAuthorize("hasAnyRole('INTERN', 'SUPER_ADMIN')")
    public ResponseEntity<InternPacketView> getMyPacket(
            @AuthenticationPrincipal User caller) {
        return service.getMyPacket(caller)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/tasks/{id}/download")
    @PreAuthorize("hasAnyRole('INTERN', 'SUPER_ADMIN')")
    public ResponseEntity<byte[]> downloadTemplate(
            @PathVariable UUID id, @AuthenticationPrincipal User caller) {
        byte[] bytes = service.downloadTemplate(id, caller);
        Document meta = taskRepository.findById(id)
                .flatMap(t -> t.getTemplateSnapshotFileId() != null
                        ? documentRepository.findById(t.getTemplateSnapshotFileId())
                        : java.util.Optional.empty())
                .orElse(null);
        String fileName = meta != null && meta.getFileName() != null
                ? meta.getFileName() : "template.pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }

    @PostMapping(value = "/tasks/{id}/upload",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('INTERN', 'SUPER_ADMIN')")
    public InternTaskView upload(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User caller) {
        return service.uploadFilled(id, file, caller);
    }
}
