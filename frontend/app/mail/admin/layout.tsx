import type { ReactNode } from 'react';
import MailAdminGuard from './_components/MailAdminGuard';
import AdminNav from './_components/AdminNav';

// Admin area shell. Nested under MailLayout (the .ds shell + MailAuthProvider),
// so it inherits the design tokens and mail session. MailAdminGuard enforces
// signed-in + ADMIN/SUPER_ADMIN before any admin page renders.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <MailAdminGuard>
      <div className="space-y-6">
        <AdminNav />
        {children}
      </div>
    </MailAdminGuard>
  );
}
