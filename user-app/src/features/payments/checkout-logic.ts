import type { CashfreeMode } from '@/lib/config';

/**
 * Pure rules behind the native checkout — kept separate so they are
 * unit-testable without the Cashfree native module.
 */
export type BackendCashfreeEnvironment = 'PRODUCTION' | 'SANDBOX' | 'DISABLED';

export class CashfreeEnvironmentMismatchError extends Error {}
export class PaymentsUnavailableError extends Error {}

/**
 * Refuses to open checkout when the backend created the order against a
 * different Cashfree environment than this build targets (a SANDBOX session
 * can never complete in PRODUCTION mode or vice versa) — same rule as the web.
 * DISABLED means the backend has no live gateway: there is nothing to open.
 */
export function assertCashfreeEnvironmentMatches(backend: BackendCashfreeEnvironment, app: CashfreeMode): void {
  if (backend === 'DISABLED') {
    throw new PaymentsUnavailableError('Online payments are not available right now. Please try again later.');
  }
  if (backend !== app) {
    throw new CashfreeEnvironmentMismatchError(
      `This app is set up for ${app.toLowerCase()} payments, but the order was created for ${backend.toLowerCase()}. Checkout was not opened.`,
    );
  }
}

/** The backend's "payment not finished yet" verify error — worth auto-retrying briefly (web rule). */
export function isPendingVerification(message: string | null | undefined): boolean {
  return !!message && /has not been completed yet/i.test(message);
}

export function isUserCancellation(code: string | null | undefined, message?: string | null): boolean {
  return /cancel/i.test(code ?? '') || /cancel/i.test(message ?? '');
}

export const VERIFY_TIMEOUT_MS = 25_000;
export const MAX_AUTO_RETRIES = 5;
export const AUTO_RETRY_DELAY_MS = 4_000;

/** One stable key per confirmed purchase attempt, resent unchanged on retry. */
export function newIdempotencyKey(): string {
  const random = () => Math.random().toString(16).slice(2, 10);
  return `${Date.now().toString(16)}-${random()}-${random()}-${random()}`;
}
