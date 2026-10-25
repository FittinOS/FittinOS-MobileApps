import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bookingsApi, conversationsApi, couponsApi } from '@/api/endpoints';
import { useAvailability, useInvalidate, useProfessional, useProfessionalReviews, useServicesForProfessional, qk } from '@/api/queries';
import type { AvailabilitySlotDto, ServiceDto } from '@/api/shared';
import { Avatar, Badge, BentoCard, Button, Card, Divider, EmptyState, ErrorState, Header, InfoBanner, Screen, Sheet, Skeleton, Spinner, TextField } from '@/components/ui';
import { FIRST_MESSAGE_MIN } from '@/features/messaging/messaging-helpers';
import { errorCodeOf, extractErrorMessage, httpStatusOf } from '@/lib/errors';
import { formatDate, formatDuration, formatMoney, formatTime } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function ProfessionalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const toast = useToast();
  const invalidate = useInvalidate();
  const professional = useProfessional(id);
  const services = useServicesForProfessional(id);
  const reviews = useProfessionalReviews(id, { limit: 5 });

  const [selectedService, setSelectedService] = useState<ServiceDto | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlotDto | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<{ originalAmount: number; discountAmount: number; finalAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  const [showMessageSheet, setShowMessageSheet] = useState(false);
  const [firstMessage, setFirstMessage] = useState('');
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageConflict, setMessageConflict] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const availability = useAvailability({ professionalId: id, serviceId: selectedService?.id });
  const serviceList: ServiceDto[] = Array.isArray(services.data) ? services.data : (services.data?.items ?? []);
  const slots = availability.data?.items ?? [];

  const grouped = useMemo(() => {
    const byDate = new Map<string, AvailabilitySlotDto[]>();
    for (const s of slots) {
      const key = formatDate(s.startTime);
      byDate.set(key, [...(byDate.get(key) ?? []), s]);
    }
    return Array.from(byDate.entries());
  }, [slots]);

  async function validateCoupon() {
    if (!couponCode.trim() || !selectedService) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const quote = await couponsApi.validate({ couponCode: couponCode.trim(), serviceId: selectedService.id });
      setCoupon(quote);
    } catch (err) {
      setCoupon(null);
      setCouponError(extractErrorMessage(err, "That coupon couldn't be applied."));
    } finally {
      setValidatingCoupon(false);
    }
  }

  async function submitBooking() {
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setBookingError(null);
    try {
      const booking = await bookingsApi.create({
        serviceId: selectedService.id,
        slotId: selectedSlot.id,
        couponCode: coupon ? couponCode.trim() : undefined,
      });
      void invalidate(qk.bookings({}));
      setConfirmedBookingId(booking.id);
    } catch (err) {
      const message = extractErrorMessage(err, "We couldn't complete this booking. Please try again.");
      setBookingError(message);
      // A slot taken by someone else, expired, or already gone — clear the stale selection and refresh.
      const code = errorCodeOf(err);
      if (code === 'SLOT_ALREADY_BOOKED' || code === 'SLOT_NOT_FOUND' || code === 'SLOT_IN_PAST') {
        // Clearing the slot closes the sheet, so the in-sheet error banner never
        // renders — a toast is the only way the user learns why it closed.
        toast.show(message, 'error');
        setSelectedSlot(null);
        void availability.refetch();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function closeBookingSheet() {
    setSelectedSlot(null);
    setCoupon(null);
    setCouponCode('');
    setCouponError(null);
    setBookingError(null);
  }

  function closeMessageSheet() {
    setShowMessageSheet(false);
    setFirstMessage('');
    setMessageError(null);
    setMessageConflict(false);
  }

  async function sendFirstMessage() {
    if (sendingMessage) return; // guards against a double tap creating two conversations
    const text = firstMessage.trim();
    if (text.length < FIRST_MESSAGE_MIN) {
      setMessageError(`Please write at least ${FIRST_MESSAGE_MIN} characters describing what you need.`);
      return;
    }
    setSendingMessage(true);
    setMessageError(null);
    setMessageConflict(false);
    try {
      const conversation = await conversationsApi.start({ professionalId: id, message: text });
      closeMessageSheet();
      toast.show('Message sent — it was free.', 'success');
      router.push({ pathname: '/(app)/messages/[id]', params: { id: conversation.id } });
    } catch (err) {
      // The backend's own unique constraint is what actually prevents a second
      // conversation with the same professional (@@unique([clientId, professionalId])) —
      // this just turns its 409 into a clear way back to the existing thread
      // instead of a dead-end error.
      setMessageConflict(httpStatusOf(err) === 409);
      setMessageError(extractErrorMessage(err, "We couldn't send your message. Please try again."));
    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <>
      <View className="flex-1 bg-background">
        <Header title={professional.data?.user.fullName ?? 'Professional'} />
        {professional.isPending ? (
          <Spinner label="Loading profile" />
        ) : professional.isError || !professional.data ? (
          <ErrorState error={professional.error} onRetry={() => void professional.refetch()} />
        ) : (
          <Screen edges={['bottom']}>
            <View className="items-center pt-2">
              <Avatar name={professional.data.user.fullName} uri={professional.data.user.avatarUrl} size={88} />
              <View className="mt-3 flex-row items-center">
                <Text className="text-xl font-bold text-text-heading" accessibilityRole="header">
                  {professional.data.user.fullName}
                </Text>
                {professional.data.kycStatus === 'APPROVED' ? (
                  <Ionicons name="checkmark-circle" size={17} color={colors.success} style={{ marginLeft: 6 }} />
                ) : null}
              </View>
              <Text className="mt-0.5 text-sm text-text-body">{professional.data.headline || professional.data.specializations.join(', ')}</Text>
              <View className="mt-2 flex-row items-center gap-3">
                <View className="flex-row items-center">
                  <Ionicons name="star" size={14} color={colors.warning} />
                  <Text className="ml-1 text-sm font-semibold text-text-heading">
                    {professional.data.ratingAverage != null ? professional.data.ratingAverage.toFixed(1) : 'New'}
                  </Text>
                  {professional.data.ratingCount ? <Text className="ml-1 text-sm text-text-muted">({professional.data.ratingCount})</Text> : null}
                </View>
                {professional.data.city ? (
                  <View className="flex-row items-center">
                    <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                    <Text className="ml-1 text-sm text-text-body">{professional.data.area ? `${professional.data.area}, ${professional.data.city}` : professional.data.city}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {professional.data.isLive ? (
              <View className="mt-4">
                <BentoCard
                  layout="block"
                  icon="chatbubble-ellipses-outline"
                  title={`Message ${professional.data.user.fullName}`}
                  tone="primary"
                  accessibilityLabel={`Message ${professional.data.user.fullName}`}
                  onPress={() => {
                    setMessageError(null);
                    setMessageConflict(false);
                    setFirstMessage('');
                    setShowMessageSheet(true);
                  }}
                >
                  <Text className="text-xs text-text-body">Your first message is always free.</Text>
                </BentoCard>
              </View>
            ) : null}

            {professional.data.bio ? (
              <Card className="mt-5">
                <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-text-body">About</Text>
                <Text className="text-sm leading-5 text-text-heading">{professional.data.bio}</Text>
                {professional.data.experienceYears ? (
                  <Text className="mt-2 text-xs text-text-body">{professional.data.experienceYears} years of experience</Text>
                ) : null}
              </Card>
            ) : null}

            <Text className="mb-2.5 mt-6 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
              Services
            </Text>
            {services.isPending ? (
              <Skeleton height={64} />
            ) : services.isError ? (
              <ErrorState compact error={services.error} onRetry={() => void services.refetch()} />
            ) : serviceList.length === 0 ? (
              <EmptyState compact icon="briefcase-outline" title="No services listed yet" />
            ) : (
              serviceList.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedService(s)}
                  className={`mb-2.5 rounded-2xl border p-4 active:bg-muted ${selectedService?.id === s.id ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.title}, ${formatMoney(s.priceAmount)}${s.isFeatured ? ', Featured' : ''}`}
                >
                  {s.isFeatured ? (
                    <View className="mb-1.5 self-start">
                      <Badge label="Featured" tone="primary" />
                    </View>
                  ) : null}
                  <View className="flex-row items-start justify-between">
                    <Text className="flex-1 text-[15px] font-bold text-text-heading">{s.title}</Text>
                    <Text className="ml-2 text-[15px] font-bold text-primary-ink">{formatMoney(s.priceAmount)}</Text>
                  </View>
                  {s.description ? (
                    <Text className="mt-1 text-xs text-text-body" numberOfLines={2}>
                      {s.description}
                    </Text>
                  ) : null}
                  <Text className="mt-1.5 text-xs text-text-muted">{formatDuration(s.durationMinutes)}</Text>
                </Pressable>
              ))
            )}

            {selectedService ? (
              <>
                <Text className="mb-2.5 mt-6 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
                  Available slots
                </Text>
                {availability.isPending ? (
                  <Skeleton height={80} />
                ) : availability.isError ? (
                  <ErrorState compact error={availability.error} onRetry={() => void availability.refetch()} />
                ) : grouped.length === 0 ? (
                  <EmptyState compact icon="calendar-outline" title="No available slots" message="Check back later or try another service." />
                ) : (
                  grouped.map(([date, daySlots]) => (
                    <View key={date} className="mb-3">
                      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-text-body">{date}</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <Pressable
                            key={slot.id}
                            onPress={() => setSelectedSlot(slot)}
                            className="rounded-xl border border-border bg-card px-3 py-2 active:bg-muted"
                            accessibilityRole="button"
                          >
                            <Text className="text-sm font-semibold text-text-heading">{formatTime(slot.startTime)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))
                )}
              </>
            ) : null}

            <Text className="mb-2.5 mt-6 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
              Reviews
            </Text>
            {reviews.isPending ? (
              <Skeleton height={64} />
            ) : reviews.isError ? (
              <ErrorState compact error={reviews.error} onRetry={() => void reviews.refetch()} />
            ) : reviews.data.items.length === 0 ? (
              <EmptyState compact icon="star-outline" title="No reviews yet" />
            ) : (
              reviews.data.items.map((r, i) => (
                <View key={r.id}>
                  {i > 0 ? <Divider className="my-3" /> : null}
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-bold text-text-heading">{r.client.fullName}</Text>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={13} color={colors.warning} />
                      <Text className="ml-1 text-xs font-semibold text-text-heading">{r.rating}</Text>
                    </View>
                  </View>
                  {r.feedback ? <Text className="mt-1 text-sm text-text-body">{r.feedback}</Text> : null}
                </View>
              ))
            )}
          </Screen>
        )}
      </View>

      <Sheet visible={!!selectedSlot} title="Confirm booking" onClose={closeBookingSheet}>
        {confirmedBookingId ? (
          <View className="items-center py-4">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-success-soft">
              <Ionicons name="checkmark-circle" size={36} color={colors.success} />
            </View>
            <Text className="mt-4 text-center text-lg font-bold text-text-heading" accessibilityRole="header">
              Slot reserved
            </Text>
            <Text className="mt-1.5 text-center text-sm leading-5 text-text-body">
              Complete payment from My Bookings to confirm this session.
            </Text>
            <View className="mt-5 w-full gap-3">
              <Button
                title="Go to booking"
                onPress={() => {
                  const bid = confirmedBookingId;
                  closeBookingSheet();
                  setConfirmedBookingId(null);
                  router.replace(`/(app)/(tabs)/bookings/${bid}`);
                }}
              />
            </View>
          </View>
        ) : selectedService && selectedSlot ? (
          <>
            <View className="rounded-2xl border border-border p-3">
              <Text className="text-sm font-bold text-text-heading">{selectedService.title}</Text>
              <Text className="mt-0.5 text-xs text-text-body">
                {formatDate(selectedSlot.startTime)} · {formatTime(selectedSlot.startTime)} ({formatDuration(selectedService.durationMinutes)})
              </Text>
            </View>

            {bookingError ? (
              <View className="mt-3">
                <InfoBanner tone="danger" message={bookingError} icon="alert-circle" />
              </View>
            ) : null}

            <View className="mt-3 flex-row items-end gap-2">
              <View className="flex-1">
                <TextField
                  label="Coupon code (optional)"
                  value={couponCode}
                  onChangeText={(v) => {
                    setCouponCode(v);
                    setCoupon(null);
                    setCouponError(null);
                  }}
                  autoCapitalize="characters"
                  placeholder="e.g. WELCOME10"
                  containerClassName="mb-0"
                />
              </View>
              <Pressable
                onPress={validateCoupon}
                disabled={!couponCode.trim() || validatingCoupon}
                className="mb-0 h-[52px] items-center justify-center rounded-2xl border border-border bg-card px-4 active:bg-muted"
                accessibilityRole="button"
              >
                <Text className="text-sm font-semibold text-text-heading">{validatingCoupon ? 'Checking…' : 'Apply'}</Text>
              </Pressable>
            </View>
            {couponError ? <Text className="mt-2 text-xs text-danger-ink">{couponError}</Text> : null}
            {coupon && !couponError ? <Text className="mt-2 text-xs text-success-ink">Coupon applied.</Text> : null}

            <View className="mt-4 rounded-2xl bg-muted p-3">
              <View className="flex-row justify-between">
                <Text className="text-sm text-text-body">Price</Text>
                <Text className="text-sm text-text-heading">{formatMoney(coupon?.originalAmount ?? selectedService.priceAmount)}</Text>
              </View>
              {coupon ? (
                <View className="mt-1 flex-row justify-between">
                  <Text className="text-sm text-success-ink">Discount</Text>
                  <Text className="text-sm text-success-ink">-{formatMoney(coupon.discountAmount)}</Text>
                </View>
              ) : null}
              <Divider className="my-2" />
              <View className="flex-row justify-between">
                <Text className="text-sm font-bold text-text-heading">Total</Text>
                <Text className="text-sm font-bold text-text-heading">{formatMoney(coupon?.finalAmount ?? selectedService.priceAmount)}</Text>
              </View>
            </View>

            <View className="mt-5">
              <Button title="Confirm booking" onPress={submitBooking} loading={submitting} />
            </View>
          </>
        ) : null}
      </Sheet>

      <Sheet visible={showMessageSheet} title="Send a free message" onClose={closeMessageSheet}>
        <Text className="text-sm leading-5 text-text-body">
          Your first message to {professional.data?.user.fullName ?? 'this professional'} is always free. Use it to ask about availability, share
          what you're looking for, or anything else — there's no charge for this one.
        </Text>
        <View className="mt-3">
          <TextField
            label="Your message"
            value={firstMessage}
            onChangeText={(v) => {
              setFirstMessage(v);
              if (messageError) setMessageError(null);
            }}
            multiline
            maxLength={1000}
            placeholder="e.g. Hi, I'm looking for a few sessions a week focused on..."
            error={messageError ?? undefined}
          />
        </View>
        {messageConflict ? (
          <View className="mt-1">
            <Button
              title="Go to Messages"
              variant="outline"
              onPress={() => {
                closeMessageSheet();
                router.push('/(app)/messages/index');
              }}
            />
          </View>
        ) : null}
        <View className="mt-4">
          <Button title="Send (free)" onPress={() => void sendFirstMessage()} loading={sendingMessage} disabled={firstMessage.trim().length === 0} />
        </View>
      </Sheet>
    </>
  );
}
