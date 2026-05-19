import type { Metadata } from 'next';
import Link from 'next/link';
import SiteLayout from '@/components/SiteLayout';

export const metadata: Metadata = {
  title: 'Careers — Skyzen Technologies',
  description:
    'General career opportunities at Skyzen Technologies. While we upgrade our listings, explore our STEM Internship Program.',
};

export default function JobsPlaceholderPage() {
  return (
    <SiteLayout>
      <section className="bg-skyzen-dark px-6 py-24 text-skyzen-text">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3.5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <span className="h-0.5 w-6 rounded-sm bg-accent" />
            Careers
          </div>
          <h1 className="mb-5 text-3xl font-extrabold text-white sm:text-4xl md:text-5xl">
            General Career Opportunities
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-skyzen-muted">
            We&apos;re upgrading our jobs listings. In the meantime, explore our STEM
            Internship Program — real client projects, structured mentorship, and full
            OPT/CPT compliance.
          </p>
          <Link
            href="/careers/openings"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent to-accent-dark px-8 py-3.5 text-sm font-bold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg"
          >
            Explore Internships
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
