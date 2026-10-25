import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { colorScheme as nativeWindScheme, useColorScheme } from 'nativewind';
import { palettes, type Palette, type SchemeName } from './tokens';

/**
 * App-wide light/dark theme. Identical mechanism to
 * apps/professional-app/src/theme/theme-provider.tsx — own storage key so
 * the two apps' preferences never collide (they're sandboxed anyway, but
 * the name makes it unambiguous in logs/devtools).
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'fittinuser.themePreference';

interface ThemeContextValue {
  preference: ThemePreference;
  scheme: SchemeName;
  isDark: boolean;
  colors: Palette;
  setPreference: (preference: ThemePreference) => void;
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
