/**
 * Where the call-signaling socket lives and how long its token has left.
 * Pure and erasable-TypeScript only, so it runs under `node --test`.
 */

/** The backend's Socket.IO namespace for calls (see CallsGateway). */
export const CALLS_NAMESPACE = '/calls';

export interface SocketTarget {
  /** Origin + namespace to connect to, e.g. https://api.example.com/calls */
  url: string;
  /** Socket.IO handshake path. */
  path: string;
}

/**
 * The socket is served by the same API host as the REST API, at
 * `<api prefix>/socket.io` (the prefix is "/api" today). Deriving both from
 * NEXT_PUBLIC_API_URL means there is nothing extra to configure per environment.
 */
export function socketTargetFromApiUrl(apiUrl: string): SocketTarget {
  const parsed = new URL(apiUrl);
  const prefix = parsed.pathname.replace(/\/+$/, '');
  return { url: `${parsed.origin}${CALLS_NAMESPACE}`, path: `${prefix}/socket.io` };
}

function decodeBase64Url(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
  return atob(padded);
}

/** Seconds until a JWT's `exp`, or null if it can't be read. Negative once expired. */
export function secondsUntilExpiry(token: string | null | undefined, nowMs: number): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { exp?: unknown };
    return typeof payload.exp === 'number' ? Math.floor(payload.exp - nowMs / 1000) : null;
  } catch {
    return null;
  }
}

/** True when the token is missing/unreadable or will expire within `marginSeconds`. */
export function needsRefresh(token: string | null | undefined, nowMs: number, marginSeconds = 30): boolean {
  const remaining = secondsUntilExpiry(token, nowMs);
  return remaining === null || remaining <= marginSeconds;
}
