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

it('falls back to searching by raw coordinates (never blocked) when the GPS fix succeeds but reverse-geocoding fails', async () => {
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
  (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: 12.9, longitude: 77.6 } });
  jest.spyOn(endpoints.locationsApi, 'geocode').mockRejectedValue({
    isAxiosError: true,
    response: { status: 503, data: { message: 'Location search is temporarily unavailable. You can still enter your location manually.' } },
  });

  await renderRouter('src/app', { initialUrl: '/discover' });
  fireEvent.press(await screen.findByLabelText('Use current location'));

  // This app's existing error-presentation convention (lib/errors.ts) surfaces —
  // not the old, misleading blanket "couldn't get your location" string, which
  // would wrongly blame GPS for a server-side failure the device had nothing to
  // do with. For a 5xx, that convention intentionally shows a generic
  // "something went wrong on our end" message rather than the raw backend text.
  expect(await screen.findByText(/fittinos ran into a problem/i)).toBeTruthy();

  // The professional-search API accepts lat/lng independently of any resolved
  // address, so the GPS fix is still useful: search proceeds under a truthful,
  // generic "Current location" label rather than being blocked entirely.
  await screen.findByText('Current location');
  const [params] = (endpoints.professionalsApi.discover as jest.Mock).mock.calls.at(-1)!;
  expect(params).toMatchObject({ lat: 12.9, lng: 77.6 });
});
