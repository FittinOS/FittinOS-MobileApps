import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { usePaymentDetail } from '@/api/queries';
import { Badge, Button, Card, Divider, ErrorState, Header, KeyValue, Screen, SectionTitle, Spinner } from '@/components/ui';
import { downloadReceipt } from '@/features/payments/download-receipt';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatMoney, humanize } from '@/lib/format';
import { genericStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = usePaymentDetail(id);
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  if (detail.isPending) {
    return (
      <>
        <Header title="Payment" />
        <Spinner />
      </>
    );
  }
  if (detail.isError) {
    return (
      <>
        <Header title="Payment" />
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </>
    );
  }
  const d = detail.data;
  const s = genericStatus(d.status);
  // The receipt endpoint only serves captured payments (ownership-checked server-side).
  const canDownload = d.status === 'CAPTURED' || d.status === 'PARTIALLY_REFUNDED' || d.status === 'REFUNDED';

  return (
    <>
      <Header title={d.reference} />
      <Screen refreshing={detail.isRefetching} onRefresh={() => void detail.refetch()}>
        <Card className="items-center">
          <Text className="text-sm text-text-body">{d.purposeLabel}</Text>
          <Text className="mt-1 text-3xl font-bold text-text-heading">{formatMoney(d.amount, { decimals: true })}</Text>
          <View className="mt-2">
            <Badge label={d.statusLabel} tone={s.tone} />
          </View>
        </Card>

        <SectionTitle title="Details" />
        <Card>
          <KeyValue label="Reference" value={d.reference} />
          <KeyValue label="Order ID" value={d.gatewayOrderId} />
          {d.gatewayPaymentId ? <KeyValue label="Payment ID" value={d.gatewayPaymentId} /> : null}
          {d.paymentMethod ? <KeyValue label="Method" value={humanize(d.paymentMethod)} /> : null}
          <KeyValue label="Created" value={formatDateTime(d.createdAt)} />
          {d.capturedAt ? <KeyValue label="Paid" value={formatDateTime(d.capturedAt)} /> : null}
        </Card>

        {d.coinPackage ? (
          <>
            <SectionTitle title="Coin package" />
            <Card>
              <KeyValue label="Package" value={d.coinPackage.name} />
              <KeyValue label="Coins" value={`${d.coinPackage.coins}${d.coinPackage.bonusCoins ? ` + ${d.coinPackage.bonusCoins} bonus` : ''}`} />
              {d.coinPackage.walletTransaction ? (
                <KeyValue label="Wallet after credit" value={`${d.coinPackage.walletTransaction.balanceAfter} coins`} />
              ) : null}
            </Card>
          </>
        ) : null}

        {d.professionalPlan ? (
          <>
            <SectionTitle title="Plan" />
            <Card>
              <KeyValue label="Plan" value={d.professionalPlan.name} />
              <KeyValue label="Duration" value={`${d.professionalPlan.durationDays} days`} />
              {d.professionalPlan.subscription ? (
                <>
                  <KeyValue label="Status" value={humanize(d.professionalPlan.subscription.status)} />
                  <KeyValue
                    label="Period"
                    value={`${formatDate(d.professionalPlan.subscription.startDate)} – ${formatDate(d.professionalPlan.subscription.endDate)}`}
                  />
                </>
              ) : null}
            </Card>
          </>
        ) : null}

        {d.featuredListing ? (
          <>
            <SectionTitle title="Featured listing" />
            <Card>
              <KeyValue label="Plan" value={d.featuredListing.planName} />
              <KeyValue label="Duration" value={`${d.featuredListing.durationDays} days`} />
            </Card>
          </>
        ) : null}

        {d.refunds.length > 0 ? (
          <>
            <SectionTitle title="Refunds" />
            <Card>
              {d.refunds.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Divider className="my-2" /> : null}
                  <KeyValue label={r.statusLabel} value={formatMoney(r.amount, { decimals: true })} emphasize />
                  <Text className="text-xs text-text-body">
                    {r.reason} · {formatDateTime(r.processedAt ?? r.createdAt)}
                  </Text>
                </View>
              ))}
              {d.refundSummary ? (
                <>
                  <Divider className="my-2" />
                  <KeyValue label="Total refunded" value={formatMoney(d.refundSummary.totalRefunded, { decimals: true })} />
                  <KeyValue label="Remaining" value={formatMoney(d.refundSummary.remaining, { decimals: true })} />
                </>
              ) : null}
            </Card>
          </>
        ) : null}

        {canDownload ? (
          <View className="mt-5">
            <Button
              title="Download receipt (PDF)"
              icon="download-outline"
              variant="outline"
              loading={downloading}
              onPress={async () => {
                setDownloading(true);
                try {
                  await downloadReceipt(d.id, d.reference);
                } catch (err) {
                  toast.show(extractErrorMessage(err, 'Could not download the receipt.'), 'error');
                } finally {
                  setDownloading(false);
                }
              }}
            />
          </View>
        ) : null}
      </Screen>
    </>
  );
}
