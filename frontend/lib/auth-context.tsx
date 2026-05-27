'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from './api';
import {
  clearAuth,
  getToken,
  getUser,
  setRefreshToken,
  setToken,
  setUser,
} from './auth-storage';
import type { AuthResponse, User, WorkAuthTrack } from '@/types';

/**
 * Phase 1.4 — optional intake profile + neutral work-auth self-attestation
 * the registration form can collect up-front. Every field is optional so an
 * older caller passing only the four legacy params keeps working unchanged.
 */
export interface RegistrationIntake {
  legalName?: string;
  preferredName?: string;
  education?: string;
  school?: string;
  degree?: string;
  skillset?: string;
  authorizedToWork?: boolean;
  sponsorshipNeeded?: boolean;
  expectedTrack?: WorkAuthTrack;
  /** ISO yyyy-mm-dd; only set when the candidate self-discloses. */
  validityDate?: string;
}

interface MeResponse {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  roles: User['roles'];
  createdAt?: string;
  emailVerified?: boolean;
  applicantId?: string;
  /** Phase 3 step 6 — candidate's expectedTrack so the sidebar can hide STEM-only tiles. */
  expectedTrack?: WorkAuthTrack;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
    intake?: RegistrationIntake
  ) => Promise<User>;
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
          expectedTrack: me.expectedTrack,
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
    setRefreshToken(res.data.refreshToken ?? null);
    const u = userFromAuthResponse(res.data);
    setUser(u);
    setUserState(u);
    return u;
  }

  async function register(
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
    intake?: RegistrationIntake
  ): Promise<User> {
    const res = await api.post<AuthResponse>('/auth/register', {
      email,
      password,
      fullName,
      phoneNumber,
      // Phase 1.4 intake + neutral self-attestation. Fields the user didn't
      // fill stay undefined and serialise as absent rather than empty strings.
      legalName: intake?.legalName,
      preferredName: intake?.preferredName,
      education: intake?.education,
      school: intake?.school,
      degree: intake?.degree,
      skillset: intake?.skillset,
      authorizedToWork: intake?.authorizedToWork,
      sponsorshipNeeded: intake?.sponsorshipNeeded,
      expectedTrack: intake?.expectedTrack,
      validityDate: intake?.validityDate,
    });
    setToken(res.data.token);
    setRefreshToken(res.data.refreshToken ?? null);
    const u = userFromAuthResponse(res.data, phoneNumber);
    setUser(u);
    setUserState(u);
    return u;
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
