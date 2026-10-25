import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme-provider';

/**
 * The rounded-square back button + title row used at the top of every
 * secondary screen, in place of a native Stack header (which every (app)/
 * (auth) Stack has `headerShown: false` for). Renders its own top
 * safe-area inset, so it works as the first child of a screen's
 * `SafeAreaView edges={['bottom']}` without double-padding.
 */
export function Header({
  title,
  onBack,
  showBack = true,
  right,
}: {
  title?: string;
  /** Defaults to `router.back()`. */
  onBack?: () => void;
  /**
   * False for the rare screen reachable both as a tab root and as a stack
   * push of the same component (e.g. Wallet) — pass `router.canGoBack()` so
   * the tab-root render shows a plain title instead of a dead-end back button.
   */
  showBack?: boolean;
  /** Rendered after the title, e.g. an overflow menu button. */
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 8 }} className="flex-row items-center px-4 pb-3">
      {showBack ? (
        <Pressable
          onPress={onBack ?? (() => router.back())}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card active:bg-muted"
        >
          <Ionicons name="chevron-back" size={22} color={colors.heading} />
        </Pressable>
      ) : null}
      {title ? (
        <Text className="flex-1 text-lg font-bold text-text-heading" numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      {right}
    </View>
  );
}
