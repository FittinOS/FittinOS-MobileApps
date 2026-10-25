/** Home's Bento category cards must still pass the real backend category id, and Discover
 * (already mounted as a tab) must actually apply it — not just on first mount. */
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
const category = { id: 'cat-1', name: 'Yoga', slug: 'yoga', description: null, iconUrl: null, isActive: true, sortOrder: 0 };

beforeEach(() => {
  store.clear();
  store.set('fittinuser.accessToken', 'a');
  store.set('fittinuser.refreshToken', 'r');
  resetTokenCacheForTests();
  jest.restoreAllMocks();
  jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(user);
  jest.spyOn(endpoints.categoriesApi, 'list').mockResolvedValue([category]);
  jest.spyOn(endpoints.professionalsApi, 'discover').mockResolvedValue(page([professional]));
  jest.spyOn(endpoints.walletApi, 'balance').mockResolvedValue({ coinBalance: 0, updatedAt: '2026-01-01T00:00:00Z' } as never);
  jest.spyOn(endpoints.walletApi, 'transactions').mockResolvedValue(page([]));
  jest.spyOn(endpoints.bookingsApi, 'list').mockResolvedValue(page([]));
});

it('navigates to Discover and applies the real category id when a Bento category card is tapped', async () => {
  await renderRouter('src/app', { initialUrl: '/' });

  fireEvent.press(await screen.findByLabelText('Yoga'));

  await waitFor(() =>
    expect(endpoints.professionalsApi.discover).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'cat-1' })),
  );
  // The chip for the same category now shows selected on Discover itself.
  await screen.findByText('Find a professional near you');
});
