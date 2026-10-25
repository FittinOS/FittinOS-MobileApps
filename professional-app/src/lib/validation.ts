/**
 * Client-side checks that mirror the backend's DTO validators, so the user
 * hears about an obvious mistake before a round trip. The backend still
 * validates everything; these never replace it.
 */

// apps/backend/src/common/validators/password.validator.ts
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
// apps/backend/src/payouts/accounts/payout-account.util.ts
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_REGEX = /^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,31}$/;
// apps/backend/src/services/dto/service.dto.ts
export const MAX_PRICE_PAISE = 10_000_000;
export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 8 * 60;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
  return undefined;
}

export function validatePassword(password: string, label = 'Password'): string | undefined {
  if (!password) return `${label} is required.`;
  if (password.length < PASSWORD_MIN_LENGTH) return `${label} must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `${label} must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/[a-z]/.test(password)) return `${label} must contain a lowercase letter.`;
  if (!/[A-Z]/.test(password)) return `${label} must contain an uppercase letter.`;
  if (!/[0-9]/.test(password)) return `${label} must contain a number.`;
  return undefined;
}

export function validateFullName(name: string): string | undefined {
  const value = name.trim();
  if (value.length < 2) return 'Enter your full name (at least 2 characters).';
  if (value.length > 120) return 'Name must be at most 120 characters.';
  return undefined;
}

/** Optional field — empty is allowed. Matches RegisterDto/UpdateAccountDto. */
export function validatePhone(phone: string): string | undefined {
  const value = phone.trim();
  if (!value) return undefined;
  if (!/^\+?[0-9]{7,15}$/.test(value)) return 'Phone must be 7–15 digits, optionally starting with +.';
  return undefined;
}

export function validateVerificationCode(code: string): string | undefined {
  if (!/^[0-9]{6}$/.test(code.trim())) return 'Enter the 6-digit code from your email.';
  return undefined;
}

export function validateIfsc(ifsc: string): string | undefined {
  if (!IFSC_REGEX.test(ifsc.trim().toUpperCase())) return 'Enter a valid 11-character IFSC (for example ABCD0123456).';
  return undefined;
}

export function validateUpi(upi: string): string | undefined {
  if (!UPI_REGEX.test(upi.trim().toLowerCase())) return 'Enter a valid UPI id (for example name@bank).';
  return undefined;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
