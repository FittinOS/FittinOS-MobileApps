import Constants, { ExecutionEnvironment } from 'expo-constants';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Some features need native code that the standard Expo Go app does not
 * contain (WebRTC calls, Cashfree's native checkout, in-call audio routing).
 * In Expo Go those packages throw as soon as they are imported, so they are
 * only ever loaded lazily and only when the native module really exists.
 * In the FittinOS Pro development/release build everything is available.
 */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function hasNativeModule(name: string): boolean {
  if (NativeModules[name] != null) return true;
  try {
    return TurboModuleRegistry.get(name) != null;
  } catch {
    return false;
  }
}

export interface Capability {
  available: boolean;
  /** Why not, in words the user can act on. Null when available. */
  reason: string | null;
}

const NEEDS_BUILD = 'the FittinOS Pro app build (Expo Go doesn’t include it)';

export function callsCapability(): Capability {
  if (!isExpoGo && hasNativeModule('WebRTCModule')) return { available: true, reason: null };
  return { available: false, reason: `Voice and video calls need ${NEEDS_BUILD}.` };
}

export function paymentsCapability(): Capability {
  if (!isExpoGo && hasNativeModule('CashfreePgApi')) return { available: true, reason: null };
  return { available: false, reason: `Online payments need ${NEEDS_BUILD}. No order was created.` };
}
