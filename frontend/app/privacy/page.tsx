import type { Metadata } from 'next';
import LegalPageShell from '@/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Skyzen Technologies collects, uses, and protects your data.',
};

const LAST_UPDATED = '2026-05-27';

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        Skyzen Technologies LLC ("Skyzen", "we", "our") provides the Skyzen
        Careers platform — the application portal and intern workspace at{' '}
        <a href="https://www.skyzentech.com" className="text-accent-dark hover:underline">
          skyzentech.com
        </a>{' '}
        ("Service"). This Privacy Policy explains what information we collect
        when you use the Service, how we use it, and the choices you have.
      </p>

      <Section title="Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account information</strong> — name, email address, phone
            number, password (stored hashed), and a Skyzen Applicant ID issued
            after verification.
          </li>
          <li>
            <strong>Application profile</strong> — education, skills, work-
            authorization self-attestation (CPT / OPT / STEM OPT track), and
            any optional fields you choose to provide.
          </li>
          <li>
            <strong>Application activity</strong> — internships you applied
            for, interview scheduling, offer status, project submissions,
            weekly reports, and timesheets.
          </li>
          <li>
            <strong>Compliance records (post-offer only)</strong> — I-9 form
            data, E-Verify case identifiers, and I-983 training plan data when
            you are on the STEM OPT track. Sensitive identifiers (SSN, document
            numbers) are stored encrypted at rest and never appear in email or
            other outbound communications.
          </li>
          <li>
            <strong>Session metadata</strong> — IP address, browser
            User-Agent, login timestamps, and an opaque session token hash for
            session management.
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>We use this information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>operate your account and route your application;</li>
          <li>
            verify federal employment eligibility (I-9 / E-Verify) when
            required;
          </li>
          <li>
            send transactional email — verification codes, password resets,
            offers, compliance alerts — which you cannot opt out of for
            account-safety reasons;
          </li>
          <li>
            send optional reminders and engagement updates, which you can
            disable any time from your Profile → Notification preferences;
          </li>
          <li>
            improve the Service by analysing aggregate usage patterns (no
            third-party advertising trackers).
          </li>
        </ul>
      </Section>

      <Section title="Sharing">
        <p>
          We do not sell personal information. We share information only as
          needed to operate the Service:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            with the staffing entity considering your application
            (recruiters, HR, your assigned supervisor);
          </li>
          <li>
            with government agencies that require it for employment
            eligibility verification (USCIS / SAVE for E-Verify, the SEVP
            DSO for I-983 plans);
          </li>
          <li>
            with infrastructure providers strictly bound by data-processing
            agreements (cloud hosting, transactional email delivery).
          </li>
        </ul>
      </Section>

      <Section title="Retention">
        <p>
          We retain account data while your account is active. Compliance
          records (I-9, I-983, E-Verify) are retained for the periods
          required by federal law (typically three years from hire, one year
          past termination, whichever is later). You can request deletion of
          non-compliance data by contacting us; legally-required records
          cannot be deleted on request.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Passwords are hashed with bcrypt; refresh tokens are stored hashed
          (SHA-256); sensitive document fields are encrypted at rest. All
          traffic uses HTTPS. We log access to compliance data via an audit
          log accessible to authorised compliance staff.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can access, correct, or download your profile from your Profile
          page. You can revoke individual sessions or sign out everywhere from
          Profile → Active sessions. To request deletion of data not retained
          for legal reasons, email{' '}
          <a href="mailto:careers@skyzentech.com" className="text-accent-dark hover:underline">
            careers@skyzentech.com
          </a>
          .
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Skyzen Technologies LLC, 5465 Legacy Drive, Suite 650, Plano, TX
          75024.
          <br />
          Email:{' '}
          <a href="mailto:careers@skyzentech.com" className="text-accent-dark hover:underline">
            careers@skyzentech.com
          </a>
        </p>
      </Section>
    </LegalPageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-2 space-y-3 text-gray-700">{children}</div>
    </section>
  );
}
