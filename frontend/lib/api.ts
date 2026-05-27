import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  clearAuth,
  getRefreshToken,
  getToken,
  setRefreshToken,
  setToken,
} from './auth-storage';

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

// Requests we don't try to refresh + retry — failure on these means the user
// genuinely needs to re-authenticate, and any retry would just hide the real
// error.
const NEVER_RETRY = ['/auth/login', '/auth/register', '/auth/refresh'];

// Shape returned by /auth/refresh — minimal duplicate of AuthResponse to avoid
// pulling the full types module into this low-level client.
interface RefreshResponse {
  token: string;
  refreshToken: string;
}

// Concurrent-401 handling: while the first 401 is busy refreshing, every other
// 401 should wait for that single attempt rather than each firing its own.
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await axios.post<RefreshResponse>(
        `${baseURL}/auth/refresh`,
        { refreshToken: refresh },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setToken(res.data.token);
      setRefreshToken(res.data.refreshToken);
      return res.data.token;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function isRetryableRequest(url: string | undefined): boolean {
  if (!url) return true;
  return !NEVER_RETRY.some((p) => url.endsWith(p) || url.includes(p + '?'));
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error?.response?.status;
    const cfg = error?.config as RetryConfig | undefined;

    // Try a refresh-and-retry once per request. The presence of a refresh
    // token decides whether we attempt — without one we go straight to the
    // login redirect below.
    if (
      status === 401 &&
      cfg &&
      !cfg._retried &&
      isRetryableRequest(cfg.url) &&
      typeof window !== 'undefined' &&
      getRefreshToken()
    ) {
      cfg._retried = true;
      const fresh = await tryRefreshAccessToken();
      if (fresh) {
        cfg.headers = cfg.headers ?? {};
        (cfg.headers as Record<string, string>).Authorization = `Bearer ${fresh}`;
        return api.request(cfg as AxiosRequestConfig);
      }
    }

    if (status === 401 && typeof window !== 'undefined') {
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
