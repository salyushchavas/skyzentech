import type { User, UserRole } from '@/types';

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  CANDIDATE: '/candidate',
  RECRUITER: '/recruiter',
  ERM: '/erm',
  HR_COMPLIANCE: '/hr',
  TECHNICAL_EVALUATOR: '/evaluator',
  ADMIN: '/admin',
};

export function getDashboardForUser(user: User): string {
  if (!user.roles?.length) return '/login';
  return ROLE_DASHBOARDS[user.roles[0]] ?? '/login';
}
