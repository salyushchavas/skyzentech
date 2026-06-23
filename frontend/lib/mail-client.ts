// Typed calls against the S1 mail backend. Shapes match the ACTUAL S1 DTOs:
//   MailAuthResponse: { token, refreshToken?, accessTokenExpiresInSeconds?,
//                       accountId, email, displayName?, role, mustChangePassword? }
//   MailMeResponse:   { accountId, email, displayName?, domainId, role,
//                       mustChangePassword? }

import { mailApi } from './mail-api';
import type { MailAccount } from './mail-auth-storage';

// Re-exported so consumers (MailAuthProvider) import session control from one place.
export { invalidateMailSession } from './mail-api';

export interface MailAuthResponse {
  token: string;
  refreshToken?: string;
  accessTokenExpiresInSeconds?: number;
  accountId: string;
  email: string;
  displayName?: string;
  role: string;
  mustChangePassword?: boolean;
}

export interface MailMeResponse {
  accountId: string;
  email: string;
  displayName?: string;
  domainId: string;
  role: string;
  mustChangePassword?: boolean;
}

export function accountFromAuthResponse(r: MailAuthResponse): MailAccount {
  return {
    accountId: r.accountId,
    email: r.email,
    displayName: r.displayName ?? null,
    role: r.role,
    mustChangePassword: r.mustChangePassword === true,
    domainId: null,
  };
}

export function accountFromMe(r: MailMeResponse): MailAccount {
  return {
    accountId: r.accountId,
    email: r.email,
    displayName: r.displayName ?? null,
    role: r.role,
    mustChangePassword: r.mustChangePassword === true,
    domainId: r.domainId,
  };
}

export async function mailLogin(
  email: string,
  password: string,
): Promise<MailAuthResponse> {
  const res = await mailApi.post<MailAuthResponse>('/api/mail/auth/login', {
    email,
    password,
  });
  return res.data;
}

export async function mailRefresh(refreshToken: string): Promise<MailAuthResponse> {
  const res = await mailApi.post<MailAuthResponse>('/api/mail/auth/refresh', {
    refreshToken,
  });
  return res.data;
}

export async function mailLogout(refreshToken: string): Promise<void> {
  await mailApi.post('/api/mail/auth/logout', { refreshToken });
}

export async function mailGetMe(): Promise<MailMeResponse> {
  const res = await mailApi.get<MailMeResponse>('/api/mail/me');
  return res.data;
}

export async function mailChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<MailAuthResponse> {
  const res = await mailApi.post<MailAuthResponse>(
    '/api/mail/me/change-password',
    { currentPassword, newPassword },
  );
  return res.data;
}
