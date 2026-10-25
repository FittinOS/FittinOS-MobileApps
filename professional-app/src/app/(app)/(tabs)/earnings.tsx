import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useEarnings, useEarningsSummary, usePayoutAccount, usePayouts } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import {
  Badge,
  BarChart,
  BentoCard,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconBadge,
  InfoBanner,
  LoadingCards,
  Metric,
  Screen,
  SectionTitle,
  Segmented,
  Skeleton,
  Spinner,
  StackedBar,
} from '@/components/ui';
import { monthOverMonth, monthlyEarnings } from '@/features/earnings/monthly';
import { formatDate, formatMoney, humanize } from '@/lib/format';
import { genericStatus, payoutAccountStatus } from '@/lib/status';

/**
 * Read-only money view: every figure is the backend's (EarningsService).
 * Payouts are created and approved by FittinOS admins — there is no
 * "withdraw" action for professionals in the backend, so none is offered.
 * The earnings/payout lists are paginated only (no date filter in the API),
 * so rows are grouped by month for reading rather than filtered.
 */
export default function EarningsScreen() {
  const summary = useEarningsSummary();
  // 100 is the API's page cap; the chart below is drawn only when this holds every record.
  const earnings = useEarnings({ limit: 100 });
  const payouts = usePayouts({ limit: 50 });
  const account = usePayoutAccount();
  const [tab, setTab] = useState<'earnings' | 'payouts'>('earnings');

  const refresh = () => {
    void summary.refetch();
    void earnings.refetch();
    void payouts.refetch();
    void account.refetch();
  };

  const chartComplete = !!earnings.data && earnings.data.total <= earnings.data.items.length;
  const months = useMemo(() => (chartComplete && earnings.data ? monthlyEarnings(earnings.data.items) : null), [chartComplete, earnings.data]);
  const change = months ? monthOverMonth(months) : null;
  const earningGroups = useMemo(() => groupByMonth(earnings.data?.items ?? [], (e) => e.createdAt), [earnings.data]);
  const payoutGroups = useMemo(() => groupByMonth(payouts.data?.items ?? [], (p) => p.processedAt ?? p.createdAt), [payouts.data]);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Earnings" subtitle="Payouts are processed by the FittinOS team" />
      <Screen refreshing={summary.isRefetching} onRefresh={refresh} edges={[]}>
        {summary.isPending ? (
          <View className="rounded-3xl border border-border bg-card p-4">
            <Skeleton height={14} width="40%" />
            <Skeleton height={34} width="60%" className="mt-3" />
          </View>
        ) : summary.isError ? (
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        ) : (
          <>
            <BentoCard layout="block" emphasis="brand" icon="wallet" title="Available for payout">
              <Metric inverse size="xl" value={formatMoney(summary.data.availableForPayout)} caption="Cleared and ready for the FittinOS team to pay out." />
            </BentoCard>

            <View className="mt-3 flex-row gap-3">
              <BentoCard icon="hourglass" tone="warning" title="Pending">
                <Metric value={formatMoney(summary.data.pendingEarnings)} caption="Clearing — not yet payable" />
              </BentoCard>
              <BentoCard icon="checkmark-done" tone="info" title="Paid out">
                <Metric value={formatMoney(summary.data.paidOut)} caption="Already sent to you" />
              </BentoCard>
            </View>

            <Card className="mt-3">
              <View className="mb-3 flex-row items-end justify-between">
                <View>
                  <Text className="text-xs font-semibold text-text-body">Lifetime earnings</Text>
                  <Text className="text-xl font-bold tracking-tight text-text-heading">{formatMoney(summary.data.totalEarnings)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-text-body">{summary.data.completedSessions} completed</Text>
                  <Text className="text-xs text-text-body">{summary.data.upcomingSessions} upcoming</Text>
                </View>
              </View>
              <StackedBar
                label={`Available ${formatMoney(summary.data.availableForPayout)}, pending ${formatMoney(summary.data.pendingEarnings)}, paid out ${formatMoney(summary.data.paidOut)}`}
                segments={[
                  { label: `Available ${formatMoney(summary.data.availableForPayout)}`, value: summary.data.availableForPayout, tone: 'success' },
                  { label: `Pending ${formatMoney(summary.data.pendingEarnings)}`, value: summary.data.pendingEarnings, tone: 'warning' },
                  { label: `Paid out ${formatMoney(summary.data.paidOut)}`, value: summary.data.paidOut, tone: 'info' },
                ]}
              />
            </Card>
          </>
        )}

        {months && months.some((m) => m.amount > 0) ? (
          <>
            <SectionTitle title="Earnings overview" subtitle="By the month each earning was recorded · last 6 months" />
            <Card>
              <View className="mb-4 flex-row items-end justify-between">
                <View>
                  <Text className="text-xs font-semibold text-text-body">This month</Text>
                  <Text className="text-xl font-bold tracking-tight text-text-heading">{formatMoney(months[months.length - 1].amount)}</Text>
                </View>
                {change != null ? (
                  <Badge label={`${change >= 0 ? '+' : ''}${change}% vs last month`} tone={change >= 0 ? 'success' : 'danger'} />
                ) : null}
              </View>
              <BarChart
                data={months.map((m) => ({ key: m.key, label: m.label, value: m.amount }))}
                formatValue={(v) => formatMoney(v)}
                label="Earnings for the last six months"
              />
            </Card>
          </>
        ) : null}

        <SectionTitle title="How your money moves" />
        <Card className="gap-3">
          <Step icon="hourglass-outline" tone="warning" title="Pending" text="Earnings from a completed session clear first. Each one shows the date it becomes available." />
          <Step icon="wallet-outline" tone="success" title="Available" text="Cleared earnings wait here until the FittinOS team processes a payout." />
          <Step icon="checkmark-done-outline" tone="info" title="Paid out" text="Sent to your payout account. The reference appears in Payouts below." />
        </Card>

        <SectionTitle title="Payout destination" />
        {account.data ? (
          <Card>
            {account.data.account ? (
              <View className="flex-row items-center">
                <IconBadge icon={account.data.account.accountType === 'UPI' ? 'phone-portrait-outline' : 'business-outline'} tone="neutral" size={40} />
                <View className="mx-3 flex-1">
                  <Text className="text-sm font-bold text-text-heading" numberOfLines={1}>
                    {account.data.account.accountType === 'UPI'
                      ? account.data.account.maskedUpiId
                      : `${account.data.account.bankName ?? 'Bank'} ${account.data.account.maskedAccountNumber ?? ''}`}
                  </Text>
                  <Text className="text-xs text-text-body">{account.data.account.accountHolderName}</Text>
                </View>
                <Badge
                  label={payoutAccountStatus(account.data.account.verificationStatus).label}
                  tone={payoutAccountStatus(account.data.account.verificationStatus).tone}
                />
              </View>
            ) : (
              <Text className="text-sm text-text-body">No payout account added yet.</Text>
            )}
            {!account.data.readiness.canReceivePayout && account.data.readiness.blockedReason ? (
              <View className="mt-3">
                <InfoBanner tone="warning" message={account.data.readiness.blockedReason} />
              </View>
            ) : null}
            <View className="mt-3">
              <Button
                title={account.data.account ? 'Manage payout account' : 'Add payout account'}
                variant="outline"
                size="sm"
                onPress={() => router.push('/payout-account')}
              />
            </View>
          </Card>
        ) : account.isError ? (
          <ErrorState compact error={account.error} onRetry={() => void account.refetch()} />
        ) : (
          <Spinner />
        )}

        <View className="mt-6">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { key: 'earnings', label: 'Earnings' },
              { key: 'payouts', label: 'Payouts' },
            ]}
          />
        </View>

        {tab === 'earnings' ? (
          earnings.isPending ? (
            <View className="mt-3">
              <LoadingCards count={2} />
            </View>
          ) : earnings.isError ? (
            <ErrorState compact error={earnings.error} onRetry={() => void earnings.refetch()} />
          ) : earnings.data.items.length === 0 ? (
            <EmptyState icon="cash-outline" title="No earnings yet" message="Completed sessions add earnings here." />
          ) : (
            earningGroups.map((g) => (
              <View key={g.key}>
                <Text className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-text-body">{g.label}</Text>
                <Card className="p-0">
                  {g.items.map((e, i) => {
                    const s = genericStatus(e.status);
                    return (
                      <View key={e.id} className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                        <View className="flex-1">
                          <Text className="text-[15px] font-bold text-text-heading">{formatMoney(e.amount)}</Text>
                          <Text className="text-xs text-text-body">
                            Earned {formatDate(e.createdAt)} · available {formatDate(e.availableAt)}
                          </Text>
                        </View>
                        <Badge label={humanize(e.status)} tone={s.tone} />
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))
          )
        ) : payouts.isPending ? (
          <View className="mt-3">
            <LoadingCards count={2} />
          </View>
        ) : payouts.isError ? (
          <ErrorState compact error={payouts.error} onRetry={() => void payouts.refetch()} />
        ) : payouts.data.items.length === 0 ? (
          <EmptyState icon="send-outline" title="No payouts yet" message="Payouts of your available earnings are processed by the FittinOS team." />
        ) : (
          payoutGroups.map((g) => (
            <View key={g.key}>
              <Text className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-text-body">{g.label}</Text>
              <Card className="p-0">
                {g.items.map((p, i) => {
                  const s = genericStatus(p.status);
                  return (
                    <View key={p.id} className={`px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[15px] font-bold text-text-heading">{formatMoney(p.amount)}</Text>
                        <Badge label={humanize(p.status)} tone={s.tone} />
                      </View>
                      <Text className="text-xs text-text-body">
                        {formatDate(p.processedAt ?? p.createdAt)}
                        {p.reference ? ` · ref ${p.reference}` : ''}
                      </Text>
                      {p.failureReason ? <Text className="mt-1 text-xs text-danger-ink">{p.failureReason}</Text> : null}
                    </View>
                  );
                })}
              </Card>
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}

function Step({ icon, tone, title, text }: { icon: 'hourglass-outline' | 'wallet-outline' | 'checkmark-done-outline'; tone: 'warning' | 'success' | 'info'; title: string; text: string }) {
  return (
    <View className="flex-row">
      <IconBadge icon={icon} tone={tone} size={34} />
      <View className="ml-3 flex-1">
        <Text className="text-sm font-bold text-text-heading">{title}</Text>
        <Text className="text-xs leading-[18px] text-text-body">{text}</Text>
      </View>
    </View>
  );
}

function groupByMonth<T>(items: T[], dateOf: (item: T) => string): Array<{ key: string; label: string; items: T[] }> {
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  for (const item of items) {
    const d = new Date(dateOf(item));
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
