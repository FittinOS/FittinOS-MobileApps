/**
 * The exact reported bug, reproduced against the real route tree: tapping
 * Buy now on the Coin packages screen in an environment without the native
 * Cashfree module (Jest matches Expo Go here — see native-capabilities.ts)
 * must show a neutral "payments aren't available" sheet, never a sheet
 * worded like a failed payment attempt, and must never create an order.
 */
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, waitFor } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';

jest.setTimeout(60_000);

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const user = {
  id: 'u1', email: 'pro@fittin.local', role: 'PROFESSIONAL' as const, status: 'ACTIVE' as const, emailVerified: true,
  fullName: 'Rahul Verma', phone: null, avatarUrl: null, createdAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  store.clear();
  store.set('fittin.accessToken', 'a');
  store.set('fittin.refreshToken', 'r');
  resetTokenCacheForTests();
  jest.restoreAllMocks();
  jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(user);
  jest.spyOn(endpoints.walletApi, 'balance').mockResolvedValue({ coinBalance: 10_100, userId: 'u1' } as never);
  jest.spyOn(endpoints.walletApi, 'transactions').mockResolvedValue({ items: [], total: 0, page: 1, limit: 4, totalPages: 1 });
  jest.spyOn(endpoints.walletApi, 'packages').mockResolvedValue([
    { id: 'pkg-1', coins: 2500, bonusCoins: 625, priceAmount: 500000, originalPriceAmount: null, tag: null, isActive: true } as never,
  ]);
  jest.spyOn(endpoints.paymentsApi, 'createOrder');
});

it('tapping Buy now without the native payment module shows a neutral unavailable sheet, not a failed-payment one, and creates no order', async () => {
  const screen = await renderRouter('src/app', { initialUrl: '/wallet/buy' });

  const buyButton = await screen.findByLabelText(/Buy 2,500 coins/i, {}, { timeout: 10_000 });
  fireEvent.press(buyButton);

  expect(await screen.findByText("Payments aren't available here")).toBeTruthy();
  expect(screen.queryByText('Payment not completed')).toBeNull();
  expect(screen.getByText(/FittinOS Pro app build/i)).toBeTruthy();
  expect(screen.getByText(/No order was created/i)).toBeTruthy();
  // Only a Close action — no "Check payment status", since nothing was ever attempted.
  expect(screen.queryByRole('button', { name: 'Check payment status' })).toBeNull();
  expect(endpoints.paymentsApi.createOrder).not.toHaveBeenCalled();

  // The sheet exposes more than one "Close" control (header icon + backdrop +
  // this screen's own ghost button) — any of them dismisses it the same way.
  fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[0]);
  await waitFor(() => expect(screen.queryByText("Payments aren't available here")).toBeNull());
});
