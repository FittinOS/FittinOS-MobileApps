import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
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
import * as Location from 'expo-location';

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
});

it('reports a GPS-fix failure (timeout/unavailable) without crashing', async () => {
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
  (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
  (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('timeout'));

  await renderRouter('src/app', { initialUrl: '/discover' });
  fireEvent.press(await screen.findByLabelText('Use current location'));

  // A GPS-layer failure (no fix, timeout) is distinguished from a backend/service
  // failure (see discover-gps-geocode-failure.test.tsx) — a message naming the
  // real cause, not the old, blanket "couldn't get your location" string.
  expect(await screen.findByText(/couldn.t get a gps fix/i)).toBeTruthy();
});
