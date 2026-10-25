/**
 * Mirrors apps/web/lib/tracking.ts's formatting conventions so the same
 * backend response reads the same way on both surfaces. Distance/duration
 * here are always the backend's real road route (BookingRouteView) — there
 * is no straight-line fallback on mobile, since without it the UI would have
 * to guess at a label like web's "km away" vs "km" distinction, and getting
 * that wrong reads as a fabricated number.
 */

const VEHICLE_LABEL: Record<string, string> = {
  CAR: 'Car',
  BIKE: 'Bike',
  SCOOTER: 'Scooter',
  AUTO: 'Auto',
  OTHER: 'Vehicle',
};

/** "Black Honda Activa" — falls back to just the vehicle type label when
 * make/model/colour weren't supplied (all three are optional on the trip). */
export function formatVehicleLabel(tracking: {
  vehicleType?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
}): string {
  const parts = [tracking.vehicleColor, tracking.vehicleMake, tracking.vehicleModel].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return VEHICLE_LABEL[tracking.vehicleType ?? ''] ?? 'Vehicle';
}

/** Actual road distance from the backend's Google Routes API result. */
export function formatRoadDistance(distanceMeters: number): string {
  const km = distanceMeters / 1000;
  if (km < 1) return `${Math.round(distanceMeters)} m`;
  return `${km.toFixed(1)} km`;
}

/** "24 min" / "1 hr 5 min" — whole-minute precision; this is an ETA, not a stopwatch. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}
