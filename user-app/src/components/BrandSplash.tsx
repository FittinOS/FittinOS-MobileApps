import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const logo = require('../../assets/splash-icon-dark.png');

/** Brand surface colours: the splash is dark in both themes, like the native splash. */
const BG = '#0E1013';
const ACCENT = '#FF5500'; // 5.9:1 on BG

/**
 * In-app continuation of the native splash: shown while the stored session is
 * checked on launch, so the hand-off from the native splash is seamless and
 * the user sees what is happening on a slow network.
 */
export function BrandSplash({ message, messageDelayMs = 0 }: { message?: string; messageDelayMs?: number }) {
  // A fast launch never flashes the message (a signed-out start resolves instantly).
  const [showMessage, setShowMessage] = useState(messageDelayMs === 0);
  useEffect(() => {
    if (messageDelayMs === 0) return;
    const t = setTimeout(() => setShowMessage(true), messageDelayMs);
    return () => clearTimeout(t);
  }, [messageDelayMs]);
  return (
    <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: BG }} accessibilityLabel={message ?? 'FittinOS'}>
      <StatusBar style="light" />
      <View className="items-center justify-center" style={{ width: 200, height: 200 }}>
        {/* Soft brand glow centred behind the mark. */}
        <View className="absolute rounded-full" style={{ width: 200, height: 200, backgroundColor: ACCENT, opacity: 0.1 }} />
        <View className="absolute rounded-full" style={{ width: 132, height: 132, backgroundColor: ACCENT, opacity: 0.12 }} />
        <Image source={logo} style={{ width: 96, height: 96 }} accessibilityIgnoresInvertColors />
      </View>
      <Text className="mt-2 text-3xl font-bold tracking-tight text-white">FittinOS</Text>
      {message && showMessage ? (
        <View className="absolute bottom-20 items-center">
          <ActivityIndicator color={ACCENT} />
          <Text className="mt-3 text-sm text-white/80">{message}</Text>
        </View>
      ) : null}
    </View>
  );
}
