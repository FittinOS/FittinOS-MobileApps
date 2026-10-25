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

it('never re-prompts once permanently denied', async () => {
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied', canAskAgain: false });

  await renderRouter('src/app', { initialUrl: '/discover' });
  fireEvent.press(await screen.findByLabelText('Use current location'));

  expect(await screen.findByText(/blocked for FittinOS/i)).toBeTruthy();
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});
