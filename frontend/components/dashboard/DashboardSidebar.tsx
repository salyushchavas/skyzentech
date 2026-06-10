'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  ClipboardCheck,
  FileSignature,
  FileText,
  FolderArchive,
  Hammer,
  HelpCircle,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  MessagesSquare,
  Package,
  Settings,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  useInternDashboardOptional,
  type InternModulesMap,
} from '@/components/intern/InternDashboardContext';
import type { UserRole } from '@/types';

interface StaffLink {
  icon: LucideIcon;
  label: string;
  href: string;
  /**
   * Key into {@link InternModulesMap}. Only INTERN links carry this; staff
   * links omit it and always render plain.
   */
  moduleKey?: keyof InternModulesMap;
}

// Six-role taxonomy. INTERN's 12-item sidebar is the doc-specified order from
// the Applicant-to-Intern Lifecycle spec. The other five roles will get their
// sub-nav filled in by per-role prompts; each is a single landing entry today.
const STAFF_ROLE_LINKS: Record<UserRole, StaffLink[]> = {
  INTERN: [
    { icon: Home,           label: 'Home',              href: '/careers/intern',             moduleKey: 'home' },
    { icon: Briefcase,      label: 'Job Postings',      href: '/careers/intern/jobs',        moduleKey: 'jobPostings' },
    { icon: ListChecks,     label: 'My Applications',   href: '/careers/intern/applications', moduleKey: 'myApplications' },
    { icon: Video,          label: 'Interview Center',  href: '/careers/intern/interviews',  moduleKey: 'interviewCenter' },
    { icon: FileSignature,  label: 'Offer Letter',      href: '/careers/intern/offer',       moduleKey: 'offerLetter' },
    { icon: FolderArchive,  label: 'My Projects',       href: '/careers/intern/projects',    moduleKey: 'myProjects' },
    { icon: Hammer,         label: 'Timesheets',        href: '/careers/intern/timesheets',  moduleKey: 'timesheets' },
    { icon: Star,           label: 'Evaluations',       href: '/careers/intern/evaluations', moduleKey: 'evaluations' },
    { icon: FileText,       label: 'Documents',         href: '/careers/intern/documents',   moduleKey: 'documents' },
    { icon: MessagesSquare, label: 'Messages',          href: '/careers/intern/messages',    moduleKey: 'messages' },
    { icon: HelpCircle,     label: 'Help',              href: '/careers/intern/help',        moduleKey: 'help' },
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
  // ERM Control Dashboard doc — 14 items in exact order.
  ERM: [
    { icon: Home,           label: 'Home',                 href: '/careers/erm' },
    { icon: Inbox,          label: 'Application Inbox',    href: '/careers/erm/applications' },
    { icon: ListChecks,     label: 'Shortlist Queue',      href: '/careers/erm/shortlist' },
    { icon: Video,          label: 'Interviews',           href: '/careers/erm/interviews' },
    { icon: FileSignature,  label: 'Offers / DocuSign',    href: '/careers/erm/offers' },
    { icon: UserPlus,       label: 'New Hire List',        href: '/careers/erm/new-hire' },
    { icon: Package,        label: 'Document Packets',     href: '/careers/erm/document-packets' },
    { icon: ClipboardCheck, label: 'Review Queue',         href: '/careers/erm/document-review' },
    { icon: ShieldCheck,    label: 'I-9 / E-Verify Tracker', href: '/careers/erm/compliance' },
    { icon: Users,          label: 'Active Interns',       href: '/careers/erm/active-interns' },
    { icon: Hammer,         label: 'Timesheets',           href: '/careers/erm/timesheets' },
    { icon: AlertTriangle,  label: 'Escalations',          href: '/careers/erm/escalations' },
    { icon: LogOut,         label: 'Exit / Inactivate',    href: '/careers/erm/exits' },
    { icon: BarChart3,      label: 'Reports',              href: '/careers/erm/reports' },
    { icon: Settings,       label: 'Settings',             href: '/careers/erm/settings' },
  ],
  SUPER_ADMIN: [
    { icon: LayoutDashboard, label: 'Super Admin Dashboard', href: '/careers/admin' },
  ],
};

// Mode that "unlocks" each module — used for the lock-tooltip copy. Falls
// back to a generic message for keys that have no single unlocking mode.
const MODULE_UNLOCK_MODE: Partial<Record<keyof InternModulesMap, string>> = {
  jobPostings: 'Applicant',
  interviewCenter: 'Interview',
  offerLetter: 'Offer',
  onboarding: 'New Hire',
  myProjects: 'Active Intern',
  timesheets: 'Active Intern',
  evaluations: 'Active Intern',
  messages: 'Applicant',
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
  const internDashboard = useInternDashboardOptional();
  const internModules = internDashboard?.data?.modules ?? null;

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
          <StaffNav
            links={links}
            pathname={pathname}
            onNavigate={onNavigate}
            internModules={internModules}
          />
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
  internModules,
}: {
  links: StaffLink[];
  pathname: string;
  onNavigate?: () => void;
  internModules: InternModulesMap | null;
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
        const moduleState = link.moduleKey && internModules
          ? internModules[link.moduleKey]
          : null;

        if (moduleState && !moduleState.visible) return null;

        const locked = Boolean(moduleState?.locked);
        const readOnly = Boolean(moduleState?.readOnly);

        if (locked) {
          const unlockMode = link.moduleKey
            ? MODULE_UNLOCK_MODE[link.moduleKey]
            : undefined;
          return (
            <li key={link.href}>
              <span
                title={unlockMode ? `Unlocks at ${unlockMode}` : 'Locked'}
                aria-disabled="true"
                className="relative flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-400 opacity-60"
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                <span className="flex-1">{link.label}</span>
                <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </span>
            </li>
          );
        }

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
              <span className="flex-1">{link.label}</span>
              {readOnly && (
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  view only
                </span>
              )}
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
