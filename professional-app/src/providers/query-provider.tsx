import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { httpStatusOf } from '@/lib/errors';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        // A 4xx will not fix itself on retry; network blips and 5xx might.
        retry: (failureCount, error) => {
          const status = httpStatusOf(error);
          if (status !== null && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function QueryProvider({ client, children }: { client: QueryClient; children: ReactNode }) {
  // Refetch stale data when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => focusManager.setFocused(status === 'active'));
    return () => sub.remove();
  }, []);
  // React Query assumes online on native; keep that (no NetInfo dependency) —
  // failed requests surface the "Unable to connect" error state with retry.
  const [ready] = useState(() => {
    onlineManager.setOnline(true);
    return true;
  });
  return ready ? <QueryClientProvider client={client}>{children}</QueryClientProvider> : null;
}
