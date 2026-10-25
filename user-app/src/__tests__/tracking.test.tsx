/**
 * The booking tracking screen, with the network and the maps-availability
 * flag stubbed — same harness as the messaging screen tests.
 */
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';
import * as mapsConfig from '@/features/tracking/maps-config';
import type { BookingTrackingView } from '@/api/endpoints';
import type { BookingDto } from '@/api/shared';

// expo-location's real exports are non-configurable in this SDK version
// (jest.spyOn can't redefine requestForegroundPermissionsAsync/
// getCurrentPositionAsync), so the module is mocked wholesale here instead.
jest.mock('expo-location', () => ({
  __esModule: true,
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
import * as Location from 'expo-location';

jest.setTimeout(60_000);

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const user = {
  id: 'u1', email: 'client@fittin.local', role: 'CLIENT' as const, status: 'ACTIVE' as const, emailVerified: true,
  fullName: 'Ananya Rao', phone: null, avatarUrl: null, createdAt: '2026-01-01T00:00:00Z',
};

function booking(over: Partial<BookingDto> = {}): BookingDto {
  return {
    id: 'b1', clientId: 'u1', professionalId: 'p1', serviceId: 's1',
    status: 'CONFIRMED', startTime: '2026-10-21T09:00:00Z', endTime: '2026-10-21T10:00:00Z',
    priceAmount: 50000, originalAmount: 50000, discountAmount: 0, refundAmount: 0,
    createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    professional: { id: 'p1', userId: 'pu1', user: { id: 'pu1', fullName: 'Rohan Mehta', avatarUrl: null, email: '' } },
    service: { id: 's1', title: 'Strength Training' },
    ...over,
  } as unknown as BookingDto;
}

function tracking(over: Partial<BookingTrackingView> = {}): BookingTrackingView {
  return { eligibility: 'LIVE', hasStarted: true, ...over };
}

beforeEach(() => {
  store.clear();
  store.set('fittinuser.accessToken', 'a');
  store.set('fittinuser.refreshToken', 'r');
  resetTokenCacheForTests();
  jest.restoreAllMocks();
  jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(user);
  jest.spyOn(endpoints.bookingsApi, 'get').mockResolvedValue(booking());
});

describe('Booking tracking screen — map visibility by eligibility', () => {
  it('never mounts a map for a non-live eligibility, regardless of maps configuration', async () => {
    jest.spyOn(mapsConfig, 'isMapsConfigured').mockReturnValue(true);
    jest.spyOn(endpoints.bookingsApi, 'tracking').mockResolvedValue(tracking({ eligibility: 'WAITING', hasStarted: false }));
    await renderRouter('src/app', { initialUrl: '/bookings/b1/tracking' });
    expect(await screen.findByText(/hasn.t started sharing/i)).toBeTruthy();
    expect(screen.queryByTestId('mock-map-view')).toBeNull();
  });

  it('renders the real map when eligibility is LIVE and maps are configured', async () => {
    jest.spyOn(mapsConfig, 'isMapsConfigured').mockReturnValue(true);
    jest.spyOn(endpoints.bookingsApi, 'tracking').mockResolvedValue(
      tracking({ eligibility: 'LIVE', latitude: 12.9, longitude: 77.6, locationUpdatedAt: '2026-10-21T09:05:00Z', vehicleType: 'CAR' }),
    );
    await renderRouter('src/app', { initialUrl: '/bookings/b1/tracking' });
    expect(await screen.findByTestId('mock-map-view')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('labels a STALE position as "last known", never as live, while still showing the map', async () => {
    jest.spyOn(mapsConfig, 'isMapsConfigured').mockReturnValue(true);
    jest.spyOn(endpoints.bookingsApi, 'tracking').mockResolvedValue(
      tracking({ eligibility: 'STALE', latitude: 12.9, longitude: 77.6, locationUpdatedAt: '2026-10-21T08:00:00Z' }),
    );
    await renderRouter('src/app', { initialUrl: '/bookings/b1/tracking' });
    expect(await screen.findByTestId('mock-map-view')).toBeTruthy();
    expect(screen.getByText(/hasn.t updated in a while/i)).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
  });

  it('falls back to the text-only placeholder when LIVE but maps are not configured — the screen stays functional', async () => {
    jest.spyOn(mapsConfig, 'isMapsConfigured').mockReturnValue(false);
    jest.spyOn(endpoints.bookingsApi, 'tracking').mockResolvedValue(tracking({ eligibility: 'LIVE', latitude: 12.9, longitude: 77.6 }));
    await renderRouter('src/app', { initialUrl: '/bookings/b1/tracking' });
    expect(await screen.findByText(/map isn.t available right now/i)).toBeTruthy();
    expect(screen.queryByTestId('mock-map-view')).toBeNull();
  });

  it('draws a route polyline only when the backend route is actually available', async () => {
    jest.spyOn(mapsConfig, 'isMapsConfigured').mockReturnValue(true);
    jest.spyOn(endpoints.bookingsApi, 'tracking').mockResolvedValue(
      tracking({
        eligibility: 'LIVE',
        latitude: 12.9,
        longitude: 77.6,
        route: { available: true, polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', distanceMeters: 2400, durationSeconds: 600 },
      }),
    );
    await renderRouter('src/app', { initialUrl: '/bookings/b1/tracking' });
    expect(await screen.findByTestId('mock-map-polyline')).toBeTruthy();
    expect(screen.getByText(/2\.4 km · 10 min/)).toBeTruthy();
  });

  it('never draws a route when the backend has none available, even with a real professional position', async () => {
    jest.spyOn(mapsConfig, 'isMapsConfigured').mockReturnValue(true);
    jest.spyOn(endpoints.bookingsApi, 'tracking').mockResolvedValue(tracking({ eligibility: 'LIVE', latitude: 12.9, longitude: 77.6 }));
    await renderRouter('src/app', { initialUrl: '/bookings/b1/tracking' });
    expect(await screen.findByTestId('mock-map-view')).toBeTruthy();
    expect(screen.queryByTestId('mock-map-polyline')).toBeNull();
  });

  it('adds the client marker only after the one-shot "share my location" action succeeds — never automatically', async () => {
    jest.spyOn(mapsConfig, 'isMapsConfigured').mockReturnValue(true);
    jest.spyOn(endpoints.bookingsApi, 'tracking').mockResolvedValue(tracking({ eligibility: 'LIVE', latitude: 12.9, longitude: 77.6 }));
    jest.spyOn(Location, 'requestForegroundPermissionsAsync').mockResolvedValue({ status: 'granted' } as never);
    const getPosition = jest
      .spyOn(Location, 'getCurrentPositionAsync')
      .mockResolvedValue({ coords: { latitude: 12.95, longitude: 77.65 } } as never);

    await renderRouter('src/app', { initialUrl: '/bookings/b1/tracking' });
    await screen.findByTestId('mock-map-view');
    expect(screen.getAllByTestId('mock-map-marker')).toHaveLength(1); // professional only — no watch, no fabricated client position

    await fireEvent.press(await screen.findByRole('button', { name: 'Share my location for an ETA' }));
    await waitFor(() => expect(screen.getAllByTestId('mock-map-marker')).toHaveLength(2));
    expect(getPosition).toHaveBeenCalledTimes(1); // one-shot — never a continuous watch
  });
});
