'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Card,
  CardHeader,
  PageHeader,
  Skeleton,
  StatusPill,
  Banner,
} from '@/components/ui';

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
        else if (status === 404) setError('Interview not found.');
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
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }
  if (error) {
    return (
      <Banner variant="danger" title="Couldn't open this interview" description={error} />
    );
  }
  if (!data) return null;

  const isCompleted = data.status === 'COMPLETED' && !!data.completedAt;

  return (
    <section className="space-y-6">
      <Link
        href="/careers/candidate"
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2.5} />
        Back to dashboard
      </Link>

      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', href: '/careers/candidate' },
          { label: 'Interviews' },
          { label: data.jobPostingTitle ?? 'Interview' },
        ]}
        title={data.jobPostingTitle ?? 'Interview detail'}
        meta={
          <>
            {data.interviewerName && (
              <span className="text-xs text-slate-600">
                With <span className="font-medium text-slate-800">{data.interviewerName}</span>
              </span>
            )}
            {data.scheduledAt && (
              <span className="text-xs text-slate-600">
                Scheduled {new Date(data.scheduledAt).toLocaleString()}
              </span>
            )}
            {isCompleted && (
              <StatusPill status="COMPLETED" icon={CheckCircle2} />
            )}
          </>
        }
      />

      <Card>
        <CardHeader
          title="What we discussed"
          subtitle="Topics covered with the panel. Individual scores and reviewer notes are not shared here."
        />
        <p className="text-sm text-slate-700">
          Your interview covered topics relevant to {data.jobPostingTitle ?? 'this role'}. Panel
          members may include the hiring manager and technical reviewers. Specific scores stay
          with the hiring team.
        </p>
      </Card>

      <WhatHappensNext outcome={data.outcomeCategory} completed={isCompleted} />

      {isCompleted && <YourNextSteps outcome={data.outcomeCategory} />}
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
  let variant: 'info' | 'success' | 'warning' | 'danger' = 'info';
  if (!completed) {
    body =
      'Once the interview is complete, the team will leave feedback and you’ll receive an update here within a few business days.';
  } else if (outcome === 'HIRE') {
    variant = 'success';
    body =
      'Expect to receive a conditional employment confirmation email within 2–3 business days. Once accepted, you’ll move into the offer + onboarding stage.';
  } else if (outcome === 'HOLD') {
    variant = 'warning';
    body =
      "We're reviewing all candidates. You'll hear from us within 5 business days.";
  } else if (outcome === 'REJECT') {
    variant = 'info';
    body =
      "We've decided not to proceed at this time. Detailed feedback may be shared separately by email.";
  } else {
    body = 'Your interview has been completed. The team will update your application status shortly.';
  }
  return (
    <Card variant="accent" accent={variant === 'success' ? 'success' : variant === 'warning' ? 'warning' : 'info'}>
      <CardHeader title={title} eyebrow={<><Sparkles className="mr-1 inline h-3 w-3" /> Outcome</>} />
      <p className="text-sm text-slate-700">{body}</p>
    </Card>
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
      'Continue applying to other roles in the meantime.',
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
    <Card>
      <CardHeader title="Your next steps" eyebrow={<><Clock className="mr-1 inline h-3 w-3" /> Action</>} />
      <ul className="space-y-1.5 text-sm text-slate-700">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-500" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
