import type { ProfessionalPlanDto, ProfessionalSubscriptionDto } from '@fittin/shared-types';
import { addMinutesToTime, groupByDay, planSlots } from '../availability/slot-plan';
import { bookingActions } from '../bookings/booking-actions';
import { socketTarget } from '../calls/native-env';
import { lastMessage, previewText } from '../messaging/messaging-helpers';
import { appRouteForActionUrl } from '../notifications/action-route';
import {
  CashfreeEnvironmentMismatchError,
  PaymentsUnavailableError,
  assertCashfreeEnvironmentMatches,
  isPendingVerification,
  isUserCancellation,
  newIdempotencyKey,
} from '../payments/checkout-logic';
import { cycleChoices, planAction, resolveCycle } from '../plans/plan-logic';

const HOUR = 3_600_000;

describe('bookingActions (web bookings table rules)', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  it('CONFIRMED in future: track, start, reschedule — no no-show yet', () => {
    expect(bookingActions({ status: 'CONFIRMED', startTime: new Date(now + HOUR).toISOString(), endTime: new Date(now + 2 * HOUR).toISOString() }, now)).toEqual({
      track: true,
      start: true,
      reschedule: true,
      complete: false,
      reportNoShow: false,
      cancel: true,
    });
  });
  it('no-show allowed after start and within 48h of the end', () => {
    const within = bookingActions({ status: 'CONFIRMED', startTime: new Date(now - 3 * HOUR).toISOString(), endTime: new Date(now - 2 * HOUR).toISOString() }, now);
    expect(within.reportNoShow).toBe(true);
    const tooLate = bookingActions({ status: 'IN_PROGRESS', startTime: new Date(now - 60 * HOUR).toISOString(), endTime: new Date(now - 50 * HOUR).toISOString() }, now);
    expect(tooLate).toMatchObject({ complete: true, reportNoShow: false });
  });
  it('terminal statuses offer nothing', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REFUNDED']) {
      expect(Object.values(bookingActions({ status, startTime: new Date(now).toISOString(), endTime: new Date(now).toISOString() }, now)).some(Boolean)).toBe(false);
    }
  });
});

describe('planSlots / groupByDay (availability)', () => {
  const now = new Date('2026-10-09T08:00:00');
  const day = new Date('2026-10-10T00:00:00');
  it('expands ranges across repeated weeks', () => {
    const plan = planSlots({ date: day, ranges: [{ start: '09:00', end: '10:00' }, { start: '18:00', end: '19:30' }], repeatWeeks: 3, now });
    expect(plan.ok && plan.slots.length).toBe(6);
    if (plan.ok) expect(plan.slots[2].startTime.getDate()).toBe(17);
  });
  it('rejects bad input like the web form', () => {
    expect(planSlots({ date: day, ranges: [], now })).toEqual({ ok: false, error: 'Add at least one time slot.' });
    expect(planSlots({ date: day, ranges: [{ start: '10:00', end: '09:00' }], now }).ok).toBe(false);
    expect(planSlots({ date: day, ranges: [{ start: '09:00', end: '10:00' }], repeatWeeks: 13, now }).ok).toBe(false);
    expect(planSlots({ date: new Date('2026-10-08T00:00:00'), ranges: [{ start: '09:00', end: '10:00' }], now })).toEqual({
      ok: false,
      error: 'Availability cannot be created in the past.',
    });
  });
  it('fills end times and groups upcoming slots by day', () => {
    expect(addMinutesToTime('09:30', 45)).toBe('10:15');
    expect(addMinutesToTime('23:30', 60)).toBe('23:59');
    const groups = groupByDay(
      [
        { startTime: '2026-10-10T10:00:00', endTime: '2026-10-10T11:00:00' },
        { startTime: '2026-10-09T05:00:00', endTime: '2026-10-09T06:00:00' },
        { startTime: '2026-10-10T08:00:00', endTime: '2026-10-10T09:00:00' },
      ],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].slots.map((s) => s.startTime)).toEqual(['2026-10-10T08:00:00', '2026-10-10T10:00:00']);
  });
});

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

