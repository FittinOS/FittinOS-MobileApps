import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bookingsApi, paymentsApi } from '@/api/endpoints';
import { newIdempotencyKey } from '@/features/payments/checkout-logic';
import { useCashfreeCheckout } from '@/features/payments/useCashfreeCheckout';
import { CheckoutStatus } from '@/features/payments/CheckoutStatus';
import { useAvailability, useBooking, useInvalidate, qk } from '@/api/queries';
import { Avatar, Badge, Button, Card, ConfirmDialog, ErrorState, Header, InfoBanner, KeyValue, Screen, Sheet, Spinner } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import { bookingStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const invalidate = useInvalidate();
  const booking = useBooking(id);
  const checkout = useCashfreeCheckout();

  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  const availability = useAvailability({
    professionalId: booking.data?.professionalId ?? '',
    serviceId: booking.data?.serviceId,
  });

  async function payNow() {
    if (!booking.data) return;
    await checkout.start(() => paymentsApi.createOrder({ purpose: 'BOOKING', bookingId: booking.data.id, idempotencyKey: newIdempotencyKey() }));
  }

  async function cancelBooking() {
    setCancelling(true);
    setCancelError(null);
    try {
      await bookingsApi.cancel(id);
      void invalidate(qk.booking(id), qk.bookings({}));
      toast.show('Booking cancelled.', 'info');
      setCancelVisible(false);
    } catch (err) {
      setCancelError(extractErrorMessage(err, "We couldn't cancel this booking."));
    } finally {
      setCancelling(false);
    }
  }

  async function rescheduleTo(newSlotId: string) {
    setRescheduling(true);
    setRescheduleError(null);
    try {
      await bookingsApi.reschedule(id, newSlotId);
      void invalidate(qk.booking(id), qk.bookings({}));
      toast.show('Booking rescheduled.');
      setRescheduleVisible(false);
    } catch (err) {
      setRescheduleError(extractErrorMessage(err, "We couldn't reschedule this booking."));
    } finally {
      setRescheduling(false);
    }
  }

  async function submitFeedback() {
    if (!rating) return;
    setSubmittingFeedback(true);
    try {
      await bookingsApi.feedback(id, rating);
      setFeedbackDone(true);
      toast.show('Thanks for your feedback!');
    } catch (err) {
      toast.show(extractErrorMessage(err, "We couldn't submit your feedback."), 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (booking.isPending) return <Spinner label="Loading booking" />;
  if (booking.isError || !booking.data) return <ErrorState error={booking.error} onRetry={() => void booking.refetch()} />;

  const b = booking.data;
  const s = bookingStatus(b.status);
  const canCancel = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'].includes(b.status);
  const canReschedule = b.status === 'CONFIRMED';
  const canPay = b.status === 'PAYMENT_PENDING';
  const canRate = b.status === 'COMPLETED' && !feedbackDone;
  const canTrack = b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS';

  return (
    <>
      <Header title="Booking" />
      <Screen>
        <View className="flex-row items-center">
          <Avatar name={b.professional?.user.fullName} uri={b.professional?.user.avatarUrl} size={56} />
          <View className="ml-3 flex-1">
            <Text className="text-base font-bold text-text-heading">{b.professional?.user.fullName ?? 'Professional'}</Text>
            <Text className="text-sm text-text-body">{b.service?.title ?? 'Session'}</Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center">
          <Badge label={s.label} tone={s.tone} />
        </View>

        <Card className="mt-4">
          <KeyValue label="Date" value={formatDate(b.startTime)} />
          <KeyValue label="Time" value={`${formatTime(b.startTime)} – ${formatTime(b.endTime)}`} />
          <KeyValue label="Original amount" value={formatMoney(b.originalAmount ?? b.priceAmount)} />
          {b.discountAmount ? <KeyValue label={`Discount${b.couponCode ? ` (${b.couponCode})` : ''}`} value={`-${formatMoney(b.discountAmount)}`} /> : null}
          <KeyValue label="Payable amount" value={formatMoney(b.priceAmount)} emphasize />
          {b.refundAmount ? <KeyValue label="Refunded" value={formatMoney(b.refundAmount)} /> : null}
        </Card>

        {b.status === 'CANCELLED' && b.cancellationReason ? (
          <View className="mt-4">
            <InfoBanner tone="neutral" title="Cancellation reason" message={b.cancellationReason} icon="information-circle" />
          </View>
        ) : null}

        {canRate ? (
          <Card className="mt-4">
            <Text className="mb-2 text-sm font-bold text-text-heading">Rate your session</Text>
            <View className="flex-row gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}>
                  <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={28} color={colors.warning} />
                </Pressable>
              ))}
            </View>
            <View className="mt-3">
              <Button title="Submit rating" onPress={submitFeedback} loading={submittingFeedback} disabled={!rating} />
            </View>
          </Card>
        ) : null}

        <View className="mt-5 gap-3">
          {canTrack ? (
            <Button
              title="Track professional"
              variant="outline"
              icon="navigate-outline"
              onPress={() => router.push({ pathname: '/(app)/(tabs)/bookings/[id]/tracking', params: { id } })}
            />
          ) : null}
          {canPay ? (
            <Button
              title="Pay now"
              icon="card-outline"
              onPress={payNow}
              loading={checkout.state === 'OPENING' || checkout.state === 'PAYMENT_IN_PROGRESS'}
              disabled={checkout.state === 'OPENING' || checkout.state === 'PAYMENT_IN_PROGRESS'}
            />
          ) : null}
          {canReschedule ? <Button title="Reschedule" variant="outline" icon="calendar-outline" onPress={() => setRescheduleVisible(true)} /> : null}
          {canCancel ? <Button title="Cancel booking" variant="ghost" icon="close-circle-outline" onPress={() => setCancelVisible(true)} /> : null}
        </View>
      </Screen>

      <CheckoutStatus checkout={checkout} successTitle="Booking confirmed" successMessage="Your payment was received and the booking is confirmed." onDone={() => void booking.refetch()} />

      <ConfirmDialog
        visible={cancelVisible}
        title="Cancel this booking?"
        message="Depending on timing, a refund may apply per the cancellation policy."
        confirmLabel="Cancel booking"
        destructive
        loading={cancelling}
        onConfirm={cancelBooking}
        onCancel={() => setCancelVisible(false)}
      >
        {cancelError ? <InfoBanner tone="danger" message={cancelError} icon="alert-circle" /> : null}
      </ConfirmDialog>

      <Sheet visible={rescheduleVisible} title="Reschedule booking" onClose={() => setRescheduleVisible(false)}>
        {rescheduleError ? (
          <View className="mb-3">
            <InfoBanner tone="danger" message={rescheduleError} icon="alert-circle" />
          </View>
        ) : null}
        {availability.isPending ? (
          <Spinner />
        ) : availability.isError ? (
          <ErrorState compact error={availability.error} onRetry={() => void availability.refetch()} />
        ) : (availability.data?.items.length ?? 0) === 0 ? (
          <Text className="py-4 text-center text-sm text-text-body">No other open slots right now.</Text>
        ) : (
          <View className="flex-row flex-wrap gap-2 pb-4">
            {availability.data!.items.map((slot) => (
              <Pressable
                key={slot.id}
                disabled={rescheduling}
                onPress={() => void rescheduleTo(slot.id)}
                className="rounded-xl border border-border bg-card px-3 py-2 active:bg-muted"
                accessibilityRole="button"
              >
                <Text className="text-xs text-text-body">{formatDate(slot.startTime)}</Text>
                <Text className="text-sm font-semibold text-text-heading">{formatTime(slot.startTime)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>
    </>
  );
}
