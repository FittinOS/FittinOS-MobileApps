import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { bookingsApi } from '@/api/endpoints';
import { useProfile } from '@/api/queries';
import { Avatar, Card, Chip, EmptyState, ErrorState, Header, LoadingCards } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

function Stars({ rating }: { rating: number }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row" accessibilityLabel={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(rating) ? 'star' : 'star-outline'} size={14} color={colors.warning} />
      ))}
    </View>
  );
}

/**
 * Same source as the web reviews page on origin/main: a review is a completed
 * booking's session rating + client feedback (most recent 100 completed bookings).
 */
export default function ReviewsScreen() {
  const { colors } = useTheme();
  const profile = useProfile();
  const bookings = useQuery({
    queryKey: ['bookings', { status: 'COMPLETED', limit: 100, sortOrder: 'desc', withSession: true }],
    queryFn: () => bookingsApi.list({ status: 'COMPLETED', limit: 100, sortOrder: 'desc' }),
  });
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const reviews = useMemo(
    () =>
      (bookings.data?.items ?? [])
        .map((b) => ({ booking: b, session: (b as typeof b & { session?: { rating: number | null; clientFeedback: string | null } | null }).session }))
        .filter((r) => r.session?.rating != null)
        .map((r) => ({
          id: r.booking.id,
          rating: r.session!.rating as number,
          feedback: r.session!.clientFeedback,
          clientName: r.booking.client?.fullName ?? 'Client',
          avatarUrl: r.booking.client?.avatarUrl ?? null,
          serviceTitle: r.booking.service?.title ?? 'Session',
          date: r.booking.completedAt ?? r.booking.startTime,
        })),
    [bookings.data],
  );
  const filtered = ratingFilter ? reviews.filter((r) => r.rating === ratingFilter) : reviews;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Header title="Reviews" />
      {bookings.isPending ? (
        <View className="px-4 pt-3">
          <LoadingCards count={3} label="Loading reviews" />
        </View>
      ) : bookings.isError ? (
        <ErrorState error={bookings.error} onRetry={() => void bookings.refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerClassName="px-4 py-3 pb-10"
          ItemSeparatorComponent={() => <View className="h-3" />}
          refreshControl={<RefreshControl refreshing={bookings.isRefetching} onRefresh={() => void bookings.refetch()} colors={[colors.primary]} />}
          ListHeaderComponent={
            <View className="mb-3">
              <Card className="items-center">
                <Text className="text-4xl font-bold text-text-heading">{profile.data?.ratingAverage != null ? profile.data.ratingAverage.toFixed(1) : '—'}</Text>
                {profile.data?.ratingAverage != null ? <Stars rating={profile.data.ratingAverage} /> : null}
                <Text className="mt-1 text-sm text-text-body">
                  {profile.data?.ratingCount ?? 0} {profile.data?.ratingCount === 1 ? 'rating' : 'ratings'}
                </Text>
              </Card>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pt-3">
                <Chip label="All" selected={ratingFilter === null} onPress={() => setRatingFilter(null)} />
                {[5, 4, 3, 2, 1].map((n) => (
                  <Chip key={n} label={`${n} ★`} selected={ratingFilter === n} onPress={() => setRatingFilter(n)} />
                ))}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="star-outline" title="No reviews yet" message="Clients can rate a session after it's completed." />}
          renderItem={({ item }) => (
            <Card>
              <View className="flex-row items-center">
                <Avatar name={item.clientName} uri={item.avatarUrl} size={36} />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-text-heading">{item.clientName}</Text>
                  <Text className="text-xs text-text-body">
                    {item.serviceTitle} · {formatDate(item.date)}
                  </Text>
                </View>
                <Stars rating={item.rating} />
              </View>
              {item.feedback ? <Text className="mt-2 text-sm text-text-heading">“{item.feedback}”</Text> : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
