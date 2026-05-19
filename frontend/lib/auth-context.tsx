'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from './api';
import { clearAuth, getUser, setToken, setUser } from './auth-storage';
import type { AuthResponse, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string
  ) => Promise<User>;
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
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getUser();
    if (stored) setUserState(stored);
    setIsLoading(false);
  }, []);

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
  ): Promise<User> {
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
    return u;
  }

  function logout(): void {
    clearAuth();
    setUserState(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
