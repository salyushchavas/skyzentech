'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, CheckCircle2, Clock, MapPin, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { formatRelative } from '@/lib/format-date';
import type { JobPostingResponse } from '@/types';
import ApplyNowModal from './ApplyNowModal';

interface Props {
  posting: JobPostingResponse;
  /** Called after a successful apply so the parent can flip card state. */
  onApplied?: (jobPostingId: string, applicationId: string) => void;
}

const EMPLOYMENT_LABEL: Record<string, string> = {
  INTERNSHIP: 'Internship',
  CONTRACT: 'Contract',
  FULL_TIME: 'Full-time',
};

const MAX_BULLET_LINES = 4;

function splitToBullets(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|;|•/g)
    .map((s) => s.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean);
}

/** Heuristic split: lines starting with "qual" go to qualifications. */
function partitionRequirements(req: string | undefined | null): {
  requirements: string[];
  qualifications: string[];
} {
  const all = splitToBullets(req);
  const qualifications: string[] = [];
  const requirements: string[] = [];
  for (const line of all) {
    if (/^qualif/i.test(line) || /^education/i.test(line) || /^degree/i.test(line)) {
      qualifications.push(line);
    } else {
      requirements.push(line);
    }
  }
  return { requirements, qualifications };
}

export default function JobCard({ posting, onApplied }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [showApply, setShowApply] = useState(false);
  const [showAllReq, setShowAllReq] = useState(false);
  const [showAllQual, setShowAllQual] = useState(false);
  const [applied, setApplied] = useState<boolean>(posting.applied ?? false);

  const { requirements, qualifications } = useMemo(
    () => partitionRequirements(posting.requirements),
    [posting.requirements],
  );

  const isAuthed = !!user;
  const isApplicant = !!user?.roles?.includes('APPLICANT');
  const isPostApplicant =
    isAuthed
    && !isApplicant
    && user?.roles?.some((r) => r !== 'APPLICANT');

  const reqShown = showAllReq ? requirements : requirements.slice(0, MAX_BULLET_LINES);
  const qualShown = showAllQual ? qualifications : qualifications.slice(0, MAX_BULLET_LINES);

  function handleApplyClick() {
    if (!isAuthed) {
      const redirect = `/careers/openings/${posting.slug}/apply`;
      router.push(`/careers/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    if (!isApplicant) return;
    if (applied) return;
    setShowApply(true);
  }

  function renderApplyButton() {
    if (isPostApplicant) {
      return (
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
        >
          Not eligible
        </button>
      );
    }
    if (applied) {
      return (
        <button
          type="button"
          disabled
          title={
            posting.applicationStatus
              ? `Status: ${posting.applicationStatus.replaceAll('_', ' ').toLowerCase()}`
              : 'Application on file'
          }
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
          Applied
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={handleApplyClick}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent to-accent-dark px-4 py-2 text-sm font-semibold text-white shadow-glow-accent hover:shadow-glow-accent-lg"
      >
        Apply Now
      </button>
    );
  }

  return (
    <>
      <article className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-accent/40 hover:shadow-md">
        {/* Header */}
        <header>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {posting.entityName && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                <Building2 className="h-3 w-3" strokeWidth={2} />
                {posting.entityName}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-primary-700">
              <Briefcase className="h-3 w-3" strokeWidth={2} />
              {EMPLOYMENT_LABEL[posting.employmentType] ?? posting.employmentType}
            </span>
            {posting.publishedAt && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" strokeWidth={2} />
                Posted {formatRelative(posting.publishedAt)}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-900">{posting.title}</h3>
          {posting.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3" strokeWidth={2} />
              {posting.location}
            </p>
          )}
        </header>

        {/* Description preview */}
        {posting.description && (
          <p className="line-clamp-2 text-sm text-slate-600">{posting.description}</p>
        )}

        {/* Requirements */}
        {requirements.length > 0 && (
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Requirements
            </h4>
            <ul className="space-y-1 text-sm text-slate-700">
              {reqShown.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            {requirements.length > MAX_BULLET_LINES && (
              <button
                type="button"
                onClick={() => setShowAllReq((v) => !v)}
                className="mt-1 text-xs font-medium text-primary-700 hover:underline"
              >
                {showAllReq ? 'Show less' : `Show ${requirements.length - MAX_BULLET_LINES} more`}
              </button>
            )}
          </section>
        )}

        {/* Qualifications */}
        {qualifications.length > 0 && (
          <section>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Qualifications
            </h4>
            <ul className="space-y-1 text-sm text-slate-700">
              {qualShown.map((q, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span>{q}</span>
                </li>
              ))}
            </ul>
            {qualifications.length > MAX_BULLET_LINES && (
              <button
                type="button"
                onClick={() => setShowAllQual((v) => !v)}
                className="mt-1 text-xs font-medium text-primary-700 hover:underline"
              >
                {showAllQual ? 'Show less' : `Show ${qualifications.length - MAX_BULLET_LINES} more`}
              </button>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Link
            href={`/careers/openings/${posting.slug}`}
            className="text-xs font-medium text-primary-700 hover:underline"
          >
            View details →
          </Link>
          {renderApplyButton()}
        </footer>
      </article>

      {showApply && (
        <ApplyNowModal
          posting={posting}
          defaultName={user?.fullName}
          defaultEmail={user?.email}
          onClose={() => setShowApply(false)}
          onApplied={(applicationId) => {
            setApplied(true);
            setShowApply(false);
            if (onApplied) onApplied(posting.id, applicationId);
          }}
        />
      )}
    </>
  );
}
