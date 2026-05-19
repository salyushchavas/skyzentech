'use client';

import { useState } from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardTopbar from './DashboardTopbar';

interface Props {
  children: React.ReactNode;
  title?: string;
}

export default function DashboardLayout({ children, title }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar — always visible at lg+ */}
      <aside className="hidden lg:flex">
        <DashboardSidebar />
      </aside>

      {/* Mobile sidebar — slides in over content */}
      <aside
        className={
          'fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-out lg:hidden ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <DashboardSidebar onNavigate={() => setOpen(false)} />
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardTopbar title={title} onMenuClick={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
