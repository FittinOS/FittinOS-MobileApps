import * as Location from 'expo-location';
import { profileApi } from '@/api/endpoints';
import { extractErrorMessage } from '@/lib/errors';

export type ShareLocationResult = { ok: true } | { ok: false; message: string };

/**
 * "Share my current location": one real GPS fix sent to
 * PATCH /professionals/me/location (admin-only freshness signal — separate
 * from the business location). On failure, the reason (never a coordinate)
 * is reported to /professionals/me/location/diagnostics, like the web does.
 */
export async function shareCurrentLocation(): Promise<ShareLocationResult> {
  const report = (reason: string, permissionState: string, message?: string) =>
    profileApi
      .reportLocationFailure({ reason, permissionState, page: '/professional/profile', attempts: 1, ...(message ? { message: message.slice(0, 200) } : {}) })
      .catch(() => undefined);

  const enabled = await Location.hasServicesEnabledAsync().catch(() => true);
  if (!enabled) {
    void report('position_unavailable', 'unsupported', 'Location services are turned off');
    return { ok: false, message: 'Turn on location services on your phone, then try again.' };
  }
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) {
    void report('permission_denied', 'denied');
    return { ok: false, message: 'Location access was denied. Allow it for FittinOS Pro in your phone settings.' };
  }
  let fix: Location.LocationObject;
  try {
    fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch (error) {
    void report('position_unavailable', 'granted', error instanceof Error ? error.message : undefined);
    return { ok: false, message: "We couldn't get a GPS fix. Move somewhere with a clearer view of the sky and try again." };
  }
  try {
    await profileApi.shareCurrentLocation({
      latitude: fix.coords.latitude,
      longitude: fix.coords.longitude,
      ...(fix.coords.accuracy != null ? { accuracyMeters: Math.min(fix.coords.accuracy, 100_000) } : {}),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: extractErrorMessage(error, 'Could not share your location.') };
  }
}
