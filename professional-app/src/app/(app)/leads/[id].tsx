import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { LeadDto, Paginated } from '@/api/shared';
import { leadsApi } from '@/api/endpoints';
import { qk } from '@/api/queries';
import { Badge, Button, Card, EmptyState, ErrorState, Header, InfoBanner, Screen, SectionTitle, Spinner } from '@/components/ui';
import { LeadMeta } from '@/features/leads/LeadMeta';
import { RespondSheet } from '@/features/leads/RespondSheet';
import { formatDateTime } from '@/lib/format';
import { leadStatus } from '@/lib/status';
import { useTheme } from '@/theme/theme-provider';

const STAGES: Array<{ key: LeadDto['leadStatus']; label: string; hint: string }> = [
  { key: 'NEW', label: 'New', hint: "You haven't responded yet" },
  { key: 'PENDING', label: 'Responded', hint: 'Waiting for the client to unlock your reply' },
  { key: 'CONTACTED', label: 'Contacted', hint: 'The client unlocked your reply' },
  { key: 'CONVERTED', label: 'Converted', hint: 'A booking resulted' },
];

/**
 * Lead details. The backend has no "get one lead" endpoint, so the lead comes
 * from the Leads list already loaded (or, after a deep link, from the list
 * including responded leads). Client contact details are never shown here —
 * the client sees your reply only after unlocking it with their own coins.
 */
export default function LeadDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [responding, setResponding] = useState(false);

  const cached = queryClient
    .getQueriesData<Paginated<LeadDto>>({ queryKey: ['leads'] })
    .flatMap(([, data]) => data?.items ?? [])
    .find((l) => l.id === id);
  const params = { includeResponded: true, limit: 100 };
  const fallback = useQuery({ queryKey: qk.leads(params), queryFn: () => leadsApi.list(params), enabled: !cached });
  const lead = cached ?? fallback.data?.items.find((l) => l.id === id);

  if (!lead) {
    return (
      <>
        <Header title="Lead" />
        {fallback.isPending && !cached ? (
          <Spinner label="Loading lead" />
        ) : fallback.isError ? (
          <ErrorState error={fallback.error} onRetry={() => void fallback.refetch()} />
        ) : (
          <EmptyState icon="flash-outline" title="This lead isn't available" message="It may have closed, or it no longer matches your active services." />
        )}
      </>
    );
  }

  const s = leadStatus(lead.leadStatus);
  const stageIndex = Math.max(0, STAGES.findIndex((st) => st.key === lead.leadStatus));
  const canRespond = lead.leadStatus === 'NEW';

  return (
    <>
      <Header title="Lead details" />
      <Screen footer={canRespond ? <Button title="Respond to this lead" icon="send" onPress={() => setResponding(true)} /> : undefined}>
        <Card>
          <View className="flex-row items-start justify-between">
            <Text className="mr-2 flex-1 text-xl font-bold tracking-tight text-text-heading" accessibilityRole="header">
              {lead.title}
            </Text>
            <Badge label={s.label} tone={s.tone} />
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <Badge label={lead.category?.name ?? 'Requirement'} tone="primary" />
            <Text className="text-xs text-text-body">Posted {formatDateTime(lead.createdAt)}</Text>
          </View>
          <Text className="mt-4 text-[15px] leading-6 text-text-heading">{lead.description}</Text>
        </Card>

        <SectionTitle title="Details" />
        <Card>
          <LeadMeta lead={lead} />
        </Card>

        <SectionTitle title="Lead progress" />
        <Card>
          {STAGES.map((stage, i) => {
            const reached = i <= stageIndex;
            const current = i === stageIndex;
            return (
              <View key={stage.key} className="flex-row" accessibilityLabel={`${stage.label}: ${reached ? 'reached' : 'not yet'}`}>
                <View className="mr-3 items-center">
                  <View className={`h-7 w-7 items-center justify-center rounded-full ${reached ? 'bg-success' : 'border-2 border-border bg-card'}`}>
                    {reached ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
                  </View>
                  {i < STAGES.length - 1 ? <View className={`w-0.5 flex-1 ${i < stageIndex ? 'bg-success' : 'bg-border'}`} style={{ minHeight: 18 }} /> : null}
                </View>
                <View className="flex-1 pb-4">
                  <Text className={`text-sm ${current ? 'font-bold text-text-heading' : reached ? 'font-semibold text-text-heading' : 'text-text-body'}`}>
                    {stage.label}
                  </Text>
                  <Text className="text-xs text-text-body">{stage.hint}</Text>
                </View>
              </View>
            );
          })}
        </Card>

        <View className="mt-3">
          <InfoBanner message="Client contact details stay private. Your reply reaches the client locked; once they unlock it, the conversation opens in Messages." />
        </View>
      </Screen>
      <RespondSheet lead={responding ? lead : null} onClose={() => setResponding(false)} />
    </>
  );
}
