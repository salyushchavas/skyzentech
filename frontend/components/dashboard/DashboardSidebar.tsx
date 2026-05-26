'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  FileBadge,
  FileCheck,
  FileSignature,
  FileText,
  FolderArchive,
  Hammer,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  ShieldCheck,
  UserCircle,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/types';

interface NavLink {
  icon: LucideIcon;
  label: string;
  href: string;
}

// PED §7 + SUPER_ADMIN split — seven role-aware sidebars. APPLICANT + INTERN
// share the same nav; pages adapt by engagement state. OPERATIONS is the
// collapsed union of the old RECRUITER + ERM sidebars (postings, interviews,
// onboarding, applications pipeline). SUPER_ADMIN holds the god-mode tiles
// (Users / Entities / Audit Log / Overview / Compliance) that were on
// OPERATIONS pre-split. EXECUTIVE is read-only leadership (overview + audit
// log + compliance).
const CANDIDATE_LINKS: NavLink[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/candidate' },
  { icon: Briefcase, label: 'Open Internships', href: '/careers/openings' },
  { icon: FileCheck, label: 'My Applications', href: '/careers/candidate/applications' },
  { icon: Video, label: 'Interviews', href: '/careers/candidate/interviews' },
  { icon: FileSignature, label: 'Offers', href: '/careers/candidate/offers' },
  { icon: ListChecks, label: 'Onboarding', href: '/careers/candidate/onboarding' },
  { icon: ShieldCheck, label: 'I-9 Form', href: '/careers/candidate/i9' },
  { icon: FileBadge, label: 'Training Plan', href: '/careers/candidate/training-plans' },
  { icon: Hammer, label: 'My Work', href: '/careers/intern/work' },
  { icon: BookOpen, label: 'Weekly Materials', href: '/careers/candidate/weekly-materials' },
  { icon: FileText, label: 'Weekly Reports', href: '/careers/candidate/weekly-reports' },
  { icon: UserCircle, label: 'Profile', href: '/careers/candidate/profile' },
];

const ROLE_LINKS: Record<UserRole, NavLink[]> = {
  APPLICANT: CANDIDATE_LINKS,
  INTERN: CANDIDATE_LINKS,
  HR_COMPLIANCE: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/hr' },
    { icon: ShieldCheck, label: 'Compliance', href: '/careers/hr/compliance' },
    { icon: FileSignature, label: 'Offer Letters', href: '/careers/hr/offers' },
    { icon: BadgeCheck, label: 'I-9 / E-Verify', href: '/careers/hr/i9-everify' },
    { icon: FolderArchive, label: 'Document Vault', href: '/careers/hr/documents' },
    { icon: Users, label: 'Supervised', href: '/careers/supervised' },
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
  ],
  TECHNICAL_SUPERVISOR: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/evaluator' },
    { icon: Users, label: 'My Interns', href: '/careers/evaluator/interns' },
    { icon: CalendarClock, label: 'Sessions', href: '/careers/evaluator/sessions' },
    { icon: ClipboardList, label: 'Assignments', href: '/careers/evaluator/assignments' },
    { icon: BookOpen, label: 'Weekly Materials', href: '/careers/evaluator/weekly-materials' },
    { icon: FileText, label: 'Weekly Reports', href: '/careers/evaluator/weekly-reports' },
    { icon: Users, label: 'Supervised', href: '/careers/supervised' },
  ],
  EXECUTIVE: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/executive' },
    { icon: ScrollText, label: 'Audit Log', href: '/careers/admin/audit-log' },
    { icon: ShieldCheck, label: 'Compliance', href: '/careers/hr/compliance' },
  ],
  SUPER_ADMIN: [
    { icon: LayoutDashboard, label: 'Overview', href: '/careers/admin' },
    { icon: Users, label: 'Users', href: '/careers/admin/users' },
    { icon: Building2, label: 'Entities', href: '/careers/admin/entities' },
    { icon: ScrollText, label: 'Audit Log', href: '/careers/admin/audit-log' },
    { icon: ShieldCheck, label: 'Compliance', href: '/careers/hr/compliance' },
  ],
};

function pickLongestMatch(pathname: string, links: NavLink[]): string | null {
  const matches = links
    .filter((l) => pathname === l.href || pathname.startsWith(l.href + '/'))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? null;
}

interface Props {
  onNavigate?: () => void;
}

export default function DashboardSidebar({ onNavigate }: Props) {
  const pathname = usePathname() ?? '';
  const { user } = useAuth();

  // Pick the first role we have nav for. APPLICANT is the fallback so the
  // sidebar still renders something while auth hydrates (most logged-in users
  // pre-hire fall into APPLICANT).
  const role: UserRole = user?.roles?.find((r) => r in ROLE_LINKS) ?? 'APPLICANT';
  const baseLinks = ROLE_LINKS[role];

  // Phase 3 step 6 — hide the Training Plan tile for non-STEM-OPT candidates.
  // STEM_OPT is the source of truth (snapshot on the engagement, mirrored by
  // candidate.expectedTrack on the user payload). Candidates with no track
  // yet also have the tile hidden — they haven't asked for STEM_OPT routing.
  //
  // Weekly Materials + Weekly Reports are intern-face only — APPLICANT can't
  // reach either endpoint (both gated by an ACTIVE engagement) so the tiles
  // would just bounce them off a 403. Hide pre-hire.
  const isCandidate = role === 'APPLICANT' || role === 'INTERN';
  const links = baseLinks.filter((l) => {
    if (!isCandidate) return true;
    if (l.href === '/careers/candidate/training-plans') {
      return user?.expectedTrack === 'STEM_OPT';
    }
    if (
      l.href === '/careers/candidate/weekly-materials' ||
      l.href === '/careers/candidate/weekly-reports'
    ) {
      return role === 'INTERN';
    }
    return true;
  });
  const activeHref = pickLongestMatch(pathname, links);

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

      {/* Primary nav */}
      <ul className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
