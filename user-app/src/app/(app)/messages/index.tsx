import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConversations } from '@/api/queries';
import { Avatar, Badge, EmptyState, ErrorState, Header, LoadingCards, ThemedRefreshControl } from '@/components/ui';
import { lastMessage, previewText } from '@/features/messaging/messaging-helpers';
import { formatRelative } from '@/lib/format';
import { conversationStatus } from '@/lib/status';

/**
 * The client's own conversations with professionals — started from a
 * professional's profile (always a free first message). Already ordered
 * newest-first by the backend (`updatedAt desc`), so there is nothing to
 * re-sort here.
 */
export default function MessagesScreen() {
  const conversations = useConversations({});

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Header title="Messages" />
      {conversations.isPending ? (
        <View className="px-4 pt-4">
          <LoadingCards count={4} label="Loading conversations" />
        </View>
      ) : conversations.isError ? (
        <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
      ) : (
        <FlatList
          data={conversations.data.items}
          keyExtractor={(c) => c.id}
          contentContainerClassName="px-4 pb-10 pt-3"
          ItemSeparatorComponent={() => <View className="h-2" />}
          refreshControl={<ThemedRefreshControl refreshing={conversations.isRefetching} onRefresh={() => void conversations.refetch()} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No messages yet"
              message="Message a professional from their profile to start a conversation — your first message is always free."
            />
          }
          renderItem={({ item }) => {
            const s = conversationStatus(item.status);
            const last = lastMessage(item.messages);
            const proName = item.professional?.user.fullName ?? 'Professional';
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/(app)/messages/[id]', params: { id: item.id } })}
                className="flex-row items-center rounded-3xl border border-border bg-card p-3 active:bg-muted"
                accessibilityRole="button"
                accessibilityLabel={`${proName}, ${s.label}. ${previewText(last)}`}
              >
                <Avatar name={proName} uri={item.professional?.user.avatarUrl} size={48} />
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="mr-2 flex-1 text-[15px] font-bold text-text-heading" numberOfLines={1}>
                      {proName}
                    </Text>
                    <Text className="text-xs text-text-body">{formatRelative(last?.createdAt ?? item.updatedAt)}</Text>
                  </View>
                  <Text className="mt-0.5 text-sm text-text-body" numberOfLines={1}>
                    {previewText(last)}
                  </Text>
                  <View className="mt-1.5">
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
