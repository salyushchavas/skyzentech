package com.skyzen.careers.repository;

import com.skyzen.careers.entity.AuditLog;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * JPA Specifications for the admin audit log viewer. Same motivation as
 * {@link InterviewSpecifications}: nullable {@code Instant} bounds in the
 * previous {@code (:param IS NULL OR ...)} pattern surfaced Postgres
 * {@code SQLSTATE 42P18} ("could not determine data type of parameter $N")
 * because Hibernate bound the null without an explicit type Postgres could
 * infer. Building predicates only when the value is present keeps null
 * filters out of the SQL bind entirely.
 *
 * No fetch joins are needed — {@code AuditLog} has no relationships that
 * the DTO mapper reads through.
 */
public final class AuditLogSpecifications {

    private AuditLogSpecifications() {}

    public static Specification<AuditLog> withFilters(
            String action,
            Collection<UUID> userIds,
            String entityType,
            Instant from,
            Instant to) {
        return (root, query, cb) -> {
            List<Predicate> preds = new ArrayList<>();
            if (action != null && !action.isBlank()) {
                preds.add(cb.equal(root.get("action"), action));
            }
            if (userIds != null && !userIds.isEmpty()) {
                preds.add(root.get("userId").in(userIds));
            }
            if (entityType != null && !entityType.isBlank()) {
                preds.add(cb.equal(root.get("entityType"), entityType));
            }
            if (from != null) {
                preds.add(cb.greaterThanOrEqualTo(root.get("timestamp"), from));
            }
            if (to != null) {
                preds.add(cb.lessThanOrEqualTo(root.get("timestamp"), to));
            }
            return preds.isEmpty() ? cb.conjunction() : cb.and(preds.toArray(new Predicate[0]));
        };
    }
}
