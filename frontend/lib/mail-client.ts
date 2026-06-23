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

// ── Admin console (S4) ────────────────────────────────────────────────
// All calls ride the SAME mailApi instance, so they inherit the mail Bearer,
// the single-flight 401 refresh, and the logout-race epoch guard. Shapes match
// the S3 backend DTOs.

export interface MailMailboxResponse {
  accountId: string;
  domainId: string;
  domainName: string;
  localPart: string;
  email: string;
  displayName: string | null;
  role: string;
  status: string;
  mustChangePassword: boolean;
  requireChangeOnFirstLogin: boolean;
  quotaBytes: number;
  createdAt: string;
}

/** SHOW-ONCE provisioning result. oneTimePassword is never refetched. */
export interface MailCredentialResponse {
  accountId: string;
  email: string;
  oneTimePassword: string;
  mustChangePassword: boolean;
}

export interface MailDomainResponse {
  id: string;
  name: string;
  displayName: string | null;
  active: boolean;
  accountCount: number;
  createdAt: string;
}

export interface CreateMailboxInput {
  domainId: string;
  localPart: string;
  displayName?: string;
  password?: string;
  requireChangeOnFirstLogin?: boolean;
}

export interface MailboxFilters {
  domainId?: string;
  status?: string;
  search?: string;
}

export async function listMailboxes(
  filters: MailboxFilters = {},
): Promise<MailMailboxResponse[]> {
  const res = await mailApi.get<MailMailboxResponse[]>('/api/mail/admin/mailboxes', {
    params: {
      domainId: filters.domainId || undefined,
      status: filters.status || undefined,
      search: filters.search || undefined,
    },
  });
  return res.data;
}

export async function createMailbox(
  input: CreateMailboxInput,
): Promise<MailCredentialResponse> {
  const res = await mailApi.post<MailCredentialResponse>(
    '/api/mail/admin/mailboxes',
    input,
  );
  return res.data;
}

export async function resetMailboxPassword(
  accountId: string,
  password?: string,
): Promise<MailCredentialResponse> {
  const res = await mailApi.post<MailCredentialResponse>(
    `/api/mail/admin/mailboxes/${accountId}/reset-password`,
    { password: password || undefined },
  );
  return res.data;
}

export async function suspendMailbox(accountId: string): Promise<MailMailboxResponse> {
  const res = await mailApi.post<MailMailboxResponse>(
    `/api/mail/admin/mailboxes/${accountId}/suspend`,
  );
  return res.data;
}

export async function reactivateMailbox(accountId: string): Promise<MailMailboxResponse> {
  const res = await mailApi.post<MailMailboxResponse>(
    `/api/mail/admin/mailboxes/${accountId}/reactivate`,
  );
  return res.data;
}

export async function setMailboxRole(
  accountId: string,
  role: string,
): Promise<MailMailboxResponse> {
  const res = await mailApi.patch<MailMailboxResponse>(
    `/api/mail/admin/mailboxes/${accountId}/role`,
    { role },
  );
  return res.data;
}

export async function listDomains(): Promise<MailDomainResponse[]> {
  const res = await mailApi.get<MailDomainResponse[]>('/api/mail/admin/domains');
  return res.data;
}

export async function createDomain(
  name: string,
  displayName?: string,
): Promise<MailDomainResponse> {
  const res = await mailApi.post<MailDomainResponse>('/api/mail/admin/domains', {
    name,
    displayName,
  });
  return res.data;
}

export async function updateDomain(
  id: string,
  patch: { displayName?: string; active?: boolean },
): Promise<MailDomainResponse> {
  const res = await mailApi.patch<MailDomainResponse>(
    `/api/mail/admin/domains/${id}`,
    patch,
  );
  return res.data;
}

export async function deleteDomain(id: string): Promise<void> {
  await mailApi.delete(`/api/mail/admin/domains/${id}`);
}

/** Extract a user-facing message from a mail API error (interceptor-enriched). */
export function mailErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as {
    userMessage?: string;
    response?: { data?: { message?: string; error?: string } };
  };
  return e?.userMessage ?? e?.response?.data?.message ?? e?.response?.data?.error ?? fallback;
}
