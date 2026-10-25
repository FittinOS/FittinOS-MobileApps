/**
 * Build-time public configuration. Every value here is compiled into the app
 * bundle, so nothing secret may ever be read from here.
 */
export type CashfreeMode = 'SANDBOX' | 'PRODUCTION';

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Backend base URL including the `/api` prefix. */
export const API_URL = trimSlash(process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4100/api');

/** Public web origin — legal pages and anything only the web hosts. */
export const WEB_URL = trimSlash(process.env.EXPO_PUBLIC_WEB_URL || 'https://fittinos.com');

/**
 * Which Cashfree environment this build opens checkout in. Must match the
 * backend's CASHFREE_ENVIRONMENT; see assertCashfreeEnvironmentMatches.
 */
export const CASHFREE_MODE: CashfreeMode =
  process.env.EXPO_PUBLIC_CASHFREE_ENVIRONMENT?.trim().toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';

export const REQUEST_TIMEOUT_MS = 20_000;
