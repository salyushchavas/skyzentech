'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  FileBadge,
  FileCheck,
  FileSignature,
  FileText,
  FolderArchive,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
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

const ROLE_LINKS: Record<UserRole, NavLink[]> = {
  CANDIDATE: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/candidate' },
    { icon: Briefcase, label: 'Open Internships', href: '/careers/openings' },
    { icon: FileCheck, label: 'My Applications', href: '/careers/candidate/applications' },
    { icon: FileText, label: 'My Resumes', href: '/careers/candidate/resumes' },
    { icon: ListChecks, label: 'Onboarding', href: '/careers/candidate/onboarding' },
  ],
  RECRUITER: [
    { icon: KanbanSquare, label: 'Pipeline', href: '/careers/recruiter' },
    { icon: Users, label: 'Candidates', href: '/careers/recruiter/candidates' },
  ],
  ERM: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/erm' },
    { icon: KanbanSquare, label: 'Pipeline', href: '/careers/recruiter' },
    { icon: Video, label: 'Interviews', href: '/careers/erm/interviews' },
    { icon: FileBadge, label: 'I-983 Plans', href: '/careers/erm/training-plans' },
  ],
  HR_COMPLIANCE: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/hr' },
    { icon: ShieldCheck, label: 'Compliance', href: '/careers/hr/compliance' },
    { icon: FileSignature, label: 'Offer Letters', href: '/careers/hr/offers' },
    { icon: BadgeCheck, label: 'I-9 / E-Verify', href: '/careers/hr/i9-everify' },
    { icon: FolderArchive, label: 'Document Vault', href: '/careers/hr/documents' },
  ],
  TECHNICAL_EVALUATOR: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/evaluator' },
    { icon: Users, label: 'My Interns', href: '/careers/evaluator/interns' },
    { icon: CalendarClock, label: 'Sessions', href: '/careers/evaluator/sessions' },
    { icon: ClipboardList, label: 'Assignments', href: '/careers/evaluator/assignments' },
  ],
  ADMIN: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/careers/admin' },
    { icon: Briefcase, label: 'Postings', href: '/careers/admin/postings' },
    { icon: KanbanSquare, label: 'Pipeline', href: '/careers/recruiter' },
    { icon: Users, label: 'Users', href: '/careers/admin/users' },
    { icon: Building2, label: 'Entities', href: '/careers/admin/entities' },
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

  // Pick the first role we have nav for. CANDIDATE is the fallback so the
  // sidebar still renders something while auth hydrates.
  const role: UserRole = user?.roles?.find((r) => r in ROLE_LINKS) ?? 'CANDIDATE';
  const links = ROLE_LINKS[role];
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
