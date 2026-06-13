import type { User, UserRole } from '@/types';

// Seven-role landing map. Each role lands on its own dashboard. Page-level
// ProtectedRoute gates which screens a role can open from there.
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  INTERN: '/careers/intern',
  TRAINER: '/careers/trainer',
  EVALUATOR: '/careers/evaluator',
  REPORTING_MANAGER: '/careers/reporting-manager',
  MANAGER: '/careers/manager',
  ERM: '/careers/erm',
  SUPER_ADMIN: '/careers/admin',
};

// Priority order for picking the landing when a user carries multiple roles.
// SUPER_ADMIN wins (god-mode lands on admin); MANAGER next (oversight);
// then operational/staff roles; INTERN last as the candidate face.
const ROLE_LANDING_PRIORITY: UserRole[] = [
  'SUPER_ADMIN',
  'MANAGER',
  'ERM',
  'TRAINER',
  'EVALUATOR',
  'REPORTING_MANAGER',
  'INTERN',
];

export function getDashboardForUser(user: User): string {
  if (!user.roles?.length) return '/careers/login';
  const ordered = ROLE_LANDING_PRIORITY.find((r) => user.roles.includes(r));
  if (ordered) return ROLE_DASHBOARDS[ordered];
  return ROLE_DASHBOARDS[user.roles[0]] ?? '/careers/login';
}
