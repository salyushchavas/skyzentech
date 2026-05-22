'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import type { Uuid, WorkAuthTrack } from '@/types';

interface UserProfileResponse {
  id: Uuid;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  roles: string[] | null;
  // Phase 1.4 intake
  legalName?: string | null;
  preferredName?: string | null;
  education?: string | null;
  school?: string | null;
  degree?: string | null;
  skillset?: string | null;
  // Phase 1.4 neutral self-attestation
  authorizedToWork?: boolean | null;
  sponsorshipNeeded?: boolean | null;
  expectedTrack?: WorkAuthTrack | null;
  validityDate?: string | null;
}

export default function CandidateProfilePage() {
  return (
    <ProtectedRoute requiredRoles={['CANDIDATE']}>
      <DashboardLayout title="Profile">
        <ProfileBody />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function ProfileBody() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api.get<UserProfileResponse>('/api/v1/users/me');
      setProfile(res.data ?? null);
    } catch (err: any) {
      setLoadError(err?.response?.data?.error ?? "Couldn't load your profile.");
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="mb-2">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded border border-red-300 px-3 py-1 font-medium hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (profile === null) {
    return <div className="py-10 text-center text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <ProfileForm profile={profile} onSaved={(p) => setProfile(p)} />
      <ChangePasswordForm />
    </div>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: UserProfileResponse;
  onSaved: (p: UserProfileResponse) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  // Phase 1.4 intake
  const [legalName, setLegalName] = useState(profile.legalName ?? '');
  const [preferredName, setPreferredName] = useState(profile.preferredName ?? '');
  const [school, setSchool] = useState(profile.school ?? '');
  const [degree, setDegree] = useState(profile.degree ?? '');
  const [education, setEducation] = useState(profile.education ?? '');
  const [skillset, setSkillset] = useState(profile.skillset ?? '');
  // Phase 1.4 attestation
  const [authorizedToWork, setAuthorizedToWork] = useState<'' | 'yes' | 'no'>(
    boolToTriState(profile.authorizedToWork),
  );
  const [sponsorshipNeeded, setSponsorshipNeeded] = useState<'' | 'yes' | 'no'>(
    boolToTriState(profile.sponsorshipNeeded),
  );
  const [expectedTrack, setExpectedTrack] = useState<WorkAuthTrack | ''>(
    profile.expectedTrack ?? '',
  );
  const [validityDate, setValidityDate] = useState(profile.validityDate ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        dateOfBirth: dateOfBirth || null,
        legalName: legalName.trim() || null,
        preferredName: preferredName.trim() || null,
        school: school.trim() || null,
        degree: degree.trim() || null,
        education: education.trim() || null,
        skillset: skillset.trim() || null,
        authorizedToWork: triStateToBool(authorizedToWork),
        sponsorshipNeeded: triStateToBool(sponsorshipNeeded),
        expectedTrack: expectedTrack || null,
        validityDate: validityDate || null,
      };
      const res = await api.put<UserProfileResponse>('/api/v1/users/me', body);
      if (res.data) onSaved(res.data);
      toast.success('Profile updated.');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.response?.data?.details?.fields?.fullName ??
        'Could not save your profile.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-lg border border-gray-200 bg-white p-6"
    >
      <header>
        <h2 className="text-lg font-semibold text-gray-900">Personal info</h2>
        <p className="mt-1 text-sm text-gray-600">
          Your name, contact details, and date of birth.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={profile.email ?? ''}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Email is tied to your login and can&apos;t be changed here.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Legal name (optional)</label>
          <input
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="As it appears on official documents"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Preferred name (optional)</label>
          <input
            type="text"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 555 5555"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date of birth</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <fieldset className="space-y-4 border-t border-gray-200 pt-4">
        <legend className="-mb-1 text-base font-semibold text-gray-900">Education &amp; skills</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">School</label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Degree</label>
            <input
              type="text"
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Education summary</label>
          <input
            type="text"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            placeholder="e.g. BS Computer Science, expected 2027"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Skills</label>
          <textarea
            value={skillset}
            onChange={(e) => setSkillset(e.target.value)}
            rows={2}
            placeholder="Comma-separated, e.g. Python, SQL, React"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-gray-200 pt-4">
        <legend className="-mb-1 text-base font-semibold text-gray-900">Work authorization</legend>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Expected work authorization track
            </label>
            <select
              value={expectedTrack}
              onChange={(e) => setExpectedTrack(e.target.value as WorkAuthTrack | '')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Select…</option>
              <option value="CPT">CPT</option>
              <option value="OPT">OPT</option>
              <option value="STEM_OPT">STEM OPT</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Authorization validity date (optional)
            </label>
            <input
              type="date"
              value={validityDate}
              onChange={(e) => setValidityDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      </fieldset>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function boolToTriState(b: boolean | null | undefined): '' | 'yes' | 'no' {
  if (b === true) return 'yes';
  if (b === false) return 'no';
  return '';
}

function triStateToBool(v: '' | 'yes' | 'no'): boolean | null {
  if (v === 'yes') return true;
  if (v === 'no') return false;
  return null;
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

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentPassword || !newPassword) {
      setError('Both current and new passwords are required.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/v1/users/me/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated.');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 400 || status === 401) {
        setError(msg ?? 'Current password is incorrect.');
      } else {
        setError(msg ?? 'Could not update your password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
    >
      <header>
        <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
        <p className="mt-1 text-sm text-gray-600">
          You&apos;ll stay logged in here; use the new password next time you sign in.
        </p>
      </header>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Current password <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              New password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Confirm new password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}
