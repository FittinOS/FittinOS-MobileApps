/**
 * Home's "Nearby professionals" section must read the SAME location Discover
 * resolves — not a second, independent one. One scenario per file: the GPS
 * chain's trailing async state update otherwise lands outside any act()
 * boundary and pollutes whichever test in the same file runs next (same
 * reasoning as the existing discover-gps-*.test.tsx files).
 */
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';
import { user, page, professional, geocoded } from '@/test-support/discover-location.fixtures';

jest.mock('expo-location', () => ({
  __esModule: true,
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
import * as Location from 'expo-location';

jest.setTimeout(60_000);

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

const wallet = { coinBalance: 100, updatedAt: '2026-01-01T00:00:00Z' };

beforeEach(() => {
  store.clear();
  store.set('fittinuser.accessToken', 'a');
  store.set('fittinuser.refreshToken', 'r');
  resetTokenCacheForTests();
  jest.restoreAllMocks();
  jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(user);
  jest.spyOn(endpoints.categoriesApi, 'list').mockResolvedValue([]);
  jest.spyOn(endpoints.professionalsApi, 'discover').mockResolvedValue(page([professional]));
  jest.spyOn(endpoints.walletApi, 'balance').mockResolvedValue(wallet as never);
  jest.spyOn(endpoints.walletApi, 'transactions').mockResolvedValue(page([]));
  jest.spyOn(endpoints.bookingsApi, 'list').mockResolvedValue(page([]));

  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined', canAskAgain: true });
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
  (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: 12.978, longitude: 77.64 } });
  jest.spyOn(endpoints.locationsApi, 'geocode').mockResolvedValue(geocoded);
});

it('shows a prompt (never a fabricated "nearby" result) on Home until a location is resolved', async () => {
  await renderRouter('src/app', { initialUrl: '/' });

  await screen.findByText('Find professionals near you');
  // The nearby query must never fire without real coordinates.
  expect(endpoints.professionalsApi.discover).not.toHaveBeenCalledWith(expect.objectContaining({ sortBy: 'distance' }));
});

it('shows real nearby results on Home once a location is resolved on Discover — the same shared state, not a second one', async () => {
  await renderRouter('src/app', { initialUrl: '/discover' });
  fireEvent.press(await screen.findByLabelText('Use current location'));
  await waitFor(() => expect(screen.getByText('Indiranagar, Bengaluru')).toBeTruthy());

  fireEvent.press(screen.getByRole('tab', { name: 'Home' }));

  await screen.findByText('Nearby professionals');
  await waitFor(() =>
    expect(endpoints.professionalsApi.discover).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 12.978, lng: 77.64, sortBy: 'distance', limit: 4 }),
    ),
  );
  // The resolved professional actually renders in the Nearby section.
  await waitFor(() => expect(screen.getAllByText('Rohan Mehta').length).toBeGreaterThan(0));
});
