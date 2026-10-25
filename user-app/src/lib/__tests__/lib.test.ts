import { errorCodeOf, extractErrorMessage, fieldErrorsOf, getErrorPresentation } from '../errors';
import { formatCoins, formatDuration, formatMoney, humanize, initials, paiseToRupeesInput, rupeesToPaise } from '../format';
import { needsRefresh, secondsUntilExpiry } from '../jwt';
import {
  validateEmail,
  validatePassword,
  validatePhone,
  validatePincode,
  validateRequirementDescription,
  validateRequirementTitle,
  validateVerificationCode,
} from '../validation';

const axiosError = (status: number, data: object) => ({ isAxiosError: true, response: { status, data } });

describe('format', () => {
  it('formats integer paise as rupees without inventing decimals', () => {
    expect(formatMoney(50000)).toBe('₹500');
    expect(formatMoney(123456)).toBe('₹1,234.56');
    expect(formatMoney(null)).toBe('—');
  });
  it('converts typed rupees to integer paise and rejects junk', () => {
    expect(rupeesToPaise('499')).toBe(49900);
    expect(rupeesToPaise('1,299.50')).toBe(129950);
    expect(rupeesToPaise('12.345')).toBeNull();
    expect(rupeesToPaise('abc')).toBeNull();
    expect(paiseToRupeesInput(129950)).toBe('1299.50');
    expect(paiseToRupeesInput(50000)).toBe('500');
  });
  it('formats misc values', () => {
    expect(formatCoins(1)).toBe('1 coin');
    expect(formatCoins(1500)).toBe('1,500 coins');
    expect(formatDuration(90)).toBe('1h 30m');
    expect(humanize('COIN_PACKAGE')).toBe('Coin package');
    expect(initials('Priya Sharma')).toBe('PS');
  });
});

describe('validation mirrors backend DTO rules', () => {
  it('password: 10+ chars, upper, lower, digit', () => {
    expect(validatePassword('short')).toMatch(/at least 10/);
    expect(validatePassword('alllowercase1')).toMatch(/uppercase/);
    expect(validatePassword('ALLUPPERCASE1')).toMatch(/lowercase/);
    expect(validatePassword('NoDigitsHere')).toMatch(/number/);
    expect(validatePassword('Demo@Password1')).toBeUndefined();
  });
  it('Indian PIN code: exactly 6 digits, nothing else', () => {
    expect(validatePincode('')).toMatch(/enter a 6-digit/i);
    expect(validatePincode('56003')).toMatch(/exactly 6 digits/i);
    expect(validatePincode('5600381')).toMatch(/exactly 6 digits/i);
    expect(validatePincode('56003A')).toMatch(/digits only/i);
    expect(validatePincode('abcdef')).toMatch(/digits only/i);
    expect(validatePincode(' 560038 ')).toBeUndefined();
    expect(validatePincode('560038')).toBeUndefined();
  });
  it('email, phone, code', () => {
    expect(validateEmail('bad')).toBeDefined();
    expect(validateEmail('client@fittin.local')).toBeUndefined();
    expect(validatePhone('')).toBeUndefined();
    expect(validatePhone('+919876543210')).toBeUndefined();
    expect(validatePhone('12-34')).toBeDefined();
    expect(validateVerificationCode('123456')).toBeUndefined();
    expect(validateVerificationCode('12345')).toBeDefined();
  });
  it('requirement title and description length rules', () => {
    expect(validateRequirementTitle('short')).toMatch(/at least 6/);
    expect(validateRequirementTitle('A valid requirement title')).toBeUndefined();
    expect(validateRequirementDescription('too short')).toMatch(/at least 20/);
    expect(validateRequirementDescription('This description is definitely long enough.')).toBeUndefined();
  });
});

describe('errors', () => {
  it('surfaces per-field validation reasons over the generic message', () => {
    const err = axiosError(400, { message: 'Validation failed', errors: { email: ['email must be a valid email address'] } });
    expect(extractErrorMessage(err)).toBe('email must be a valid email address');
    expect(fieldErrorsOf(err)).toEqual({ email: 'email must be a valid email address' });
  });
  it('never leaks Axios network strings', () => {
    expect(extractErrorMessage({ isAxiosError: true, message: 'Network Error' }, 'Offline')).toBe('Offline');
    expect(getErrorPresentation({ isAxiosError: true, message: 'Network Error' }).title).toBe('Unable to connect');
  });
  it('maps status codes and exposes the backend code', () => {
    expect(getErrorPresentation(axiosError(401, {})).isAuthError).toBe(true);
    expect(getErrorPresentation(axiosError(503, { message: 'x' })).title).toMatch(/our end/);
    expect(errorCodeOf(axiosError(409, { code: 'SLOT_ALREADY_BOOKED' }))).toBe('SLOT_ALREADY_BOOKED');
  });
});

describe('jwt', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  it('reads exp and decides when to refresh', () => {
    const now = Date.now();
    const token = `${b64({ alg: 'none' })}.${b64({ exp: Math.floor(now / 1000) + 600 })}.x`;
    expect(secondsUntilExpiry(token, now)).toBeGreaterThan(590);
    expect(needsRefresh(token, now)).toBe(false);
    expect(needsRefresh('garbage', now)).toBe(true);
    expect(needsRefresh(null, now)).toBe(true);
  });
});
