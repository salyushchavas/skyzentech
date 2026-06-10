package com.skyzen.careers.erm.documents;

import com.skyzen.careers.entity.DocumentPacket;
import com.skyzen.careers.entity.DocumentTask;
import com.skyzen.careers.entity.DocumentTaskReviewLog;
import com.skyzen.careers.entity.DocumentTemplate;
import com.skyzen.careers.repository.DocumentPacketRepository;
import com.skyzen.careers.repository.DocumentTaskRepository;
import com.skyzen.careers.repository.DocumentTaskReviewLogRepository;
import com.skyzen.careers.repository.DocumentTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ERM Phase 8 — one-shot migration that converts the legacy
 * {@code OnboardingPacket} / {@code OnboardingItem} pair into the new
 * {@code DocumentPacket} / {@code DocumentTask} pair.
 *
 * <p>Idempotent: gated by a row in {@code migration_log} with
 * {@code migration_key = ONBOARDING_TO_DOCUMENT_PACKETS_V1}. Runs at
 * boot AFTER {@code DocumentTemplateSeeder} (which it depends on for
 * template lookups by title). Reads via raw JDBC so it stays
 * independent of the soon-to-be-deleted OnboardingItem / OnboardingPacket
 * JPA entities + repos.</p>
 *
 * <p>Category mapping (legacy item category → new template title):</p>
 * <ul>
 *   <li>{@code W4} → "W-4 2026"</li>
 *   <li>{@code I9} → "I-9 Form 2026"</li>
 *   <li>{@code ACH} → "Employee Data Sheet"</li>
 *   <li>{@code EMERGENCY_CONTACT} → "Employee Data Sheet"</li>
 *   <li>{@code HANDBOOK_ACK} → "Employee Handbook"</li>
 *   <li>{@code I983} → "I-983 (2029)"</li>
 * </ul>
 *
 * <p>Legacy status maps 1:1 (PENDING → PENDING, SUBMITTED → SUBMITTED,
 * ACCEPTED → ACCEPTED, REJECTED → REJECTED, RESEND_REQUESTED →
 * RESEND_REQUESTED). Packet status: ACCEPTED → COMPLETED, others
 * (ASSIGNED, IN_PROGRESS, IN_REVIEW) → IN_PROGRESS.</p>
 */
@Component
@Order(25)   // After DocumentTemplateSeeder (Order 20).
@RequiredArgsConstructor
@Slf4j
public class OnboardingMigrationRunner implements CommandLineRunner {

    private static final String MIGRATION_KEY = "ONBOARDING_TO_DOCUMENT_PACKETS_V1";

    private static final Map<String, String> CATEGORY_TO_TITLE = Map.of(
            "W4", "W-4 2026",
            "I9", "I-9 Form 2026",
            "ACH", "Employee Data Sheet",
            "EMERGENCY_CONTACT", "Employee Data Sheet",
            "HANDBOOK_ACK", "Employee Handbook",
            "I983", "I-983 (2029)");

    private final JdbcTemplate jdbc;
    private final DocumentTemplateRepository templateRepository;
    private final DocumentPacketRepository packetRepository;
    private final DocumentTaskRepository taskRepository;
    private final DocumentTaskReviewLogRepository reviewLogRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (alreadyMigrated()) {
            log.info("[OnboardingMigration] {} already executed; skipping",
                    MIGRATION_KEY);
            return;
        }
        if (!legacyTablesExist()) {
            // Fresh deploy — no legacy data. Mark migration done so the
            // SchemaFixupRunner's conditional DROP can proceed next boot
            // (idempotent — DROPs are no-ops on non-existent tables).
            postSuccess(0, "Fresh deploy — no legacy tables to migrate");
            log.info("[OnboardingMigration] Fresh deploy — no legacy onboarding tables; "
                    + "marked {} complete", MIGRATION_KEY);
            return;
        }

        Map<String, UUID> titleToId = loadTemplateIdsByTitle();
        if (titleToId.isEmpty()) {
            log.warn("[OnboardingMigration] No DocumentTemplates seeded yet; "
                    + "deferring migration to next boot");
            return;
        }

