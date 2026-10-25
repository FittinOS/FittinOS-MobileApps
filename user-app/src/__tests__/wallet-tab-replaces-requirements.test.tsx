/**
 * The 4th bottom-tab position now opens the real, existing Coin Wallet screen
 * (reused as-is, not rebuilt) instead of Requirements. Requirements itself
 * must no longer show as a tab button, but its route must still work —
 * Home's "Post a requirement" quick action still pushes straight to it.
 */
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';
import { user, page, professional } from '@/test-support/discover-location.fixtures';

jest.mock('expo-location', () => ({
  __esModule: true,
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.setTimeout(60_000);

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  store.clear();
  store.set('fittinuser.accessToken', 'a');
  store.set('fittinuser.refreshToken', 'r');
  resetTokenCacheForTests();
  jest.restoreAllMocks();
  jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(user);
  jest.spyOn(endpoints.categoriesApi, 'list').mockResolvedValue([]);
  jest.spyOn(endpoints.professionalsApi, 'discover').mockResolvedValue(page([professional]));
  jest.spyOn(endpoints.walletApi, 'balance').mockResolvedValue({ coinBalance: 1234, updatedAt: '2026-01-01T00:00:00Z' } as never);
  jest.spyOn(endpoints.walletApi, 'transactions').mockResolvedValue(page([]));
  jest.spyOn(endpoints.bookingsApi, 'list').mockResolvedValue(page([]));
});

it('opens the real wallet screen (real balance, real transactions) from the Wallet tab, and hides Requirements from the tab bar without breaking its route', async () => {
  await renderRouter('src/app', { initialUrl: '/' });

  // Requirements is gone from the tab bar...
  expect(screen.queryByRole('tab', { name: 'Requirements' })).toBeNull();
  // ...but Wallet is there instead, at the same position.
  fireEvent.press(await screen.findByRole('tab', { name: 'Wallet' }));

  // This is the SAME wallet screen reachable via the stack push from Home (real balance, real API).
  await waitFor(() => expect(endpoints.walletApi.balance).toHaveBeenCalled());
  await screen.findByText('1,234 coins');
  await screen.findByText('Transaction history');

  // As the active tab root, there is nowhere to go "back" to — no back button.
  expect(screen.queryByLabelText('Back')).toBeNull();

  // The same screen, reached instead as a stack push from Home, does show one.
  fireEvent.press(screen.getByRole('tab', { name: 'Home' }));
  fireEvent.press(await screen.findByLabelText('1,234 coins. View wallet'));
  await screen.findByText('Transaction history');
  expect(screen.getByLabelText('Back')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back'));

  // Requirements' own route is still fully reachable — just not from the tab bar.
  await screen.findByRole('tab', { name: 'Home' });
  fireEvent.press(await screen.findByLabelText('Post a requirement'));
  await screen.findByText('Post requirement');
});
