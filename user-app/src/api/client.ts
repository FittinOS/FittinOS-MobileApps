import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/config';
import { needsRefresh } from '@/lib/jwt';
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from '@/lib/token-store';

/**
 * The single authenticated HTTP client for the whole app.
 *
 * Refresh-token rotation: the backend issues a NEW refresh token on every
 * /auth/refresh and revokes every session of the account if an
 * already-used one is presented again (theft detection, see
 * AuthService.refresh). So concurrent 401s must share ONE refresh call
 * (single-flight), and the rotated refresh token must be persisted before
 * anything else can refresh again.
 */

// A 401 from these means "this action was rejected" (wrong password, bad
// code), never "the session died" — they must not trigger a refresh.
export const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/email/verify',
  '/auth/email/send-code',
  '/auth/oauth/',
  '/auth/logout',
];

export interface TokenStorage {
  load(): Promise<StoredTokens | null>;
  save(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiClientOptions {
  baseURL: string;
  storage: TokenStorage;
  /** Exchanges a refresh token for a new pair. Injected so tests needn't hit the network. */
  refresh: (refreshToken: string) => Promise<StoredTokens>;
  timeoutMs?: number;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export interface ApiClient {
  http: AxiosInstance;
  /** A valid access token, refreshing first if it is about to expire. Null when signed out. */
  getFreshAccessToken(): Promise<string | null>;
  /** Registers the callback run once when the session is irrecoverably gone. */
  onSessionExpired(listener: () => void): () => void;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const http = axios.create({ baseURL: options.baseURL, timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS });
  const listeners = new Set<() => void>();
  let inFlight: Promise<string> | null = null;

  function refreshOnce(): Promise<string> {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const current = await options.storage.load();
        if (!current?.refreshToken) throw new Error('No refresh token available');
        const next = await options.refresh(current.refreshToken);
        await options.storage.save(next);
        return next.accessToken;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function expireSession(): Promise<void> {
    await options.storage.clear();
    listeners.forEach((listener) => listener());
  }

  http.interceptors.request.use(async (config) => {
    const isPublic = PUBLIC_AUTH_PATHS.some((path) => config.url?.includes(path));
    if (!isPublic) {
      const tokens = await options.storage.load();
      if (tokens?.accessToken) config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    }
    return config;
  });

  http.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as RetriableConfig | undefined;
      const isPublic = PUBLIC_AUTH_PATHS.some((path) => original?.url?.includes(path));
      if (error.response?.status === 401 && original && !original._retry && !isPublic) {
        original._retry = true;
        let accessToken: string;
        try {
          accessToken = await refreshOnce();
        } catch (refreshError) {
          await expireSession();
          return Promise.reject(refreshError);
        }
        original.headers.set('Authorization', `Bearer ${accessToken}`);
        return http(original);
      }
      return Promise.reject(error);
    },
  );

  return {
    http,
    async getFreshAccessToken() {
      const tokens = await options.storage.load();
      if (!tokens) return null;
      if (!needsRefresh(tokens.accessToken, Date.now())) return tokens.accessToken;
      try {
        return await refreshOnce();
      } catch {
        await expireSession();
        return null;
      }
    },
    onSessionExpired(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Unwraps the backend's `{ success, data, message }` envelope. */
export function unwrap<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

export const api = createApiClient({
  baseURL: API_URL,
  storage: { load: loadTokens, save: saveTokens, clear: clearTokens },
  refresh: async (refreshToken) => {
    const response = await axios.post<{ data: StoredTokens }>(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    const { accessToken, refreshToken: rotated } = response.data.data;
    return { accessToken, refreshToken: rotated };
  },
});

export const http = api.http;
