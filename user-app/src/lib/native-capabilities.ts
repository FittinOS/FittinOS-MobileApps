import Constants, { ExecutionEnvironment } from 'expo-constants';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * Some features need native code that the standard Expo Go app does not
 * contain (Cashfree's native checkout). In Expo Go that package throws as
 * soon as it is imported, so it is only ever loaded lazily and only when the
 * native module really exists. In the FittinOS development/release build
 * everything is available.
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

const NEEDS_BUILD = 'the FittinOS app build (Expo Go doesn’t include it)';

export function paymentsCapability(): Capability {
  if (!isExpoGo && hasNativeModule('CashfreePgApi')) return { available: true, reason: null };
  return { available: false, reason: `Online payments need ${NEEDS_BUILD}. No order was created.` };
}
