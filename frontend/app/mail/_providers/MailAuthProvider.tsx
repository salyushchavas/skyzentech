'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  getMailAccount,
  getMailRefreshToken,
  getMailToken,
  setMailAuth,
  setMailAccount,
  type MailAccount,
} from '@/lib/mail-auth-storage';
import {
  accountFromAuthResponse,
  accountFromMe,
  invalidateMailSession,
  mailGetMe,
  mailLogin,
  mailLogout,
  mailChangePassword,
  type MailAuthResponse,
} from '@/lib/mail-client';

// Mail auth context — modelled on Skyzen's AuthProvider/useAuth but fully
// independent: separate mail.* storage, separate axios client, separate
// redirects. It is nested inside MailLayout (NOT the root layout), so it only
// governs the /mail subtree.
interface MailAuthContextValue {
  account: MailAccount | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<MailAuthResponse>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<MailAuthResponse>;
  logout: () => Promise<void>;
}

const MailAuthContext = createContext<MailAuthContextValue | null>(null);

export default function MailAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [account, setAccount] = useState<MailAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshFromMe = useCallback(async () => {
    try {
      const me = await mailGetMe();
      const acct = accountFromMe(me);
      setMailAccount(acct);
      setAccount(acct);
    } catch {
      // A 401 here is handled by the mail axios interceptor (refresh or
      // redirect). Any other error: keep the cached account.
    }
  }, []);

  useEffect(() => {
    const stored = getMailAccount();
    if (stored) setAccount(stored);
    setIsLoading(false);
    if (getMailToken()) {
      void refreshFromMe();
    }
  }, [refreshFromMe]);

  const login = useCallback(
    async (email: string, password: string): Promise<MailAuthResponse> => {
      const res = await mailLogin(email, password);
      const acct = accountFromAuthResponse(res);
      setMailAuth({ token: res.token, refreshToken: res.refreshToken, account: acct });
      setAccount(acct);
      return res;
    },
    [],
  );

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
    ): Promise<MailAuthResponse> => {
      const res = await mailChangePassword(currentPassword, newPassword);
      // The endpoint returns a FRESH, ungated token pair — persist it so the
      // user is never locked out.
      const acct = accountFromAuthResponse(res);
      setMailAuth({ token: res.token, refreshToken: res.refreshToken, account: acct });
      setAccount(acct);
      // Re-hydrate from /me with the fresh token so fields the change-password
      // response omits (e.g. domainId) are repopulated.
      void refreshFromMe();
      return res;
    },
    [refreshFromMe],
  );

  const logout = useCallback(async (): Promise<void> => {
    const rt = getMailRefreshToken();
    if (rt) {
      try {
        await mailLogout(rt);
      } catch {
        // best-effort revoke
      }
    }
    invalidateMailSession();
    setAccount(null);
    router.replace('/mail/login');
  }, [router]);

  return (
    <MailAuthContext.Provider
      value={{ account, isLoading, login, changePassword, logout }}
    >
      {children}
    </MailAuthContext.Provider>
  );
}

export function useMailAuth(): MailAuthContextValue {
  const ctx = useContext(MailAuthContext);
  if (!ctx) throw new Error('useMailAuth must be used within MailAuthProvider');
  return ctx;
}
