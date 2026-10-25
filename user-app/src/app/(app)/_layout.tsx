import { Stack } from 'expo-router';
import { SelectedLocationProvider } from '@/providers/selected-location-provider';
import { useTheme } from '@/theme/theme-provider';

// A deep link straight to a secondary screen still has the tabs underneath,
// so Back lands on the workspace instead of leaving the app.
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Everything behind sign-in. Every secondary screen renders its own `Header`
 * (rounded-square back button + title) in place of a native Stack header —
 * `headerShown: false` here is the default for the whole Stack, not a
 * per-screen override.
 */
export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <SelectedLocationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      />
    </SelectedLocationProvider>
  );
}
