package com.skyzen.careers.workspace.api;

import com.skyzen.careers.entity.User;
import com.skyzen.careers.workspace.api.dto.RenameFileRequest;
import com.skyzen.careers.workspace.api.dto.WorkspaceFileRequest;
import com.skyzen.careers.workspace.api.dto.WorkspaceFileResponse;
import com.skyzen.careers.workspace.application.WorkspaceFileService;
import com.skyzen.careers.workspace.domain.ProjectWorkspaceFile;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

/**
 * Workspace CRUD for one project.
 *
 * <p>File-content endpoints use a {@code **} wildcard so the path can contain
 * slashes (e.g. {@code src/main.py}). The path is recovered from the request
 * URI and URL-decoded; the service layer applies the canonical path
 * validation.</p>
 */
@RestController
@RequestMapping("/api/v1/projects/{projectId}/workspace")
@RequiredArgsConstructor
public class WorkspaceFileController {

    private final WorkspaceFileService fileService;

    @GetMapping("/files")
    @PreAuthorize("isAuthenticated()")
    public List<WorkspaceFileResponse> listFiles(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal User caller) {
        return fileService.listFiles(projectId, caller).stream()
                .map(WorkspaceFileController::toListItem)
                .toList();
    }

    @GetMapping("/files/**")
    @PreAuthorize("isAuthenticated()")
    public WorkspaceFileResponse getFile(
            @PathVariable UUID projectId,
            HttpServletRequest request,
            @AuthenticationPrincipal User caller) {
        String path = extractPath(request, projectId);
        ProjectWorkspaceFile file = fileService.getFile(projectId, path, caller);
        return toResponseWithContent(file);
    }

    @PutMapping("/files/**")
    @PreAuthorize("isAuthenticated()")
    public WorkspaceFileResponse upsertFile(
            @PathVariable UUID projectId,
            @RequestBody WorkspaceFileRequest body,
            HttpServletRequest request,
            @AuthenticationPrincipal User caller) {
        String path = extractPath(request, projectId);
        String content = body != null ? body.content() : "";
        ProjectWorkspaceFile saved = fileService.upsertFile(projectId, path, content, caller);
        return toListItem(saved);
    }

    @DeleteMapping("/files/**")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteFile(
            @PathVariable UUID projectId,
            HttpServletRequest request,
            @AuthenticationPrincipal User caller) {
        String path = extractPath(request, projectId);
        fileService.deleteFile(projectId, path, caller);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/files/rename")
    @PreAuthorize("isAuthenticated()")
    public WorkspaceFileResponse renameFile(
            @PathVariable UUID projectId,
            @Valid @RequestBody RenameFileRequest body,
            @AuthenticationPrincipal User caller) {
        ProjectWorkspaceFile saved = fileService.renameFile(
                projectId, body.fromPath(), body.toPath(), caller);
        return toListItem(saved);
    }

    // ── Mapping ─────────────────────────────────────────────────────────────

    private static WorkspaceFileResponse toListItem(ProjectWorkspaceFile f) {
        return new WorkspaceFileResponse(
                f.getId(), f.getProjectId(), f.getPath(),
                f.getSizeBytes(), f.getLastModifiedAt(), f.getLastModifiedBy(),
                null /* content omitted on list */);
    }

    private static WorkspaceFileResponse toResponseWithContent(ProjectWorkspaceFile f) {
        return new WorkspaceFileResponse(
                f.getId(), f.getProjectId(), f.getPath(),
                f.getSizeBytes(), f.getLastModifiedAt(), f.getLastModifiedBy(),
                f.getContent());
    }

    /**
     * Recover the path from the request URI. The {@code @RequestMapping} on
     * this controller pinned the prefix at
     * {@code /api/v1/projects/{projectId}/workspace/files/}; everything after
     * that slash is the file path. URL-decoded as UTF-8 so paths with
     * Unicode (unlikely for code, but cheap to support correctly).
     */
    private static String extractPath(HttpServletRequest request, UUID projectId) {
        String uri = request.getRequestURI();
        String prefix = "/api/v1/projects/" + projectId + "/workspace/files/";
        int idx = uri.indexOf(prefix);
        if (idx < 0) return "";
        String raw = uri.substring(idx + prefix.length());
        return UriUtils.decode(raw, StandardCharsets.UTF_8);
    }
}
