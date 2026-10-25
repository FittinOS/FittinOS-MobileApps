import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SelectedLocation } from '@/features/discover/location-state';

/**
 * The one location Discover and Home both search around. Lives in memory only
 * (no SecureStore/AsyncStorage) — a resolved GPS fix or PIN-code area is only
 * ever as fresh as this app session, never silently reused across restarts
 * without the user re-confirming it. Mounted once in (app)/_layout.tsx, so it
 * survives navigation between Home and Discover but not a full app relaunch.
 */
interface SelectedLocationContextValue {
  location: SelectedLocation | null;
  setLocation: (location: SelectedLocation | null) => void;
}

const SelectedLocationContext = createContext<SelectedLocationContextValue | null>(null);

export function SelectedLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const value = useMemo(() => ({ location, setLocation }), [location]);
  return <SelectedLocationContext.Provider value={value}>{children}</SelectedLocationContext.Provider>;
}

const FALLBACK: SelectedLocationContextValue = { location: null, setLocation: () => undefined };

export function useSelectedLocation(): SelectedLocationContextValue {
  return useContext(SelectedLocationContext) ?? FALLBACK;
}
