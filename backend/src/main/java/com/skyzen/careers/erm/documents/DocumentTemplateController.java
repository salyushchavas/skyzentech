package com.skyzen.careers.erm.documents;

import com.skyzen.careers.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/** ERM Phase 8 — document template library HTTP surface. */
@RestController
@RequestMapping("/api/v1/erm/document-templates")
@RequiredArgsConstructor
public class DocumentTemplateController {

    private final DocumentTemplateService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTemplatePage list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean activeOnly,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int pageSize) {
        return service.list(category, activeOnly, search, page, pageSize);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTemplateDto get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTemplateDto create(
            @RequestBody DocumentDtos.CreateTemplateRequest req,
            @AuthenticationPrincipal User caller) {
        return service.create(req, caller);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTemplateDto update(
            @PathVariable UUID id,
            @RequestBody DocumentDtos.UpdateTemplateRequest req,
            @AuthenticationPrincipal User caller) {
        return service.update(id, req, caller);
    }

    @PostMapping(value = "/{id}/file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTemplateDto uploadFile(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User caller) {
        return service.uploadFile(id, file, caller);
    }

    @GetMapping("/{id}/file")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public ResponseEntity<byte[]> downloadFile(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        byte[] bytes = service.downloadAsErm(id, caller);
        DocumentDtos.DocumentTemplateDto meta = service.get(id);
        String fileName = meta.templateFileName() != null ? meta.templateFileName()
                : (meta.title() + "." + meta.fileKind().toLowerCase());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }

    @PostMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTemplateDto deactivate(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        return service.deactivate(id, caller);
    }

    @PostMapping("/{id}/reactivate")
    @PreAuthorize("hasAnyRole('ERM', 'SUPER_ADMIN')")
    public DocumentDtos.DocumentTemplateDto reactivate(
            @PathVariable UUID id,
            @AuthenticationPrincipal User caller) {
        return service.reactivate(id, caller);
    }
}
