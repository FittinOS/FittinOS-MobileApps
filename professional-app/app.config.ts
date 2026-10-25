import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * FittinOS Professional — Expo app config.
 *
 * Only PUBLIC values belong here or in EXPO_PUBLIC_* env vars: they are
 * compiled into the app bundle and readable by anyone holding the APK.
 * Cashfree secrets, API Sathi keys, TURN secrets, JWT secrets etc. stay on
 * the backend — this app only ever receives short-lived, per-user values
 * from the API (payment session ids, TURN credentials, access tokens).
 *
 * Variants (APP_VARIANT):
 *  - "development" — opt-in (put it in your local .env): `.dev` application id,
 *    cleartext HTTP allowed so a debug build can reach a local backend
 *    (http://10.0.2.2:<port> from the Android emulator).
 *  - anything else / unset — RELEASE. HTTPS only, and the build refuses to
 *    configure unless every release input is set explicitly, so a forgotten
 *    variable can never ship a dev id, an emulator API URL or the wrong
 *    Cashfree mode.
 *
 * Release inputs (no defaults on purpose):
 *  ANDROID_APPLICATION_ID   permanent Play Store id — must match the Play Console listing
 *  IOS_BUNDLE_IDENTIFIER    optional until an iOS build exists
 *  EXPO_PUBLIC_API_URL      https://…/api
 *  EXPO_PUBLIC_CASHFREE_ENVIRONMENT  SANDBOX | PRODUCTION (must equal the backend's)
 */
const isDev = process.env.APP_VARIANT === 'development';
const DEV_ID = 'com.fittinos.professional.dev';

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
  name: isDev ? 'FittinOS Pro (Dev)' : 'FittinOS Pro',
  slug: 'fittinos-professional',
  scheme: 'fittinospro',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  // The in-app theme switch (src/theme) needs the native side to allow both schemes.
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
    // Requested at runtime only when the matching feature is used (calls,
    // trip tracking, photo upload) — never at launch.
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.VIBRATE',
    ],
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // Dark brand splash in both system themes (drawn before any JS runs, so it
        // can't know the in-app theme). Matches src/components/BrandSplash.tsx,
        // which takes over while the stored session is restored.
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
        photosPermission: 'FittinOS Pro needs access to your photos so you can choose a profile picture or certificate.',
        cameraPermission: 'FittinOS Pro needs the camera so you can take a profile picture or photograph a certificate.',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'FittinOS Pro uses your location to share your business location and, during a booking trip you start, to show the client where you are.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      '@config-plugins/react-native-webrtc',
      {
        cameraPermission: 'FittinOS Pro needs the camera for video calls with your clients.',
        microphonePermission: 'FittinOS Pro needs the microphone for voice and video calls with your clients.',
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