        List<Map<String, Object>> packets;
        try {
            packets = jdbc.queryForList(
                    "SELECT id, user_id, intern_lifecycle_id, status, "
                            + "       assigned_by_id, assigned_at, accepted_at "
                            + "  FROM onboarding_packets");
        } catch (DataAccessException e) {
            log.warn("[OnboardingMigration] legacy packet query failed; "
                    + "assuming no rows: {}", e.getMessage());
            postSuccess(0, "No legacy rows readable; treated as fresh deploy");
            return;
        }
        if (packets.isEmpty()) {
            postSuccess(0, "No legacy packets to migrate");
            return;
        }

        int packetsMigrated = 0;
        int tasksMigrated = 0;
        int tasksWithMissingTemplate = 0;

        for (Map<String, Object> p : packets) {
            UUID legacyPacketId = uuid(p.get("id"));
            UUID lifecycleId = uuid(p.get("intern_lifecycle_id"));
            String legacyStatus = (String) p.get("status");
            UUID assignedById = uuid(p.get("assigned_by_id"));
            Instant assignedAt = instantOf((java.sql.Timestamp) p.get("assigned_at"));
            Instant acceptedAt = instantOf((java.sql.Timestamp) p.get("accepted_at"));
            if (lifecycleId == null) continue;
            // Skip if a new-model packet already exists for this lifecycle.
            try {
                Integer existing = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM document_packets "
                                + " WHERE intern_lifecycle_id = ?",
                        Integer.class, lifecycleId);
                if (existing != null && existing > 0) {
                    log.debug("[OnboardingMigration] DocumentPacket already exists "
                            + "for lifecycle {} — skipping legacy {}", lifecycleId, legacyPacketId);
                    continue;
                }
            } catch (Exception e) {
                // continue with creation; UNIQUE partial index will catch dupes
            }

            String newStatus = mapPacketStatus(legacyStatus);
            DocumentPacket newPacket = DocumentPacket.builder()
                    .internLifecycleId(lifecycleId)
                    .assignedById(assignedById != null
                            ? assignedById
                            : UUID.fromString("00000000-0000-0000-0000-000000000001"))
                    .status(newStatus)
                    .assignedAt(assignedAt != null ? assignedAt : Instant.now())
                    .completedAt("COMPLETED".equals(newStatus) ? acceptedAt : null)
                    .customInstructions("[Migrated from legacy onboarding_packets row "
                            + legacyPacketId + "]")
                    .build();
            try {
                newPacket = packetRepository.save(newPacket);
                packetsMigrated++;
            } catch (Exception e) {
                log.warn("[OnboardingMigration] failed to save DocumentPacket "
                        + "for legacy {} (non-fatal): {}", legacyPacketId, e.getMessage());
                continue;
            }

