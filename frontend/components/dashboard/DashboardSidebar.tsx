'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  CalendarClock,
  ClipboardList,
  FileSignature,
  FileText,
  FolderArchive,
  Hammer,
  HelpCircle,
  Home,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Star,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/types';

interface StaffLink {
  icon: LucideIcon;
  label: string;
  href: string;
}

// Six-role taxonomy. INTERN's 12-item sidebar is the doc-specified order from
// the Applicant-to-Intern Lifecycle spec. The other five roles will get their
// sub-nav filled in by per-role prompts; each is a single landing entry today.
const STAFF_ROLE_LINKS: Record<UserRole, StaffLink[]> = {
  INTERN: [
    { icon: Home,           label: 'Home',              href: '/careers/intern' },
    { icon: Briefcase,      label: 'Job Postings',      href: '/careers/intern/jobs' },
    { icon: ListChecks,     label: 'My Applications',   href: '/careers/intern/applications' },
    { icon: Video,          label: 'Interview Center',  href: '/careers/intern/interviews' },
    { icon: FileSignature,  label: 'Offer Letter',      href: '/careers/intern/offer' },
    { icon: ClipboardList,  label: 'Onboarding',        href: '/careers/intern/onboarding' },
    { icon: FolderArchive,  label: 'My Projects',       href: '/careers/intern/projects' },
    { icon: Hammer,         label: 'Timesheets',        href: '/careers/intern/timesheets' },
    { icon: Star,           label: 'Evaluations',       href: '/careers/intern/evaluations' },
    { icon: FileText,       label: 'Documents',         href: '/careers/intern/documents' },
    { icon: MessagesSquare, label: 'Messages',          href: '/careers/intern/messages' },
    { icon: HelpCircle,     label: 'Help',              href: '/careers/intern/help' },
  ],
  TRAINER: [
    { icon: LayoutDashboard, label: 'Trainer Dashboard', href: '/careers/trainer' },
  ],
  REPORTING_MANAGER: [
    { icon: LayoutDashboard, label: 'Reporting Manager Dashboard', href: '/careers/reporting-manager' },
  ],
  MANAGER: [
    { icon: LayoutDashboard, label: 'Manager Dashboard', href: '/careers/manager' },
  ],
  ERM: [
    { icon: LayoutDashboard, label: 'ERM Dashboard', href: '/careers/erm' },
  ],
  SUPER_ADMIN: [
    { icon: LayoutDashboard, label: 'Super Admin Dashboard', href: '/careers/admin' },
  ],
};

function pickActiveByRoute(pathname: string, routes: string[]): string | null {
  const matches = routes
    .filter((r) => pathname === r || pathname.startsWith(r + '/'))
    .sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}

interface Props {
  onNavigate?: () => void;
}

export default function DashboardSidebar({ onNavigate }: Props) {
  const pathname = usePathname() ?? '';
  const { user } = useAuth();

  // Pick the first role with a defined sidebar. Users with multiple roles
  // (rare) land on the first match in the declared role order.
  const activeRole = useMemo<UserRole | null>(() => {
    const roles = user?.roles ?? [];
    for (const r of roles) {
      if (r in STAFF_ROLE_LINKS) return r;
    }
    return null;
  }, [user?.roles]);

  const links = activeRole ? STAFF_ROLE_LINKS[activeRole] : null;

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link
        href="/careers"
        onClick={onNavigate}
        className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/skyzen-logo.png" alt="Skyzen" className="h-7 w-auto" />
        <span className="text-sm font-semibold text-slate-900">Careers</span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {links ? (
          <StaffNav links={links} pathname={pathname} onNavigate={onNavigate} />
        ) : (
          <SidebarSkeleton rows={4} />
        )}
      </div>

      <div className="border-t border-slate-200 px-3 py-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="block rounded-md px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          ← Back to main site
        </Link>
      </div>
    </nav>
  );
}

function StaffNav({
  links,
  pathname,
  onNavigate,
}: {
  links: StaffLink[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const activeHref = pickActiveByRoute(
    pathname,
    links.map((l) => l.href),
  );
  return (
    <ul className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon;
        const active = link.href === activeHref;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              className={
                'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 '
                + (active
                  ? 'bg-slate-100 text-slate-900 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r before:bg-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
              }
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="h-9 animate-pulse rounded-md bg-slate-100"
          aria-hidden
        />
      ))}
    </ul>
  );
}
