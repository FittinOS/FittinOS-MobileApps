import { Stack } from 'expo-router';
import { CallProvider } from '@/features/calls/call-provider';
import { CallOverlay } from '@/features/calls/CallOverlay';
import { useTheme } from '@/theme/theme-provider';

// A deep link straight to a secondary screen still has the tabs underneath,
// so Back lands on the workspace instead of leaving the app.
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Everything behind sign-in. CallProvider lives here so an incoming call
 * rings on any screen of the workspace, exactly like the web's layout.
 * Every secondary screen renders its own `Header` (rounded-square back
 * button + title) in place of a native Stack header — `headerShown: false`
 * here is the default for the whole Stack, not a per-screen override.
 */
export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <CallProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      />
      <CallOverlay />
    </CallProvider>
  );
}
