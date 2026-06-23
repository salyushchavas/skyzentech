/**
 * Brand identity — single source of truth for all chrome that varies
 * per deployment. Reads NEXT_PUBLIC_BRAND_* env vars at build time;
 * defaults to Skyzen so existing deployments are byte-unchanged.
 *
 * Per-brand deployments (Vercel) set these vars in their project
 * settings; each brand's build snapshot pins its own brand strings into
 * the bundle. For dev, leave the vars unset and Skyzen renders.
 *
 * NOT in scope here: Skyzen-specific marketing pages (`app/page.tsx`,
 * `app/jobs`, `app/terms`, `app/privacy`, `SiteHeader`, `SiteFooter`,
 * `LegalPageShell`). Those are Skyzen LLC company content. A different
 * brand deploying this codebase would either remove those routes or
 * replace the content entirely — they're not generic chrome.
 */
export const BRAND = {
  /** Short brand name used in sidebar subtitles, body copy. e.g. "Skyzen Tech". */
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Skyzen Tech',
  /** "{name} Careers" product noun. e.g. "Skyzen Careers". */
  productName: process.env.NEXT_PUBLIC_BRAND_PRODUCT_NAME || 'Skyzen Careers',
  /** Legal entity (for footers, contracts). e.g. "Skyzen Technologies LLC". */
  legalName:
    process.env.NEXT_PUBLIC_BRAND_LEGAL_NAME || 'Skyzen Technologies LLC',
  /** Logo asset path or absolute URL. Default = bundled Skyzen logo. */
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || '/images/skyzen-logo.png',
  /** Favicon URL. Empty default = no <link rel="icon"> emitted (current behavior). */
  faviconUrl: process.env.NEXT_PUBLIC_BRAND_FAVICON_URL || '',
  /** Support / contact email (UI + email templates may reference). */
  supportEmail:
    process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL || 'careers@skyzentech.com',
  /** Public marketing site URL. */
  websiteUrl:
    process.env.NEXT_PUBLIC_BRAND_WEBSITE_URL || 'https://www.skyzentech.com',
  /**
   * Brand primary color (hex) — informational; the visual rendering uses
   * Tailwind's brand-* ramp baked at build (see tailwind.config.ts which
   * reads the same env var). Exposed here so JS-driven code paths
   * (charts, SVG icons) can use the value directly.
   */
  primary: process.env.NEXT_PUBLIC_BRAND_PRIMARY || '#fb9b47',
  /** Brand accent color (hex) — same as above, for the deeper accent. */
  accent: process.env.NEXT_PUBLIC_BRAND_ACCENT || '#ff7c20',
  /**
   * <title> default for routes that don't override metadata. Defaults
   * to the exact Skyzen marketing tagline so existing pages are
   * byte-unchanged; per-brand deploys override with their own.
   */
  documentTitle:
    process.env.NEXT_PUBLIC_BRAND_DOCUMENT_TITLE
      || 'Skyzen Technologies — IT Staffing & STEM Internships',
  /** Document title template (Next.js metadata format). %s = page title. */
  documentTitleTemplate:
    process.env.NEXT_PUBLIC_BRAND_DOCUMENT_TITLE_TEMPLATE
      || '%s — Skyzen Technologies',
  /** Meta description default. Same byte-exact preservation rule. */
  documentDescription:
    process.env.NEXT_PUBLIC_BRAND_DOCUMENT_DESCRIPTION
      || 'Skyzen Technologies LLC — premier IT consulting, software development, staffing, and STEM internships based in Plano, TX. Trusted by 21+ enterprise clients.',
};
