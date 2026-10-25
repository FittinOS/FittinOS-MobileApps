import Constants from 'expo-constants';

/**
 * Mirrors apps/web/lib/googleMaps.ts's isGoogleMapsConfigured() — the UI
 * degrades honestly to a "map unavailable" placeholder instead of ever
 * attempting to render a broken map.
 *
 * Unlike web (which embeds the key in a <script> URL at runtime), Android's
 * Google Maps SDK reads its key from the compiled AndroidManifest.xml,
 * populated at `expo prebuild` time from app.config.ts's
 * `android.config.googleMaps.apiKey` (itself read from the
 * GOOGLE_MAPS_ANDROID_API_KEY env var — see app.config.ts). This function
 * only checks whether that build already has a key baked in; it never reads
 * or exposes the key's actual value to JS.
 */
export function isMapsConfigured(): boolean {
  return !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
}
