import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { decodePolyline, type LatLng } from './decode-polyline';

interface LiveTrackingMapProps {
  professionalPosition: LatLng | null;
  /** The client's own one-shot position (never a continuous watch) — see the
   *  tracking screen's "Share my location for an ETA" action. Null until
   *  the client has actually shared it. */
  userPosition: LatLng | null;
  /** Google's encoded polyline from the backend's Routes API result
   *  (BookingRouteView.polyline) — undefined/null means no road route is
   *  available right now; markers render exactly the same either way, this
   *  is purely an additive overlay. Never decoded/drawn from anything but
   *  this exact backend-supplied value — no client-side route guessing. */
  routePolyline?: string | null;
  style?: StyleProp<ViewStyle>;
}

// FittinOS's own brand orange for the professional, a neutral dark tone for
// the client — kept distinct from Google's default red/blue markers and from
// each other, mirrored exactly from apps/web/components/tracking/LiveTrackingMap.tsx.
const PROFESSIONAL_MARKER_COLOR = '#E4572E';
const USER_MARKER_COLOR = '#1A1A1A';
const DEFAULT_DELTA = 0.01;

function regionFor(a: LatLng, b: LatLng | null): Region {
  if (!b) return { latitude: a.latitude, longitude: a.longitude, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA };
  const latitude = (a.latitude + b.latitude) / 2;
  const longitude = (a.longitude + b.longitude) / 2;
  const latitudeDelta = Math.max(Math.abs(a.latitude - b.latitude) * 1.8, DEFAULT_DELTA);
  const longitudeDelta = Math.max(Math.abs(a.longitude - b.longitude) * 1.8, DEFAULT_DELTA);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

/**
 * Native Google Maps view for booking-day live tracking — only ever rendered
 * by the tracking screen when eligibility is LIVE or STALE (see
 * src/app/(app)/(tabs)/bookings/[id]/tracking.tsx), and only when
 * isMapsConfigured() is true. A structural port of
 * apps/web/components/tracking/LiveTrackingMap.tsx: same marker colours,
 * same "route is purely additive" rule, same one-shot (never watched) client
 * position.
 */
export default function LiveTrackingMap({ professionalPosition, userPosition, routePolyline, style }: LiveTrackingMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const hasCenteredOnce = useRef(false);

  const [route, setRoute] = useState<LatLng[]>([]);
  useEffect(() => {
    setRoute(routePolyline ? decodePolyline(routePolyline) : []);
  }, [routePolyline]);

  // Re-centre (not remount) on every new fix — animated, so a moving marker
  // reads as "live" rather than the map silently teleporting.
  useEffect(() => {
    if (!professionalPosition || !mapRef.current) return;
    const region = regionFor(professionalPosition, userPosition);
    mapRef.current.animateToRegion?.(region, hasCenteredOnce.current ? 600 : 0);
    hasCenteredOnce.current = true;
  }, [professionalPosition, userPosition]);

  if (!professionalPosition) return null;

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(professionalPosition, userPosition)}
        zoomEnabled
        rotateEnabled={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={professionalPosition} title="Professional" tracksViewChanges={false}>
          <View style={[styles.dot, { backgroundColor: PROFESSIONAL_MARKER_COLOR }]} />
        </Marker>
        {userPosition ? (
          <Marker coordinate={userPosition} title="You" tracksViewChanges={false}>
            <View style={[styles.dot, styles.userDot, { backgroundColor: USER_MARKER_COLOR }]} />
          </Marker>
        ) : null}
        {route.length > 1 ? <Polyline coordinates={route} strokeColor={PROFESSIONAL_MARKER_COLOR} strokeWidth={5} /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
