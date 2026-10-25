import { appRouteForActionUrl } from '../notifications/action-route';
import {
  CashfreeEnvironmentMismatchError,
  PaymentsUnavailableError,
  assertCashfreeEnvironmentMatches,
  isPendingVerification,
  isUserCancellation,
  newIdempotencyKey,
} from '../payments/checkout-logic';

describe('checkout rules', () => {
  it('refuses a mismatched or disabled Cashfree environment', () => {
    expect(() => assertCashfreeEnvironmentMatches('SANDBOX', 'SANDBOX')).not.toThrow();
    expect(() => assertCashfreeEnvironmentMatches('PRODUCTION', 'SANDBOX')).toThrow(CashfreeEnvironmentMismatchError);
    expect(() => assertCashfreeEnvironmentMatches('DISABLED', 'PRODUCTION')).toThrow(PaymentsUnavailableError);
  });
  it('recognises the backend pending message and SDK cancellations', () => {
    expect(isPendingVerification('Payment has not been completed yet.')).toBe(true);
    expect(isPendingVerification('Payment failed.')).toBe(false);
    expect(isUserCancellation('action_cancelled')).toBe(true);
    expect(isUserCancellation('payment_failed', 'Bank declined')).toBe(false);
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});

describe('notification action URLs → app routes', () => {
  it('maps the backend web routes and ignores unknown ones', () => {
    expect(appRouteForActionUrl('/user/bookings/8943d65e-676a-484f-9c6a-499ea3c2642c')).toBe('/(app)/(tabs)/bookings/8943d65e-676a-484f-9c6a-499ea3c2642c');
    expect(appRouteForActionUrl('/user/requirements/abc-1')).toBe('/(app)/(tabs)/requirements/abc-1');
    expect(appRouteForActionUrl('/user/wallet/buy')).toBe('/(app)/wallet/buy');
    expect(appRouteForActionUrl('/user/dashboard')).toBe('/(app)/(tabs)');
    expect(appRouteForActionUrl('/professional/8943d65e-676a-484f-9c6a-499ea3c2642c')).toBe('/(app)/professional/8943d65e-676a-484f-9c6a-499ea3c2642c');
    expect(appRouteForActionUrl('/user/messages')).toBe('/(app)/messages');
    expect(appRouteForActionUrl('/user/messages/8943d65e-676a-484f-9c6a-499ea3c2642c')).toBe('/(app)/messages/8943d65e-676a-484f-9c6a-499ea3c2642c');
    expect(appRouteForActionUrl('/user/bookings/8943d65e-676a-484f-9c6a-499ea3c2642c/tracking')).toBe('/(app)/(tabs)/bookings/8943d65e-676a-484f-9c6a-499ea3c2642c/tracking');
    expect(appRouteForActionUrl('/some/unknown/path')).toBeNull();
    expect(appRouteForActionUrl('https://evil.example')).toBeNull();
    expect(appRouteForActionUrl(null)).toBeNull();
  });
});
