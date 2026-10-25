import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BookingDto } from '@/api/shared';
import { useBookings } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import { Avatar, Badge, EmptyState, ErrorState, LoadingCards, Segmented } from '@/components/ui';
import { formatDate, formatMoney, formatTime } from '@/lib/format';
import { bookingStatus } from '@/lib/status';
import { useTheme } from '@/theme/theme-provider';

type Scope = 'upcoming' | 'past';

export default function BookingsListScreen() {
  const { colors } = useTheme();
  const [scope, setScope] = useState<Scope>('upcoming');
  const bookings = useBookings({ scope, sortOrder: scope === 'upcoming' ? 'asc' : 'desc', limit: 50 });

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Bookings" subtitle="Your sessions with professionals" />
      <View className="px-4 pt-3">
        <Segmented
          options={[
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'past', label: 'Past' },
          ]}
          value={scope}
          onChange={setScope}
        />
      </View>
      {bookings.isPending ? (
        <View className="px-4 pt-3">
          <LoadingCards count={4} />
        </View>
      ) : bookings.isError ? (
        <ErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : bookings.data.items.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={scope === 'upcoming' ? 'No upcoming bookings' : 'No past bookings'}
          message={scope === 'upcoming' ? 'Discover a professional and book a slot.' : 'Completed and cancelled bookings appear here.'}
          actionLabel={scope === 'upcoming' ? 'Discover professionals' : undefined}
          onAction={scope === 'upcoming' ? () => router.push('/(app)/(tabs)/discover') : undefined}
        />
      ) : (
        <FlatList
          data={bookings.data.items}
          keyExtractor={(b) => b.id}
          contentContainerClassName="px-4 pb-6 pt-3"
          renderItem={({ item: b }) => <BookingRow booking={b} />}
        />
      )}
    </View>
  );
}

function BookingRow({ booking }: { booking: BookingDto }) {
  const { colors } = useTheme();
  const s = bookingStatus(booking.status);
  return (
    <Pressable
      onPress={() => router.push(`/(app)/(tabs)/bookings/${booking.id}`)}
      className="mb-3 rounded-3xl border border-border bg-card p-4 active:bg-muted"
      accessibilityRole="button"
    >
      <View className="flex-row items-center">
        <Avatar name={booking.professional?.user.fullName} uri={booking.professional?.user.avatarUrl} size={44} />
        <View className="ml-3 flex-1">
          <Text className="text-sm font-bold text-text-heading" numberOfLines={1}>
            {booking.professional?.user.fullName ?? 'Professional'}
          </Text>
          <Text className="text-xs text-text-body" numberOfLines={1}>
            {booking.service?.title ?? 'Session'}
          </Text>
        </View>
        <Badge label={s.label} tone={s.tone} />
      </View>
      <View className="mt-3 flex-row items-center justify-between border-t border-border pt-3">
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text className="ml-1.5 text-xs text-text-body">
            {formatDate(booking.startTime)} · {formatTime(booking.startTime)}
          </Text>
        </View>
        <Text className="text-sm font-bold text-text-heading">{formatMoney(booking.priceAmount)}</Text>
      </View>
    </Pressable>
  );
}
