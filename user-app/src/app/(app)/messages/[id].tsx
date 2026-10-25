import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { conversationsApi } from '@/api/endpoints';
import { qk, useConversation, useInvalidate, useWallet } from '@/api/queries';
import type { MessageDto } from '@/api/shared';
import { Button, ConfirmDialog, EmptyState, ErrorState, Header, InfoBanner, Spinner } from '@/components/ui';
import { REPLY_MAX_LENGTH } from '@/features/messaging/messaging-helpers';
import { extractErrorMessage } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { useAndroidKeyboardInset } from '@/lib/keyboard';
import { conversationStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

/**
 * The client's own conversation with a professional. A locked response is
 * never sent to this viewer's device as text (see the backend's
 * toMessageDto) — the unlock card below is the entire truth the frontend
 * has to show, and unlocking is always an explicit, confirmed action that
 * spends real coins. Nothing here ever unlocks or spends coins on its own.
 */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const invalidate = useInvalidate();
  const insets = useSafeAreaInsets();
  const keyboard = useAndroidKeyboardInset();
  const listRef = useRef<FlatList<MessageDto>>(null);

  const conversation = useConversation(id);
  const wallet = useWallet();

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const refresh = () => invalidate(qk.conversation(id), qk.conversations({}));

  async function sendReply() {
    const text = reply.trim();
    if (!text || sending) return; // disabled below too — belt and suspenders against a double tap
    setSending(true);
    setSendError(null);
    try {
      await conversationsApi.reply(id, text);
      setReply('');
      void refresh();
    } catch (err) {
      setSendError(extractErrorMessage(err, "Message not sent. Please try again."));
    } finally {
      setSending(false);
    }
  }

  async function confirmAndUnlock() {
    if (unlocking) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      await conversationsApi.unlock(id);
      setConfirmUnlock(false);
      toast.show('Unlocked — coins deducted from your wallet.', 'success');
      void refresh();
      void invalidate(qk.wallet);
    } catch (err) {
      setUnlockError(extractErrorMessage(err, "Couldn't unlock this response. Please try again."));
    } finally {
      setUnlocking(false);
    }
  }

  if (conversation.isPending) {
    return (
      <>
        <Header title="Conversation" />
        <Spinner label="Loading conversation" />
      </>
    );
  }
  if (conversation.isError || !conversation.data) {
    return (
      <>
        <Header title="Conversation" />
        <ErrorState error={conversation.error} onRetry={() => void conversation.refetch()} />
      </>
    );
  }

  const conv = conversation.data;
  const s = conversationStatus(conv.status);
  const proName = conv.professional?.user.fullName ?? 'Professional';
  // `inverted` flips the list, so it wants newest-first.
  const timeline = [...(conv.messages ?? [])].reverse();
  const balanceKnown = wallet.data !== undefined;
  const shortOnCoins = balanceKnown && wallet.data.coinBalance < conv.unlockCoinCost;

  return (
    <View className="flex-1 bg-background">
      <Header title={proName} />
      <View className="border-b border-border bg-card px-4 py-2">
        <Text className="text-xs font-semibold text-text-body">{s.label}</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 56}>
        <FlatList
          ref={listRef}
          inverted
          data={timeline}
          keyExtractor={(m) => m.id}
          contentContainerClassName="px-3 py-3"
          ListEmptyComponent={
            // `inverted` flips the whole scroll content, including this component — counter-flip
            // it back so the empty state reads right-side up.
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <EmptyState compact icon="chatbubble-ellipses-outline" title="No messages yet" message="Your first message started this conversation." />
            </View>
          }
          renderItem={({ item }) =>
            item.isLocked ? (
              <LockedResponseCard
                unlockCoinCost={conv.unlockCoinCost}
                onUnlock={() => {
                  setUnlockError(null);
                  setConfirmUnlock(true);
                }}
              />
            ) : (
              <Bubble message={item} />
            )
          }
          onRefresh={() => void conversation.refetch()}
          refreshing={conversation.isRefetching}
        />

        {sendError ? (
          <View className="px-4 pb-2">
            <InfoBanner tone="danger" message={sendError} icon="alert-circle" />
          </View>
        ) : null}

        <View className="border-t border-border bg-card px-3 pt-2" style={{ paddingBottom: keyboard > 0 ? keyboard + 8 : Math.max(insets.bottom, 8) }}>
          {conv.status === 'UNLOCKED' ? (
            <View className="flex-row items-end">
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Type a message…"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={REPLY_MAX_LENGTH}
                editable={!sending}
                className="max-h-[120px] min-h-[46px] flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-base text-text-heading"
                accessibilityLabel="Message"
              />
              <Pressable
                onPress={() => void sendReply()}
                disabled={!reply.trim() || sending}
                className={`ml-2 h-12 w-12 items-center justify-center rounded-full ${reply.trim() && !sending ? 'bg-action' : 'bg-border'}`}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                {sending ? <ActivityIndicator color={colors.onPrimary} /> : <Ionicons name="send" size={20} color={colors.onPrimary} />}
              </Pressable>
            </View>
          ) : conv.status === 'RESPONSE_LOCKED' ? (
            <Text className="py-2 text-center text-sm text-text-body">Unlock {proName}'s response above to continue the conversation.</Text>
          ) : conv.status === 'AWAITING_PROFESSIONAL' ? (
            <Text className="py-2 text-center text-sm text-text-body">Waiting for {proName} to respond.</Text>
          ) : (
            <Text className="py-2 text-center text-sm text-text-body">
              This conversation was declined.{conv.declineReason ? ` Reason: ${conv.declineReason}` : ''}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmUnlock}
        title={`Unlock ${proName}'s response?`}
        message={`This spends ${conv.unlockCoinCost} coin${conv.unlockCoinCost === 1 ? '' : 's'} from your wallet${
          balanceKnown ? ` (balance: ${wallet.data.coinBalance})` : ''
        }. This can't be undone.`}
        confirmLabel={`Unlock · ${conv.unlockCoinCost} coin${conv.unlockCoinCost === 1 ? '' : 's'}`}
        loading={unlocking}
        onConfirm={() => void confirmAndUnlock()}
        onCancel={() => setConfirmUnlock(false)}
      >
        {shortOnCoins ? (
          <InfoBanner
            tone="warning"
            message="You don't have enough coins for this."
            icon="alert-circle"
            action={
              <Button
                title="Top up wallet"
                variant="outline"
                size="sm"
                onPress={() => {
                  setConfirmUnlock(false);
                  router.push('/(app)/wallet/buy');
                }}
              />
            }
          />
        ) : null}
        {unlockError ? (
          <View className="mt-3">
            <InfoBanner tone="danger" message={unlockError} icon="alert-circle" />
          </View>
        ) : null}
      </ConfirmDialog>
    </View>
  );
}

