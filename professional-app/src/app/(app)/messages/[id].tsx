import { useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { CallDto, MessageDto } from '@/api/shared';
import { conversationsApi } from '@/api/endpoints';
import { qk, useCallHistory, useConversation, useInvalidate } from '@/api/queries';
import { Button, ConfirmDialog, Divider, EmptyState, ErrorState, Header, InfoBanner, ListRow, Spinner, TextField } from '@/components/ui';
import { useCall } from '@/features/calls/call-provider';
import { callAvailability } from '@/features/calls/engine/availability.ts';
import { historyEntryOf } from '@/features/calls/engine/call-status.ts';
import { ACCEPT_MESSAGE_MIN } from '@/features/messaging/messaging-helpers';
import { errorCodeOf, extractErrorMessage } from '@/lib/errors';
import { formatDateTime, formatTime } from '@/lib/format';
import { conversationStatus } from '@/lib/status';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { useAndroidKeyboardInset } from '@/lib/keyboard';
import { useTheme } from '@/theme/theme-provider';

type TimelineItem = { kind: 'message'; at: string; message: MessageDto } | { kind: 'call'; at: string; call: CallDto };

export default function ConversationScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversation = useConversation(id);
  const calls = useCallHistory(id);
  const call = useCall();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  // Edge-to-edge Android doesn't resize for the keyboard; lift the composer ourselves.
  const keyboard = useAndroidKeyboardInset();
  const invalidate = useInvalidate();
  const toast = useToast();
  const listRef = useRef<FlatList<TimelineItem>>(null);

  const [reply, setReply] = useState('');
  const [dialog, setDialog] = useState<'accept' | 'decline' | 'menu' | 'report' | 'block' | null>(null);
  const [acceptText, setAcceptText] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);

  const refresh = () => invalidate(qk.conversation(id), ['conversations']);
  const fail = (fallback: string) => (err: unknown) => {
    setNeedsPlan(errorCodeOf(err) === 'PLAN_UPGRADE_REQUIRED');
    setError(extractErrorMessage(err, fallback));
  };

  const accept = useMutation({
    mutationFn: () => conversationsApi.accept(id, acceptText.trim()),
    onSuccess: () => {
      setDialog(null);
      setAcceptText('');
      toast.show('Response sent. The client unlocks it to read it.');
      void refresh();
    },
    onError: fail('Failed to send your response. Please try again.'),
  });
  const decline = useMutation({
    mutationFn: () => conversationsApi.decline(id, declineReason.trim() || undefined),
    onSuccess: () => {
      setDialog(null);
      toast.show('Conversation declined.', 'info');
      void refresh();
    },
    onError: fail('Failed to decline. Please try again.'),
  });
  const send = useMutation({
    mutationFn: (text: string) => conversationsApi.reply(id, text),
    onSuccess: () => {
      setReply('');
      void refresh();
    },
    onError: fail('Message not sent. Please try again.'),
  });
  const report = useMutation({
    mutationFn: () => conversationsApi.report(id, reportReason.trim()),
    onSuccess: () => {
      setDialog(null);
      setReportReason('');
      toast.show('Reported. Our support team will review it.', 'info');
    },
    onError: fail('Could not send the report.'),
  });
  const block = useMutation({
    mutationFn: () => conversationsApi.block(id),
    onSuccess: () => {
      setDialog(null);
      toast.show('Client blocked.', 'info');
      void invalidate(['conversations']);
      router.back();
    },
    onError: fail('Could not block this client.'),
  });

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...(conversation.data?.messages ?? []).map((m) => ({ kind: 'message' as const, at: m.createdAt, message: m })),
      ...(calls.data ?? []).map((c) => ({ kind: 'call' as const, at: c.createdAt, call: c })),
    ];
    // Newest first for an inverted list.
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [conversation.data?.messages, calls.data]);

  if (conversation.isPending) {
    return (
      <>
        <Header title="Conversation" />
        <Spinner label="Loading conversation" />
      </>
    );
  }
  if (conversation.isError) {
    return (
      <>
        <Header title="Conversation" />
        <ErrorState error={conversation.error} onRetry={() => void conversation.refetch()} />
      </>
    );
  }

  const conv = conversation.data;
  const s = conversationStatus(conv.status);
  const clientName = conv.client?.fullName ?? 'Client';
  const availability = callAvailability({
    viewerRole: 'PROFESSIONAL',
    conversationStatus: conv.status,
    browserSupport: { supported: call.support.available, reason: call.support.reason },
    socket: call.state.socket,
    phase: call.state.phase,
  });
  const startCall = (type: 'VOICE' | 'VIDEO') =>
    call.startCall({ conversationId: conv.id, type, peer: { fullName: clientName, avatarUrl: conv.client?.avatarUrl ?? null } });

  return (
    <View className="flex-1 bg-background">
      <Header
        title={clientName}
        right={
          <View className="flex-row items-center">
            <HeaderIcon icon="call-outline" label="Voice call" disabled={!availability.available} onPress={() => startCall('VOICE')} />
            <HeaderIcon icon="videocam-outline" label="Video call" disabled={!availability.available} onPress={() => startCall('VIDEO')} />
            <HeaderIcon icon="ellipsis-vertical" label="More options" onPress={() => setDialog('menu')} />
          </View>
        }
      />
      <View className="flex-row items-center justify-between border-b border-border bg-card px-4 py-2">
        <Text className="text-xs font-semibold text-text-body">{s.label}</Text>
        {availability.reason ? (
          <Text className="ml-3 flex-1 text-right text-xs text-text-body" numberOfLines={2}>
            {availability.reason}
          </Text>
        ) : (
          <Text className="text-xs text-success-ink">Free voice & video calls</Text>
        )}
      </View>
      {calls.isError ? (
        <Pressable onPress={() => void calls.refetch()} className="flex-row items-center justify-center bg-warning-soft px-4 py-1.5" accessibilityRole="button">
          <Ionicons name="refresh" size={12} color={colors.warning} />
          <Text className="ml-1.5 text-xs font-medium text-warning-ink">Call history failed to load. Tap to retry.</Text>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 56}>
        <FlatList
          ref={listRef}
          inverted
          data={timeline}
          keyExtractor={(item) => (item.kind === 'message' ? `m-${item.message.id}` : `c-${item.call.id}`)}
          contentContainerClassName="px-3 py-3"
          ListEmptyComponent={
            // `inverted` flips the whole scroll content, including this component — counter-flip
            // it back so the empty state reads right-side up.
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <EmptyState
                compact
                icon="chatbubble-ellipses-outline"
                title="No messages yet"
                message={conv.status === 'AWAITING_PROFESSIONAL' ? 'Respond below to start the conversation.' : 'Messages and calls will appear here.'}
              />
            </View>
          }
          renderItem={({ item }) =>
            item.kind === 'message' ? <Bubble message={item.message} /> : user ? <CallRow call={item.call} selfUserId={user.id} /> : null
          }
          onRefresh={() => {
            void conversation.refetch();
            void calls.refetch();
          }}
          refreshing={conversation.isRefetching}
        />

        {error ? (
          <View className="px-4 pb-2">
            <InfoBanner tone="danger" message={error} icon="alert-circle" />
            {needsPlan ? (
              <View className="mt-2">
                <Button title="View plans" variant="outline" size="sm" onPress={() => router.push('/plans')} />
              </View>
            ) : null}
          </View>
        ) : null}

        <View className="border-t border-border bg-card px-3 pt-2" style={{ paddingBottom: keyboard > 0 ? keyboard + 8 : Math.max(insets.bottom, 8) }}>
          {conv.status === 'UNLOCKED' ? (
            <View className="flex-row items-end">
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Continue the conversation…"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={2000}
                className="max-h-[120px] min-h-[46px] flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-base text-text-heading"
                accessibilityLabel="Message"
              />
              <Pressable
                onPress={() => {
                  const text = reply.trim();
                  if (!text) return;
                  setError(null);
                  send.mutate(text);
                }}
                disabled={!reply.trim() || send.isPending}
                className={`ml-2 h-12 w-12 items-center justify-center rounded-full ${reply.trim() ? 'bg-action' : 'bg-border'}`}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Ionicons name="send" size={20} color={colors.onPrimary} />
              </Pressable>
            </View>
          ) : conv.status === 'AWAITING_PROFESSIONAL' ? (
            <View className="pb-1">
              <Text className="mb-2 text-sm text-text-body">
                {clientName} reached out to you. Respond to start the conversation, or decline. No coins are charged to either side for declining.
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button title="Decline" variant="outline" onPress={() => { setError(null); setDialog('decline'); }} />
                </View>
                <View className="flex-1">
                  <Button title="Respond" onPress={() => { setError(null); setFieldError(undefined); setDialog('accept'); }} />
                </View>
              </View>
            </View>
          ) : conv.status === 'RESPONSE_LOCKED' ? (
            <Text className="py-2 text-center text-sm text-text-body">
              Your response is locked until the client unlocks it. You can reply freely once they do.
            </Text>
          ) : (
            <Text className="py-2 text-center text-sm text-text-body">
              You declined this conversation.{conv.declineReason ? ` Reason: ${conv.declineReason}` : ''}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={dialog === 'accept'}
        title={`Respond to ${clientName}`}
        message="Your first reply reaches the client locked; they unlock it with their own coins. No coins are taken from you."
        confirmLabel="Send response"
        loading={accept.isPending}
        onConfirm={() => {
          if (acceptText.trim().length < ACCEPT_MESSAGE_MIN) {
            setFieldError(`Please write at least ${ACCEPT_MESSAGE_MIN} characters.`);
            return;
          }
          accept.mutate();
        }}
        onCancel={() => setDialog(null)}
      >
        <TextField label="Your response" value={acceptText} onChangeText={setAcceptText} error={fieldError} multiline maxLength={2000} />
      </ConfirmDialog>

      <ConfirmDialog
        visible={dialog === 'decline'}
        title="Decline this conversation?"
        message="No coins are charged to either side. The client will see this conversation as declined."
        confirmLabel="Decline"
        destructive
        loading={decline.isPending}
        onConfirm={() => decline.mutate()}
        onCancel={() => setDialog(null)}
      >
        <TextField label="Reason (optional)" value={declineReason} onChangeText={setDeclineReason} multiline maxLength={300} />
      </ConfirmDialog>

      <ConfirmDialog
        visible={dialog === 'menu'}
        title="Conversation options"
        confirmLabel="Close"
        singleAction
        onConfirm={() => setDialog(null)}
        onCancel={() => setDialog(null)}
      >
        <View className="overflow-hidden rounded-2xl border border-border">
          <ListRow
            title="Report"
            subtitle="Opens a ticket for our support team"
            icon="flag-outline"
            tone="warning"
            onPress={() => {
              setFieldError(undefined);
              setDialog('report');
            }}
          />
          <Divider />
          <ListRow title="Block this client" subtitle="They can't message or call you" icon="ban" destructive onPress={() => setDialog('block')} />
        </View>
      </ConfirmDialog>

      <ConfirmDialog
        visible={dialog === 'report'}
        title="Report conversation"
        message="Tell us what's wrong. This opens a ticket our support team reviews."
        confirmLabel="Send report"
        destructive
        loading={report.isPending}
        onConfirm={() => {
          if (reportReason.trim().length < 10) {
            setFieldError('Please describe the problem (at least 10 characters).');
            return;
          }
          report.mutate();
        }}
        onCancel={() => setDialog(null)}
      >
        <TextField label="What happened?" value={reportReason} onChangeText={setReportReason} error={fieldError} multiline maxLength={1000} />
      </ConfirmDialog>

      <ConfirmDialog
        visible={dialog === 'block'}
        title={`Block ${clientName}?`}
        message="They won't be able to message or call you. You can unblock them later from Settings."
        confirmLabel="Block"
        destructive
        loading={block.isPending}
        onConfirm={() => block.mutate()}
        onCancel={() => setDialog(null)}
      />
    </View>
  );
}

function HeaderIcon({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className={`h-11 w-11 items-center justify-center ${disabled ? 'opacity-30' : ''}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={icon} size={22} color={colors.heading} />
    </Pressable>
  );
}

function Bubble({ message }: { message: MessageDto }) {
  const { colors } = useTheme();
  const mine = message.senderRole === 'PROFESSIONAL';
  return (
    <View className={`my-1 max-w-[82%] ${mine ? 'self-end' : 'self-start'}`}>
      <View className={`rounded-2xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-action' : 'rounded-bl-md border border-border bg-card'}`}>
        {message.isLocked ? (
          <View className="flex-row items-center">
            <Ionicons name="lock-closed" size={14} color={mine ? '#FFFFFF' : colors.body} />
            <Text className={`ml-1.5 text-sm italic ${mine ? 'text-white' : 'text-text-body'}`}>Locked until the client unlocks it</Text>
          </View>
        ) : (
          <Text className={`text-base ${mine ? 'text-white' : 'text-text-heading'}`}>{message.message}</Text>
        )}
      </View>
      <Text className={`mt-0.5 text-[11px] text-text-body ${mine ? 'text-right' : ''}`}>{formatTime(message.createdAt)}</Text>
    </View>
  );
}

function CallRow({ call, selfUserId }: { call: CallDto; selfUserId: string }) {
  const { colors } = useTheme();
  const entry = historyEntryOf(call, selfUserId);
  const color = entry.tone === 'missed' || entry.tone === 'failed' ? colors.danger : colors.body;
  return (
    <View className="my-2 flex-row items-center self-center rounded-full bg-secondary-soft px-3 py-1.5" accessibilityLabel={`${entry.directionLabel} ${entry.label}, ${entry.statusLabel}`}>
      <Ionicons name={call.type === 'VIDEO' ? 'videocam' : 'call'} size={13} color={color} />
      <Text className="ml-1.5 text-xs text-text-heading">
        {entry.directionLabel} {entry.label.toLowerCase()} · {entry.statusLabel}
        {entry.duration ? ` · ${entry.duration}` : ''} · {formatDateTime(entry.at)}
      </Text>
    </View>
  );
}
