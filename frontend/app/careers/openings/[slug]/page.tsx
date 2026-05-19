import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchJobPosting } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

const EMPLOYMENT_LABEL: Record<string, string> = {
  INTERNSHIP: 'Internship',
  CONTRACT: 'Contract',
  FULL_TIME: 'Full-time',
};

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const posting = await fetchJobPosting(params.slug);
    if (!posting) {
      return { title: 'Position not found — Skyzen Careers' };
    }
    return {
      title: `${posting.title} — Skyzen Careers`,
      description: posting.description?.slice(0, 200),
    };
  } catch {
    return { title: 'Skyzen Careers' };
  }
}

function paragraphs(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function requirementLines(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

export default async function JobPostingDetailPage({ params }: Props) {
  let posting;
  let loadError = false;
  try {
    posting = await fetchJobPosting(params.slug);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p className="font-medium">Couldn&apos;t load this posting.</p>
        <p className="mt-1">
          The backend may be starting up.{' '}
          <Link href="/careers/openings" className="underline">
            Back to openings
          </Link>
          .
        </p>
      </section>
    );
  }

  if (!posting) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="mb-2 text-xl font-semibold text-slate-900">
          This position is no longer open
        </h1>
        <p className="mb-6 text-sm text-slate-600">
          It may have been filled or paused. Check the openings list for current roles.
        </p>
        <Link
          href="/careers/openings"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to all openings
        </Link>
      </section>
    );
  }

  const descParas = paragraphs(posting.description);
  const reqs = requirementLines(posting.requirements);
  const employment = EMPLOYMENT_LABEL[posting.employmentType] ?? posting.employmentType;

  return (
    <article>
      <div className="mb-3">
        <Link
          href="/careers/openings"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; All openings
        </Link>
      </div>

      <header className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {posting.entityName && (
            <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {posting.entityName}
            </span>
          )}
          <span className="inline-block rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            {employment}
          </span>
          <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {posting.location}
          </span>
        </div>
        <h1 className="text-3xl font-semibold text-slate-900">{posting.title}</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {descParas.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">About the role</h2>
              <div className="space-y-3 text-sm leading-relaxed text-slate-700">
                {descParas.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}

          {reqs.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Requirements</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {reqs.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-6 rounded-lg border border-slate-200 bg-white p-6">
            <p className="mb-4 text-sm text-slate-600">
              Ready to apply? You&apos;ll need a resume (PDF or Word).
            </p>
            <Link
              href={`/careers/openings/${posting.slug}/apply`}
              className="block w-full rounded bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700"
            >
              Apply Now
            </Link>
          </div>
        </aside>
      </div>
    </article>
  );
}
