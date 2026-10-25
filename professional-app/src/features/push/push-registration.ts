import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { router, type Href } from 'expo-router';
import { pushApi } from '@/api/endpoints';
import * as nativeCapabilities from '@/lib/native-capabilities';
import { appRouteForActionUrl } from '@/features/notifications/action-route';

/**
 * Native push registration (Expo push service). Mirrors
 * apps/user-app/src/features/push/push-registration.ts exactly — every step
 * here is best-effort and non-throwing — a professional must never be
 * blocked from signing in or using the app because push permission was
 * denied, no physical device is available, or the network is down.
 */

const STORED_TOKEN_KEY = 'fittin.pushToken';

let handlerConfigured = false;

/** Deferred to first use (rather than a module-load side effect) so importing this file is always inert until a registration is actually attempted. */
function ensureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function getProjectId(): string | null {
  return Constants.expoConfig?.extra?.eas?.projectId ?? null;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Requests permission (if not already decided) and registers this device's
 * current Expo push token with the signed-in account. Safe to call
 * repeatedly — it only calls the backend when the token is new or changed.
 */
export async function registerPushDevice(): Promise<void> {
  try {
    // Expo Go dropped remote push support from SDK 53 onward — this needs
    // the FittinOS Professional dev/release build, same gate this app
    // already uses for Cashfree's native checkout (see native-capabilities.ts).
    if (nativeCapabilities.isExpoGo) return;
    if (!Device.isDevice) return; // Simulators/emulators cannot receive push.
    ensureNotificationHandler();

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[push] No EAS projectId configured in app.config.ts (extra.eas.projectId) — skipping registration.');
      return;
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted' && current.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return; // Denied — never block app usage for this.

    await ensureAndroidChannel();

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const previous = await SecureStore.getItemAsync(STORED_TOKEN_KEY);
    if (previous === token) return; // Already registered with this exact token.

    await pushApi.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    await SecureStore.setItemAsync(STORED_TOKEN_KEY, token);
  } catch (error) {
    console.warn('[push] registration failed (non-fatal):', error instanceof Error ? error.message : String(error));
  }
}

/** Best-effort deactivation of this device's token — called while still authenticated, right before logout clears the session. */
export async function unregisterPushDevice(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(STORED_TOKEN_KEY);
    if (!token) return;
    await pushApi.unregisterDevice(token);
    await SecureStore.deleteItemAsync(STORED_TOKEN_KEY);
  } catch (error) {
    console.warn('[push] unregistration failed (non-fatal):', error instanceof Error ? error.message : String(error));
  }
}

/** Re-registers whenever the OS hands this device a new token (rare — app restore, token rotation). */
export function subscribeToPushTokenRefresh(): { remove: () => void } {
  const subscription = Notifications.addPushTokenListener(() => {
    void registerPushDevice();
  });
  return { remove: () => subscription.remove() };
}

function navigateFromResponse(response: Notifications.NotificationResponse | null): void {
  const data = response?.notification.request.content.data as { url?: string } | undefined;
  const route = appRouteForActionUrl(data?.url);
  if (route) router.push(route as Href);
}

/**
 * Navigates when the professional taps a received OS push notification.
 * Mirrors apps/user-app/src/features/push/push-registration.ts exactly —
 * covers foreground/background via the listener, and cold-start (app was
 * fully killed, then launched by tapping the notification) via
 * `getLastNotificationResponseAsync`, checked explicitly rather than assumed
 * covered by the listener alone. Reuses the exact route mapping the in-app
 * Notifications list already uses for its own tap-to-navigate
 * (features/notifications/action-route.ts) — never a second, parallel
 * mapping. Before this, a tapped push only opened the app to its default
 * screen; there was no destination.
 */
export function subscribeToNotificationOpen(): { remove: () => void } {
  void Notifications.getLastNotificationResponseAsync().then(navigateFromResponse);
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromResponse(response);
  });
  return { remove: () => subscription.remove() };
}
