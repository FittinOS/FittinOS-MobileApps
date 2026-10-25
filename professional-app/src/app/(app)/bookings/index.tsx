import { useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BookingDto } from '@/api/shared';
import { useBookings } from '@/api/queries';
import type { BookingScope } from '@/api/endpoints';
import { Badge, Chip, EmptyState, ErrorState, Header, LoadingCards, ThemedRefreshControl } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';
import { formatDateTime, formatDuration, formatMoney } from '@/lib/format';
import { bookingStatus } from '@/lib/status';

const SCOPES: Array<{ key: BookingScope; label: string }> = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'today', label: 'Today' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
];

export default function BookingsScreen() {
  const [scope, setScope] = useState<BookingScope>('upcoming');
  const bookings = useBookings({ scope, limit: 50, sortOrder: scope === 'past' || scope === 'all' ? 'desc' : 'asc' });

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Header title="Bookings" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 pb-2 pt-3">
          {SCOPES.map((s) => (
            <Chip key={s.key} label={s.label} selected={scope === s.key} onPress={() => setScope(s.key)} />
          ))}
        </ScrollView>
        {bookings.data ? (
          <Text className="px-4 pb-2 text-xs text-text-body">
            {bookings.data.total} {scope === 'all' ? 'in total' : scope} booking{bookings.data.total === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>
      {bookings.isPending ? (
        <View className="px-4 pt-2">
          <LoadingCards count={3} label="Loading bookings" />
        </View>
      ) : bookings.isError ? (
        <ErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : (
        <FlatList
          data={bookings.data.items}
          keyExtractor={(b) => b.id}
          contentContainerClassName="px-4 pb-8 pt-1"
          refreshControl={<ThemedRefreshControl refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={scope === 'upcoming' ? 'No upcoming bookings' : 'No bookings here'}
              message="Bookings appear when clients book one of your open slots."
              actionLabel="Manage availability"
              onAction={() => router.push('/availability')}
            />
          }
          renderItem={({ item }) => <BookingCard booking={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function BookingCard({ booking }: { booking: BookingDto }) {
  const { colors } = useTheme();
  const s = bookingStatus(booking.status);
  const start = new Date(booking.startTime);
  return (
    <Pressable
      onPress={() => router.push(`/bookings/${booking.id}`)}
      className="flex-row rounded-3xl border border-border bg-card p-4 active:bg-muted"
      accessibilityRole="button"
      accessibilityLabel={`${booking.service?.title ?? 'Session'} with ${booking.client?.fullName ?? 'client'}, ${formatDateTime(booking.startTime)}, ${s.label}`}
    >
      <View className="mr-3 h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft">
        <Text className="text-[10px] font-bold uppercase text-primary-ink">{start.toLocaleDateString('en-IN', { month: 'short' })}</Text>
        <Text className="text-lg font-bold leading-6 text-primary-ink">{start.getDate()}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-start justify-between">
          <View className="mr-2 flex-1">
            <Text className="text-base font-bold text-text-heading" numberOfLines={1}>
              {booking.service?.title ?? 'Session'}
            </Text>
            <Text className="text-sm text-text-body" numberOfLines={1}>
              {booking.client?.fullName ?? 'Client'}
            </Text>
          </View>
          <Badge label={s.label} tone={s.tone} />
        </View>
        <View className="mt-2.5 flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color={colors.body} />
            <Text className="ml-1 text-xs font-medium text-text-heading">
              {formatDateTime(booking.startTime)} · {formatDuration(booking.service?.durationMinutes)}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="cash-outline" size={14} color={colors.body} />
            <Text className="ml-1 text-xs font-medium text-text-heading">You earn {formatMoney(booking.professionalEarningAmount)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
