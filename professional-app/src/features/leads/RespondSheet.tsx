import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import type { LeadDto } from '@/api/shared';
import { leadsApi } from '@/api/endpoints';
import { useInvalidate } from '@/api/queries';
import { Button, InfoBanner, Sheet, TextField } from '@/components/ui';
import { errorCodeOf, extractErrorMessage } from '@/lib/errors';
import { formatDateTime, rupeesToPaise } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';

const MESSAGE_MIN = 20;

/** Respond to a lead (POST /leads/:id/respond). Shared by the Leads list and Lead details. */
export function RespondSheet({ lead, onClose }: { lead: LeadDto | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [quote, setQuote] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ message?: string; quote?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);

  const respond = useMutation({
    mutationFn: (input: { message: string; quotedAmount?: number; availabilityNote?: string }) => leadsApi.respond(lead!.id, input),
    onSuccess: () => {
      toast.show('Response sent. The client sees it once they unlock it.');
      void invalidate(['leads']);
      close();
    },
    onError: (error) => {
      setNeedsPlan(errorCodeOf(error) === 'PLAN_UPGRADE_REQUIRED');
      setFormError(extractErrorMessage(error, 'Could not send your response.'));
    },
  });

  function close() {
    setMessage('');
    setQuote('');
    setNote('');
    setErrors({});
    setFormError(null);
    setNeedsPlan(false);
    onClose();
  }

  function submit() {
    const quotedAmount = quote.trim() ? rupeesToPaise(quote) : undefined;
    const next = {
      message: message.trim().length < MESSAGE_MIN ? `Your message must be at least ${MESSAGE_MIN} characters.` : undefined,
      quote: quotedAmount === null ? 'Enter a valid amount in rupees.' : undefined,
    };
    setErrors(next);
    if (next.message || next.quote) return;
    setFormError(null);
    respond.mutate({
      message: message.trim(),
      ...(quotedAmount != null ? { quotedAmount } : {}),
      ...(note.trim() ? { availabilityNote: note.trim() } : {}),
    });
  }

  return (
    <Sheet visible={!!lead} title="Respond to lead" onClose={close}>
      {lead ? (
        <>
          <Text className="text-base font-semibold text-text-heading">{lead.title}</Text>
          <Text className="mb-3 text-xs text-text-body">Posted {formatDateTime(lead.createdAt)}</Text>
          <View className="mb-3">
            <InfoBanner message="No coins are taken from you. Your reply reaches the client locked, and they unlock it with their own coins. Responding to leads needs an active paid plan." />
          </View>
          {formError ? (
            <View className="mb-3">
              <InfoBanner tone="danger" message={formError} icon="alert-circle" />
              {needsPlan ? (
                <View className="mt-2">
                  <Button
                    title="View plans"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      close();
                      router.push('/plans');
                    }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
          <TextField
            label="Your message"
            value={message}
            onChangeText={setMessage}
            error={errors.message}
            hint={`${message.trim().length}/${MESSAGE_MIN} characters minimum`}
            multiline
            maxLength={2000}
            placeholder="Introduce yourself and how you can help"
          />
          <TextField
            label="Your quote per session (optional)"
            prefix="₹"
            value={quote}
            onChangeText={setQuote}
            error={errors.quote}
            keyboardType="decimal-pad"
          />
          <TextField label="Availability note (optional)" value={note} onChangeText={setNote} maxLength={300} placeholder="e.g. Weekday mornings" />
          <Button title="Send response" onPress={submit} loading={respond.isPending} />
          <View className="h-4" />
        </>
      ) : null}
    </Sheet>
  );
}
