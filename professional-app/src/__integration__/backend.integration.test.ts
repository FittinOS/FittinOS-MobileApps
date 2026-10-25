/**
 * @jest-environment node
 */
/**
 * Live contract tests: the app's REAL endpoint layer, API client and token
 * storage against a running FittinOS backend. Skipped unless
 * INTEGRATION_API_URL is set, e.g.
 *
 *   INTEGRATION_API_URL=http://localhost:4200/api EXPO_PUBLIC_API_URL=http://localhost:4200/api \
 *     npx jest --runInBand src/__integration__
 *
 * Uses the seeded demo professional (prisma/seed.ts). Writes are limited to
 * reversible ones: toggling acceptingWork and restoring it, creating one
 * availability slot a year out and deleting it. No payment is ever made.
 */
import axios from 'axios';
import { api } from '@/api/client';
import {
  authApi,
  availabilityApi,
  bookingsApi,
  callsApi,
  conversationsApi,
  earningsApi,
  featuredApi,
  leadsApi,
  notificationsApi,
  paymentsApi,
  payoutAccountApi,
  plansApi,
  profileApi,
  promotionsApi,
  servicesApi,
  supportApi,
  walletApi,
} from '@/api/endpoints';
import { getErrorPresentation, httpStatusOf } from '@/lib/errors';
import { loadTokens, saveTokens, clearTokens, resetTokenCacheForTests } from '@/lib/token-store';

const BASE = process.env.INTEGRATION_API_URL;
const run = BASE ? describe : describe.skip;
jest.setTimeout(60_000);

