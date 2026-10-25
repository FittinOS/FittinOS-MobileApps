import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getErrorPresentation, httpStatusOf } from '@/lib/errors';
import { useTheme } from '@/theme/theme-provider';
import { Button } from './Button';
import { Spinner } from './primitives';

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  actionLabel,
  onAction,
  compact,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View className={`items-center px-6 ${compact ? 'py-6' : 'py-12'}`}>
      <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <Text className="text-center text-base font-bold text-text-heading">{title}</Text>
      {message ? <Text className="mt-1 text-center text-sm leading-5 text-text-body">{message}</Text> : null}
      {actionLabel && onAction ? (
        <View className="mt-4 w-full max-w-[260px]">
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/** Icon + tint for each failure kind, so offline, server and permission errors read differently. */
function errorVisual(error: unknown, isAuthError: boolean): { icon: keyof typeof Ionicons.glyphMap; tone: 'danger' | 'warning' | 'info' } {
  if (isAuthError) return { icon: 'lock-closed-outline', tone: 'warning' };
  const status = httpStatusOf(error);
  if (status == null) return { icon: 'cloud-offline-outline', tone: 'warning' };
  if (status === 403) return { icon: 'lock-closed-outline', tone: 'warning' };
  if (status === 404) return { icon: 'search-outline', tone: 'info' };
  if (status === 429) return { icon: 'hourglass-outline', tone: 'warning' };
  if (status >= 500) return { icon: 'server-outline', tone: 'danger' };
  return { icon: 'alert-circle-outline', tone: 'danger' };
}

/**
 * Failure state with the matching recovery: Try again for connectivity and
 * server problems, Contact support when access is restricted (403).
 */
export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  const p = getErrorPresentation(error);
  const visual = errorVisual(error, p.isAuthError);
  const restricted = httpStatusOf(error) === 403;
  const bg = visual.tone === 'danger' ? 'bg-danger-soft' : visual.tone === 'warning' ? 'bg-warning-soft' : 'bg-info-soft';
  const fg = visual.tone === 'danger' ? colors.danger : visual.tone === 'warning' ? colors.warning : colors.info;
  return (
    <View className={`items-center px-6 ${compact ? 'py-6' : 'py-12'}`} accessibilityRole="alert">
      <View className={`mb-3 h-16 w-16 items-center justify-center rounded-3xl ${bg}`}>
        <Ionicons name={visual.icon} size={28} color={fg} />
      </View>
      <Text className="text-center text-base font-bold text-text-heading">{p.title}</Text>
      <Text className="mt-1 text-center text-sm leading-5 text-text-body">{p.description}</Text>
      {restricted ? (
        <View className="mt-4 w-full max-w-[220px]">
          <Button title="Contact support" variant="outline" icon="help-buoy-outline" onPress={() => router.push('/help')} />
        </View>
      ) : onRetry ? (
        <View className="mt-4 w-full max-w-[220px]">
          <Button title="Try again" variant="outline" icon="refresh" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

/** True once the OS "Reduce Motion" accessibility setting is known to be on. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => active && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(v));
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);
  return reduced;
}

/** Placeholder block that gently pulses while content loads; holds a static tint instead when the OS "Reduce Motion" setting is on. */
export function Skeleton({ height = 16, width = '100%', className = '' }: { height?: number; width?: number | `${number}%`; className?: string }) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.75);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reducedMotion]);
  return (
    <Animated.View style={{ width, opacity }}>
      <View className={`rounded-xl bg-muted ${className}`} style={{ height }} />
    </Animated.View>
  );
}

/** Card-shaped loading placeholder for lists and Bento tiles. */
export function LoadingCards({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="mb-3 rounded-3xl border border-border bg-card p-4">
          <Skeleton height={14} width="45%" />
          <Skeleton height={22} width="70%" className="mt-3" />
          <Skeleton height={12} width="90%" className="mt-3" />
        </View>
      ))}
    </View>
  );
}

/**
 * Renders the loading/error branches of a React Query result, so every
 * screen handles them the same way. Children render only once data exists.
 */
export function QueryBoundary<T>({
  query,
  children,
  loadingLabel,
}: {
  query: { data: T | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  children: (data: T) => React.ReactNode;
  loadingLabel?: string;
}) {
  if (query.isPending) return <Spinner label={loadingLabel} />;
  if (query.isError || query.data === undefined) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data)}</>;
}
