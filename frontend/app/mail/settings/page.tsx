'use client';

import MailGuard from '../_providers/MailGuard';
import RulesSettings from './_components/RulesSettings';

// Per-account mail settings (inbox rules). Lives in the mail CLIENT settings, not
// /mail/admin — every signed-in account manages its own rules. MailGuard ensures a
// signed-in, non-pre-change account; the shell (header + .ds) comes from MailLayout.
export default function MailSettingsPage() {
  return (
    <MailGuard>
      <RulesSettings />
    </MailGuard>
  );
}
