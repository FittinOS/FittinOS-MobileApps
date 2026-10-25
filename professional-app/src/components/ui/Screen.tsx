import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useAndroidKeyboardInset } from '@/lib/keyboard';
import { useTheme } from '@/theme/theme-provider';

/**
 * Standard screen container: safe areas, keyboard avoidance, optional
 * pull-to-refresh. Screens under a native Stack header pass
 * `edges={['bottom']}` so the header owns the top inset; tab roots pass
 * `edges={[]}` because the tab bar owns the bottom inset.
 */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ['bottom'],
  footer,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  /** Pinned below the scroll area (e.g. a primary action), above the keyboard. */
  footer?: ReactNode;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Edge-to-edge Android doesn't resize for the keyboard: shrink the content
  // (and lift a pinned footer) by the part of the keyboard below the safe area.
  const keyboard = useAndroidKeyboardInset();
  const keyboardPad = Math.max(0, keyboard - (edges.includes('bottom') ? insets.bottom : 0));
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ paddingBottom: keyboardPad }}>
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName={padded ? 'px-4 pb-10 pt-4' : 'pb-10'}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                  progressBackgroundColor={colors.card}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View className={`flex-1 ${padded ? 'px-4 pt-4' : ''}`}>{children}</View>
        )}
        {footer ? <View className="border-t border-border bg-card px-4 pb-3 pt-3">{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Theme-aware pull-to-refresh for FlatLists. On Android the ScrollView clones
 * its refreshControl element and passes the scroll content + style through it
 * as props, so every prop must be forwarded — dropping them renders an empty list.
 */
export function ThemedRefreshControl(props: RefreshControlProps) {
  const { colors } = useTheme();
  return <RefreshControl colors={[colors.primary]} tintColor={colors.primary} progressBackgroundColor={colors.card} {...props} />;
}
