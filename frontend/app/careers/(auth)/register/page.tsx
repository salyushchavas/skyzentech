'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/dashboard/AuthLayout';
import { useAuth } from '@/lib/auth-context';
import type { WorkAuthTrack } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  // Core auth fields.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Phase 1.4 intake.
  const [skillset, setSkillset] = useState('');
  const [school, setSchool] = useState('');
  const [degree, setDegree] = useState('');
  const [education, setEducation] = useState('');

  // Phase 1.4 neutral self-attestation. tri-state strings ('' = unanswered,
  // 'yes' / 'no') so the radio group reflects "not answered yet" correctly.
  const [authorizedToWork, setAuthorizedToWork] = useState<'' | 'yes' | 'no'>('');
  const [sponsorshipNeeded, setSponsorshipNeeded] = useState<'' | 'yes' | 'no'>('');
  const [expectedTrack, setExpectedTrack] = useState<WorkAuthTrack | ''>('');
  const [validityDate, setValidityDate] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { user, devVerificationCode } = await register(
        email,
        password,
        fullName,
        phoneNumber || undefined,
        {
          // Trim + drop blanks so the backend stores null instead of "".
          skillset: skillset.trim() || undefined,
          school: school.trim() || undefined,
          degree: degree.trim() || undefined,
          education: education.trim() || undefined,
          authorizedToWork: triStateToBool(authorizedToWork),
          sponsorshipNeeded: triStateToBool(sponsorshipNeeded),
          expectedTrack: expectedTrack || undefined,
          validityDate: validityDate || undefined,
        },
      );
      // Phase 1.2 — every fresh registration starts unverified; route to verify.
      if (user.emailVerified === false || user.emailVerified === undefined) {
        const params = new URLSearchParams({ email: user.email });
        if (devVerificationCode) params.set('devCode', devVerificationCode);
        const returnTo = safeReturnTo();
        if (returnTo) params.set('returnTo', returnTo);
        router.replace(`/careers/verify-email?${params.toString()}`);
        return;
      }
      const returnTo = safeReturnTo();
      router.replace(returnTo ?? '/careers/candidate');
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function safeReturnTo(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('returnTo');
    if (!raw) return null;
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
    return decoded;
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Apply to STEM internships in minutes"
    >
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <SectionLabel>Your account</SectionLabel>
        <Field id="fullName" label="Full name" type="text" value={fullName} onChange={setFullName} required autoComplete="name" />
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Field id="phoneNumber" label="Phone (optional)" type="tel" value={phoneNumber} onChange={setPhoneNumber} autoComplete="tel" />
        <Field id="password" label="Password (min 8 characters)" type="password" value={password} onChange={setPassword} required autoComplete="new-password" minLength={8} />
        <Field id="confirmPassword" label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} required autoComplete="new-password" />

        <SectionLabel>Education &amp; skills</SectionLabel>
        <p className="text-xs text-gray-500">All optional — you can finish these on your profile later.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="school" label="School" type="text" value={school} onChange={setSchool} autoComplete="organization" />
          <Field id="degree" label="Degree" type="text" value={degree} onChange={setDegree} />
        </div>
        <Field id="education" label="Education summary" type="text" value={education} onChange={setEducation} placeholder="e.g. BS Computer Science, expected 2027" />
        <div>
          <label htmlFor="skillset" className="mb-1 block text-sm font-medium text-gray-700">
            Skills
          </label>
          <textarea
            id="skillset"
            value={skillset}
            onChange={(e) => setSkillset(e.target.value)}
            rows={2}
            placeholder="Comma-separated, e.g. Python, SQL, React"
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <SectionLabel>Work authorization (self-attestation)</SectionLabel>
        {/* Compliance helper — NO documents are collected pre-offer. */}
        <p className="text-xs text-gray-500">
          We collect only your own statement here. Documents are <strong>not</strong>{' '}
          collected now; any required documents come after an offer.
        </p>

        <YesNo
          label="Are you currently authorized to work in the United States?"
          value={authorizedToWork}
          onChange={setAuthorizedToWork}
          name="authorizedToWork"
        />

        <YesNo
          label="Will you now or in the future require employment sponsorship?"
          value={sponsorshipNeeded}
          onChange={setSponsorshipNeeded}
          name="sponsorshipNeeded"
        />

        <div>
          <label htmlFor="expectedTrack" className="mb-1 block text-sm font-medium text-gray-700">
            Expected work authorization track
          </label>
          <select
            id="expectedTrack"
            value={expectedTrack}
            onChange={(e) => setExpectedTrack(e.target.value as WorkAuthTrack | '')}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Select…</option>
            <option value="CPT">CPT</option>
            <option value="OPT">OPT</option>
            <option value="STEM_OPT">STEM OPT</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <Field
          id="validityDate"
          label="Authorization validity date (optional)"
          type="date"
          value={validityDate}
          onChange={setValidityDate}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-gradient-to-r from-accent to-accent-dark px-4 py-2.5 font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <div className="mt-6 text-center text-sm">
        <Link
          href="/careers/login"
          className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
        >
          Already have an account? Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

function triStateToBool(v: '' | 'yes' | 'no'): boolean | undefined {
  if (v === 'yes') return true;
  if (v === 'no') return false;
  return undefined;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-2 border-b border-gray-200 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
      {children}
    </h3>
  );
}

function YesNo({
  label,
  value,
  onChange,
  name,
}: {
  label: string;
  value: '' | 'yes' | 'no';
  onChange: (v: '' | 'yes' | 'no') => void;
  name: string;
}) {
  return (
    <div>
      <p className="mb-1.5 block text-sm font-medium text-gray-700">{label}</p>
      <div className="flex gap-3">
        {(['yes', 'no'] as const).map((opt) => (
          <label
            key={opt}
            className={
              'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ' +
              (value === opt
                ? 'border-accent bg-accent/5 text-accent-dark'
                : 'border-gray-300 bg-white hover:bg-gray-50')
            }
          >
            <input
              type="radio"
              name={name}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="h-4 w-4 text-accent focus:ring-accent"
            />
            {opt === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
}

function Field(props: FieldProps) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1 block text-sm font-medium text-gray-700">
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type}
        required={props.required}
        autoComplete={props.autoComplete}
        minLength={props.minLength}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}