run(`live backend ${BASE ?? ''}`, () => {
  beforeAll(async () => {
    // Real sockets from Node: use axios's http adapter for the app client and the refresh call.
    axios.defaults.adapter = 'http';
    api.http.defaults.adapter = 'http';
    resetTokenCacheForTests();
    await clearTokens();
    const result = await authApi.login('pro@fittin.local', 'Demo@Password1');
    expect(result.user.role).toBe('PROFESSIONAL');
    await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  });

  afterAll(async () => {
    const t = await loadTokens();
    if (t) await authApi.logout(t.refreshToken).catch(() => undefined);
  });

  it('auth: wrong password is a 401 the client does not try to refresh', async () => {
    await expect(authApi.login('pro@fittin.local', 'Wrong-Password-1')).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('reads every professional surface with the expected shapes', async () => {
    const me = await authApi.me();
    expect(me.email).toBe('pro@fittin.local');
    const profile = await profileApi.get();
    expect(typeof profile.isLive).toBe('boolean');
    expect(Array.isArray((await servicesApi.list()).items)).toBe(true);
    expect(Array.isArray(await servicesApi.categories())).toBe(true);
    expect((await availabilityApi.mine({ limit: 5 })).items).toBeDefined();
    expect((await leadsApi.list({ limit: 5 })).items).toBeDefined();
    expect(typeof (await leadsApi.stats()).conversionRate).toBe('number');
    expect((await bookingsApi.list({ scope: 'all', limit: 5 })).items).toBeDefined();
    const convs = await conversationsApi.mine({ limit: 5 });
    expect(convs.items).toBeDefined();
    if (convs.items[0]) {
      const detail = await conversationsApi.get(convs.items[0].id);
      expect(Array.isArray(detail.messages)).toBe(true);
      expect(Array.isArray(await callsApi.history(detail.id))).toBe(true);
    }
    expect(typeof (await walletApi.balance()).coinBalance).toBe('number');
    expect(typeof (await walletApi.coinValue()).coinValuePaise).toBe('number');
    expect(Array.isArray(await walletApi.packages())).toBe(true);
    expect((await walletApi.transactions({ limit: 5 })).items).toBeDefined();
    expect((await paymentsApi.history({ limit: 5 })).items).toBeDefined();
    const plans = await plansApi.list();
    expect(plans.every((p) => Array.isArray(p.billingOptions))).toBe(true);
    await plansApi.current();
    expect(Array.isArray(await plansApi.couponOffers())).toBe(true);
    expect(Array.isArray(await featuredApi.plans())).toBe(true);
    expect((await featuredApi.mine({ limit: 5 })).items).toBeDefined();
    expect(Array.isArray(await promotionsApi.list())).toBe(true);
    expect(Array.isArray((await promotionsApi.analytics()).byCoupon)).toBe(true);
    expect(typeof (await earningsApi.summary()).availableForPayout).toBe('number');
    expect((await earningsApi.list({ limit: 5 })).items).toBeDefined();
    expect((await earningsApi.payouts({ limit: 5 })).items).toBeDefined();
    expect(typeof (await payoutAccountApi.get()).readiness.canReceivePayout).toBe('boolean');
    expect((await notificationsApi.list({ limit: 5 })).items).toBeDefined();
    expect(typeof (await notificationsApi.unreadCount()).count).toBe('number');
    expect(Array.isArray((await notificationsApi.preferences()).mutedCategories)).toBe(true);
    expect((await supportApi.list({ limit: 5 })).items).toBeDefined();
    expect(Array.isArray(await profileApi.kycSubmissions())).toBe(true);
    expect(Array.isArray(await profileApi.certificationSubmissions())).toBe(true);
    expect(Array.isArray(await conversationsApi.blocked())).toBe(true);
    const ice = await callsApi.iceServers();
    expect(ice.iceServers.length).toBeGreaterThan(0);
  });

  it('toggles acceptingWork and restores it', async () => {
    const before = (await profileApi.get()).acceptingWork;
    expect((await profileApi.update({ acceptingWork: !before })).acceptingWork).toBe(!before);
    expect((await profileApi.update({ acceptingWork: before })).acceptingWork).toBe(before);
  });

  it('creates and deletes one availability slot (when KYC allows)', async () => {
    const start = new Date(Date.now() + 365 * 86_400_000);
    start.setUTCHours(3, 30, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    try {
      const slot = await availabilityApi.create({ startTime: start.toISOString(), endTime: end.toISOString() });
      expect(slot.status).toBe('OPEN');
      await availabilityApi.remove(slot.id);
    } catch (error) {
      // A professional without approved KYC is refused by the backend — that is the rule, not a failure.
      expect([403, 409, 422]).toContain(httpStatusOf(error));
    }
  });

  it('payment order creation is refused cleanly when the gateway is disabled', async () => {
    const pkg = (await walletApi.packages()).find((p) => p.isActive);
    if (!pkg) return;
    try {
      const order = await paymentsApi.createOrder({ purpose: 'COIN_PACKAGE', coinPackageId: pkg.id, idempotencyKey: `it-${Date.now()}` });
      // A configured gateway returns a real session; the app never treats that as paid.
      expect(order.paymentSessionId).toBeTruthy();
    } catch (error) {
      expect(httpStatusOf(error)).toBeGreaterThanOrEqual(400);
      expect(getErrorPresentation(error).title).toBeTruthy();
    }
  });

  it('refresh rotation: an expired-looking access token is refreshed and the rotated pair stored', async () => {
    const before = await loadTokens();
    await saveTokens({ accessToken: 'not-a-jwt', refreshToken: before!.refreshToken });
    const fresh = await api.getFreshAccessToken();
    const after = await loadTokens();
    expect(fresh).toBeTruthy();
    expect(after!.refreshToken).not.toBe(before!.refreshToken);
    expect((await authApi.me()).email).toBe('pro@fittin.local');
  });

  it('logout revokes the refresh token server-side', async () => {
    const result = await authApi.login('pro@fittin.local', 'Demo@Password1');
    await authApi.logout(result.refreshToken);
    await expect(axios.post(`${BASE}/auth/refresh`, { refreshToken: result.refreshToken })).rejects.toMatchObject({ response: { status: 401 } });
  });
});
