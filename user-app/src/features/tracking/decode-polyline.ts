/**
 * Decodes Google's encoded polyline algorithm format into an array of
 * {latitude, longitude} points. This is the exact format returned by the
 * backend's Routes API call (BookingRouteView.polyline, see
 * apps/backend/src/bookings/booking-route.service.ts) — never re-derived or
 * approximated here, only decoded. Mirrors what web does with the Maps JS
 * `geometry` library's `decodePath` (apps/web/lib/googleMaps.ts), but
 * implemented locally since there is no equivalent bundled library on
 * mobile — this is the same well-known algorithm Google itself publishes
 * (https://developers.google.com/maps/documentation/utilities/polylinealgorithm).
 */
export interface LatLng {
  latitude: number;
  longitude: number;
}

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  if (!encoded) return points;

  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    lat += decodeSignedChunk();
    lng += decodeSignedChunk();
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;

  // One lat-or-lng delta: a base-64-ish varint (5 bits per char, continuation
  // bit 0x20) that's then zigzag-decoded back to a signed integer.
  function decodeSignedChunk(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }
}
