/**
 * JWT expiry helpers (mirrors apps/web/lib/calls/call-socket-config.ts). Only
 * reads `exp` to decide when to refresh — the token is never trusted for
 * identity on the client.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Decode(input: string): string {
  if (typeof globalThis.atob === 'function') return globalThis.atob(input);
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of input.replace(/=+$/, '')) {
    const value = B64.indexOf(ch);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

function decodeBase64Url(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
  return base64Decode(padded);
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
