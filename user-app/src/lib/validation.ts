/**
 * Client-side checks that mirror the backend's DTO validators, so the user
 * hears about an obvious mistake before a round trip. The backend still
 * validates everything; these never replace it.
 */

// apps/backend/src/common/validators/password.validator.ts
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
// apps/backend/src/requirements/dto/requirement.dto.ts
export const MAX_BUDGET_PAISE = 10_000_000;

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

export function validateRequirementTitle(title: string): string | undefined {
  const value = title.trim();
  if (value.length < 6) return 'Title must be at least 6 characters.';
  if (value.length > 140) return 'Title must be at most 140 characters.';
  return undefined;
}

export function validateRequirementDescription(description: string): string | undefined {
  const value = description.trim();
  if (value.length < 20) return 'Description must be at least 20 characters.';
  if (value.length > 2000) return 'Description must be at most 2000 characters.';
  return undefined;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

/** Indian postal PIN code — exactly 6 digits after trimming. Never sent to the API until this passes. */
export function validatePincode(pincode: string): string | undefined {
  const value = pincode.trim();
  if (!value) return 'Enter a 6-digit PIN code.';
  if (!/^[0-9]+$/.test(value)) return 'PIN code must contain digits only.';
  if (value.length !== 6) return 'PIN code must be exactly 6 digits.';
  return undefined;
}
