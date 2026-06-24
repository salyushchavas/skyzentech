'use client';

import MailGuard from './_providers/MailGuard';
import MailClient from './_components/MailClient';

// The /mail home is the three-pane mail client (folders | list | reading pane).
// MailGuard ensures a signed-in, non-pre-change account; MailLayout supplies the
// .ds shell + MailAuthProvider. The full client replaces the S2 home stub.
export default function MailHomePage() {
  return (
    <MailGuard>
      <MailClient />
    </MailGuard>
  );
}
