package com.skyzen.careers.service;

import com.skyzen.careers.dto.admin.AuditLogEntryResponse;
import com.skyzen.careers.dto.admin.PagedAuditLogResponse;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAuditLogService {

    private static final int DETAILS_MAX = 200;

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PagedAuditLogResponse search(int page, int size, String action,
                                        String actorSearch, Instant from, Instant to) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));
        Pageable pageable = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "timestamp"));

        String normalizedAction = (action != null && !action.isBlank()) ? action.trim() : null;

        // Actor filter: resolve to a set of userIds upstream of the query so the
        // repository doesn't need a join. Empty set when the search yields no
        // matches; we still pass it through so the caller sees an empty page
        // (not a query that ignores the filter).
        Collection<UUID> userIds = resolveActorIds(actorSearch);

        Page<AuditLog> resultPage = auditLogRepository.search(
                normalizedAction, userIds, from, to, pageable);

        // Batch-resolve actor names for the rows on this page only — keeps the
        // query count at O(1) regardless of page size.
        Set<UUID> actorIdsInPage = resultPage.getContent().stream()
                .map(AuditLog::getUserId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));
        Map<UUID, String> actorNameById = new HashMap<>();
        if (!actorIdsInPage.isEmpty()) {
            for (User u : userRepository.findAllById(actorIdsInPage)) {
                actorNameById.put(u.getId(), u.getFullName());
            }
        }

        List<AuditLogEntryResponse> content = resultPage.getContent().stream()
                .map(a -> toResponse(a, actorNameById.get(a.getUserId())))
                .toList();

        return PagedAuditLogResponse.builder()
                .content(content)
                .page(resultPage.getNumber())
                .size(resultPage.getSize())
                .totalElements(resultPage.getTotalElements())
                .totalPages(resultPage.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public List<String> distinctActions() {
        List<String> actions = auditLogRepository.findDistinctActions();
        return actions != null ? actions : Collections.emptyList();
    }

    /**
     * Translates an actor-search term (name OR email substring, case-insensitive)
     * into a userId filter set. Returns {@code null} to mean "no actor filter"
     * when the term is blank, OR an empty list when the term is non-blank but
     * matches no users — in the latter case the search legitimately returns
     * zero rows rather than ignoring the filter.
     */
    private Collection<UUID> resolveActorIds(String actorSearch) {
        if (actorSearch == null || actorSearch.isBlank()) return null;
        String q = actorSearch.trim().toLowerCase(Locale.ROOT);
        List<UUID> ids = userRepository.findAll().stream()
                .filter(u -> (u.getFullName() != null && u.getFullName().toLowerCase(Locale.ROOT).contains(q))
                        || (u.getEmail() != null && u.getEmail().toLowerCase(Locale.ROOT).contains(q)))
                .map(User::getId)
                .toList();
        // Empty set means "no matches"; the JPQL "userId IN :userIds" handles
        // the empty collection in Hibernate 6 by producing no rows. If a
        // dialect ever complains, return a sentinel set with a random UUID.
        return ids.isEmpty() ? List.of(new UUID(0L, 0L)) : ids;
    }

    private AuditLogEntryResponse toResponse(AuditLog a, String actorName) {
        return AuditLogEntryResponse.builder()
                .id(a.getId())
                .timestamp(a.getTimestamp())
                .actorId(a.getUserId())
                .actorName(actorName)
                .action(a.getAction())
                .entityType(a.getEntityType())
                .entityId(a.getEntityId())
                .details(truncate(a.getAfterJson()))
                .build();
    }

    private String truncate(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.length() <= DETAILS_MAX) return s;
        return s.substring(0, DETAILS_MAX) + "…";
    }
}
