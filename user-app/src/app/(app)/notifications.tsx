import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi } from '@/api/endpoints';
import { useInvalidate, useNotifications } from '@/api/queries';
import type { NotificationDto } from '@/api/shared';
import { Chip, EmptyState, ErrorState, Header, Skeleton } from '@/components/ui';
import { appRouteForActionUrl } from '@/features/notifications/action-route';
import { formatRelative, humanize } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  BOOKING: 'calendar',
  MESSAGING: 'chatbubble',
  REQUIREMENT: 'flash',
  PAYMENT: 'card',
  WALLET: 'wallet',
  PROFILE: 'person',
  SYSTEM: 'information-circle',
  MARKETING: 'pricetag',
};

const FILTERS = ['ALL', 'UNREAD', 'BOOKING', 'REQUIREMENT', 'PAYMENT', 'WALLET'] as const;

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const params = { limit: 50, ...(filter === 'UNREAD' ? { unreadOnly: true } : filter !== 'ALL' ? { category: filter } : {}) };
  const list = useNotifications(params);
  const invalidate = useInvalidate();
  const refresh = () => invalidate(['notifications']);

  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });
  const remove = useMutation({ mutationFn: notificationsApi.remove, onSuccess: refresh });

  function open(n: NotificationDto) {
    if (!n.isRead) markRead.mutate(n.id);
    const route = appRouteForActionUrl(n.actionUrl);
    if (route) router.push(route as Href);
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Header
        title="Notifications"
        right={
          <Pressable
            onPress={() => markAll.mutate()}
            hitSlop={10}
            className="flex-row items-center p-2"
            accessibilityRole="button"
            accessibilityState={{ disabled: markAll.isPending, busy: markAll.isPending }}
            disabled={markAll.isPending}
          >
            {markAll.isPending ? <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} /> : null}
            <Text className="text-sm font-semibold text-primary-ink">Mark all read</Text>
          </Pressable>
        }
      />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 py-3">
          {FILTERS.map((f) => (
            <Chip key={f} label={f === 'ALL' ? 'All' : humanize(f)} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      </View>
      {list.isPending ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading notifications">
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} className="flex-row px-4 py-3">
              <Skeleton height={36} width={36} className="mr-3 mt-0.5" />
              <View className="flex-1">
                <Skeleton height={13} width="60%" />
                <Skeleton height={13} width="85%" className="mt-1.5" />
                <Skeleton height={11} width="30%" className="mt-1.5" />
              </View>
            </View>
          ))}
        </View>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <FlatList
          data={list.data.items}
          keyExtractor={(n) => n.id}
          contentContainerClassName="pb-10"
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} colors={[colors.primary]} />}
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="You're all caught up" />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              className={`flex-row px-4 py-3 active:bg-muted ${item.isRead ? 'bg-card' : 'bg-primary-soft'}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.title}. ${item.body}`}
            >
              <View className="mr-3 mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-card">
                <Ionicons name={CATEGORY_ICON[item.category] ?? 'notifications'} size={18} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className={`text-sm text-text-heading ${item.isRead ? '' : 'font-semibold'}`}>{item.title}</Text>
                <Text className="mt-0.5 text-sm text-text-body">{item.body}</Text>
                <Text className="mt-1 text-xs text-text-body">{formatRelative(item.createdAt)}</Text>
              </View>
              <Pressable
                onPress={() => remove.mutate(item.id)}
                hitSlop={8}
                className="ml-2 h-10 w-10 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Delete notification"
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
