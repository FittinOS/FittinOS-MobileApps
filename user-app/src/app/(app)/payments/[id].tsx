import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { usePaymentDetail } from '@/api/queries';
import { Badge, Button, Card, ErrorState, Header, KeyValue, Screen, SectionTitle, Spinner } from '@/components/ui';
import { downloadReceipt } from '@/features/payments/download-receipt';
import { extractErrorMessage } from '@/lib/errors';
import { formatDateTime, formatMoney, humanize } from '@/lib/format';
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
  const canDownload = d.status === 'CAPTURED' || d.status === 'REFUNDED';

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

        {d.booking ? (
          <>
            <SectionTitle title="Booking" />
            <Card>
              {d.booking.professionalName ? <KeyValue label="Professional" value={d.booking.professionalName} /> : null}
              {d.booking.serviceName ? <KeyValue label="Service" value={d.booking.serviceName} /> : null}
              <KeyValue label="Date" value={formatDateTime(d.booking.startTime)} />
              <KeyValue label="Status" value={humanize(d.booking.status)} />
            </Card>
          </>
        ) : null}

        {d.coinPackage ? (
          <>
            <SectionTitle title="Coin package" />
            <Card>
              <KeyValue label="Package" value={d.coinPackage.name} />
              <KeyValue label="Coins" value={`${d.coinPackage.coins}${d.coinPackage.bonusCoins ? ` + ${d.coinPackage.bonusCoins} bonus` : ''}`} />
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
