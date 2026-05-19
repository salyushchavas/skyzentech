import type { User, UserRole } from '@/types';

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  CANDIDATE: '/careers/candidate',
  RECRUITER: '/careers/recruiter',
  ERM: '/careers/erm',
  HR_COMPLIANCE: '/careers/hr',
  TECHNICAL_EVALUATOR: '/careers/evaluator',
  ADMIN: '/careers/admin',
};

export function getDashboardForUser(user: User): string {
  if (!user.roles?.length) return '/careers/login';
  return ROLE_DASHBOARDS[user.roles[0]] ?? '/careers/login';
}
