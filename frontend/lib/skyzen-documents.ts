// ERM Phase 8.2 — mirror of com.skyzen.careers.erm.documents.SkyzenDocument.
// Keep in sync manually with the backend enum: same keys, same order,
// same sensitivities. The 13 blank PDFs live as static files in
// `frontend/public/document-templates/`; the URL each entry exposes is
// served as a cacheable static asset by Next.js.

export type SkyzenDocumentKey =
  | 'W4_2026'
  | 'W9_FW9'
  | 'I9_FORM_2026'
  | 'I9_AUTHORIZED_AGENT_2026'
  | 'I983_2029'
  | 'EMPLOYEE_DATA_SHEET'
  | 'EMPLOYEE_HANDBOOK'
  | 'H1_OFFER_LETTER'
  | 'OFFER_LETTER_SOFTWARE_DEV'
  | 'MSA_TEMPLATE'
  | 'PO_TEMPLATE'
  | 'LEAVE_OF_ABSENCE_FORM'
  | 'WEEKLY_STATUS_REPORT_INSTRUCTIONS';

export type SkyzenDocumentCategory =
  | 'TAX'
  | 'IMMIGRATION'
  | 'EMPLOYMENT'
  | 'LEGAL'
  | 'INFORMATIONAL';

export type SkyzenDocumentSensitivity =
  | 'GENERAL'
  | 'FINANCIAL'
  | 'GOVERNMENT_ID';

export type SkyzenDocumentSpec = {
  key: SkyzenDocumentKey;
  title: string;
  category: SkyzenDocumentCategory;
  sensitivity: SkyzenDocumentSensitivity;
  filename: string;
  description: string;
  publicUrl: string;
};

export const SKYZEN_DOCUMENTS: readonly SkyzenDocumentSpec[] = [
  { key: 'W4_2026', title: 'W-4 2026', category: 'TAX',
    sensitivity: 'FINANCIAL', filename: 'w4-2026.pdf',
    description: 'IRS W-4 employee withholding certificate, 2026 version.',
    publicUrl: '/document-templates/w4-2026.pdf' },
  { key: 'W9_FW9', title: 'W-9 (FW9)', category: 'TAX',
    sensitivity: 'FINANCIAL', filename: 'fw9.pdf',
    description: 'IRS W-9 for contractor / 1099 tax information.',
    publicUrl: '/document-templates/fw9.pdf' },
  { key: 'I9_FORM_2026', title: 'I-9 Form 2026', category: 'IMMIGRATION',
    sensitivity: 'GOVERNMENT_ID', filename: 'i9-form-2026.pdf',
    description: 'DHS I-9 employment eligibility, 2026 version.',
    publicUrl: '/document-templates/i9-form-2026.pdf' },
  { key: 'I9_AUTHORIZED_AGENT_2026', title: 'I-9 Authorized Agent 2026',
    category: 'IMMIGRATION', sensitivity: 'GOVERNMENT_ID',
    filename: 'i9-authorized-agent-2026.pdf',
    description: 'I-9 with authorized agent procedures.',
    publicUrl: '/document-templates/i9-authorized-agent-2026.pdf' },
  { key: 'I983_2029', title: 'I-983 (2029)', category: 'IMMIGRATION',
    sensitivity: 'GOVERNMENT_ID', filename: 'i983-2029.pdf',
    description: 'DHS I-983 STEM OPT training plan.',
    publicUrl: '/document-templates/i983-2029.pdf' },
  { key: 'EMPLOYEE_DATA_SHEET', title: 'Employee Data Sheet',
    category: 'EMPLOYMENT', sensitivity: 'GENERAL',
    filename: 'employee-data-sheet.pdf',
    description: 'Employee profile and HR details form.',
    publicUrl: '/document-templates/employee-data-sheet.pdf' },
  { key: 'EMPLOYEE_HANDBOOK', title: 'Employee Handbook',
    category: 'INFORMATIONAL', sensitivity: 'GENERAL',
    filename: 'employee-handbook.pdf',
    description: 'Company handbook with policies.',
    publicUrl: '/document-templates/employee-handbook.pdf' },
  { key: 'H1_OFFER_LETTER', title: 'H1 Offer Letter', category: 'LEGAL',
    sensitivity: 'GENERAL', filename: 'h1-offer-letter.pdf',
    description: 'Offer letter template for H1B candidates.',
    publicUrl: '/document-templates/h1-offer-letter.pdf' },
  { key: 'OFFER_LETTER_SOFTWARE_DEV',
    title: 'Offer Letter Software Developer', category: 'LEGAL',
    sensitivity: 'GENERAL',
    filename: 'offer-letter-software-developer.pdf',
    description: 'Offer letter template for software developer roles.',
    publicUrl: '/document-templates/offer-letter-software-developer.pdf' },
  { key: 'MSA_TEMPLATE', title: 'MSA Template', category: 'LEGAL',
    sensitivity: 'GENERAL', filename: 'msa-template.pdf',
    description: 'Master Service Agreement template.',
    publicUrl: '/document-templates/msa-template.pdf' },
  { key: 'PO_TEMPLATE', title: 'PO Template', category: 'INFORMATIONAL',
    sensitivity: 'GENERAL', filename: 'po-template.pdf',
    description: 'Purchase Order template.',
    publicUrl: '/document-templates/po-template.pdf' },
  { key: 'LEAVE_OF_ABSENCE_FORM', title: 'Leave of Absence Form',
    category: 'EMPLOYMENT', sensitivity: 'GENERAL',
    filename: 'leave-of-absence-form.pdf',
    description: 'Time-off / leave request form.',
    publicUrl: '/document-templates/leave-of-absence-form.pdf' },
  { key: 'WEEKLY_STATUS_REPORT_INSTRUCTIONS',
    title: 'Weekly Status Report Instructions',
    category: 'INFORMATIONAL', sensitivity: 'GENERAL',
    filename: 'weekly-status-report-instructions.pdf',
    description: 'Instructions for the weekly status report cadence.',
    publicUrl: '/document-templates/weekly-status-report-instructions.pdf' },
] as const;

export const SKYZEN_DOCUMENT_BY_KEY: Record<SkyzenDocumentKey, SkyzenDocumentSpec> =
  Object.fromEntries(SKYZEN_DOCUMENTS.map((d) => [d.key, d])) as Record<
    SkyzenDocumentKey, SkyzenDocumentSpec
  >;

export const SKYZEN_DOCUMENT_CATEGORIES: readonly SkyzenDocumentCategory[] = [
  'TAX', 'IMMIGRATION', 'EMPLOYMENT', 'LEGAL', 'INFORMATIONAL',
];

export const CATEGORY_BADGE: Record<SkyzenDocumentCategory, string> = {
  TAX: 'bg-amber-100 text-amber-800',
  IMMIGRATION: 'bg-violet-100 text-violet-800',
  EMPLOYMENT: 'bg-sky-100 text-sky-800',
  LEGAL: 'bg-rose-100 text-rose-800',
  INFORMATIONAL: 'bg-slate-100 text-slate-700',
};

export const SENSITIVITY_BADGE: Record<SkyzenDocumentSensitivity, string> = {
  GENERAL: 'bg-slate-100 text-slate-700',
  FINANCIAL: 'bg-amber-100 text-amber-800',
  GOVERNMENT_ID: 'bg-rose-100 text-rose-800',
};

export const SENSITIVITY_LABEL: Record<SkyzenDocumentSensitivity, string> = {
  GENERAL: 'General',
  FINANCIAL: 'Financial',
  GOVERNMENT_ID: 'Government ID',
};
