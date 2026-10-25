import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePaymentHistory } from '@/api/queries';
import type { PaymentHistoryStatus, PaymentPurposeValue } from '@/api/types';
import { Badge, Button, Chip, EmptyState, ErrorState, Header, LoadingCards } from '@/components/ui';
import { formatDateTime, formatMoney } from '@/lib/format';
import { genericStatus } from '@/lib/status';
import { useTheme } from '@/theme/theme-provider';

const PURPOSES: Array<{ key?: PaymentPurposeValue; label: string }> = [
  { label: 'All' },
  { key: 'COIN_PACKAGE', label: 'Coins' },
  { key: 'PROFESSIONAL_SUBSCRIPTION', label: 'Plans' },
  { key: 'FEATURED_LISTING', label: 'Featured' },
];
const STATUSES: Array<{ key?: PaymentHistoryStatus; label: string }> = [
  { label: 'Any status' },
  { key: 'CAPTURED', label: 'Paid' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'REFUNDED', label: 'Refunded' },
];

export default function PaymentHistoryScreen() {
  const { colors } = useTheme();
  const [purpose, setPurpose] = useState<PaymentPurposeValue | undefined>();
  const [status, setStatus] = useState<PaymentHistoryStatus | undefined>();
  const [page, setPage] = useState(1);
  const history = usePaymentHistory({ page, limit: 20, purpose, status });

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Header title="Payment history" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 pt-3">
          {PURPOSES.map((p) => (
            <Chip key={p.label} label={p.label} selected={purpose === p.key} onPress={() => { setPurpose(p.key); setPage(1); }} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 py-2">
          {STATUSES.map((s) => (
            <Chip key={s.label} label={s.label} selected={status === s.key} onPress={() => { setStatus(s.key); setPage(1); }} />
          ))}
        </ScrollView>
      </View>
      {history.isPending ? (
        <View className="px-4 pt-3">
          <LoadingCards count={4} label="Loading payment history" />
        </View>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : (
        <FlatList
          data={history.data.items}
          keyExtractor={(p) => p.id}
          contentContainerClassName="px-4 pb-10"
          ItemSeparatorComponent={() => <View className="h-2" />}
          refreshControl={<RefreshControl refreshing={history.isRefetching} onRefresh={() => void history.refetch()} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No payments yet" message="Coin, plan and featured-listing purchases appear here." />}
          ListFooterComponent={
            history.data.totalPages > 1 ? (
              <View className="mt-4 flex-row items-center justify-between">
                <Button title="Previous" size="sm" variant="outline" fullWidth={false} disabled={page <= 1} onPress={() => setPage((p) => p - 1)} />
                <Text className="text-sm text-text-body">
                  Page {history.data.page} of {history.data.totalPages}
                </Text>
                <Button title="Next" size="sm" variant="outline" fullWidth={false} disabled={page >= history.data.totalPages} onPress={() => setPage((p) => p + 1)} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const s = genericStatus(item.status);
            return (
              <Pressable
                onPress={() => router.push(`/payments/${item.id}`)}
                className="rounded-3xl border border-border bg-card p-4 active:bg-muted"
                accessibilityRole="button"
              >
                <View className="flex-row items-start justify-between">
                  <View className="mr-2 flex-1">
                    <Text className="text-sm font-semibold text-text-heading" numberOfLines={1}>
                      {item.summary || item.purposeLabel}
                    </Text>
                    <Text className="text-xs text-text-body">
                      {item.purposeLabel} · {item.reference}
                    </Text>
                  </View>
                  <Text className="text-base font-bold text-text-heading">{formatMoney(item.amount)}</Text>
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs text-text-body">{formatDateTime(item.createdAt)}</Text>
                  <Badge label={item.statusLabel} tone={s.tone} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
