import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { requirementsApi } from '@/api/endpoints';
import { useInvalidate, useRequirement, qk } from '@/api/queries';
import { Badge, Button, Card, Divider, EmptyState, ErrorState, Header, InfoBanner, Screen, Spinner } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import { requirementStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';

interface ResponseItem {
  id?: string;
  professional?: { fullName?: string };
  message?: string;
  quotedAmount?: number;
  isUnlocked?: boolean;
  createdAt?: string;
}

export default function RequirementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const invalidate = useInvalidate();
  const requirement = useRequirement(id);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  async function close() {
    setClosing(true);
    setCloseError(null);
    try {
      await requirementsApi.close(id);
      void invalidate(qk.requirement(id), qk.requirements({}));
      toast.show('Requirement closed.');
    } catch (err) {
      setCloseError(extractErrorMessage(err, "We couldn't close this requirement."));
    } finally {
      setClosing(false);
    }
  }

  if (requirement.isPending) return <Spinner label="Loading requirement" />;
  if (requirement.isError || !requirement.data) return <ErrorState error={requirement.error} onRetry={() => void requirement.refetch()} />;

  const r = requirement.data;
  const s = requirementStatus(r.status);
  const responses = (r as { responses?: ResponseItem[] }).responses ?? [];

  return (
    <>
      <Header title="Requirement" />
      <Screen>
        <View className="flex-row items-start justify-between">
          <Text className="flex-1 text-lg font-bold text-text-heading" accessibilityRole="header">
            {r.title}
          </Text>
          <Badge label={s.label} tone={s.tone} />
        </View>
        <Text className="mt-1 text-xs text-text-body">Posted {formatDate(r.createdAt)}</Text>

        <Card className="mt-4">
          <Text className="text-sm leading-5 text-text-heading">{r.description}</Text>
          {r.budgetAmount ? <Text className="mt-2 text-xs font-semibold text-text-body">Budget: {formatMoney(r.budgetAmount)}</Text> : null}
          {r.location ? <Text className="mt-1 text-xs text-text-body">Location: {r.location}</Text> : null}
        </Card>

        {closeError ? (
          <View className="mt-3">
            <InfoBanner tone="danger" message={closeError} icon="alert-circle" />
          </View>
        ) : null}

        {r.status === 'OPEN' ? (
          <View className="mt-4">
            <Button title="Close requirement" variant="outline" onPress={close} loading={closing} />
          </View>
        ) : null}

        <Text className="mb-2.5 mt-6 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
          Responses
        </Text>
        {responses.length === 0 ? (
          <EmptyState compact icon="chatbox-ellipses-outline" title="No responses yet" message="Professionals who respond will show up here." />
        ) : (
          responses.map((resp, i) => (
            <View key={resp.id ?? i}>
              {i > 0 ? <Divider className="my-3" /> : null}
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-text-heading">{resp.professional?.fullName ?? 'Professional'}</Text>
                {resp.quotedAmount != null ? <Text className="text-sm font-semibold text-primary-ink">{formatMoney(resp.quotedAmount)}</Text> : null}
              </View>
              <Text className="mt-1 text-sm text-text-body">{resp.message ?? '—'}</Text>
            </View>
          ))
        )}
      </Screen>
    </>
  );
}
