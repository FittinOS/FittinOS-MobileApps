import * as SecureStore from 'expo-secure-store';

/**
 * Session persistence. Tokens live only in the platform keystore
 * (expo-secure-store → Android Keystore / iOS Keychain), never in
 * AsyncStorage or plain files. Values are cached in memory after the first
 * read so the request interceptor doesn't hit the keystore on every call.
 *
 * Own key namespace (`fittinuser.*`) — this app's keystore entries never mix
 * with apps/professional-app's, even though SecureStore is already
 * per-application-sandboxed on both platforms.
 */
const ACCESS_KEY = 'fittinuser.accessToken';
const REFRESH_KEY = 'fittinuser.refreshToken';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

let cache: StoredTokens | null | undefined;

export async function loadTokens(): Promise<StoredTokens | null> {
  if (cache !== undefined) return cache;
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  cache = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  return cache;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  cache = tokens;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  cache = null;
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}

/** Test hook — forget the in-memory copy so the next read goes to the store. */
export function resetTokenCacheForTests(): void {
  cache = undefined;
}
