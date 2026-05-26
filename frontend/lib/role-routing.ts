import type { User, UserRole } from '@/types';

// PED §7 mapping. APPLICANT + INTERN share the candidate landing — the page
// itself adapts its face by engagement state. OPERATIONS collapses the former
// recruiter / ERM / admin dashboards into one Operations landing. EXECUTIVE
// is read-only leadership; it lands on the admin (overview) page which now
// allows EXECUTIVE alongside OPERATIONS.
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  APPLICANT: '/careers/candidate',
  INTERN: '/careers/candidate',
  HR_COMPLIANCE: '/careers/hr',
  OPERATIONS: '/careers/recruiter',
  TECHNICAL_SUPERVISOR: '/careers/evaluator',
  EXECUTIVE: '/careers/admin',
};

export function getDashboardForUser(user: User): string {
  if (!user.roles?.length) return '/careers/login';
  return ROLE_DASHBOARDS[user.roles[0]] ?? '/careers/login';
}
