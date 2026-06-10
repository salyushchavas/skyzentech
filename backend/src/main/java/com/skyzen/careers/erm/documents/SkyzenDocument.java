package com.skyzen.careers.erm.documents;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * ERM Phase 8.2 — the 13 ANVI document templates as a static enum.
 * Replaces the dynamically-managed {@code DocumentTemplate} entity from
 * Phase 8. The actual blank PDF lives in the Next.js public folder at
 * {@code frontend/public/document-templates/{filename}.pdf} and is
 * served as a static asset (CDN-cacheable) — the backend never touches
 * the file bytes for templates. Interns download via the public URL;
 * filled-in PDFs are uploaded back through {@code DocumentVaultService}
 * with the {@link #sensitivity} carried over from this enum.
 *
 * <p>Stored in {@code document_tasks.document_key} as
 * {@code EnumType.STRING}.</p>
 */
public enum SkyzenDocument {

    W4_2026("W-4 2026", "TAX", "FINANCIAL", "W4 2026.pdf",
            "IRS W-4 employee withholding certificate, 2026 version."),
    W9_FW9("W-9 (FW9)", "TAX", "FINANCIAL", "fw9.pdf",
            "IRS W-9 for contractor / 1099 tax information."),
    I9_FORM_2026("I-9 Form 2026", "IMMIGRATION", "GOVERNMENT_ID",
            "I-9 form_26.pdf",
            "DHS I-9 employment eligibility, 2026 version."),
    I9_AUTHORIZED_AGENT_2026("I-9 Authorized Agent 2026", "IMMIGRATION",
            "GOVERNMENT_ID", "EM_i-9_authorized_agent 2026.pdf",
            "I-9 with authorized agent procedures."),
    I983_2029("I-983 (2029)", "IMMIGRATION", "GOVERNMENT_ID",
            "i983_2029.pdf",
            "DHS I-983 STEM OPT training plan."),
    EMPLOYEE_DATA_SHEET("Employee Data Sheet", "EMPLOYMENT", "GENERAL",
            "EM_Employee Data Sheet.pdf",
            "Employee profile and HR details form."),
    EMPLOYEE_HANDBOOK("Employee Handbook", "INFORMATIONAL", "GENERAL",
            "EM_Employee Handbook.pdf",
            "Company handbook with policies."),
    H1_OFFER_LETTER("H1 Offer Letter", "LEGAL", "GENERAL",
            "EM_H1 offer letter.pdf",
            "Offer letter template for H1B candidates."),
    OFFER_LETTER_SOFTWARE_DEV("Offer Letter Software Developer", "LEGAL",
            "GENERAL", "EM_Offer letter_Software Developer.pdf",
            "Offer letter template for software developer roles."),
    MSA_TEMPLATE("MSA Template", "LEGAL", "GENERAL", "EM_MSA_TEMPLATE.PDF",
            "Master Service Agreement template."),
    PO_TEMPLATE("PO Template", "INFORMATIONAL", "GENERAL", "EM_PO Template.pdf",
            "Purchase Order template."),
    LEAVE_OF_ABSENCE_FORM("Leave of Absence Form", "EMPLOYMENT", "GENERAL",
            "EM_LEAVE OF ABSENCE FORM.PDF",
            "Time-off / leave request form."),
    WEEKLY_STATUS_REPORT_INSTRUCTIONS("Weekly Status Report Instructions",
            "INFORMATIONAL", "GENERAL",
            "EM_Instructions for Weekly Status Reports and timecard entry.pdf",
            "Instructions for the weekly status report cadence.");

    private final String title;
    private final String category;
    private final String sensitivity;
    private final String filename;
    private final String description;

    SkyzenDocument(String title, String category, String sensitivity,
                   String filename, String description) {
        this.title = title;
        this.category = category;
        this.sensitivity = sensitivity;
        this.filename = filename;
        this.description = description;
    }

    public String getTitle() { return title; }
    public String getCategory() { return category; }
    public String getSensitivity() { return sensitivity; }
    public String getFilename() { return filename; }
    public String getDescription() { return description; }

    /** Relative URL into the Next.js public folder. The frontend joins
     *  this with its own origin; the backend uses it only inside DTOs.
     *  Filenames contain spaces and original casing — encode for URL
     *  safety (spaces → %20, etc). URLEncoder is form-encoded so we
     *  swap its `+` back to `%20` for path-segment correctness. */
    public String publicUrl() {
        String encoded = URLEncoder.encode(filename, StandardCharsets.UTF_8)
                .replace("+", "%20");
        return "/document-templates/" + encoded;
    }

    /** Resolve a legacy {@code DocumentTemplate.title} to its enum value
     *  for the Phase 8 → 8.2 schema migration. Returns null if the title
     *  doesn't match any known document (caller decides how to handle
     *  the orphan — Phase 8.2 migration logs + skips). */
    public static SkyzenDocument fromLegacyTitle(String title) {
        if (title == null) return null;
        String t = title.trim();
        for (SkyzenDocument d : values()) {
            if (d.title.equalsIgnoreCase(t)) return d;
        }
        return null;
    }

    public static SkyzenDocument fromKey(String key) {
        if (key == null) return null;
        try { return SkyzenDocument.valueOf(key.trim()); }
        catch (IllegalArgumentException e) { return null; }
    }
}
