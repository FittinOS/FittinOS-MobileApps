/**
 * User-facing error copy — ported from apps/web/lib/errors.ts so both
 * clients say the same thing for the same backend response. Identical to
 * apps/professional-app/src/lib/errors.ts (own copy, same contract).
 *
 * The backend's ValidationPipe answers DTO failures with a generic
 * "Validation failed" message and the real reasons under `errors`; this
 * surfaces the real reasons. Connectivity failures (no response) never leak
 * Axios's technical strings.
 */
interface ErrorLike {
  isAxiosError?: boolean;
  message?: string;
  code?: string;
  response?: { status: number; data?: { message?: string; code?: string; errors?: Record<string, unknown> } };
}

function asErrorLike(err: unknown): ErrorLike {
  return (err ?? {}) as ErrorLike;
}

export function extractErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = asErrorLike(err);
  const data = e.response?.data;
  if (!data) {
    if (e.isAxiosError) return fallback;
    return e.message || fallback;
  }
  if (data.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors).flat().filter((m): m is string => typeof m === 'string' && m.length > 0);
    if (messages.length > 0) return messages.join(' ');
  }
  return data.message || fallback;
}

/** The backend's machine-readable error code (e.g. `SLOT_ALREADY_BOOKED`), if any. */
export function errorCodeOf(err: unknown): string | null {
  return asErrorLike(err).response?.data?.code ?? null;
}

export function httpStatusOf(err: unknown): number | null {
  return asErrorLike(err).response?.status ?? null;
}

export interface ErrorPresentation {
  title: string;
  description: string;
  /** True when the right recovery is "sign in again", not "retry". */
  isAuthError: boolean;
}

export function getErrorPresentation(err: unknown): ErrorPresentation {
  const e = asErrorLike(err);
  if (!e.response) {
    if (e.code === 'ECONNABORTED' || /timeout/i.test(e.message || '')) {
      return {
        title: 'Request timed out',
        description: 'That took longer than expected. Please check your connection and try again.',
        isAuthError: false,
      };
    }
    return {
      title: 'Unable to connect',
      description: "We couldn't reach FittinOS right now. Please check your connection and try again.",
      isAuthError: false,
    };
  }
  const status = e.response.status;
  switch (status) {
    case 401:
      return { title: 'Session expired', description: 'Please sign in again to continue.', isAuthError: true };
    case 403:
      return {
        title: "You don't have access to this",
        description: extractErrorMessage(err, "You don't have permission to do that."),
        isAuthError: false,
      };
    case 404:
      return {
        title: 'Not found',
        description: extractErrorMessage(err, "We couldn't find what you were looking for."),
        isAuthError: false,
      };
    case 409:
      return {
        title: "That didn't go through",
        description: extractErrorMessage(err, 'This conflicts with something that already happened. Please refresh and try again.'),
        isAuthError: false,
      };
    case 422:
      return { title: 'Check the form', description: extractErrorMessage(err, 'Some information is missing or invalid.'), isAuthError: false };
    case 429:
      return {
        title: 'Too many attempts',
        description: "You've tried that too many times. Please wait a moment before trying again.",
        isAuthError: false,
      };
    default:
      if (status >= 500) {
        return {
          title: 'Something went wrong on our end',
          description: 'FittinOS ran into a problem. Please try again in a moment.',
          isAuthError: false,
        };
      }
      return { title: 'Something went wrong', description: extractErrorMessage(err), isAuthError: false };
  }
}

/** Per-field messages from a 422 (`errors: { field: [messages] }`), first message per field. */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  const errors = asErrorLike(err).response?.data?.errors;
  if (!errors || typeof errors !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(errors)) {
    const first = Array.isArray(value) ? value.find((m) => typeof m === 'string') : typeof value === 'string' ? value : undefined;
    if (first) out[field] = first;
  }
  return out;
}
