import type { User, UserRole } from '@/types';

// PED §7 + SUPER_ADMIN split. APPLICANT + INTERN share the candidate landing
// — the page adapts its face by engagement state. OPERATIONS collapses the
// former recruiter / ERM dashboards into one Operations landing. SUPER_ADMIN
// and EXECUTIVE both land on /careers/admin — EXECUTIVE for read-only
// overview, SUPER_ADMIN for full user/entity/audit management. Page-level
// ProtectedRoute gates which screens each role can open from there.
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  APPLICANT: '/careers/candidate',
  INTERN: '/careers/candidate',
  HR_COMPLIANCE: '/careers/hr',
  OPERATIONS: '/careers/operations',
  TECHNICAL_SUPERVISOR: '/careers/evaluator',
  REPORTING_MANAGER: '/careers/evaluator',
  EXECUTIVE: '/careers/executive',
  SUPER_ADMIN: '/careers/admin',
};

// Priority order for picking the landing when a user carries multiple roles.
// SUPER_ADMIN wins (god-mode lands on admin); EXECUTIVE next (read-only admin);
// then operational/staff roles; APPLICANT/INTERN last as the candidate face.
const ROLE_LANDING_PRIORITY: UserRole[] = [
  'SUPER_ADMIN',
  'EXECUTIVE',
  'OPERATIONS',
  'HR_COMPLIANCE',
  'TECHNICAL_SUPERVISOR',
  'REPORTING_MANAGER',
  'INTERN',
  'APPLICANT',
];

export function getDashboardForUser(user: User): string {
  if (!user.roles?.length) return '/careers/login';
  const ordered = ROLE_LANDING_PRIORITY.find((r) => user.roles.includes(r));
  if (ordered) return ROLE_DASHBOARDS[ordered];
  return ROLE_DASHBOARDS[user.roles[0]] ?? '/careers/login';
}
