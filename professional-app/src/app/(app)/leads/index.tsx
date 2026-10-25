import { useState } from 'react';
import { FlatList, Pressable, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { LeadDto } from '@/api/shared';
import { useLeadStats, useLeads } from '@/api/queries';
import { Badge, Button, EmptyState, ErrorState, Header, IconBadge, LoadingCards, ThemedRefreshControl } from '@/components/ui';
import { RespondSheet } from '@/features/leads/RespondSheet';
import { LeadMeta } from '@/features/leads/LeadMeta';
import { formatMoney, formatRelative } from '@/lib/format';
import { leadStatus } from '@/lib/status';
import { useTheme } from '@/theme/theme-provider';

export default function LeadsScreen() {
  const [includeResponded, setIncludeResponded] = useState(false);
  const leads = useLeads({ includeResponded: includeResponded || undefined, limit: 50 });
  const stats = useLeadStats();
  const [responding, setResponding] = useState<LeadDto | null>(null);
  const { colors } = useTheme();

  const header = (
    <View>
      {stats.data ? (
        <>
          <Text className="mb-1.5 text-xs text-text-body">All-time, across your categories (includes closed requests)</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            <MiniStat label="Total" value={stats.data.totalLeads} />
            <MiniStat label="Not responded" value={stats.data.newLeads} />
            <MiniStat label="Pending" value={stats.data.pendingLeads} />
            <MiniStat label="Contacted" value={stats.data.contactedLeads} />
            <MiniStat label="Converted" value={stats.data.convertedLeads} />
            <MiniStat label="Conversion" value={`${stats.data.conversionRate}%`} />
          </View>
        </>
      ) : null}
      <View className="mb-3 flex-row items-center rounded-2xl border border-border bg-card px-4 py-2">
        <Text className="flex-1 text-sm text-text-heading">Show leads I&apos;ve already responded to</Text>
        <Switch
          value={includeResponded}
          onValueChange={setIncludeResponded}
          trackColor={{ true: colors.primary, false: colors.trackOff }}
          thumbColor={includeResponded ? colors.onPrimary : colors.thumbOff}
          accessibilityLabel="Show responded leads"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Header title="Leads" />
      {leads.isPending ? (
        <View className="px-4 pt-4">
          <LoadingCards count={3} label="Loading leads" />
        </View>
      ) : leads.isError ? (
        <ErrorState error={leads.error} onRetry={() => void leads.refetch()} />
      ) : (
        <FlatList
          data={leads.data.items}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={header}
          contentContainerClassName="px-4 pb-8 pt-3"
          ItemSeparatorComponent={() => <View className="h-3" />}
          refreshControl={
            <ThemedRefreshControl
              refreshing={leads.isRefetching}
              onRefresh={() => {
                void leads.refetch();
                void stats.refetch();
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="flash-outline"
              title="No leads right now"
              message="When clients post requirements that match your active services, they'll appear here."
            />
          }
          renderItem={({ item }) => <LeadCard lead={item} onRespond={() => setResponding(item)} />}
        />
      )}
      <RespondSheet lead={responding} onClose={() => setResponding(null)} />
    </SafeAreaView>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="min-w-[30%] grow rounded-3xl border border-border bg-card px-3 py-2.5">
      <Text className="text-base font-bold text-text-heading">{value}</Text>
      <Text className="text-xs text-text-body">{label}</Text>
    </View>
  );
}

function LeadCard({ lead, onRespond }: { lead: LeadDto; onRespond: () => void }) {
  const s = leadStatus(lead.leadStatus);
  const canRespond = lead.leadStatus === 'NEW';
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-card">
      <Pressable
        onPress={() => router.push({ pathname: '/leads/[id]', params: { id: lead.id } })}
        className="p-4 active:bg-muted"
        accessibilityRole="button"
        accessibilityLabel={`${lead.title}, ${s.label}. Open lead details`}
      >
        <View className="flex-row items-start">
          <IconBadge icon="flash" tone="primary" size={40} />
          <View className="ml-3 flex-1">
            <View className="flex-row items-start justify-between">
              <Text className="mr-2 flex-1 text-base font-bold text-text-heading" numberOfLines={2}>
                {lead.title}
              </Text>
              <Badge label={s.label} tone={s.tone} />
            </View>
            <Text className="mt-0.5 text-xs text-text-body">
              {lead.category?.name ?? 'Requirement'} · {formatRelative(lead.createdAt)}
            </Text>
          </View>
        </View>
        <Text className="mt-3 text-sm leading-5 text-text-heading" numberOfLines={3}>
          {lead.description}
        </Text>
        <View className="mt-3">
          <LeadMeta lead={lead} compact />
        </View>
      </Pressable>
      <View className="border-t border-border px-4 py-3">
        {canRespond ? (
          <Button title="Respond" icon="send" size="sm" onPress={onRespond} />
        ) : (
          <Text className="text-center text-sm text-text-body">
            You&apos;ve responded{lead.budgetAmount != null ? ` · client budget ${formatMoney(lead.budgetAmount)}` : ''}.
          </Text>
        )}
      </View>
    </View>
  );
}
