import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { colorScheme as nativeWindScheme, useColorScheme } from 'nativewind';
import { palettes, type Palette, type SchemeName } from './tokens';

/**
 * App-wide light/dark theme.
 *
 * The preference ("system" | "light" | "dark") is persisted with the app's
 * existing storage (expo-secure-store; it is not a secret, but this keeps a
 * single storage mechanism). It is applied through NativeWind's colorScheme,
 * which flips every CSS-variable token in global.css, and the resolved scheme
 * is exposed with the matching JS palette for icons and native props.
 *
 * Children render only after the stored preference is read, so the first
 * frame is already in the right theme (the native splash covers this read).
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'fittin.themePreference';

interface ThemeContextValue {
  preference: ThemePreference;
  scheme: SchemeName;
  isDark: boolean;
  colors: Palette;
  setPreference: (preference: ThemePreference) => void;
  /** Flips between light and dark (leaving "system" for an explicit choice). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference | null>(null);
  const { colorScheme } = useColorScheme();
  const scheme: SchemeName = colorScheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(THEME_PREFERENCE_KEY)
      .catch(() => null)
      .then((stored) => {
        if (cancelled) return;
        const initial = isPreference(stored) ? stored : 'system';
        nativeWindScheme.set(initial);
        setPreferenceState(initial);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Root window colour behind every screen (keyboard, transitions, overscroll).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palettes[scheme].background).catch(() => undefined);
  }, [scheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    nativeWindScheme.set(next);
    setPreferenceState(next);
    void SecureStore.setItemAsync(THEME_PREFERENCE_KEY, next).catch(() => undefined);
  }, []);

  const toggle = useCallback(() => setPreference(scheme === 'dark' ? 'light' : 'dark'), [scheme, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference: preference ?? 'system',
      scheme,
      isDark: scheme === 'dark',
      colors: palettes[scheme],
      setPreference,
      toggle,
    }),
    [preference, scheme, setPreference, toggle],
  );

  if (preference === null) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Light theme for components rendered outside the provider (isolated component tests). */
const FALLBACK: ThemeContextValue = {
  preference: 'system',
  scheme: 'light',
  isDark: false,
  colors: palettes.light,
  setPreference: () => undefined,
  toggle: () => undefined,
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}
