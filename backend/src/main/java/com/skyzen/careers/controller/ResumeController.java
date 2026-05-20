package com.skyzen.careers.controller;

import com.skyzen.careers.dto.ResumeResponse;
import com.skyzen.careers.entity.Resume;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.repository.ApplicationRepository;
import com.skyzen.careers.service.ResumeService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/resumes")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;
    private final ApplicationRepository applicationRepository;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<ResumeResponse> upload(@RequestParam("file") MultipartFile file,
                                                 @AuthenticationPrincipal User user) {
        ResumeResponse created = resumeService.upload(user, file);
        return ResponseEntity.created(URI.create("/api/v1/resumes/" + created.getId()))
                .body(created);
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public List<ResumeResponse> listMine(@AuthenticationPrincipal User user) {
        return resumeService.listForUser(user.getId());
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<FileSystemResource> download(@PathVariable UUID id,
                                                       @AuthenticationPrincipal User user) {
        if (user == null) {
            throw new ForbiddenException("Authentication required");
        }
        Resume resume = resumeService.loadEntity(id);
        ensureCanDownload(resume, user);
        FileSystemResource resource = resumeService.loadFile(resume);

        String contentType = resume.getContentType() != null
                ? resume.getContentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE;
        String fileName = resume.getFileName() != null ? resume.getFileName() : "resume";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + sanitizeFileName(fileName) + "\"")
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .body(resource);
    }

    @PatchMapping("/{id}/default")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResumeResponse setDefault(@PathVariable UUID id,
                                     @AuthenticationPrincipal User user) {
        return resumeService.setDefault(user.getId(), id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       @AuthenticationPrincipal User user) {
        resumeService.delete(user.getId(), id, true);
        return ResponseEntity.noContent().build();
    }

    private void ensureCanDownload(Resume resume, User caller) {
        boolean privileged = caller.getRoles().contains(UserRole.ADMIN)
                || caller.getRoles().contains(UserRole.RECRUITER)
                || caller.getRoles().contains(UserRole.ERM);

        boolean isOwner = resume.getCandidate() != null
                && resume.getCandidate().getUser() != null
                && resume.getCandidate().getUser().getId().equals(caller.getId());

        if (isOwner) return;

        if (privileged) {
            if (applicationRepository.existsByResumeId(resume.getId())) return;
            throw new ForbiddenException("Resume not linked to any application visible to you");
        }
        throw new ForbiddenException("Not allowed to download this resume");
    }

    private String sanitizeFileName(String name) {
        return name.replaceAll("[\\r\\n\"]", "_");
    }
}
