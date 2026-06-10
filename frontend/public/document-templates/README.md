# Skyzen Document Templates — static PDF library

ERM Phase 8.2 replaces the dynamic `DocumentTemplate` entity with a static
list of 13 blank PDFs served by Next.js from this folder. The canonical
list — including the URL slugs used here and the sensitivity tag each
filled-in PDF inherits when uploaded — lives in two places that must
stay in sync:

- Backend: `backend/.../erm/documents/SkyzenDocument.java`
- Frontend: `frontend/lib/skyzen-documents.ts`

When you add or rename a template you must update **both** files **and**
this README's filename list below.

## Required filenames

Each filename below MUST exist in this folder before ERM agents can
assign that document. Missing files don't break the build, but interns
clicking "Download" will get a 404. There is no fallback.

| Filename                                       | Document                                |
| ---------------------------------------------- | --------------------------------------- |
| `w4-2026.pdf`                                  | W-4 2026                                |
| `fw9.pdf`                                      | W-9 (FW9)                               |
| `i9-form-2026.pdf`                             | I-9 Form 2026                           |
| `i9-authorized-agent-2026.pdf`                 | I-9 Authorized Agent 2026               |
| `i983-2029.pdf`                                | I-983 (2029)                            |
| `employee-data-sheet.pdf`                      | Employee Data Sheet                     |
| `employee-handbook.pdf`                        | Employee Handbook                       |
| `h1-offer-letter.pdf`                          | H1 Offer Letter                         |
| `offer-letter-software-developer.pdf`          | Offer Letter Software Developer         |
| `msa-template.pdf`                             | MSA Template                            |
| `po-template.pdf`                              | PO Template                             |
| `leave-of-absence-form.pdf`                    | Leave of Absence Form                   |
| `weekly-status-report-instructions.pdf`        | Weekly Status Report Instructions       |

## Why static files instead of a managed library?

- ERM Phase 8 (commit `e146bba`) shipped a full template-CRUD UI but the
  document set is small (13) and changes infrequently (annual IRS / DHS
  refreshes). Hosting the PDFs directly in the repo trades dynamic
  management for source-controlled provenance + free CDN caching via
  Next.js's static asset pipeline.
- Filled-in PDFs uploaded by interns still go through `DocumentVault`
  (AES-256-GCM at rest, sensitivity inherited from the enum) — only the
  blank templates are public.

## Updating a template

1. Drop the new PDF in this folder using the exact filename above.
2. If the title or sensitivity changed, update `SkyzenDocument.java` +
   `skyzen-documents.ts` + the table above.
3. Commit. Vercel redeploys and the new file is live on next request.
