import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * FittinOS User — Expo app config.
 *
 * Only PUBLIC values belong here or in EXPO_PUBLIC_* env vars: they are
 * compiled into the app bundle and readable by anyone holding the APK.
 * Cashfree secrets, JWT secrets etc. stay on the backend — this app only
 * ever receives short-lived, per-user values from the API (payment session
 * ids, access tokens).
 *
 * This is a genuinely separate app from apps/professional-app: its own
 * application id, scheme, entry point and routes. See that app's
 * app.config.ts for the identical variant/release-gating pattern, mirrored
 * here on purpose so both apps are configured the same way.
 *
 * Variants (APP_VARIANT):
 *  - "development" — opt-in (put it in your local .env): `.dev` application id,
 *    cleartext HTTP allowed so a debug build can reach a local backend
 *    (http://10.0.2.2:<port> from the Android emulator).
 *  - anything else / unset — RELEASE. HTTPS only, and the build refuses to
 *    configure unless every release input is set explicitly.
 *
 * Release inputs (no defaults on purpose):
 *  ANDROID_APPLICATION_ID   permanent Play Store id — must match the Play Console listing
 *  IOS_BUNDLE_IDENTIFIER    optional until an iOS build exists
 *  EXPO_PUBLIC_API_URL      https://…/api
 *  EXPO_PUBLIC_CASHFREE_ENVIRONMENT  SANDBOX | PRODUCTION (must equal the backend's)
 */
const isDev = process.env.APP_VARIANT === 'development';
const DEV_ID = 'com.fittinos.user.dev';

export function releaseConfigProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const appId = env.ANDROID_APPLICATION_ID?.trim();
  if (!appId) problems.push('ANDROID_APPLICATION_ID is not set (the permanent Play Store application id).');
  else if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(appId) || appId.endsWith('.dev')) {
    problems.push(`ANDROID_APPLICATION_ID "${appId}" is not a valid release application id.`);
  }
  const api = env.EXPO_PUBLIC_API_URL?.trim();
  if (!api || !/^https:\/\/[^/]+\/api\/?$/.test(api)) problems.push('EXPO_PUBLIC_API_URL must be the https://<host>/api URL of the production backend.');
  const cf = env.EXPO_PUBLIC_CASHFREE_ENVIRONMENT?.trim().toUpperCase();
  if (cf !== 'SANDBOX' && cf !== 'PRODUCTION') problems.push('EXPO_PUBLIC_CASHFREE_ENVIRONMENT must be set to SANDBOX or PRODUCTION (matching the backend).');
  return problems;
}

if (!isDev) {
  const problems = releaseConfigProblems(process.env);
  if (problems.length) {
    throw new Error(
      ['Release build configuration is incomplete (set APP_VARIANT=development for a dev build):', ...problems.map((p) => ` - ${p}`)].join('\n'),
    );
  }
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDev ? 'FittinOS (Dev)' : 'FittinOS',
  slug: 'fittinos-user',
  scheme: 'fittinosuser',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: isDev ? DEV_ID : process.env.IOS_BUNDLE_IDENTIFIER?.trim() || process.env.ANDROID_APPLICATION_ID?.trim(),
  },
  android: {
    package: isDev ? DEV_ID : process.env.ANDROID_APPLICATION_ID?.trim(),
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: 'resize',
    // Requested at runtime only when the matching feature is used (location
    // for nearby-professional search, photo upload for avatar) — never at launch.
    permissions: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
    config: {
      // Google Maps SDK for Android key — a *different* Google Cloud product
      // (and key) from the backend's server-only Places/Routes/Geocoding key
      // and from web's browser-restricted Maps JavaScript key. Restricted by
      // Android package name + SHA-1 signing fingerprint, never by HTTP
      // referrer. Left undefined (no map rendered — see
      // src/features/tracking/maps-config.ts) until this is actually set.
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon-dark.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#0E1013',
        dark: {
          image: './assets/splash-icon-dark.png',
          backgroundColor: '#0E1013',
        },
      },
    ],
    'expo-secure-store',
    'expo-web-browser',
    'expo-sharing',
    'expo-dev-client',
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      {
        photosPermission: 'FittinOS needs access to your photos so you can choose a profile picture.',
        cameraPermission: 'FittinOS needs the camera so you can take a profile picture.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'FittinOS uses your location to show professionals near you.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: isDev,
        },
      },
    ],
    [
      'expo-notifications',
      {
        // No custom sound/icon configured — Android uses the app icon and
        // system default notification sound until design specifies otherwise.
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appVariant: isDev ? 'development' : 'release',
    // Required by Notifications.getExpoPushTokenAsync() — unset until this
    // app is linked to an EAS project (`eas init` / `eas project:info`).
    // Push registration no-ops (logs a warning, never throws) until this is
    // set — see src/features/push/push-registration.ts.
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
