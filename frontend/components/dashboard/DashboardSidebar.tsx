'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  Circle,
  ClipboardList,
  FileBadge,
  FileCheck,
  FileSignature,
  FileText,
  FolderArchive,
  Hammer,
  HelpCircle,
  KanbanSquare,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  ShieldCheck,
  Star,
  UserCircle,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { CandidateNavResponse, NavItem, UserRole } from '@/types';

interface StaffLink {
  icon: LucideIcon;
  label: string;
  href: string;
}

// ── Staff sidebars — frontend-hardcoded (unchanged) ─────────────────────────
//
// HR_COMPLIANCE, OPERATIONS, TECHNICAL_SUPERVISOR, EXECUTIVE, SUPER_ADMIN all
// remain frontend-driven. Only APPLICANT / INTERN moved to the backend-driven
// /api/v1/candidate/nav read so the menu reflects the user's journey
// progression (interviews appear when first one is scheduled, etc.).
const STAFF_ROLE_LINKS: Partial<Record<UserRole, StaffLink[]>> = {
  HR_COMPLIANCE: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/hr' },
    { icon: ShieldCheck, label: 'Compliance', href: '/careers/hr/compliance' },
    { icon: FileSignature, label: 'Offer Letters', href: '/careers/hr/offers' },
    { icon: BadgeCheck, label: 'I-9 / E-Verify', href: '/careers/hr/i9-everify' },
    { icon: FolderArchive, label: 'Document Vault', href: '/careers/hr/documents' },
    { icon: Users, label: 'Supervised', href: '/careers/supervised' },
    { icon: KeyRound, label: 'Sessions', href: '/careers/sessions' },
  ],
  OPERATIONS: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/operations' },
    { icon: KanbanSquare, label: 'Pipeline', href: '/careers/recruiter' },
    { icon: Users, label: 'Candidates', href: '/careers/recruiter/candidates' },
    { icon: Video, label: 'Interviews', href: '/careers/erm/interviews' },
    { icon: FileSignature, label: 'Offer Letters', href: '/careers/hr/offers' },
    { icon: FileBadge, label: 'I-983 Plans', href: '/careers/erm/training-plans' },
    { icon: Briefcase, label: 'Postings', href: '/careers/admin/postings' },
    { icon: Users, label: 'Supervised', href: '/careers/supervised' },
    { icon: KeyRound, label: 'Sessions', href: '/careers/sessions' },
  ],
  TECHNICAL_SUPERVISOR: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/evaluator' },
    { icon: Users, label: 'My Interns', href: '/careers/evaluator/interns' },
    { icon: CalendarClock, label: 'Sessions', href: '/careers/evaluator/sessions' },
    { icon: ClipboardList, label: 'Assignments', href: '/careers/evaluator/assignments' },
    { icon: BookOpen, label: 'Weekly Materials', href: '/careers/evaluator/weekly-materials' },
    { icon: FileText, label: 'Weekly Reports', href: '/careers/evaluator/weekly-reports' },
    { icon: ClipboardList, label: 'Projects', href: '/careers/evaluator/projects' },
    { icon: Star, label: 'Evaluations', href: '/careers/evaluator/evaluations' },
    { icon: Users, label: 'Supervised', href: '/careers/supervised' },
    { icon: KeyRound, label: 'Active sessions', href: '/careers/sessions' },
  ],
  EXECUTIVE: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/executive' },
    { icon: ShieldCheck, label: 'Compliance', href: '/careers/hr/compliance' },
    { icon: KeyRound, label: 'Sessions', href: '/careers/sessions' },
  ],
  SUPER_ADMIN: [
    { icon: LayoutDashboard, label: 'Overview', href: '/careers/admin' },
    { icon: Users, label: 'Users', href: '/careers/admin/users' },
    { icon: Building2, label: 'Entities', href: '/careers/admin/entities' },
    { icon: ScrollText, label: 'Audit Log', href: '/careers/admin/audit-log' },
    { icon: ShieldCheck, label: 'Compliance', href: '/careers/hr/compliance' },
    { icon: KeyRound, label: 'Sessions', href: '/careers/sessions' },
  ],
};

