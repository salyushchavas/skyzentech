'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import api from '@/lib/api';
import InternPageShell from '@/components/intern/InternPageShell';

interface PacketItem {
  id: string;
  category: string;
  required: boolean;
  status: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'RESEND_REQUESTED';
  ermComments?: string | null;
  version: number;
  submittedAt?: string | null;
}

interface PacketResponse {
  items: PacketItem[];
}

type FormShape = Record<string, string | boolean | number | undefined>;

const CATEGORY_TITLE: Record<string, string> = {
  W4: 'W-4 Tax Withholding',
  I9: 'I-9 Section 1 (Employee Information)',
  ACH: 'Direct Deposit Authorization (ACH)',
  EMERGENCY_CONTACT: 'Emergency Contact',
  HANDBOOK_ACK: 'Employee Handbook Acknowledgment',
  I983: 'I-983 Training Plan (Student Section)',
};

export default function OnboardingItemPage() {
  const router = useRouter();
  const params = useParams<{ itemId: string }>();
  const itemId = params?.itemId;

  const [item, setItem] = useState<PacketItem | null>(null);
  const [form, setForm] = useState<FormShape>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      // Pull packet for the item metadata + the item-specific form pre-fill.
      const [packetRes, itemRes] = await Promise.all([
        api.get<PacketResponse>('/api/v1/onboarding/packet'),
        api.get<{ itemId: string; formData: FormShape }>(`/api/v1/onboarding/items/${itemId}`),
      ]);
      const found = packetRes.data.items.find((i) => i.id === itemId) ?? null;
      setItem(found);
      setForm(itemRes.data.formData ?? {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load item');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!item) return;
    setSubmitting(true);
    setErr(null);
    try {
      await api.post(`/api/v1/onboarding/items/${item.id}/submit`, form);
      router.push('/careers/intern/onboarding');
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string; message?: string } } };
      setErr(ax.response?.data?.error
        ?? ax.response?.data?.message
        ?? (e instanceof Error ? e.message : 'Submission failed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <InternPageShell title="Onboarding item">
        <div className="h-48 animate-pulse rounded-lg bg-slate-50" aria-hidden />
      </InternPageShell>
    );
  }
  if (!item) {
    return (
      <InternPageShell title="Onboarding item">
        <p className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Item not found.
        </p>
      </InternPageShell>
    );
  }

  const title = CATEGORY_TITLE[item.category] ?? item.category;
  const readOnly = item.status === 'SUBMITTED' || item.status === 'ACCEPTED';

  return (
    <InternPageShell title={title}>
      <Link
        href="/careers/intern/onboarding"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        Back to Onboarding
      </Link>

      {(item.status === 'REJECTED' || item.status === 'RESEND_REQUESTED') && item.ermComments && (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="mb-1 inline-flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
            ERM feedback
          </div>
          <p className="whitespace-pre-wrap">{item.ermComments}</p>
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {item.category === 'W4' && <W4Fields form={form} setForm={setForm} readOnly={readOnly} />}
        {item.category === 'I9' && <I9Fields form={form} setForm={setForm} readOnly={readOnly} />}
        {item.category === 'ACH' && <AchFields form={form} setForm={setForm} readOnly={readOnly} />}
        {item.category === 'EMERGENCY_CONTACT' && <EmergencyContactFields form={form} setForm={setForm} readOnly={readOnly} />}
        {item.category === 'HANDBOOK_ACK' && <HandbookAckFields form={form} setForm={setForm} readOnly={readOnly} />}
        {item.category === 'I983' && <I983Fields form={form} setForm={setForm} readOnly={readOnly} />}

        {err && (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            {err}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5">
          <Link
            href="/careers/intern/onboarding"
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          {!readOnly && (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
          {readOnly && (
            <span className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-500">
              Already submitted
            </span>
          )}
        </div>
      </section>
    </InternPageShell>
  );
}

// ── Field groups (kept compact — full per-form polish can come later). ───────

interface FieldProps {
  form: FormShape;
  setForm: (next: FormShape) => void;
  readOnly: boolean;
}

function set<K extends string>(form: FormShape, setForm: (n: FormShape) => void, key: K) {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [key]: e.target.value });
  };
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Input({ value, onChange, disabled, type = 'text', placeholder }: {
  value: string | number | undefined;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
    />
  );
}

function Select({ value, onChange, disabled, options }: {
  value: string | undefined;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
    >
      <option value="" disabled>Select…</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function W4Fields({ form, setForm, readOnly }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full legal name" required>
        <Input value={form.fullName as string} onChange={set(form, setForm, 'fullName')} disabled={readOnly} />
      </Field>
      <Field label="SSN" required>
        <Input value={form.ssn as string} onChange={set(form, setForm, 'ssn')} disabled={readOnly} placeholder="9 digits, no dashes" />
      </Field>
      <Field label="Address line 1" required>
        <Input value={form.addressLine1 as string} onChange={set(form, setForm, 'addressLine1')} disabled={readOnly} />
      </Field>
      <Field label="Address line 2">
        <Input value={form.addressLine2 as string} onChange={set(form, setForm, 'addressLine2')} disabled={readOnly} />
      </Field>
      <Field label="City" required>
        <Input value={form.city as string} onChange={set(form, setForm, 'city')} disabled={readOnly} />
      </Field>
      <Field label="State" required>
        <Input value={form.state as string} onChange={set(form, setForm, 'state')} disabled={readOnly} placeholder="2-letter" />
      </Field>
      <Field label="ZIP" required>
        <Input value={form.zip as string} onChange={set(form, setForm, 'zip')} disabled={readOnly} />
      </Field>
      <Field label="Filing status" required>
        <Select
          value={form.filingStatus as string}
          onChange={set(form, setForm, 'filingStatus')}
          disabled={readOnly}
          options={[
            { value: 'SINGLE', label: 'Single' },
            { value: 'MARRIED_JOINT', label: 'Married filing jointly' },
            { value: 'HEAD_OF_HOUSEHOLD', label: 'Head of household' },
          ]}
        />
      </Field>
      <Field label="Typed signature (legal name)" required>
        <Input value={form.signatureName as string} onChange={set(form, setForm, 'signatureName')} disabled={readOnly} />
      </Field>
      <Field label="Signature date" required>
        <Input value={form.signatureDate as string} onChange={set(form, setForm, 'signatureDate')} disabled={readOnly} type="date" />
      </Field>
    </div>
  );
}

function I9Fields({ form, setForm, readOnly }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Legal first name" required>
        <Input value={form.legalFirstName as string} onChange={set(form, setForm, 'legalFirstName')} disabled={readOnly} />
      </Field>
      <Field label="Legal last name" required>
        <Input value={form.legalLastName as string} onChange={set(form, setForm, 'legalLastName')} disabled={readOnly} />
      </Field>
      <Field label="Date of birth" required>
        <Input value={form.dob as string} onChange={set(form, setForm, 'dob')} disabled={readOnly} type="date" />
      </Field>
      <Field label="SSN">
        <Input value={form.ssn as string} onChange={set(form, setForm, 'ssn')} disabled={readOnly} placeholder="9 digits" />
      </Field>
      <Field label="Email" required>
        <Input value={form.email as string} onChange={set(form, setForm, 'email')} disabled={readOnly} type="email" />
      </Field>
      <Field label="Phone">
        <Input value={form.phone as string} onChange={set(form, setForm, 'phone')} disabled={readOnly} />
      </Field>
      <Field label="Citizenship status" required>
        <Select
          value={form.citizenshipStatus as string}
          onChange={set(form, setForm, 'citizenshipStatus')}
          disabled={readOnly}
          options={[
            { value: 'US_CITIZEN', label: 'U.S. Citizen' },
            { value: 'NON_CITIZEN_NATIONAL', label: 'Non-citizen national' },
            { value: 'LAWFUL_PERMANENT_RESIDENT', label: 'Lawful permanent resident' },
            { value: 'ALIEN_AUTHORIZED', label: 'Alien authorized to work' },
          ]}
        />
      </Field>
      <Field label="Typed signature (legal name)" required>
        <Input value={form.employeeSignatureName as string} onChange={set(form, setForm, 'employeeSignatureName')} disabled={readOnly} />
      </Field>
      <Field label="Signature date" required>
        <Input value={form.employeeSignatureDate as string} onChange={set(form, setForm, 'employeeSignatureDate')} disabled={readOnly} type="date" />
      </Field>
    </div>
  );
}

function AchFields({ form, setForm, readOnly }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Account holder name" required>
        <Input value={form.accountHolderName as string} onChange={set(form, setForm, 'accountHolderName')} disabled={readOnly} />
      </Field>
      <Field label="Bank name" required>
        <Input value={form.bankName as string} onChange={set(form, setForm, 'bankName')} disabled={readOnly} />
      </Field>
      <Field label="Account type" required>
        <Select
          value={form.accountType as string}
          onChange={set(form, setForm, 'accountType')}
          disabled={readOnly}
          options={[
            { value: 'CHECKING', label: 'Checking' },
            { value: 'SAVINGS', label: 'Savings' },
          ]}
        />
      </Field>
      <Field label="Routing number" required>
        <Input value={form.routingNumber as string} onChange={set(form, setForm, 'routingNumber')} disabled={readOnly} placeholder="9 digits" />
      </Field>
      <Field label="Account number" required>
        <Input value={form.accountNumber as string} onChange={set(form, setForm, 'accountNumber')} disabled={readOnly} placeholder="4-17 digits" />
      </Field>
      <Field label="Authorization signature" required>
        <Input value={form.authorizationSignatureName as string} onChange={set(form, setForm, 'authorizationSignatureName')} disabled={readOnly} />
      </Field>
      <Field label="Authorization date" required>
        <Input value={form.authorizationDate as string} onChange={set(form, setForm, 'authorizationDate')} disabled={readOnly} type="date" />
      </Field>
      <div className="sm:col-span-2">
        <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          I authorize Skyzen Tech to deposit my net pay into the account above
          and, if necessary, to debit it to correct an erroneous credit.
        </p>
      </div>
    </div>
  );
}

function EmergencyContactFields({ form, setForm, readOnly }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Contact name" required>
        <Input value={form.contactName as string} onChange={set(form, setForm, 'contactName')} disabled={readOnly} />
      </Field>
      <Field label="Relationship" required>
        <Select
          value={form.relationship as string}
          onChange={set(form, setForm, 'relationship')}
          disabled={readOnly}
          options={[
            { value: 'SPOUSE', label: 'Spouse' },
            { value: 'PARENT', label: 'Parent' },
            { value: 'SIBLING', label: 'Sibling' },
            { value: 'CHILD', label: 'Child' },
            { value: 'FRIEND', label: 'Friend' },
            { value: 'OTHER', label: 'Other' },
          ]}
        />
      </Field>
      <Field label="Primary phone" required>
        <Input value={form.phonePrimary as string} onChange={set(form, setForm, 'phonePrimary')} disabled={readOnly} />
      </Field>
      <Field label="Secondary phone">
        <Input value={form.phoneSecondary as string} onChange={set(form, setForm, 'phoneSecondary')} disabled={readOnly} />
      </Field>
      <Field label="Email">
        <Input value={form.email as string} onChange={set(form, setForm, 'email')} disabled={readOnly} type="email" />
      </Field>
      <Field label="Address line 1">
        <Input value={form.addressLine1 as string} onChange={set(form, setForm, 'addressLine1')} disabled={readOnly} />
      </Field>
    </div>
  );
}

function HandbookAckFields({ form, setForm, readOnly }: FieldProps) {
  const acknowledged = form.acknowledged === true;
  return (
    <div className="space-y-4">
      <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
        <p className="mb-2 font-semibold">Skyzen Tech Employee Handbook — 2026 Edition</p>
        <p>This handbook outlines the policies, procedures, and expectations that govern your employment at Skyzen Tech. By signing below, you acknowledge that you have read, understood, and agree to abide by these policies in full.</p>
        <p className="mt-2 text-slate-500">A complete copy is available in your Documents vault.</p>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setForm({ ...form, acknowledged: e.target.checked })}
          disabled={readOnly}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
        />
        I have read and agree to abide by the Skyzen Tech Employee Handbook.
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Typed signature" required>
          <Input value={form.signatureName as string} onChange={set(form, setForm, 'signatureName')} disabled={readOnly} />
        </Field>
        <Field label="Signature date" required>
          <Input value={form.signatureDate as string} onChange={set(form, setForm, 'signatureDate')} disabled={readOnly} type="date" />
        </Field>
      </div>
    </div>
  );
}

function I983Fields({ form, setForm, readOnly }: FieldProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Training opportunity title" required>
        <Input value={form.trainingOpportunityTitle as string} onChange={set(form, setForm, 'trainingOpportunityTitle')} disabled={readOnly} />
      </Field>
      <Field label="School / institution">
        <Input value={form.schoolName as string} onChange={set(form, setForm, 'schoolName')} disabled={readOnly} />
      </Field>
      <Field label="Plan start date" required>
        <Input value={form.planStartDate as string} onChange={set(form, setForm, 'planStartDate')} disabled={readOnly} type="date" />
      </Field>
      <Field label="Plan end date" required>
        <Input value={form.planEndDate as string} onChange={set(form, setForm, 'planEndDate')} disabled={readOnly} type="date" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Learning objectives">
          <textarea
            value={(form.learningObjectives as string) ?? ''}
            onChange={set(form, setForm, 'learningObjectives')}
            disabled={readOnly}
            rows={4}
            className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </Field>
      </div>
    </div>
  );
}
