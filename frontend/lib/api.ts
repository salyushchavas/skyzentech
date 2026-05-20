import axios from 'axios';
import { clearAuth, getToken } from './auth-storage';

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

// No hard default Content-Type — axios sets "application/json" automatically
// for plain object bodies, and we explicitly drop the header for FormData in
// the interceptor below so the browser supplies the multipart boundary.
export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  // For FormData uploads (resume upload, etc.): drop any forced Content-Type
  // so the browser can set "multipart/form-data; boundary=..." automatically.
  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

// Paths where a 401 is expected (the user is mid-auth) — don't redirect.
const AUTH_PATHS = [
  '/careers/login',
  '/careers/register',
  '/careers/forgot-password',
  '/careers/reset-password',
];

const LOGIN_URL = '/careers/login';

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      clearAuth();
      const path = window.location.pathname;
      const onAuthPage = AUTH_PATHS.some((p) => path === p);
      if (!onAuthPage) {
        window.location.href = LOGIN_URL;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
