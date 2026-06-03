'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, MessageSquare, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';

interface ApplicantInterviewDetail {
  id: string;
  applicationId: string;
  jobPostingTitle: string | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  interviewerName: string | null;
  completedAt: string | null;
  outcomeCategory: 'HIRE' | 'HOLD' | 'REJECT' | null;
  outcomePositive: boolean;
}

export default function CandidateInterviewDetailPage() {
  return (
    <ProtectedRoute requiredRoles={['APPLICANT', 'INTERN', 'SUPER_ADMIN']}>
      <DashboardLayout title="Interview">
        <Body />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function Body() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<ApplicantInterviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<ApplicantInterviewDetail>(
          `/api/v1/applicant/interviews/${encodeURIComponent(id)}`,
        );
        if (!cancelled) setData(res.data);
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 403) setError("You don't have access to this interview.");
        else if (status === 404) setError("Interview not found.");
        else setError(err?.response?.data?.error ?? "Couldn't load this interview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-7 w-40 animate-pulse rounded bg-slate-100" />
        <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const isCompleted = data.status === 'COMPLETED' && data.completedAt;

  return (
    <section className="space-y-5">
      <Link
        href="/careers/candidate"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2.5} />
        Back to dashboard
      </Link>

      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Interview</p>
        <h1 className="mt-0.5 text-2xl font-semibold text-slate-900">
          {data.jobPostingTitle ?? 'Interview detail'}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          {data.interviewerName && (
            <span>
              With <span className="font-medium text-slate-800">{data.interviewerName}</span>
            </span>
          )}
          {data.scheduledAt && (
            <span>
              Scheduled {new Date(data.scheduledAt).toLocaleString()}
            </span>
          )}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
              Completed
            </span>
          )}
        </div>
        {isCompleted && (
          <p className="mt-2 text-sm text-slate-600">
            Interview completed on{' '}
            <span className="font-medium text-slate-800">
              {new Date(data.completedAt!).toLocaleString()}
            </span>
            .
          </p>
        )}
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessageSquare className="h-4 w-4 text-accent" strokeWidth={2} />
          What we discussed
        </div>
        <p className="text-sm text-slate-600">
          Your interview covered topics relevant to the {data.jobPostingTitle ?? 'role'}. Panel
          members may include the hiring manager and technical reviewers. We don't share
          individual scores or private interviewer notes here — those stay with the hiring team.
        </p>
      </section>

      <WhatHappensNext outcome={data.outcomeCategory} completed={!!isCompleted} />

      {isCompleted && (
        <YourNextSteps outcome={data.outcomeCategory} />
      )}
    </section>
  );
}

function WhatHappensNext({
  outcome,
  completed,
}: {
  outcome: 'HIRE' | 'HOLD' | 'REJECT' | null;
  completed: boolean;
}) {
  let title = 'What happens next';
  let body = '';
  let tone = 'border-slate-200 bg-white';
  if (!completed) {
    body =
      'Once the interview is complete, the team will leave feedback and you’ll receive an update here within a few business days.';
  } else if (outcome === 'HIRE') {
    tone = 'border-emerald-200 bg-emerald-50';
    body =
      'Expect to receive a conditional employment confirmation email within 2–3 business days. Once accepted, you’ll move into the offer + onboarding stage.';
  } else if (outcome === 'HOLD') {
    tone = 'border-amber-200 bg-amber-50';
    body =
      "We're reviewing all candidates. You'll hear from us within 5 business days.";
  } else if (outcome === 'REJECT') {
    tone = 'border-slate-200 bg-slate-50';
    body =
      "We've decided not to proceed at this time. Detailed feedback may be shared separately by email.";
  } else {
    body =
      "Your interview has been completed. The team will update your application status shortly.";
  }
  return (
    <section className={'rounded-xl border p-5 ' + tone}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles className="h-4 w-4 text-accent" strokeWidth={2} />
        {title}
      </div>
      <p className="text-sm text-slate-700">{body}</p>
    </section>
  );
}

function YourNextSteps({ outcome }: { outcome: 'HIRE' | 'HOLD' | 'REJECT' | null }) {
  let bullets: string[] = [];
  if (outcome === 'HIRE') {
    bullets = [
      'Watch your inbox for the conditional employment confirmation email.',
      'Have your documents ready (ID, work-authorization paperwork).',
      'Be ready to confirm your start window once the formal offer arrives.',
    ];
  } else if (outcome === 'HOLD') {
    bullets = [
      "Keep an eye on email — we'll reach out within five business days.",
      'Continue applying to other roles that fit your skills in the meantime.',
    ];
  } else if (outcome === 'REJECT') {
    bullets = [
      'Consider applying to other open positions that match your profile.',
      'Keep your resume and profile up to date for future opportunities.',
    ];
  } else {
    bullets = ['No specific action right now — we’ll be in touch soon.'];
  }
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Clock className="h-4 w-4 text-accent" strokeWidth={2} />
        Your next steps
      </div>
      <ul className="space-y-1.5 text-sm text-slate-700">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
