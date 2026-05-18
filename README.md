# Skyzen Careers

Monorepo for the Skyzen Careers internship lifecycle management platform.

New STEM intern lifecycle module that will live at `skyzentech.com/careers`
(reverse-proxied from GoDaddy to the Vercel-hosted Next.js frontend).

**Coexists with** the existing PHP jobs system on skyzentech.com
(`jobs.php`, `job-details.php`, `apply-job.php`, `send-application.php`) —
does not replace it.

## Structure

- `backend/` — Spring Boot 3 + PostgreSQL on Railway
- `frontend/` — Next.js 14 + TypeScript + Tailwind on Vercel
- `PRODUCT.md` — single source of truth for product decisions (to be added)

## Deployment

- **Backend:** Railway watches `backend/` directory, deploys on push
- **Frontend:** Vercel watches `frontend/` directory, deploys on push
- **DB:** Railway-hosted PostgreSQL (shared with the local dev environment)

## Local development

See `backend/README.md` and `frontend/README.md` for individual setup.
Backend's `run-dev.ps1` (gitignored) is the launcher.
