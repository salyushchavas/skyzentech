'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, GraduationCap, ShieldCheck, UserCircle } from 'lucide-react';
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

  const [acceptedTos, setAcceptedTos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const errorRef = useRef<HTMLDivElement | null>(null);

  // The legacy layout put the error at the top of a tall column, so users
  // had to scroll up to read it after clicking Submit. The error banner now
  // lives next to the submit button, but if the viewport is small we also
  // smooth-scroll it into view on every new error so the user never has to
  // hunt for it.
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

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
    if (!acceptedTos) {
      setError('Please accept the Privacy Policy and Terms of Service to continue.');
      return;
    }

    setLoading(true);
    try {
      const user = await register(
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
        acceptedTos,
      );
      // Phase 1.2 — every fresh registration starts unverified; route to verify.
      // The code is delivered ONLY by email (never round-tripped through the
      // API), so the verify field starts empty and the user types it in.
      if (user.emailVerified === false || user.emailVerified === undefined) {
        const params = new URLSearchParams({ email: user.email });
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
      wide
    >
      <form onSubmit={onSubmit} className="space-y-6">
        {/* Two-column card layout. Each section is its own card so the form
            reads as bite-sized chunks, not one tall scroll. Stacks to a single
            column under sm:. */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Account card — required, anchors the left column. */}
          <Card icon={<UserCircle />} title="Your account" required>
            <Field id="fullName" label="Full name" type="text" value={fullName}
              onChange={setFullName} required autoComplete="name" />
            <Field id="email" label="Email" type="email" value={email}
              onChange={setEmail} required autoComplete="email" />
            <Field id="phoneNumber" label="Phone (optional)" type="tel"
              value={phoneNumber} onChange={setPhoneNumber} autoComplete="tel" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="password" label="Password" type="password"
                value={password} onChange={setPassword} required
                autoComplete="new-password" minLength={8}
                hint="At least 8 characters" />
              <Field id="confirmPassword" label="Confirm" type="password"
                value={confirmPassword} onChange={setConfirmPassword} required
                autoComplete="new-password" />
            </div>
          </Card>

          {/* Education card — top of right column. */}
          <Card
            icon={<GraduationCap />}
            title="Education & skills"
            subtitle="Optional — finish on your profile later"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="school" label="School" type="text" value={school}
                onChange={setSchool} autoComplete="organization" />
              <Field id="degree" label="Degree" type="text" value={degree}
                onChange={setDegree} />
            </div>
            <Field id="education" label="Education summary" type="text"
              value={education} onChange={setEducation}
              placeholder="e.g. BS Computer Science, expected 2027" />
            <div>
              <label htmlFor="skillset"
                className="mb-1 block text-sm font-medium text-gray-700">
                Skills
              </label>
              <textarea
                id="skillset"
                value={skillset}
                onChange={(e) => setSkillset(e.target.value)}
                rows={2}
                placeholder="Comma-separated, e.g. Python, SQL, React"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </Card>

          {/* Work-auth card — spans full width on lg to give the long
              attestation questions breathing room without making the page
              tall on desktop. */}
          <Card
            icon={<ShieldCheck />}
            title="Work authorization"
            subtitle="Your own statement — no documents are collected now"
            className="lg:col-span-2"
          >
            <div className="grid gap-4 lg:grid-cols-2">
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="expectedTrack"
                  className="mb-1 block text-sm font-medium text-gray-700">
                  Expected authorization track
                </label>
                <select
                  id="expectedTrack"
                  value={expectedTrack}
                  onChange={(e) =>
                    setExpectedTrack(e.target.value as WorkAuthTrack | '')
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
                label="Authorization validity date"
                type="date"
                value={validityDate}
                onChange={setValidityDate}
              />
            </div>
          </Card>
        </div>

        {/* Submit footer — ToS checkbox + button + INLINE error.
            Keeping these visually grouped means the error appears right next
            to the action the user just took, so they don't have to scroll
            up looking for it. */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-5">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={acceptedTos}
              onChange={(e) => setAcceptedTos(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-accent focus:ring-accent"
              aria-required="true"
            />
            <span>
              I agree to the{' '}
              <Link
                href="/privacy"
                target="_blank"
                className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
              >
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
              >
                Terms of Service
              </Link>
              .
            </span>
          </label>

          {error && (
            <div
              ref={errorRef}
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={2}
              />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !acceptedTos}
            className="w-full rounded-full bg-gradient-to-r from-accent to-accent-dark px-4 py-2.5 font-semibold text-white shadow-glow-accent transition hover:shadow-glow-accent-lg disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </div>
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

function Card({
  icon,
  title,
  subtitle,
  required,
  className,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        'flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 ' +
        (className ?? '')
      }
    >
      <header className="flex items-start gap-3">
        <span className="rounded-md bg-accent/10 p-1.5 text-accent">
          <span className="block h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">
            {title}
            {required && (
              <span className="ml-1 align-middle text-xs font-medium text-accent-dark">
                required
              </span>
            )}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
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
  hint?: string;
}

function Field(props: FieldProps) {
  return (
    <div>
      <label
        htmlFor={props.id}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {props.label}
        {props.required && <span className="ml-0.5 text-red-500">*</span>}
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
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {props.hint && (
        <p className="mt-1 text-xs text-gray-500">{props.hint}</p>
      )}
    </div>
  );
}