describe('plan rules (web plans page)', () => {
  const option = (cycle: 'MONTHLY' | 'YEARLY', price: number, discountPercent = 0) => ({
    cycle,
    label: cycle === 'MONTHLY' ? 'Monthly' : 'Yearly',
    months: cycle === 'MONTHLY' ? 1 : 12,
    priceAmount: price,
    durationDays: cycle === 'MONTHLY' ? 30 : 365,
    isActive: true,
    discountPercent,
    effectiveMonthlyAmount: price,
    savingsAmount: 0,
  });
  const plan = (id: string, type: 'FREE' | 'PAID', billingOptions: ReturnType<typeof option>[]) =>
    ({ id, type, billingOptions, name: id, isActive: true, sortOrder: 0 }) as unknown as ProfessionalPlanDto;
  const plans = [plan('free', 'FREE', []), plan('basic', 'PAID', [option('MONTHLY', 49900), option('YEARLY', 499000, 17)]), plan('pro', 'PAID', [option('MONTHLY', 99900), option('YEARLY', 999000, 17)])];

  it('offers only cycles the backend sells, best discount as badge', () => {
    expect(cycleChoices(plans)).toEqual([
      { cycle: 'MONTHLY', label: 'Monthly', badge: undefined },
      { cycle: 'YEARLY', label: 'Yearly', badge: '17% OFF' },
    ]);
    expect(resolveCycle(cycleChoices(plans), null)).toBe('MONTHLY');
  });
  it('current plan+cycle cannot be re-bought; free is never bought; switches are labelled', () => {
    const sub = { planId: 'basic', billingCycle: 'MONTHLY' } as ProfessionalSubscriptionDto;
    expect(planAction({ plan: plans[1], index: 1, cycle: 'MONTHLY', activeSubscription: sub, currentPlanIndex: 1 })).toEqual({ kind: 'current' });
    expect(planAction({ plan: plans[1], index: 1, cycle: 'YEARLY', activeSubscription: sub, currentPlanIndex: 1 })).toEqual({ kind: 'buy', label: 'Switch to Yearly' });
    expect(planAction({ plan: plans[0], index: 0, cycle: 'MONTHLY', activeSubscription: sub, currentPlanIndex: 1 })).toEqual({ kind: 'free' });
    expect(planAction({ plan: plans[2], index: 2, cycle: 'MONTHLY', activeSubscription: sub, currentPlanIndex: 1 })).toEqual({ kind: 'buy', label: 'Upgrade' });
  });
});

describe('notification action URLs → app routes', () => {
  it('maps the backend web routes and ignores unknown ones', () => {
    expect(appRouteForActionUrl('/professional/messages/8943d65e-676a-484f-9c6a-499ea3c2642c')).toBe('/messages/8943d65e-676a-484f-9c6a-499ea3c2642c');
    expect(appRouteForActionUrl('/professional/bookings/abc-1')).toBe('/bookings/abc-1');
    expect(appRouteForActionUrl('/professional/kyc-intro')).toBe('/verification');
    expect(appRouteForActionUrl('/professional/plans?x=1')).toBe('/plans');
    expect(appRouteForActionUrl('/user/requirements/1')).toBeNull();
    expect(appRouteForActionUrl('https://evil.example')).toBeNull();
    expect(appRouteForActionUrl(null)).toBeNull();
  });
});

describe('messaging helpers', () => {
  it('previews from the professional side', () => {
    const msgs = [
      { id: '1', conversationId: 'c', senderRole: 'CLIENT' as const, isLocked: false, message: 'Hi', createdAt: '2026-01-01T10:00:00Z' },
      { id: '2', conversationId: 'c', senderRole: 'PROFESSIONAL' as const, isLocked: false, message: 'Hello!', createdAt: '2026-01-01T11:00:00Z' },
    ];
    expect(previewText(lastMessage(msgs))).toBe('You: Hello!');
    expect(previewText({ ...msgs[1], isLocked: true, message: null })).toBe('Your response is locked for the client');
    expect(previewText(undefined)).toBe('No messages yet');
  });
});

describe('call socket target', () => {
  it('matches the web: /calls namespace, <prefix>/socket.io path', () => {
    expect(socketTarget('http://10.0.2.2:4200/api')).toEqual({ url: 'http://10.0.2.2:4200/calls', path: '/api/socket.io' });
    expect(socketTarget('https://api.fittinos.com/api/')).toEqual({ url: 'https://api.fittinos.com/calls', path: '/api/socket.io' });
  });
});

import { monthOverMonth, monthlyEarnings } from '@/features/earnings/monthly';

describe('monthly earnings chart data', () => {
  const now = new Date(2026, 9, 15); // Oct 2026, local time
  const at = (y: number, m: number) => new Date(y, m, 10).toISOString();

  it('buckets the last six months, oldest first, excluding reversed earnings', () => {
    const buckets = monthlyEarnings(
      [
        { amount: 1000, status: 'AVAILABLE', createdAt: at(2026, 9) },
        { amount: 500, status: 'PAID_OUT', createdAt: at(2026, 9) },
        { amount: 700, status: 'REVERSED', createdAt: at(2026, 9) },
        { amount: 2000, status: 'PENDING', createdAt: at(2026, 8) },
        { amount: 9999, status: 'AVAILABLE', createdAt: at(2026, 2) }, // outside the window
      ],
      6,
      now,
    );
    expect(buckets).toHaveLength(6);
    expect(buckets[5].amount).toBe(1500);
    expect(buckets[4].amount).toBe(2000);
    expect(buckets.reduce((s, b) => s + b.amount, 0)).toBe(3500);
  });

  it('month-over-month change is null when either month had nothing', () => {
    expect(monthOverMonth([{ key: 'a', label: 'Sep', amount: 0 }, { key: 'b', label: 'Oct', amount: 500 }])).toBeNull();
    expect(monthOverMonth([{ key: 'a', label: 'Sep', amount: 500 }, { key: 'b', label: 'Oct', amount: 0 }])).toBeNull();
    expect(monthOverMonth([{ key: 'a', label: 'Sep', amount: 2000 }, { key: 'b', label: 'Oct', amount: 1500 }])).toBe(-25);
  });
});
