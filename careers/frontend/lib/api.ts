import axios from 'axios';
import { clearAuth, getToken } from './auth-storage';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Paths where a 401 is expected (the user is mid-auth) — don't redirect.
const AUTH_PATH_SUFFIXES = ['/login', '/register', '/forgot-password', '/reset-password'];

// basePath is '/careers' (see next.config.js). window.location.href is a full
// browser navigation outside Next's router, so the prefix must be included here.
const LOGIN_URL = '/careers/login';

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      const path = window.location.pathname;
      const onAuthPage = AUTH_PATH_SUFFIXES.some((s) => path.endsWith(s));
      if (!onAuthPage) {
        window.location.href = LOGIN_URL;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