            // Migrate child items.
            List<Map<String, Object>> items;
            try {
                items = jdbc.queryForList(
                        "SELECT id, category, status, form_data_json, document_id, "
                                + "       submitted_at, reviewed_at, reviewed_by_id, "
                                + "       erm_comments, internal_notes, last_review_reason_code "
                                + "  FROM onboarding_items WHERE packet_id = ?",
                        legacyPacketId);
            } catch (Exception e) {
                log.warn("[OnboardingMigration] item query failed for packet {}: {}",
                        legacyPacketId, e.getMessage());
                continue;
            }
            for (Map<String, Object> it : items) {
                String category = (String) it.get("category");
                String legacyTitle = CATEGORY_TO_TITLE.get(category);
                UUID templateId = legacyTitle != null ? titleToId.get(legacyTitle) : null;
                if (templateId == null) {
                    tasksWithMissingTemplate++;
                    log.warn("[OnboardingMigration] no template match for category {} "
                            + "(legacy item {}); creating task with template_id NULL",
                            category, it.get("id"));
                }
                DocumentTask t = DocumentTask.builder()
                        .packetId(newPacket.getId())
                        .templateId(templateId)
                        .status(mapTaskStatus((String) it.get("status")))
                        .uploadedFileId(uuid(it.get("document_id")))
                        .submittedAt(instantOf((java.sql.Timestamp) it.get("submitted_at")))
                        .reviewedAt(instantOf((java.sql.Timestamp) it.get("reviewed_at")))
                        .reviewedById(uuid(it.get("reviewed_by_id")))
                        .reviewReasonCode((String) it.get("last_review_reason_code"))
                        .reviewComments((String) it.get("erm_comments"))
                        .internalNote((String) it.get("internal_notes"))
                        .version(1)
                        .taskInstructions("[Migrated from legacy structured form; "
                                + "original form data preserved in audit log under OnboardingItem id="
                                + it.get("id") + "]")
                        .build();
                try {
                    DocumentTask saved = taskRepository.save(t);
                    tasksMigrated++;
                    String legacyJson = (String) it.get("form_data_json");
                    reviewLogRepository.save(DocumentTaskReviewLog.builder()
                            .taskId(saved.getId())
                            .actorUserId(null)
                            .eventType("MIGRATED_FROM_LEGACY_FORM")
                            .newStatus(saved.getStatus())
                            .comments("Migrated from legacy OnboardingItem "
                                    + it.get("id") + " (category=" + category + ")")
                            .payloadJson(legacyJson != null && legacyJson.length() <= 8000
                                    ? legacyJson : null)
                            .build());
                } catch (Exception e) {
                    log.warn("[OnboardingMigration] failed to save DocumentTask "
                            + "for legacy item {}: {}", it.get("id"), e.getMessage());
                }
            }
        }

        postSuccess(packetsMigrated, "packets=" + packetsMigrated
                + ", tasks=" + tasksMigrated
                + ", tasksWithMissingTemplate=" + tasksWithMissingTemplate);
        log.info("[OnboardingMigration] Migrated {} packet(s) / {} task(s) "
                + "({} with missing template match)",
                packetsMigrated, tasksMigrated, tasksWithMissingTemplate);
    }

    private boolean alreadyMigrated() {
        try {
            Integer cnt = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM migration_log WHERE migration_key = ?",
                    Integer.class, MIGRATION_KEY);
            return cnt != null && cnt > 0;
        } catch (Exception e) {
            // migration_log doesn't exist yet — first boot. Not migrated.
            return false;
        }
    }

    private boolean legacyTablesExist() {
        try {
            jdbc.queryForObject(
                    "SELECT 1 FROM onboarding_packets LIMIT 1", Integer.class);
            return true;
        } catch (DataAccessException e) {
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private void postSuccess(int rowsMigrated, String notes) {
        try {
            jdbc.update(
                    "INSERT INTO migration_log "
                            + "  (id, migration_key, executed_at, rows_migrated, notes) "
                            + "VALUES (?, ?, NOW(), ?, ?) "
                            + "ON CONFLICT (migration_key) DO NOTHING",
                    UUID.randomUUID(), MIGRATION_KEY, rowsMigrated, notes);
        } catch (Exception e) {
            log.warn("[OnboardingMigration] failed to write migration_log row: {}",
                    e.getMessage());
        }
    }

    private Map<String, UUID> loadTemplateIdsByTitle() {
        Map<String, UUID> out = new HashMap<>();
        for (DocumentTemplate t : templateRepository.findAll()) {
            out.put(t.getTitle(), t.getId());
        }
        return out;
    }

    private static String mapPacketStatus(String legacy) {
        if (legacy == null) return "ASSIGNED";
        return switch (legacy) {
            case "ACCEPTED" -> "COMPLETED";
            case "REJECTED" -> "IN_PROGRESS";   // surface for ERM rework
            case "DRAFT", "ASSIGNED" -> "ASSIGNED";
            default -> "IN_PROGRESS";
        };
    }

    private static String mapTaskStatus(String legacy) {
        if (legacy == null) return "PENDING";
        return switch (legacy) {
            case "ACCEPTED" -> "ACCEPTED";
            case "SUBMITTED" -> "SUBMITTED";
            case "REJECTED" -> "REJECTED";
            case "RESEND_REQUESTED" -> "RESEND_REQUESTED";
            default -> "PENDING";
        };
    }

    private static UUID uuid(Object o) {
        if (o == null) return null;
        try { return UUID.fromString(String.valueOf(o)); }
        catch (Exception e) { return null; }
    }

    private static Instant instantOf(java.sql.Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
