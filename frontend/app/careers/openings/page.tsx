import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchOpenJobPostings } from '@/lib/server-api';
import JobPostingCard from '@/components/JobPostingCard';

export const metadata: Metadata = {
  title: 'Open Internships — Skyzen Careers',
  description:
    'Browse open STEM internship positions at Skyzen Technologies. Apply directly through Skyzen Careers.',
};

export const dynamic = 'force-dynamic';

export default async function OpeningsPage() {
  let page;
  let loadError = false;
  try {
    page = await fetchOpenJobPostings(0, 50);
  } catch {
    loadError = true;
  }

  const postings = page?.content ?? [];

  return (
    <section>
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-semibold text-slate-900">Open Internships</h1>
        <p className="text-sm text-slate-600">
          Join the Skyzen Careers STEM internship program.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-medium">Couldn&apos;t load openings.</p>
          <p className="mt-1">
            The backend may be starting up. Refresh in a few seconds or{' '}
            <Link href="/careers/openings" className="underline">
              try again
            </Link>
            .
          </p>
        </div>
      ) : postings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-base font-medium text-slate-700">
            No open positions right now.
          </p>
          <p className="mt-1 text-sm text-slate-500">Check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {postings.map((p) => (
            <JobPostingCard key={p.id} posting={p} />
          ))}
        </div>
      )}
    </section>
  );
}
