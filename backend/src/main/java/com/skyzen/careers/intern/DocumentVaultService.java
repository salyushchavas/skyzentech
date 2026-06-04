package com.skyzen.careers.intern;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skyzen.careers.entity.AuditLog;
import com.skyzen.careers.entity.Document;
import com.skyzen.careers.entity.User;
import com.skyzen.careers.enums.UserRole;
import com.skyzen.careers.exception.ForbiddenException;
import com.skyzen.careers.exception.ResourceNotFoundException;
import com.skyzen.careers.repository.AuditLogRepository;
import com.skyzen.careers.repository.DocumentRepository;
import com.skyzen.careers.security.PiiEncryptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Phase 4 document vault write/read service. Distinct from the existing
 * {@code DocumentService} (a read-only aggregator that maps I-9 / I-983 /
 * Offer / Resume rows into a unified vault DTO).
 *
 * <p>This service manages the {@code documents} table directly — uploads
 * from the intern UI (voided checks, supporting docs) and the SIGNED_OFFER
 * archive from the Phase 3 webhook both write through here. Content bytes
 * are encrypted at rest when sensitivity is PII / FINANCIAL / GOVERNMENT_ID.</p>
 *
 * <p>Read path is RBAC-gated: owner reads with no audit row; staff (ERM /
 * MANAGER / SUPER_ADMIN) reads write a {@code DOCUMENT_READ} audit row.
 * Trainer / Evaluator never see PII categories.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentVaultService {

    private static final Set<String> PII_SENSITIVITIES =
            Set.of("PII", "FINANCIAL", "GOVERNMENT_ID");

    /** Categories that auto-tag a sensitivity classification on upload. */
    private static final Map<String, String> CATEGORY_SENSITIVITY = Map.of(
            "W4",                  "PII",
            "I9",                  "GOVERNMENT_ID",
            "ACH",                 "FINANCIAL",
            "EMERGENCY_CONTACT",   "NORMAL",
            "HANDBOOK_ACK",        "NORMAL",
            "I983",                "PII",
            "SIGNED_OFFER",        "PII",
            "EVERIFY",             "GOVERNMENT_ID",
            "RESUME",              "NORMAL",
            "OTHER",               "NORMAL"
    );

    private final DocumentRepository documentRepository;
    private final AuditLogRepository auditLogRepository;
    private final PiiEncryptionService piiEncryption;
    private final ObjectMapper objectMapper;

    @Value("${app.documents.storage-path:./uploads/documents}")
    private String storageRoot;

    // ── Writes ─────────────────────────────────────────────────────────────

    @Transactional
    public Document saveDocument(UUID ownerUserId,
                                  String fileName,
                                  String mimeType,
                                  byte[] bytes,
                                  String category,
                                  String sensitivity,
                                  UUID uploadedById) {
        if (ownerUserId == null) {
            throw new IllegalArgumentException("ownerUserId is required");
        }
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("Document content is empty");
        }
        if (category == null) category = "OTHER";
        if (sensitivity == null) {
            sensitivity = CATEGORY_SENSITIVITY.getOrDefault(category, "NORMAL");
        }

        try {
            Path dir = Paths.get(storageRoot, ownerUserId.toString());
            Files.createDirectories(dir);
            UUID storageUuid = UUID.randomUUID();
            Path target = dir.resolve(storageUuid + ".bin");

            String encryptionMetadataJson = null;
            byte[] toWrite = bytes;
            if (PII_SENSITIVITIES.contains(sensitivity)) {
                // Wrap bytes in our standard base64(IV||ct+tag) envelope and
                // store the on-disk file as that envelope. encryption_metadata_json
                // records the algorithm so the reader knows to decrypt.
                String b64 = piiEncryption.encrypt(
                        Base64.getEncoder().encodeToString(bytes));
                toWrite = b64.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                Map<String, Object> meta = new LinkedHashMap<>();
                meta.put("alg", "AES-256-GCM");
                meta.put("encoded_base64_inner", true);
                encryptionMetadataJson = objectMapper.writeValueAsString(meta);
            }
            Files.write(target, toWrite);

            Document doc = Document.builder()
                    .ownerUserId(ownerUserId)
                    .fileName(fileName != null ? fileName : "upload.bin")
                    .fileSize(bytes.length)
                    .mimeType(mimeType != null ? mimeType : "application/octet-stream")
                    .storageKey(target.toString())
                    .category(category)
                    .sensitivity(sensitivity)
                    .uploadedById(uploadedById)
                    .encryptionMetadataJson(encryptionMetadataJson)
                    .build();
            return documentRepository.save(doc);
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new RuntimeException("Document write failed: " + e.getMessage(), e);
        }
    }

    // ── Reads ──────────────────────────────────────────────────────────────

    @Transactional
    public byte[] readDocument(UUID documentId, User caller) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));
        if (doc.getDeletedAt() != null) {
            throw new ResourceNotFoundException("Document not found: " + documentId);
        }
        boolean owner = caller != null && caller.getId().equals(doc.getOwnerUserId());
        boolean staff = caller != null && (
                caller.getRoles().contains(UserRole.ERM)
                || caller.getRoles().contains(UserRole.MANAGER)
                || caller.getRoles().contains(UserRole.SUPER_ADMIN));
        if (!owner && !staff) {
            throw new ForbiddenException("Not allowed to read this document");
        }
        // PII categories never visible to non-staff non-owner; Trainer / Evaluator
        // never see encrypted-content documents at all.
        try {
            byte[] raw = Files.readAllBytes(Paths.get(doc.getStorageKey()));
            byte[] result;
            if (doc.getEncryptionMetadataJson() != null) {
                String b64 = new String(raw, java.nio.charset.StandardCharsets.UTF_8);
                String inner = piiEncryption.decrypt(b64);
                result = Base64.getDecoder().decode(inner);
            } else {
                result = raw;
            }
            // Audit every staff read of a sensitive document.
            if (!owner && PII_SENSITIVITIES.contains(doc.getSensitivity())) {
                writeAudit(doc, caller, "DOCUMENT_READ");
            }
            return result;
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            log.error("[DocumentVault] read failed for {}: {}", documentId, e.getMessage());
            throw new RuntimeException("Document read failed");
        }
    }

    @Transactional(readOnly = true)
    public List<Document> listForOwner(UUID ownerUserId) {
        return documentRepository.findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(ownerUserId);
    }

    @Transactional
    public Document loadMetadataForOwner(UUID documentId, User caller) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));
        if (doc.getDeletedAt() != null) {
            throw new ResourceNotFoundException("Document not found: " + documentId);
        }
        boolean owner = caller != null && caller.getId().equals(doc.getOwnerUserId());
        boolean staff = caller != null && (
                caller.getRoles().contains(UserRole.ERM)
                || caller.getRoles().contains(UserRole.MANAGER)
                || caller.getRoles().contains(UserRole.SUPER_ADMIN));
        if (!owner && !staff) {
            throw new ForbiddenException("Not allowed to read this document");
        }
        return doc;
    }

    @Transactional
    public void softDelete(UUID documentId, User caller) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));
        boolean owner = caller != null && caller.getId().equals(doc.getOwnerUserId());
        boolean staff = caller != null && (
                caller.getRoles().contains(UserRole.ERM)
                || caller.getRoles().contains(UserRole.SUPER_ADMIN));
        if (!owner && !staff) {
            throw new ForbiddenException("Not allowed to delete this document");
        }
        doc.setDeletedAt(Instant.now());
        documentRepository.save(doc);
    }

    // ── Internals ──────────────────────────────────────────────────────────

    private void writeAudit(Document doc, User caller, String action) {
        try {
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("category", doc.getCategory());
            after.put("sensitivity", doc.getSensitivity());
            after.put("ownerUserId", doc.getOwnerUserId());
            AuditLog entry = AuditLog.builder()
                    .entityType("Document")
                    .entityId(doc.getId())
                    .action(action)
                    .userId(caller != null ? caller.getId() : null)
                    .subjectUserId(doc.getOwnerUserId())
                    .afterJson(objectMapper.writeValueAsString(after))
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("[DocumentVault] audit write failed: {}", e.getMessage());
        }
    }

    public static String defaultSensitivityForCategory(String category) {
        return CATEGORY_SENSITIVITY.getOrDefault(category, "NORMAL");
    }
}
