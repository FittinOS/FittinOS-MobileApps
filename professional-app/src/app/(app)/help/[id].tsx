import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supportApi } from '@/api/endpoints';
import { useInvalidate, useSupportTicket } from '@/api/queries';
import { Badge, EmptyState, ErrorState, Header, Spinner } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { formatDateTime, humanize } from '@/lib/format';
import { genericStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';
import { useAndroidKeyboardInset } from '@/lib/keyboard';
import { useTheme } from '@/theme/theme-provider';

export default function SupportTicketScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticket = useSupportTicket(id);
  const invalidate = useInvalidate();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  // Edge-to-edge Android doesn't resize for the keyboard; lift the composer ourselves.
  const keyboard = useAndroidKeyboardInset();
  const [text, setText] = useState('');

  const reply = useMutation({
    mutationFn: () => supportApi.reply(id, text.trim()),
    onSuccess: () => {
      setText('');
      void invalidate(['support']);
    },
    onError: (err) => toast.show(extractErrorMessage(err, 'Reply not sent.'), 'error'),
  });

  if (ticket.isPending) {
    return (
      <>
        <Header title="Support ticket" />
        <Spinner />
      </>
    );
  }
  if (ticket.isError) {
    return (
      <>
        <Header title="Support ticket" />
        <ErrorState error={ticket.error} onRetry={() => void ticket.refetch()} />
      </>
    );
  }
  const t = ticket.data;
  const closed = t.status === 'CLOSED';
  const messages = [...(t.messages ?? [])].reverse();

  return (
    <View className="flex-1 bg-background">
      <Header title="Support ticket" />
      <View className="border-b border-border bg-card px-4 py-3">
        <Text className="text-base font-semibold text-text-heading">{t.subject}</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Badge label={humanize(t.status)} tone={genericStatus(t.status).tone} />
          {t.assignedTo ? <Text className="text-xs text-text-body">Handled by {t.assignedTo.fullName}</Text> : null}
        </View>
      </View>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 56}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerClassName="px-3 py-3"
          onRefresh={() => void ticket.refetch()}
          refreshing={ticket.isRefetching}
          ListEmptyComponent={
            // `inverted` flips the whole scroll content, including this component — counter-flip
            // it back so the empty state reads right-side up.
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <EmptyState compact icon="chatbubble-ellipses-outline" title="No messages yet" message="Your message to support will appear here." />
            </View>
          }
          renderItem={({ item }) => {
            const staff = item.isAdminReply;
            return (
              <View className={`my-1 max-w-[85%] ${staff ? 'self-start' : 'self-end'}`}>
                <Text className={`mb-0.5 text-[11px] text-text-body ${staff ? '' : 'text-right'}`}>{staff ? 'FittinOS support' : 'You'}</Text>
                <View className={`rounded-2xl px-4 py-2.5 ${staff ? 'border border-border bg-card' : 'bg-secondary'}`}>
                  <Text className={`text-sm ${staff ? 'text-text-heading' : 'text-white'}`}>{item.body}</Text>
                </View>
                <Text className={`mt-0.5 text-[11px] text-text-body ${staff ? '' : 'text-right'}`}>{formatDateTime(item.createdAt)}</Text>
              </View>
            );
          }}
        />
        {closed ? (
          <Text className="bg-card px-4 py-3 text-center text-sm text-text-body" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            This ticket is closed. Open a new one if you need more help.
          </Text>
        ) : (
          <View className="flex-row items-end border-t border-border bg-card px-3 pt-2" style={{ paddingBottom: keyboard > 0 ? keyboard + 8 : Math.max(insets.bottom, 8) }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a reply…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={4000}
              className="max-h-[120px] min-h-[46px] flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-base text-text-heading"
              accessibilityLabel="Reply"
            />
            <Pressable
              onPress={() => text.trim() && reply.mutate()}
              disabled={!text.trim() || reply.isPending}
              className={`ml-2 h-12 w-12 items-center justify-center rounded-full ${text.trim() ? 'bg-action' : 'bg-border'}`}
              accessibilityRole="button"
              accessibilityLabel="Send reply"
            >
              <Ionicons name="send" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