function LockedResponseCard({ unlockCoinCost, onUnlock }: { unlockCoinCost: number; onUnlock: () => void }) {
  const { colors } = useTheme();
  return (
    <View className="my-1 max-w-[82%] self-start">
      <View className="rounded-2xl rounded-bl-md border border-warning bg-warning-soft px-4 py-3">
        <View className="flex-row items-center">
          <Ionicons name="lock-closed" size={14} color={colors.warning} />
          <Text className="ml-1.5 text-sm font-semibold text-text-heading">Response received</Text>
        </View>
        <Text className="mt-1 text-xs text-text-body">Unlock to read this response.</Text>
        <Pressable
          onPress={onUnlock}
          className="mt-2.5 flex-row items-center justify-center rounded-xl bg-action px-3 py-2.5 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`Unlock for ${unlockCoinCost} coin${unlockCoinCost === 1 ? '' : 's'}`}
        >
          <Ionicons name="lock-open-outline" size={14} color={colors.onPrimary} />
          <Text className="ml-1.5 text-sm font-bold text-white">
            Unlock · {unlockCoinCost} coin{unlockCoinCost === 1 ? '' : 's'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Bubble({ message }: { message: MessageDto }) {
  const mine = message.senderRole === 'CLIENT';
  return (
    <View className={`my-1 max-w-[82%] ${mine ? 'self-end' : 'self-start'}`}>
      <View className={`rounded-2xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-action' : 'rounded-bl-md border border-border bg-card'}`}>
        <Text className={`text-base ${mine ? 'text-white' : 'text-text-heading'}`}>{message.message}</Text>
      </View>
      <Text className={`mt-0.5 text-[11px] text-text-body ${mine ? 'text-right' : ''}`}>{formatTime(message.createdAt)}</Text>
    </View>
  );
}
