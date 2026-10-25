import '../../global.css';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrandSplash } from '@/components/BrandSplash';
import { usePushRegistration } from '@/features/push/use-push-registration';
import { isExpoGo } from '@/lib/native-capabilities';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { QueryProvider, createQueryClient } from '@/providers/query-provider';
import { ToastProvider } from '@/providers/toast-provider';
import { ThemeProvider, useTheme } from '@/theme/theme-provider';

// Keep the native splash up until the stored session has been validated, so
// the user never sees a flash of the sign-in screen before their dashboard.
void SplashScreen.preventAutoHideAsync();
// Splash fade options are a native-build feature; Expo Go ignores them with a warning.
if (!isExpoGo) SplashScreen.setOptions({ duration: 250, fade: true });

function RootNavigator() {
  const { status, needsEmailVerification, showKycIntro } = useAuth();
  const { colors, isDark } = useTheme();
  usePushRegistration();

  // The theme is loaded once this renders; hand over from the native splash to
  // the identical in-app brand splash, which explains a slow session restore.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  if (status === 'restoring') return <BrandSplash message="Welcome back — restoring your session…" messageDelayMs={600} />;

  const signedIn = status === 'signedIn';
  return (
    <>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'offline'}>
        <Stack.Screen name="offline" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && needsEmailVerification}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsEmailVerification && showKycIntro}>
        <Stack.Screen name="kyc-intro" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsEmailVerification && !showKycIntro}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider client={queryClient}>
            <AuthProvider queryClient={queryClient}>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
