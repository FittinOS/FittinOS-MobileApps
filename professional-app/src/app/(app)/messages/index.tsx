import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConversations } from '@/api/queries';
import { Avatar, Badge, Chip, EmptyState, ErrorState, Header, LoadingCards, ThemedRefreshControl } from '@/components/ui';
import { lastMessage, previewText } from '@/features/messaging/messaging-helpers';
import { formatRelative } from '@/lib/format';
import { conversationStatus } from '@/lib/status';

type Filter = 'ALL' | 'NEW' | 'ACTIVE';
const FILTERS: Array<{ key: Filter; label: string; status?: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'NEW', label: 'New', status: 'AWAITING_PROFESSIONAL' },
  { key: 'ACTIVE', label: 'Active', status: 'UNLOCKED' },
];

export default function MessagesScreen() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const status = FILTERS.find((f) => f.key === filter)?.status;
  const conversations = useConversations(status ? { status } : {});

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Header title="Messages" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 py-3">
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
        <Text className="px-4 pb-2 text-xs text-text-body">Chat and call clients — calls are free.</Text>
      </View>
      {conversations.isPending ? (
        <View className="px-4 pt-2">
          <LoadingCards count={3} label="Loading conversations" />
        </View>
      ) : conversations.isError ? (
        <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
      ) : (
        <FlatList
          data={[...conversations.data.items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())}
          keyExtractor={(c) => c.id}
          contentContainerClassName="pb-8"
          refreshControl={<ThemedRefreshControl refreshing={conversations.isRefetching} onRefresh={() => void conversations.refetch()} />}
          ItemSeparatorComponent={() => <View className="ml-[76px] h-px bg-border" />}
          ListEmptyComponent={
            <EmptyState icon="chatbubbles-outline" title="No conversations yet" message="When a client messages you, the conversation appears here." />
          }
          renderItem={({ item }) => {
            const s = conversationStatus(item.status);
            const last = lastMessage(item.messages);
            const needsYou = item.status === 'AWAITING_PROFESSIONAL';
            return (
              <Pressable
                onPress={() => router.push(`/messages/${item.id}`)}
                className="flex-row items-center bg-card px-4 py-3 active:bg-muted"
                accessibilityRole="button"
                accessibilityLabel={`${item.client?.fullName ?? 'Client'}, ${s.label}. ${previewText(last)}`}
              >
                <Avatar name={item.client?.fullName} uri={item.client?.avatarUrl} size={48} />
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className={`mr-2 flex-1 text-base text-text-heading ${needsYou ? 'font-bold' : 'font-semibold'}`} numberOfLines={1}>
                      {item.client?.fullName ?? 'Client'}
                    </Text>
                    <Text className="text-xs text-text-body">{formatRelative(last?.createdAt ?? item.updatedAt)}</Text>
                  </View>
                  <Text className={`mt-0.5 text-sm ${needsYou ? 'text-text-heading' : 'text-text-body'}`} numberOfLines={1}>
                    {previewText(last)}
                  </Text>
                  <View className="mt-1">
                    <Badge label={s.label} tone={s.tone} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
