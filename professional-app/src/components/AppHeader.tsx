import { useCallback, type ReactNode } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useConversations, useUnreadCount } from '@/api/queries';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/theme/theme-provider';
import { initials } from '@/lib/format';

const brandMark = require('../../assets/brand-mark.png');
const ACCENT = '#FF5500'; // 5.9:1 on the dark header

/**
 * Dark brand toolbar for the five tab roots (dark in both themes).
 * Left: the FittinOS Professional lockup (Home) or the brand mark + screen
 * title. Right: light/dark switch, messages, notifications and the
 * professional's avatar (opens Profile). Badges show only real counts —
 * unread notifications and conversations awaiting the professional's reply.
 * Secondary screens use the native stack header (back button + title).
 */
export function AppHeader({ title, subtitle, brand, right }: { title?: string; subtitle?: string; brand?: boolean; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  // Narrow phones: the avatar (Profile is a tab anyway) and then the wordmark give way.
  const showAvatar = width >= 380;
  const showWordmark = width >= 340;
  const unread = useUnreadCount();
  const awaiting = useConversations({ status: 'AWAITING_PROFESSIONAL', limit: 1 });
  const unreadCount = unread.data?.count ?? 0;
  const awaitingCount = awaiting.data?.total ?? 0;

  // Light status-bar icons over the dark header; restore the theme's default when leaving.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(isDark ? 'light' : 'dark');
    }, [isDark]),
  );

  return (
    <View className="rounded-b-[28px] px-4 pb-4" style={{ paddingTop: insets.top + 10, backgroundColor: colors.header }}>
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-white">
          <Image source={brandMark} style={{ width: 28, height: 28 }} accessibilityLabel="FittinOS" />
        </View>
        <View className="ml-2.5 mr-2 flex-1">
          {brand ? (
            showWordmark ? (
              <View accessibilityRole="header" accessibilityLabel="FittinOS Professional">
                <Text className="text-lg font-bold leading-6 tracking-tight text-white">FittinOS</Text>
                <Text className="text-sm font-semibold leading-4" style={{ color: ACCENT }}>
                  Professional
                </Text>
              </View>
            ) : null
          ) : (
            <>
              <Text className="text-lg font-bold tracking-tight text-white" accessibilityRole="header" numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text className="text-xs text-white/70" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </>
          )}
        </View>
        {right}
        <ThemeSwitch />
        <HeaderIconButton
          icon="chatbubble-ellipses-outline"
          count={awaitingCount}
          label={awaitingCount > 0 ? `Messages, ${awaitingCount} awaiting your reply` : 'Messages'}
          onPress={() => router.push('/messages')}
        />
        <HeaderIconButton
          icon="notifications-outline"
          count={unreadCount}
          label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          onPress={() => router.push('/notifications')}
        />
        {showAvatar ? (
          <Pressable
            onPress={() => router.navigate('/profile')}
            hitSlop={4}
            className="ml-2 h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 36, height: 36 }} accessibilityIgnoresInvertColors />
            ) : (
              <View className="h-full w-full items-center justify-center" style={{ backgroundColor: ACCENT }}>
                <Text className="text-xs font-bold text-white">{initials(user?.fullName)}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
  count = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  count?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      className="ml-1.5 h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={19} color="#FFFFFF" />
      {count > 0 ? (
        <View
          className="absolute -right-1 -top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full bg-action px-1"
          style={{ borderWidth: 2, borderColor: colors.header }}
        >
          <Text className="text-[9px] font-bold text-white">{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Sun/moon pill switch: flips the whole app between light and dark; the choice is persisted. */
export function ThemeSwitch() {
  const { isDark, toggle } = useTheme();
  return (
    <Pressable
      onPress={toggle}
      hitSlop={4}
      className="h-9 w-[60px] flex-row items-center justify-between px-1.5 active:opacity-80"
      style={{ borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' }}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Knob fills are separate layers created only when active: Android ignored the corner
          radius when a background was toggled on a persistent view (it showed a square box). */}
      <View className="h-6 w-6 items-center justify-center">
        {!isDark ? <View pointerEvents="none" style={{ position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' }} /> : null}
        <Ionicons name="sunny" size={14} color={isDark ? 'rgba(255,255,255,0.7)' : ACCENT} />
      </View>
      <View className="h-6 w-6 items-center justify-center">
        {isDark ? <View pointerEvents="none" style={{ position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: ACCENT }} /> : null}
        <Ionicons name="moon" size={13} color={isDark ? '#FFFFFF' : 'rgba(255,255,255,0.7)'} />
      </View>
    </Pressable>
  );
}
