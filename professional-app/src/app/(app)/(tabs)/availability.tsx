import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { AvailabilitySlotDto } from '@/api/shared';
import { availabilityApi } from '@/api/endpoints';
import { useAvailability, useInvalidate, useProfile, useServices } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import {
  Badge,
  BentoCard,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingCards,
  Metric,
  Screen,
  Sheet,
  TextField,
} from '@/components/ui';
import { FULL_DAY, addMinutesToTime, groupByDay, planSlots, type TimeRange } from '@/features/availability/slot-plan';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate, formatTime, humanize } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

const SLOT_TONE = { OPEN: 'success', RESERVED: 'warning', BOOKED: 'info', BLOCKED: 'neutral' } as const;
const STRIP_DAYS = 14;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AvailabilityScreen() {
  const profile = useProfile();
  const services = useServices();
  // Upcoming only — past slots aren't bookable.
  const [from] = useState(() => new Date(Date.now() - 60 * 60_000).toISOString());
  const slots = useAvailability({ from, limit: 100 });
  const invalidate = useInvalidate();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<AvailabilitySlotDto | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const kycApproved = profile.data?.kycStatus === 'APPROVED';
  const serviceMap = useMemo(() => Object.fromEntries((services.data?.items ?? []).map((s) => [s.id, s.title])), [services.data]);
  const groups = useMemo(() => groupByDay(slots.data?.items ?? []), [slots.data]);
  const openCount = (slots.data?.items ?? []).filter((s) => s.status === 'OPEN').length;
  const bookedCount = (slots.data?.items ?? []).filter((s) => s.status === 'RESERVED' || s.status === 'BOOKED').length;
  const truncated = !!slots.data && slots.data.total > slots.data.items.length;

  // Two-week strip: real slot counts per local day.
  const strip = useMemo(() => {
    const counts = new Map(groups.map((g) => [g.day, g.slots.length]));
    const start = new Date();
    return Array.from({ length: STRIP_DAYS }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      return { key, date: d, count: counts.get(key) ?? 0 };
    });
  }, [groups]);
  const visibleGroups = selectedDay ? groups.filter((g) => g.day === selectedDay) : groups;

  const remove = useMutation({
    mutationFn: (id: string) => availabilityApi.remove(id),
    onSuccess: () => {
      setToDelete(null);
      toast.show('Slot deleted.');
      void invalidate(['availability']);
    },
    onError: (err) => {
      setToDelete(null);
      toast.show(extractErrorMessage(err, 'Failed to delete slot — it may already be reserved or booked.'), 'error');
    },
  });

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Availability" subtitle="The times clients can book you" />
      <Screen
        edges={[]}
        refreshing={slots.isRefetching}
        onRefresh={() => void slots.refetch()}
        footer={kycApproved ? <Button title="Add availability" icon="add" onPress={() => setAdding(true)} /> : undefined}
      >
        {profile.isError ? (
          <View className="mb-3">
            <ErrorState compact error={profile.error} onRetry={() => void profile.refetch()} />
          </View>
        ) : null}

        {profile.data && !kycApproved ? (
          <View className="mb-3">
            <InfoBanner
              tone="warning"
              title="KYC required"
              message="Opening availability needs an approved KYC first."
              action={<Button title="Go to verification" variant="outline" size="sm" onPress={() => router.push('/verification')} />}
            />
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <BentoCard icon="checkmark-circle" tone="success" title="Open slots">
            <Metric value={slots.data ? String(openCount) : '—'} caption="bookable right now" />
          </BentoCard>
          <BentoCard icon="calendar" tone="info" title="Reserved / booked">
            <Metric value={slots.data ? String(bookedCount) : '—'} caption="held by clients" />
          </BentoCard>
        </View>

        <View className="mb-2 mt-6 flex-row items-center justify-between">
          <Text className="text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
            Next two weeks
          </Text>
          {selectedDay ? (
            <Pressable onPress={() => setSelectedDay(null)} hitSlop={12} accessibilityRole="button" className="min-h-[32px] justify-center">
              <Text className="text-sm font-semibold text-primary-ink">Show all</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-1" className="-mx-4" contentContainerStyle={{ paddingHorizontal: 16 }}>
          {strip.map((d) => (
            <DayPill
              key={d.key}
              date={d.date}
              count={d.count}
              selected={selectedDay === d.key}
              onPress={() => setSelectedDay(selectedDay === d.key ? null : d.key)}
            />
          ))}
        </ScrollView>
        {truncated ? (
          <Text className="mt-2 text-xs text-text-body">Showing your next {slots.data?.items.length} slots of {slots.data?.total}.</Text>
        ) : null}

        <View className="mt-4">
          {slots.isPending ? (
            <LoadingCards count={2} label="Loading availability" />
          ) : slots.isError ? (
            <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
          ) : visibleGroups.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon="calendar-clear-outline"
                title={selectedDay ? 'Nothing on this day' : 'No upcoming availability'}
                message={selectedDay ? 'Pick another day or add availability.' : 'Add the times clients can book you.'}
              />
            </Card>
          ) : (
            visibleGroups.map((g) => (
              <View key={g.day} className="mb-4">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-text-body">
                  {new Date(g.slots[0].startTime).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                </Text>
                <Card className="p-0">
                  {g.slots.map((slot, i) => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      first={i === 0}
                      serviceLabel={slot.serviceId ? serviceMap[slot.serviceId] ?? 'Service' : 'Any of my services'}
                      canDelete={kycApproved && slot.status === 'OPEN'}
                      onDelete={() => setToDelete(slot)}
                    />
                  ))}
                </Card>
              </View>
            ))
          )}
        </View>
      </Screen>

      <AddAvailabilitySheet visible={adding} onClose={() => setAdding(false)} services={(services.data?.items ?? []).filter((s) => s.status === 'ACTIVE')} />

      <ConfirmDialog
        visible={!!toDelete}
        title="Delete this slot?"
        message={toDelete ? `${formatDate(toDelete.startTime)}, ${formatTime(toDelete.startTime)} – ${formatTime(toDelete.endTime)}` : undefined}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </View>
  );
}

function DayPill({ date, count, selected, onPress }: { date: Date; count: number; selected: boolean; onPress: () => void }) {
  const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} slot${count === 1 ? '' : 's'}`}
      className={`h-[78px] w-[58px] items-center justify-center rounded-2xl border ${
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-card active:bg-muted'
      }`}
    >
      <Text className={`text-[11px] font-semibold uppercase ${selected ? 'text-primary-ink' : 'text-text-body'}`}>{weekday}</Text>
      <Text className={`text-lg font-bold ${selected ? 'text-primary-ink' : 'text-text-heading'}`}>{date.getDate()}</Text>
      {count > 0 ? (
        <View className={`mt-0.5 min-w-[18px] items-center rounded-full px-1.5 ${selected ? 'bg-action' : 'bg-success-soft'}`}>
          <Text className={`text-[10px] font-bold ${selected ? 'text-white' : 'text-success-ink'}`}>{count}</Text>
        </View>
      ) : (
        <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-border" />
      )}
    </Pressable>
  );
}

function SlotRow({
  slot,
  first,
  serviceLabel,
  canDelete,
  onDelete,
}: {
  slot: AvailabilitySlotDto;
  first: boolean;
  serviceLabel: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const tone = SLOT_TONE[slot.status] ?? 'neutral';
  const bar = tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : tone === 'info' ? 'bg-info' : 'bg-text-muted';
  return (
    <View className={`flex-row items-center py-3 pl-3 pr-2 ${first ? '' : 'border-t border-border'}`}>
      <View className={`mr-3 h-10 w-1 rounded-full ${bar}`} />
      <View className="flex-1">
        <Text className="text-[15px] font-bold text-text-heading">
          {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
        </Text>
        <Text className="text-xs text-text-body" numberOfLines={1}>
          {serviceLabel}
        </Text>
      </View>
      <Badge label={humanize(slot.status)} tone={tone} />
      {canDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          className="ml-1 h-11 w-11 items-center justify-center rounded-xl active:bg-danger-soft"
          accessibilityRole="button"
          accessibilityLabel="Delete slot"
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

const DURATIONS = [30, 45, 60, 90, 120];

function AddAvailabilitySheet({ visible, onClose, services }: { visible: boolean; onClose: () => void; services: Array<{ id: string; title: string }> }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const { colors } = useTheme();
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);
  const [date, setDate] = useState<Date>(tomorrow);
  const [showDate, setShowDate] = useState(false);
  const [fullDay, setFullDay] = useState(false);
  const [duration, setDuration] = useState(60);
  const [ranges, setRanges] = useState<TimeRange[]>([{ start: '09:00', end: '10:00' }]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState('4');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setFullDay(false);
    setRanges([{ start: '09:00', end: '10:00' }]);
    setServiceId(null);
    setRepeat(false);
    setError(null);
  }

  async function save() {
    const plan = planSlots({ date, ranges: fullDay ? [FULL_DAY] : ranges, repeatWeeks: repeat ? Number(weeks) : 1 });
    if (!plan.ok) return setError(plan.error);
    setError(null);
    setSaving(true);
    let created = 0;
    try {
      // Sequential on purpose (same as the web): reports exactly which slot failed.
      for (const slot of plan.slots) {
        await availabilityApi.create({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          ...(serviceId ? { serviceId } : {}),
        });
        created += 1;
      }
      toast.show(`${created} availability slot${created === 1 ? '' : 's'} created.`);
      reset();
      onClose();
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to create slot.');
      setError(created > 0 ? `Created ${created} slot${created === 1 ? '' : 's'} before this failed: ${message}` : message);
    } finally {
      setSaving(false);
      if (created > 0) void invalidate(['availability']);
    }
  }

  const switchColors = (on: boolean) => ({
    trackColor: { true: colors.primary, false: colors.trackOff },
    thumbColor: on ? colors.onPrimary : colors.thumbOff,
  });

  return (
    <Sheet visible={visible} title="Add availability" onClose={onClose}>
      {error ? (
        <View className="mb-3">
          <InfoBanner tone="danger" message={error} icon="alert-circle" />
        </View>
      ) : null}
      <Text className="mb-1.5 text-sm font-semibold text-text-heading">Date</Text>
      <Button title={formatDate(date)} variant="outline" icon="calendar-outline" onPress={() => setShowDate(true)} accessibilityLabel={`Date: ${formatDate(date)}`} />
      {showDate ? (
        <DateTimePicker
          value={date}
          mode="date"
          minimumDate={new Date()}
          onChange={(event, d) => {
            setShowDate(false);
            if (event.type === 'set' && d) setDate(d);
          }}
        />
      ) : null}

      <View className="my-4 flex-row items-center justify-between rounded-2xl bg-muted px-4 py-2">
        <Text className="text-sm font-semibold text-text-heading">Available all day</Text>
        <Switch value={fullDay} onValueChange={setFullDay} {...switchColors(fullDay)} accessibilityLabel="Available all day" />
      </View>

      {!fullDay ? (
        <>
          <Text className="mb-1.5 text-sm font-semibold text-text-heading">Session length (fills the end time)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {DURATIONS.map((d) => (
              <Chip key={d} label={`${d} min`} selected={duration === d} onPress={() => setDuration(d)} />
            ))}
          </ScrollView>
          {ranges.map((r, i) => (
            <View key={i} className="flex-row items-start gap-2">
              <View className="flex-1">
                <TextField
                  label={i === 0 ? 'Start (HH:MM)' : undefined}
                  value={r.start}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  onChangeText={(start) =>
                    setRanges((all) => all.map((x, j) => (j === i ? { start, end: /^\d{2}:\d{2}$/.test(start) ? addMinutesToTime(start, duration) : x.end } : x)))
                  }
                />
              </View>
              <View className="flex-1">
                <TextField
                  label={i === 0 ? 'End (HH:MM)' : undefined}
                  value={r.end}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  onChangeText={(end) => setRanges((all) => all.map((x, j) => (j === i ? { ...x, end } : x)))}
                />
              </View>
              {ranges.length > 1 ? (
                <Pressable
                  onPress={() => setRanges((all) => all.filter((_, j) => j !== i))}
                  className={`h-[52px] w-10 items-center justify-center ${i === 0 ? 'mt-7' : ''}`}
                  accessibilityRole="button"
                  accessibilityLabel="Remove time range"
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Button
            title="Add another time"
            variant="ghost"
            icon="add"
            onPress={() => {
              const last = ranges[ranges.length - 1];
              const start = last && /^\d{2}:\d{2}$/.test(last.end) ? last.end : '09:00';
              setRanges((all) => [...all, { start, end: addMinutesToTime(start, duration) }]);
            }}
          />
        </>
      ) : null}

      <Text className="mb-1.5 mt-3 text-sm font-semibold text-text-heading">For which service?</Text>
      <View className="mb-3 flex-row flex-wrap gap-y-2">
        <Chip label="Any of my services" selected={!serviceId} onPress={() => setServiceId(null)} />
        {services.map((s) => (
          <Chip key={s.id} label={s.title} selected={serviceId === s.id} onPress={() => setServiceId(s.id)} />
        ))}
      </View>

      <View className="mb-3 flex-row items-center justify-between rounded-2xl bg-muted px-4 py-2">
        <Text className="text-sm font-semibold text-text-heading">Repeat weekly</Text>
        <Switch value={repeat} onValueChange={setRepeat} {...switchColors(repeat)} accessibilityLabel="Repeat weekly" />
      </View>
      {repeat ? <TextField label="For how many weeks? (1–12)" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" maxLength={2} /> : null}

      <View className="mt-2">
        <Button title="Save availability" loading={saving} onPress={save} />
      </View>
      <View className="h-4" />
    </Sheet>
  );
}
