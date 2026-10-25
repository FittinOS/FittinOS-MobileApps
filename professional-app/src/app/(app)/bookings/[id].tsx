import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { availabilityApi, bookingsApi } from '@/api/endpoints';
import { qk, useBooking, useInvalidate } from '@/api/queries';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  EmptyState,
  ErrorState,
  Header,
  InfoBanner,
  KeyValue,
  Screen,
  SectionTitle,
  Sheet,
  Spinner,
  TextField,
} from '@/components/ui';
import { bookingActions, NO_SHOW_REASON_MIN } from '@/features/bookings/booking-actions';
import { TripControlSheet } from '@/features/bookings/TripControlSheet';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatDuration, formatMoney, formatTime, humanize } from '@/lib/format';
import { bookingStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

type Dialog = 'start' | 'complete' | 'noShow' | 'cancel' | 'reschedule' | 'trip' | null;

export default function BookingDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [newSlotId, setNewSlotId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshAll = () => invalidate(['bookings'], qk.earningsSummary);
  const onDone = (message: string) => {
    setDialog(null);
    setActionError(null);
    toast.show(message);
    void refreshAll();
  };
  const onFail = (fallback: string) => (error: unknown) => setActionError(extractErrorMessage(error, fallback));

  const start = useMutation({ mutationFn: () => bookingsApi.start(id), onSuccess: () => onDone('Session started.'), onError: onFail('Could not start the session.') });
  const complete = useMutation({
    mutationFn: () => bookingsApi.complete(id, notes.trim() || undefined),
    onSuccess: () => onDone('Session marked complete.'),
    onError: onFail('Could not complete the session.'),
  });
  const noShow = useMutation({
    mutationFn: () => bookingsApi.reportNoShow(id, reason.trim()),
    onSuccess: () => onDone('No-show reported. Our team will review it.'),
    onError: onFail('Could not report the no-show.'),
  });
  const reschedule = useMutation({
    mutationFn: () => bookingsApi.reschedule(id, newSlotId!),
    onSuccess: () => onDone('Booking rescheduled.'),
    onError: onFail('Could not reschedule this booking.'),
  });
  const cancel = useMutation({
    mutationFn: () => bookingsApi.cancel(id, reason.trim() || undefined),
    onSuccess: () => onDone('Booking cancelled. The client has been notified.'),
    onError: onFail('Could not cancel this booking.'),
  });

  const slots = useQuery({
    queryKey: ['availability', 'public', booking.data?.professionalId, booking.data?.serviceId],
    queryFn: () => availabilityApi.publicOpen({ professionalId: booking.data!.professionalId, serviceId: booking.data!.serviceId }),
    enabled: dialog === 'reschedule' && !!booking.data,
  });

  if (booking.isPending) {
    return (
      <>
        <Header title="Booking" />
        <Spinner label="Loading booking" />
      </>
    );
  }
  if (booking.isError) {
    return (
      <>
        <Header title="Booking" />
        <ErrorState error={booking.error} onRetry={() => void booking.refetch()} />
      </>
    );
  }

  const b = booking.data;
  const s = bookingStatus(b.status);
  const actions = bookingActions(b);
  const slotOptions = (slots.data?.items ?? []).filter((slot) => slot.id !== b.slotId);

  return (
    <>
      <Header title="Booking" />
      <Screen refreshing={booking.isRefetching} onRefresh={() => void booking.refetch()}>
        <Card>
          <View className="flex-row items-center">
            <Avatar name={b.client?.fullName} uri={b.client?.avatarUrl} size={48} />
            <View className="ml-3 flex-1">
              <Text className="text-lg font-semibold text-text-heading">{b.client?.fullName ?? 'Client'}</Text>
              <Text className="text-sm text-text-body">{b.service?.title ?? 'Session'}</Text>
            </View>
            <Badge label={s.label} tone={s.tone} />
          </View>
          <Divider className="my-3" />
          <KeyValue label="Date" value={formatDate(b.startTime)} />
          <KeyValue label="Time" value={`${formatTime(b.startTime)} – ${formatTime(b.endTime)}`} />
          <KeyValue label="Duration" value={formatDuration(b.service?.durationMinutes)} />
          <KeyValue label="Mode" value={humanize(b.service?.mode)} />
          {b.service?.location ? <KeyValue label="Location" value={b.service.location} /> : null}
        </Card>

        {actionError ? (
          <View className="mt-3">
            <InfoBanner tone="danger" message={actionError} icon="alert-circle" />
          </View>
        ) : null}

        {actions.start || actions.complete || actions.track || actions.reschedule || actions.reportNoShow || actions.cancel ? (
          <View className="mt-4 gap-3">
            {actions.start ? <Button title="Start session" icon="play" onPress={() => setDialog('start')} /> : null}
            {actions.complete ? <Button title="Mark complete" icon="checkmark-circle" onPress={() => setDialog('complete')} /> : null}
            {actions.track ? <Button title="Booking-day tracking" icon="navigate" variant="outline" onPress={() => setDialog('trip')} /> : null}
            {actions.reschedule ? (
              <Button
                title="Reschedule"
                icon="calendar"
                variant="outline"
                onPress={() => {
                  setNewSlotId(null);
                  setActionError(null);
                  setDialog('reschedule');
                }}
              />
            ) : null}
            {actions.reportNoShow ? (
              <Button
                title="Report client no-show"
                icon="flag"
                variant="ghost"
                onPress={() => {
                  setReason('');
                  setReasonError(undefined);
                  setDialog('noShow');
                }}
              />
            ) : null}
            {actions.cancel ? (
              <Button
                title="Cancel booking"
                icon="close-circle"
                variant="ghost"
                onPress={() => {
                  setReason('');
                  setActionError(null);
                  setDialog('cancel');
                }}
              />
            ) : null}
          </View>
        ) : null}

        <SectionTitle title="Payment" />
        <Card>
          <KeyValue label="Client paid" value={formatMoney(b.priceAmount)} />
          {b.discountAmount ? <KeyValue label={`Coupon ${b.couponCode ?? ''}`.trim()} value={`− ${formatMoney(b.discountAmount)}`} /> : null}
          <KeyValue label="Platform fee" value={formatMoney(b.platformFeeAmount)} />
          <Divider className="my-1" />
          <KeyValue label="Your earning" value={formatMoney(b.professionalEarningAmount)} emphasize />
          {b.paymentStatus ? <KeyValue label="Payment status" value={humanize(b.paymentStatus)} /> : null}
          {b.refundAmount ? <KeyValue label="Refunded to client" value={formatMoney(b.refundAmount)} /> : null}
        </Card>

        {b.cancellationReason ? (
          <>
            <SectionTitle title="Cancellation" />
            <Card>
              <KeyValue label="Cancelled" value={formatDateTime(b.cancelledAt)} />
              <Text className="mt-1 text-sm text-text-heading">{b.cancellationReason}</Text>
            </Card>
          </>
        ) : null}

        {b.session ? (
          <>
            <SectionTitle title="Session" />
            <Card>
              {b.session.startedAt ? <KeyValue label="Started" value={formatDateTime(b.session.startedAt)} /> : null}
              {b.session.endedAt ? <KeyValue label="Ended" value={formatDateTime(b.session.endedAt)} /> : null}
              {b.session.professionalNotes ? (
                <View className="mt-2">
                  <Text className="text-xs font-semibold uppercase text-text-body">Your notes</Text>
                  <Text className="mt-1 text-sm text-text-heading">{b.session.professionalNotes}</Text>
                </View>
              ) : null}
              {b.session.rating != null ? (
                <View className="mt-3 flex-row items-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons key={n} name={n <= (b.session?.rating ?? 0) ? 'star' : 'star-outline'} size={16} color={colors.warning} />
                  ))}
                  <Text className="ml-2 text-sm text-text-body">Client rating</Text>
                </View>
              ) : null}
              {b.session.clientFeedback ? <Text className="mt-2 text-sm italic text-text-heading">“{b.session.clientFeedback}”</Text> : null}
            </Card>
          </>
        ) : null}

        <Pressable onPress={() => router.push('/messages')} className="mt-6 items-center py-2" accessibilityRole="link">
          <Text className="text-sm font-semibold text-primary-ink">Message or call this client from Messages</Text>
        </Pressable>
      </Screen>

      <ConfirmDialog
        visible={dialog === 'start'}
        title="Start this session?"
        message="Only start once you're with the client (or the online session has begun)."
        confirmLabel="Start"
        loading={start.isPending}
        onConfirm={() => start.mutate()}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        visible={dialog === 'complete'}
        title="Mark session complete?"
        message="Your earning for this session starts clearing once it's complete."
        confirmLabel="Complete"
        loading={complete.isPending}
        onConfirm={() => complete.mutate()}
        onCancel={() => setDialog(null)}
      >
        <TextField label="Session notes (optional)" value={notes} onChangeText={setNotes} multiline maxLength={2000} />
      </ConfirmDialog>

      <ConfirmDialog
        visible={dialog === 'noShow'}
        title="Report client no-show"
        message="Tell us what happened. A FittinOS admin reviews every report before any money moves."
        confirmLabel="Report"
        destructive
        loading={noShow.isPending}
        onConfirm={() => {
          if (reason.trim().length < NO_SHOW_REASON_MIN) {
            setReasonError(`Please describe what happened (at least ${NO_SHOW_REASON_MIN} characters).`);
            return;
          }
          noShow.mutate();
        }}
        onCancel={() => setDialog(null)}
      >
        <TextField label="What happened?" value={reason} onChangeText={setReason} error={reasonError} multiline maxLength={500} />
      </ConfirmDialog>

      <ConfirmDialog
        visible={dialog === 'cancel'}
        title="Cancel this booking?"
        message="The client will be notified immediately. If they already paid, they will be fully refunded — cancelling as the professional always refunds 100%, regardless of how close the session is. This cannot be undone."
        confirmLabel="Cancel booking"
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setDialog(null)}
      >
        <TextField label="Reason (optional)" value={reason} onChangeText={setReason} multiline maxLength={500} />
      </ConfirmDialog>

      <Sheet visible={dialog === 'reschedule'} title="Reschedule booking" onClose={() => setDialog(null)}>
        <Text className="mb-3 text-sm text-text-body">
          Pick one of your open slots. Rescheduling is only allowed while the booking could still be cancelled with a full refund.
        </Text>
        {actionError ? (
          <View className="mb-3">
            <InfoBanner tone="danger" message={actionError} icon="alert-circle" />
          </View>
        ) : null}
        {slots.isPending ? (
          <Spinner />
        ) : slots.isError ? (
          <ErrorState compact error={slots.error} onRetry={() => void slots.refetch()} />
        ) : slotOptions.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No open slots"
            message="Add availability first, then come back to reschedule."
            actionLabel="Add availability"
            onAction={() => {
              setDialog(null);
              router.push('/availability');
            }}
          />
        ) : (
          <View className="mb-4 gap-2">
            {slotOptions.map((slot) => {
              const selected = slot.id === newSlotId;
              return (
                <Pressable
                  key={slot.id}
                  onPress={() => setNewSlotId(slot.id)}
                  className={`min-h-[52px] flex-row items-center rounded-xl border px-4 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.textMuted} />
                  <Text className="ml-3 text-sm text-text-heading">
                    {formatDateTime(slot.startTime)} – {formatTime(slot.endTime)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <Button title="Confirm new time" disabled={!newSlotId} loading={reschedule.isPending} onPress={() => reschedule.mutate()} />
        <View className="h-4" />
      </Sheet>

      <TripControlSheet
        visible={dialog === 'trip'}
        onClose={() => setDialog(null)}
        bookingId={b.id}
        clientName={b.client?.fullName ?? 'Client'}
        startTime={b.startTime}
      />
    </>
  );
}
