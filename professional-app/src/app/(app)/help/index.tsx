import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { supportApi } from '@/api/endpoints';
import { useInvalidate, useSupportContact, useSupportTickets } from '@/api/queries';
import { Badge, Button, Card, EmptyState, ErrorState, Header, InfoBanner, Screen, SectionTitle, Sheet, Spinner, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { formatRelative, humanize } from '@/lib/format';
import { genericStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

const FAQS = [
  {
    q: 'How do leads work?',
    a: 'Clients post requirements that match your services. Responding costs you no coins (it needs an active paid plan); the client unlocks your reply with their own coins.',
  },
  {
    q: 'When do I get paid?',
    a: 'Earnings from completed bookings clear after the platform holding period, then become available for payout. Payouts go to your verified payout account.',
  },
  {
    q: 'How do I go live on the platform?',
    a: 'Complete your KYC verification and at least one certification. Once both are approved, your profile goes live automatically.',
  },
  {
    q: 'Do calls with clients cost coins?',
    a: 'No. Voice and video calls are free for both sides. They become available once the client has unlocked your response.',
  },
];

export default function HelpScreen() {
  const { colors } = useTheme();
  const tickets = useSupportTickets();
  const contact = useSupportContact();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => supportApi.create(subject.trim(), message.trim()),
    onSuccess: (ticket) => {
      toast.show('Ticket created. Our team will reply here.');
      setCreating(false);
      setSubject('');
      setMessage('');
      void invalidate(['support']);
      if (ticket?.id) router.push(`/help/${ticket.id}`);
    },
    onError: (err) => setError(extractErrorMessage(err, 'Could not create the ticket.')),
  });

  return (
    <>
      <Header title="Help & support" />
      <Screen refreshing={tickets.isRefetching} onRefresh={() => void tickets.refetch()}>
        <SectionTitle title="Frequently asked" />
        <Card className="p-0">
          {FAQS.map((f, i) => (
            <Pressable
              key={f.q}
              onPress={() => setOpen(open === i ? null : i)}
              className={`px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}
            >
              <View className="flex-row items-center">
                <Text className="flex-1 text-sm font-semibold text-text-heading">{f.q}</Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={16} color={colors.body} />
              </View>
              {open === i ? <Text className="mt-2 text-sm text-text-body">{f.a}</Text> : null}
            </Pressable>
          ))}
        </Card>

        <SectionTitle title="Your support tickets" action={<Button title="New ticket" size="sm" fullWidth={false} onPress={() => setCreating(true)} />} />
        {tickets.isPending ? (
          <Spinner />
        ) : tickets.isError ? (
          <ErrorState compact error={tickets.error} onRetry={() => void tickets.refetch()} />
        ) : tickets.data.items.length === 0 ? (
          <Card>
            <EmptyState compact icon="help-buoy-outline" title="No tickets yet" message="Open one and our team will reply here." />
          </Card>
        ) : (
          <Card className="p-0">
            {tickets.data.items.map((t, i) => {
              const s = genericStatus(t.status);
              return (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(`/help/${t.id}`)}
                  className={`px-4 py-3 active:bg-muted ${i > 0 ? 'border-t border-border' : ''}`}
                  accessibilityRole="button"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="mr-2 flex-1 text-sm font-semibold text-text-heading" numberOfLines={1}>
                      {t.subject}
                    </Text>
                    <Badge label={humanize(t.status)} tone={s.tone} />
                  </View>
                  {t.lastMessage ? (
                    <Text className="mt-0.5 text-xs text-text-body" numberOfLines={1}>
                      {t.lastMessage}
                    </Text>
                  ) : null}
                  <Text className="mt-0.5 text-xs text-text-body">Updated {formatRelative(t.updatedAt)}</Text>
                </Pressable>
              );
            })}
          </Card>
        )}

        <SectionTitle title="Contact us" />
        <Card>
          {contact.data?.email || contact.data?.phone ? (
            <>
              <Text className="text-sm text-text-body">Prefer to reach us directly? Contact FittinOS support.</Text>
              {contact.data.email ? (
                <Pressable onPress={() => void Linking.openURL(`mailto:${contact.data!.email}`)} className="mt-2 flex-row items-center py-1" accessibilityRole="link">
                  <Ionicons name="mail-outline" size={18} color={colors.info} />
                  <Text className="ml-2 text-sm font-semibold text-info-ink">{contact.data.email}</Text>
                </Pressable>
              ) : null}
              {contact.data.phone ? (
                <Pressable onPress={() => void Linking.openURL(`tel:${contact.data!.phone}`)} className="mt-1 flex-row items-center py-1" accessibilityRole="link">
                  <Ionicons name="call-outline" size={18} color={colors.info} />
                  <Text className="ml-2 text-sm font-semibold text-info-ink">{contact.data.phone}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text className="text-sm text-text-body">Use the form above to reach our support team.</Text>
          )}
        </Card>
      </Screen>

      <Sheet visible={creating} title="New support ticket" onClose={() => setCreating(false)}>
        {error ? (
          <View className="mb-3">
            <InfoBanner tone="danger" message={error} icon="alert-circle" />
          </View>
        ) : null}
        <TextField label="Subject" value={subject} onChangeText={setSubject} placeholder="What's this about?" maxLength={200} />
        <TextField label="Message" value={message} onChangeText={setMessage} multiline maxLength={4000} placeholder="Describe the issue" />
        <Button
          title="Submit ticket"
          loading={create.isPending}
          onPress={() => {
            if (!subject.trim() || !message.trim()) return setError('Please fill in both the subject and your message.');
            if (subject.trim().length < 4) return setError('The subject must be at least 4 characters.');
            if (message.trim().length < 10) return setError('Your message must be at least 10 characters.');
            setError(null);
            create.mutate();
          }}
        />
        <View className="h-4" />
      </Sheet>
    </>
  );
}
