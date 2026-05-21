'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from './api';
import { clearAuth, getToken, getUser, setToken, setUser } from './auth-storage';
import type { AuthResponse, User } from '@/types';

interface MeResponse {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  roles: User['roles'];
  createdAt?: string;
  emailVerified?: boolean;
  applicantId?: string;
}

interface RegisterResult {
  user: User;
  /** Dev-only: present when the backend surfaces the stub verification code. */
  devVerificationCode?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string
  ) => Promise<RegisterResult>;
  /**
   * Update the locally-cached user object after a state change (e.g.
   * email verification flipped emailVerified to true). Persists to
   * localStorage so a hard refresh sees the new value.
   */
  updateUser: (patch: Partial<User>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromAuthResponse(res: AuthResponse, phoneNumber?: string): User {
  return {
    userId: res.userId,
    email: res.email,
    fullName: res.fullName,
    phoneNumber,
    roles: res.roles,
    emailVerified: res.emailVerified,
    applicantId: res.applicantId,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getUser();
    if (stored) setUserState(stored);
    setIsLoading(false);
    // Phase 1.2: refresh from /auth/me so localStorage caches written before
    // emailVerified/applicantId existed pick up the new fields, and so a
    // verification flipped in another tab is reflected on the next load.
    // Silent — if it fails (token expired etc.) the cached user stays valid.
    if (getToken()) {
      void refreshFromMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshFromMe(): Promise<void> {
    try {
      const res = await api.get<MeResponse>('/auth/me');
      const me = res.data;
      setUserState((curr) => {
        const next: User = {
          userId: me.userId,
          email: me.email,
          fullName: me.fullName,
          phoneNumber: me.phoneNumber ?? curr?.phoneNumber,
          roles: me.roles,
          createdAt: me.createdAt ?? curr?.createdAt,
          emailVerified: me.emailVerified,
          applicantId: me.applicantId,
        };
        setUser(next);
        return next;
      });
    } catch {
      // ignore — cached user remains in effect
    }
  }

  async function login(email: string, password: string): Promise<User> {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    setToken(res.data.token);
    const u = userFromAuthResponse(res.data);
    setUser(u);
    setUserState(u);
    return u;
  }

  async function register(
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string
  ): Promise<RegisterResult> {
    const res = await api.post<AuthResponse>('/auth/register', {
      email,
      password,
      fullName,
      phoneNumber,
    });
    setToken(res.data.token);
    const u = userFromAuthResponse(res.data, phoneNumber);
    setUser(u);
    setUserState(u);
    return { user: u, devVerificationCode: res.data.devVerificationCode };
  }

  function updateUser(patch: Partial<User>): void {
    setUserState((curr) => {
      if (!curr) return curr;
      const next = { ...curr, ...patch };
      setUser(next);
      return next;
    });
  }

  function logout(): void {
    clearAuth();
    setUserState(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
