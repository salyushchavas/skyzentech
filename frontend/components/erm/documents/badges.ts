// ERM Phase 8.1 — shared badge palette for the document templates UI.
// Categories + sensitivities derived from DocumentTemplateSeeder + the
// DocumentTemplateService set of accepted values.

export const TEMPLATE_CATEGORIES = [
  'TAX',
  'IMMIGRATION',
  'EMPLOYMENT',
  'LEGAL',
  'COMPLIANCE',
  'INFORMATIONAL',
  'OTHER',
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const CATEGORY_BADGE: Record<string, string> = {
  TAX: 'bg-amber-100 text-amber-800',
  IMMIGRATION: 'bg-violet-100 text-violet-800',
  EMPLOYMENT: 'bg-sky-100 text-sky-800',
  LEGAL: 'bg-rose-100 text-rose-800',
  COMPLIANCE: 'bg-emerald-100 text-emerald-800',
  INFORMATIONAL: 'bg-slate-100 text-slate-700',
  OTHER: 'bg-slate-100 text-slate-700',
};

// "NORMAL" is the DB default; we expose it in the UI as "General" to match
// how ERM agents think about it.
export const TEMPLATE_SENSITIVITIES = [
  'NORMAL',
  'FINANCIAL',
  'GOVERNMENT_ID',
  'MEDICAL',
] as const;
export type TemplateSensitivity = (typeof TEMPLATE_SENSITIVITIES)[number];

export const SENSITIVITY_LABEL: Record<string, string> = {
  NORMAL: 'General',
  FINANCIAL: 'Financial',
  GOVERNMENT_ID: 'Government ID',
  MEDICAL: 'Medical',
};

export const SENSITIVITY_BADGE: Record<string, string> = {
  NORMAL: 'bg-slate-100 text-slate-700',
  FINANCIAL: 'bg-amber-100 text-amber-800',
  GOVERNMENT_ID: 'bg-rose-100 text-rose-800',
  MEDICAL: 'bg-blue-100 text-blue-800',
};

export const FILE_KINDS = ['PDF', 'DOCX', 'XLSX', 'OTHER'] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const TEMPLATE_FILE_ACCEPT =
  'application/pdf,'
  + 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,'
  + 'application/msword,'
  + 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,'
  + 'application/vnd.ms-excel';

export const TEMPLATE_FILE_MAX_BYTES = 10 * 1024 * 1024;

export function isAllowedTemplateMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return TEMPLATE_FILE_ACCEPT.split(',').includes(mime);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
