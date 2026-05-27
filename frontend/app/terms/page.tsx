import type { Metadata } from 'next';
import LegalPageShell from '@/components/LegalPageShell';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The agreement between you and Skyzen Technologies for use of the Service.',
};

const LAST_UPDATED = '2026-05-27';

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service ("Terms") govern your use of the Skyzen
        Careers platform ("Service") provided by Skyzen Technologies LLC
        ("Skyzen", "we"). By creating an account or otherwise using the
        Service, you agree to these Terms and to our{' '}
        <a href="/privacy" className="text-accent-dark hover:underline">Privacy Policy</a>.
      </p>

      <Section title="Eligibility">
        <p>
          You must be at least 18 years old and legally able to enter into
          a binding agreement under U.S. law. By registering you represent
          that the information you provide is accurate and that you have
          authority to share it.
        </p>
      </Section>

      <Section title="Your account">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You are responsible for keeping your password confidential and
            for all activity that happens under your account.
          </li>
          <li>
            You must promptly notify us at{' '}
            <a href="mailto:careers@skyzentech.com" className="text-accent-dark hover:underline">
              careers@skyzentech.com
            </a>{' '}
            of any unauthorised access, and revoke any sessions you don't
            recognise from Profile → Active sessions.
          </li>
          <li>
            We may suspend or terminate accounts that violate these Terms,
            misuse the Service, or that we reasonably believe to be
            fraudulent.
          </li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>You agree NOT to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            submit false, misleading, or impersonated information on an
            application, attestation, or compliance form;
          </li>
          <li>
            attempt to access another user's account, data, or sessions;
          </li>
          <li>
            interfere with the operation of the Service or attempt to
            reverse-engineer it;
          </li>
          <li>
            use the Service for purposes other than its intended use —
            searching, applying to, and participating in Skyzen-managed
            internships and engagements.
          </li>
        </ul>
      </Section>

      <Section title="Compliance materials">
        <p>
          When you submit federal employment eligibility documentation
          (I-9, E-Verify, I-983), you acknowledge that you provide it under
          penalty of perjury where indicated, and that Skyzen and the
          staffing entity may share it with government agencies as required
          by federal law.
        </p>
      </Section>

      <Section title="Communications">
        <p>
          We will send transactional emails related to your account and any
          internship engagement (verification codes, password resets, offer
          letters, compliance status). You cannot opt out of these — they
          are required for account safety and legal compliance. You can
          control optional reminders and engagement updates from Profile →
          Notification preferences.
        </p>
      </Section>

      <Section title="Intellectual property">
        <p>
          The Service, including its branding, interface, and underlying
          software, is the intellectual property of Skyzen Technologies LLC.
          We grant you a limited, non-transferable, revocable license to use
          it for the purposes described in these Terms.
        </p>
      </Section>

      <Section title="Disclaimer + limitation">
        <p>
          The Service is provided "as is" without warranty of any kind. To
          the maximum extent permitted by law, Skyzen disclaims all implied
          warranties and is not liable for indirect or consequential damages
          arising from your use of the Service.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these Terms from time to time. Material changes
          will be communicated via email or in-product notice. Your
          continued use of the Service after a change constitutes acceptance
          of the updated Terms; the version stamp at the top of this page
          reflects the current effective version.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These Terms are governed by the laws of the State of Texas, USA,
          without regard to conflict-of-laws principles. Any dispute will
          be brought in the state or federal courts of Collin County,
          Texas.
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
