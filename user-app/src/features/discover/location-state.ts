import type { GeocodedLocation } from '@/api/endpoints';

/**
 * What Discover actually needs from a resolved location: coordinates for the
 * real server-side distance search, plus a short label for display. Never
 * carries a raw PIN code or formatted address — only what the backend's
 * DiscoverProfessionalsQueryDto genuinely accepts (lat/lng) and a city for
 * the pre-existing `city` filter as a fallback.
 */
export interface SelectedLocation {
  label: string;
  city: string | null;
  latitude: number;
  longitude: number;
}

/** Builds the short display label and extracts only the fields Discover's search can use. */
export function locationFromGeocode(result: GeocodedLocation): SelectedLocation {
  const label = result.area && result.city ? `${result.area}, ${result.city}` : (result.city ?? result.formattedAddress);
  return {
    label,
    city: result.city,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

/**
 * A GPS fix on its own — no area/city name, because reverse geocoding either
 * wasn't attempted or failed. The backend's DiscoverProfessionalsQueryDto
 * accepts `lat`/`lng` entirely independently of any resolved address (see its
 * own field docs: "Client latitude — paired with lng to search by
 * proximity"), so distance-sorted search still works from coordinates alone.
 * The label is a truthful, generic fallback — never a guessed or invented
 * place name.
 */
export function locationFromCoordinates(latitude: number, longitude: number): SelectedLocation {
  return { label: 'Current location', city: null, latitude, longitude };
}
