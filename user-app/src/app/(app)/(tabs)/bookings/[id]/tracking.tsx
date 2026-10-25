import { useState } from 'react';
import { Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useBooking, useBookingTracking } from '@/api/queries';
import { Avatar, Badge, Button, Card, ErrorState, Header, InfoBanner, KeyValue, Screen, Spinner } from '@/components/ui';
import { formatRelative, formatTime } from '@/lib/format';
import { trackingStatus } from '@/lib/status';
import { formatDuration, formatRoadDistance, formatVehicleLabel } from '@/features/tracking/tracking-helpers';
import { isMapsConfigured } from '@/features/tracking/maps-config';
import { MapUnavailablePlaceholder } from '@/features/tracking/MapUnavailablePlaceholder';
import type LiveTrackingMapComponent from '@/features/tracking/LiveTrackingMap';

/**
 * `react-native-maps` is a real native module — requiring it only throws if
 * actually evaluated, and it is only evaluated when isMapsConfigured() is
 * true (i.e. the app was built with a Maps key AND a native rebuild has
 * linked the module). Importing it lazily, inside the check below rather
 * than as a static top-level import, means a build that hasn't been
 * rebuilt with this module yet never executes any of its code — the
 * text-only screen keeps working exactly as before. See
 * src/features/tracking/maps-config.ts.
 */
function loadLiveTrackingMap(): typeof LiveTrackingMapComponent | null {
  if (!isMapsConfigured()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/features/tracking/LiveTrackingMap').default;
}

/**
 * Read-only live-tracking view for the client side of a booking. Polls the
 * backend's authoritative eligibility state (apps/backend's
 * BookingTrackingService) every 6s — this screen never computes staleness or
 * access rules itself, only renders what the server already decided.
 */
export default function BookingTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const tracking = useBookingTracking(id, { destination });

  async function shareMyLocationForEta() {
    setRequestingLocation(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission was not granted, so an ETA cannot be shown.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDestination({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      setLocationError("We couldn't get your location. Please try again.");
    } finally {
      setRequestingLocation(false);
    }
  }

  if (booking.isPending) return <Spinner label="Loading booking" />;
  if (booking.isError || !booking.data) return <ErrorState error={booking.error} onRetry={() => void booking.refetch()} />;

  const b = booking.data;
  const view = tracking.data;
  const s = trackingStatus(view?.eligibility);
  const isLive = view?.eligibility === 'LIVE' || view?.eligibility === 'STALE';
  const LiveTrackingMap = isLive ? loadLiveTrackingMap() : null;
  const professionalPosition = isLive && view?.latitude != null && view?.longitude != null ? { latitude: view.latitude, longitude: view.longitude } : null;
  const userPosition = destination ? { latitude: destination.lat, longitude: destination.lng } : null;

  return (
    <>
      <Header title="Live tracking" />
      <Screen>
        <View className="flex-row items-center">
          <Avatar name={b.professional?.user.fullName} uri={b.professional?.user.avatarUrl} size={56} />
          <View className="ml-3 flex-1">
            <Text className="text-base font-bold text-text-heading">{b.professional?.user.fullName ?? 'Professional'}</Text>
            <Text className="text-sm text-text-body">{b.service?.title ?? 'Session'}</Text>
          </View>
        </View>

        <View className="mt-4">
          {tracking.isPending ? (
            <Spinner label="Checking tracking status" />
          ) : tracking.isError ? (
            <ErrorState compact error={tracking.error} onRetry={() => void tracking.refetch()} />
          ) : (
            <Card>
              <View className="flex-row items-center justify-between">
                <Badge label={s.label} tone={s.tone} />
                {view?.locationUpdatedAt ? <Text className="text-xs text-text-body">Updated {formatRelative(view.locationUpdatedAt)}</Text> : null}
              </View>

              {view?.eligibility === 'NOT_YET_AVAILABLE' ? (
                <Text className="mt-3 text-sm text-text-body">
                  {view.trackingWindowOpensAt
                    ? `Tracking opens at ${formatTime(view.trackingWindowOpensAt)}, closer to your ${formatTime(b.startTime)} session.`
                    : 'Tracking opens closer to your session.'}
                </Text>
              ) : null}

              {view?.eligibility === 'WAITING' ? (
                <Text className="mt-3 text-sm text-text-body">
                  {view.hasStarted ? 'Your professional is getting ready to share their location.' : 'Your professional hasn’t started sharing their location yet.'}
                </Text>
              ) : null}

              {isLive ? (
                <View className="mt-3">
                  {professionalPosition ? (
                    LiveTrackingMap ? (
                      <LiveTrackingMap
                        professionalPosition={professionalPosition}
                        userPosition={userPosition}
                        routePolyline={view?.route?.available ? view.route.polyline : null}
                        style={{ height: 220 }}
                      />
                    ) : (
                      <MapUnavailablePlaceholder style={{ height: 220 }} />
                    )
                  ) : null}
                  <View className="mt-3">
                    <KeyValue label="Vehicle" value={formatVehicleLabel(view)} />
                    {view?.route?.available && view.route.distanceMeters != null && view.route.durationSeconds != null ? (
                      <KeyValue
                        label="Distance / ETA"
                        value={`${formatRoadDistance(view.route.distanceMeters)} · ${formatDuration(view.route.durationSeconds)}`}
                        emphasize
                      />
                    ) : (
                      <View className="mt-3">
                        <Button
                          title="Share my location for an ETA"
                          variant="outline"
                          icon="navigate-outline"
                          onPress={() => void shareMyLocationForEta()}
                          loading={requestingLocation}
                        />
                      </View>
                    )}
                    {locationError ? (
                      <View className="mt-2">
                        <InfoBanner tone="danger" message={locationError} icon="alert-circle" />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {view?.eligibility === 'STOPPED' || view?.eligibility === 'COMPLETED' ? (
                <Text className="mt-3 text-sm text-text-body">Location sharing has ended for this booking.</Text>
              ) : null}

              {view?.eligibility === 'NO_DATA' ? <Text className="mt-3 text-sm text-text-body">No location has been shared for this booking.</Text> : null}
            </Card>
          )}
        </View>
      </Screen>
    </>
  );
}
