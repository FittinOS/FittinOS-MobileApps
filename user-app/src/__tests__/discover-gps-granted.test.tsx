/**
 * Discover's "Use current location" — granted path. One scenario per file:
 * a fire-and-forget async permission/geocode chain's trailing state update
 * otherwise lands outside any act() boundary and pollutes whichever test
 * in the same file runs next (verified directly against this exact repo/
 * Jest setup) — splitting avoids that without masking or skipping anything.
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

it('requests only foreground permission, geocodes the fix, and re-searches with lat/lng', async () => {
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined', canAskAgain: true });
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
  (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: 12.978, longitude: 77.64 } });
  jest.spyOn(endpoints.locationsApi, 'geocode').mockResolvedValue(geocoded);

  await renderRouter('src/app', { initialUrl: '/discover' });
  fireEvent.press(await screen.findByLabelText('Use current location'));

  await waitFor(() => expect(screen.getByText('Indiranagar, Bengaluru')).toBeTruthy());

  // Backend only receives coordinates — never a background permission, never a raw PIN code.
  expect(endpoints.locationsApi.geocode).toHaveBeenCalledWith({ latitude: 12.978, longitude: 77.64 });
  await waitFor(() =>
    expect(endpoints.professionalsApi.discover).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 12.978, lng: 77.64, sortBy: 'distance' }),
    ),
  );
});