// ── Candidate icons mapped by key ───────────────────────────────────────────
//
// Backend returns nav items with a stable `key`; the frontend owns the icon
// mapping so we can swap visuals without a backend change.
const CANDIDATE_KEY_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  openings: Briefcase,
  applications: FileCheck,
  interviews: Video,
  offers: FileSignature,
  onboarding: ListChecks,
  i9: ShieldCheck,
  'training-plan': FileBadge,
  'weekly-materials': BookOpen,
  'weekly-reports': FileText,
  timesheets: Hammer,
  projects: ClipboardList,
  evaluations: Star,
  profile: UserCircle,
  sessions: KeyRound,
  help: HelpCircle,
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

  const isCandidate = useMemo(() => {
    const roles = user?.roles ?? [];
    // INTERN takes precedence over APPLICANT for users who hold both; both
    // share the same backend-driven nav.
    return roles.includes('INTERN') || roles.includes('APPLICANT');
  }, [user?.roles]);

  // Pick the first staff role with a defined sidebar (interns / applicants
  // route through the candidate fetch instead).
  const staffRole = useMemo<UserRole | null>(() => {
    const roles = user?.roles ?? [];
    for (const r of roles) {
      if (r !== 'APPLICANT' && r !== 'INTERN' && r in STAFF_ROLE_LINKS) {
        return r;
      }
    }
    return null;
  }, [user?.roles]);

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Logo area */}
      <Link
        href="/careers"
        onClick={onNavigate}
        className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 px-4"
      >
        <img src="/images/skyzen-logo.png" alt="Skyzen" className="h-8 w-auto" />
        <span className="text-base font-semibold text-gray-900">Careers</span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {staffRole ? (
          <StaffNav
            links={STAFF_ROLE_LINKS[staffRole]!}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ) : isCandidate ? (
          <CandidateNav pathname={pathname} onNavigate={onNavigate} />
        ) : (
          // Fallback while auth hydrates — show a minimal scaffold so the
          // chrome doesn't look empty.
          <SidebarSkeleton rows={4} />
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-3 py-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="block px-3 py-2 text-xs text-gray-500 transition-colors hover:text-gray-700"
        >
          &larr; Back to main site
        </Link>
      </div>
    </nav>
  );
}

// ── Staff branch ────────────────────────────────────────────────────────────

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
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ' +
                (active
                  ? 'bg-accent/10 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900')
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

// ── Candidate branch (backend-driven) ──────────────────────────────────────

function CandidateNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const [data, setData] = useState<CandidateNavResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<CandidateNavResponse>('/api/v1/candidate/nav');
      setData(res.data);
    } catch {
      // Silent — the user sees a minimal fallback list below.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Optimistic clear of the "new" badge when the user clicks an item that
  // had one — keeps the UI feeling responsive without waiting on the POST.
  const dismissNew = useCallback(
    (key: string) => {
      setData((curr) => {
        if (!curr) return curr;
        const next = curr.items.map((it) =>
          it.key === key && it.badge?.type === 'new' ? { ...it, badge: null } : it,
        );
        return { ...curr, items: next };
      });
      // Fire-and-forget; errors stay silent (next /nav read will re-add the
      // badge if it really hasn't persisted, so no UX hazard).
      void api
        .post('/api/v1/candidate/nav/seen', { key })
        .catch(() => undefined);
    },
    [],
  );

  if (!loaded) return <SidebarSkeleton rows={6} />;

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  const routes = items.map((it) => it.route);
  const activeRoute = pickActiveByRoute(pathname, routes);

  // Split into groups for the INTERN face; APPLICANT items all carry group=null
  // and render in one flat list.
  const primary = items.filter((it) => it.group !== 'history');
  const history = items.filter((it) => it.group === 'history');
  const hasGroups = history.length > 0;

  return (
    <div className="space-y-4">
      <ul className="space-y-1">
        {primary.map((it) => (
          <CandidateNavRow
            key={it.key}
            item={it}
            active={it.route === activeRoute}
            onClick={(key) => {
              if (it.badge?.type === 'new') dismissNew(key);
              onNavigate?.();
            }}
          />
        ))}
      </ul>

      {hasGroups && (
        <div>
          <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Hiring history
          </div>
          <ul className="space-y-1">
            {history.map((it) => (
              <CandidateNavRow
                key={it.key}
                item={it}
                active={it.route === activeRoute}
                muted
                onClick={(key) => {
                  if (it.badge?.type === 'new') dismissNew(key);
                  onNavigate?.();
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CandidateNavRow({
  item,
  active,
  muted,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  muted?: boolean;
  onClick: (key: string) => void;
}) {
  const Icon = CANDIDATE_KEY_ICONS[item.key] ?? Circle;
  return (
    <li>
      <Link
        href={item.route}
        onClick={() => onClick(item.key)}
        // Subtle entry animation — only fires once per mount, not on re-render.
        // Tailwind's animate-in works without extra config; if a fade is
        // unsupported by the build's tailwind version the row still renders.
        className={
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 ' +
          (active
            ? 'bg-accent/10 text-primary-700'
            : muted
              ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900')
        }
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        <span className="flex-1 truncate">{item.label}</span>
        {item.badge?.type === 'count' && (
          <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-accent/15 px-1.5 text-[11px] font-semibold leading-5 text-accent-dark">
            {item.badge.value}
          </span>
        )}
        {item.badge?.type === 'new' && (
          <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            New
          </span>
        )}
      </Link>
    </li>
  );
}

function SidebarSkeleton({ rows }: { rows: number }) {
  return (
    <ul className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="h-10 animate-pulse rounded-lg bg-gray-100"
          aria-hidden
        />
      ))}
    </ul>
  );
}
