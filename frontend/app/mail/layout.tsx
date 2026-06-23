import type { ReactNode } from 'react';
import MailAuthProvider from './_providers/MailAuthProvider';
import MailHeader from './_components/MailHeader';

// Standalone shell for the /mail subtree. It does NOT reuse Skyzen's
// DashboardLayout (which carries the careers nav). Root wrapped in `ds` to
// inherit the orange/slate design tokens + Inter font. MailAuthProvider is
// nested HERE (not the root layout) so it only governs /mail. The root layout's
// AuthProvider/IdleTimeoutProvider still wrap this subtree but are inert for a
// mail-only visitor (Skyzen user == null), so no neutralization is needed.
export default function MailLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ds min-h-screen bg-slate-50 text-slate-900">
      <MailAuthProvider>
        <MailHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      </MailAuthProvider>
    </div>
  );
}
