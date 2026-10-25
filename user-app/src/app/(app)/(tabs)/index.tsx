import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BookingDto, CategoryDto } from '@/api/shared';
import { useBookings, useCategories, useProfessionals, useWallet } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import { Avatar, Badge, BentoCard, EmptyState, ErrorState, GlowHeroCard, IconBadge, Screen, Skeleton, Spinner, StatTile, type Tone } from '@/components/ui';
import { ProfessionalRow } from '@/features/discover/ProfessionalRow';
import { useSelectedLocation } from '@/providers/selected-location-provider';
import { useAuth } from '@/providers/auth-provider';
import { categoryIconFor } from '@/lib/category-icons';
import { formatCoins, formatDate, formatTime } from '@/lib/format';
import { bookingStatus } from '@/lib/status';
import { useTheme } from '@/theme/theme-provider';

type IconName = keyof typeof Ionicons.glyphMap;
const ACCENT = '#FF5500';
/** Cycled across category cards for restrained pastel variety — the existing tone system, not new colors. */
const CATEGORY_TONES: Tone[] = ['primary', 'info', 'success', 'warning', 'danger'];

/**
 * Home dashboard. Every figure is a backend value — nothing is estimated or
 * filled in: a tile shows "—" until its query has answered.
 */
export default function DashboardScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const wallet = useWallet();
  const upcoming = useBookings({ scope: 'upcoming', sortOrder: 'asc', limit: 5 });
  const completed = useBookings({ status: 'COMPLETED', limit: 1 });
  const recommended = useProfessionals({ limit: 8, sortBy: 'rating' });
  const categories = useCategories();
  const { location } = useSelectedLocation();
  // Only ever fires once a real location was resolved on Discover (GPS or PIN
  // code) — the same shared state Discover itself reads, so Home never keeps
  // a second, possibly-conflicting idea of "where" the user is searching.
  const nearby = useProfessionals(
    { limit: 4, sortBy: 'distance', lat: location?.latitude, lng: location?.longitude },
    !!location, // never fires without a real, resolved location — no wasted request, no "nearby" results without real coordinates
  );

  const refreshing = wallet.isRefetching || upcoming.isRefetching;
  const refresh = () => {
    void wallet.refetch();
    void upcoming.refetch();
    void completed.refetch();
    void recommended.refetch();
    void categories.refetch();
    if (location) void nearby.refetch();
  };

  const firstName = user?.fullName.split(' ')[0] || 'there';

  return (
    <View className="flex-1 bg-background">
      <AppHeader brand />
      <Screen refreshing={refreshing} onRefresh={refresh} edges={[]}>
        <View className="mb-4">
          <Text className="text-[15px] text-text-body">{greeting()},</Text>
          <View className="flex-row items-center">
            <Text className="text-[26px] font-bold leading-8 tracking-tight text-text-heading" accessibilityRole="header" numberOfLines={1}>
              {firstName}
            </Text>
            <Text className="ml-1.5 text-2xl" accessibilityElementsHidden importantForAccessibility="no">
              👋
            </Text>
          </View>
        </View>

        <WalletHero wallet={wallet} />

        <StatRow
          tiles={[
            {
              icon: 'calendar-outline',
              label: 'Upcoming bookings',
              value: upcoming.data ? String(upcoming.data.total) : '—',
              href: '/(app)/(tabs)/bookings',
              hint: upcoming.isError ? "Couldn't load — tap to retry" : undefined,
            },
            {
              icon: 'checkmark-done-outline',
              label: 'Completed sessions',
              value: completed.data ? String(completed.data.total) : '—',
              href: '/(app)/(tabs)/bookings',
              hint: completed.isError ? "Couldn't load — tap to retry" : undefined,
            },
            {
              icon: 'people-outline',
              label: 'Professionals available',
              value: recommended.data ? String(recommended.data.total) : '—',
              href: '/(app)/(tabs)/discover',
              hint: recommended.isError ? "Couldn't load — tap to retry" : undefined,
            },
            {
              icon: 'wallet-outline',
              label: 'FittinOS Coins',
              value: wallet.data ? formatCoins(wallet.data.coinBalance) : '—',
              href: '/(app)/wallet',
              hint: wallet.isError ? "Couldn't load — tap to retry" : undefined,
            },
          ]}
        />

        {/* Next booking */}
        <BentoCard layout="block" className="mt-4">
          <View className="mb-1 flex-row items-center">
            <Ionicons name="calendar-outline" size={20} color={ACCENT} />
            <Text className="ml-2 flex-1 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
              Upcoming bookings
            </Text>
            <ViewAll onPress={() => router.push('/(app)/(tabs)/bookings')} />
          </View>
          {upcoming.isPending ? (
            <View className="py-3">
              <Skeleton height={48} />
              <Skeleton height={48} className="mt-3" />
            </View>
          ) : upcoming.isError ? (
            <ErrorState compact error={upcoming.error} onRetry={() => void upcoming.refetch()} />
          ) : upcoming.data.items.length === 0 ? (
            <EmptyState
              compact
              icon="calendar-outline"
              title="No upcoming bookings"
              message="Discover a professional and book a slot to see it here."
              actionLabel="Discover professionals"
              onAction={() => router.push('/(app)/(tabs)/discover')}
            />
          ) : (
            upcoming.data.items.map((b, i) => <SessionRow key={b.id} booking={b} first={i === 0} />)
          )}
        </BentoCard>

        {/* Nearby professionals — only ever shown with the same shared location Discover uses */}
        <View className="mb-2.5 mt-6 flex-row items-end justify-between">
          <Text className="text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
            Nearby professionals
          </Text>
          {location ? (
            <ViewAll onPress={() => router.push('/(app)/(tabs)/discover')} label="View all" accessibilityLabel="View all nearby professionals" />
          ) : null}
        </View>
        {!location ? (
          <EmptyState
            compact
            icon="navigate-outline"
            title="Find professionals near you"
            message="Select a location on Discover (GPS or PIN code) to see professionals close to you here."
            actionLabel="Choose a location"
            onAction={() => router.push('/(app)/(tabs)/discover')}
          />
        ) : nearby.isPending ? (
          <View className="gap-3">
            <Skeleton height={76} />
            <Skeleton height={76} />
          </View>
        ) : nearby.isError ? (
          <ErrorState compact error={nearby.error} onRetry={() => void nearby.refetch()} />
        ) : nearby.data.items.length === 0 ? (
          <EmptyState
            compact
            icon="location-outline"
            title="No professionals found nearby"
            message={`No professionals found near ${location.label} yet. Try a different location on Discover.`}
          />
        ) : (
          <View className="gap-3">
            {nearby.data.items.map((p) => (
              <ProfessionalRow key={p.id} professional={p} />
            ))}
          </View>
        )}

        {/* Recommended professionals */}
        <Text className="mb-2.5 mt-6 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
          Recommended for you
        </Text>
        {recommended.isPending ? (
          <View className="flex-row gap-3">
            <Skeleton height={140} width="48%" />
            <Skeleton height={140} width="48%" />
          </View>
        ) : recommended.isError ? (
          <ErrorState compact error={recommended.error} onRetry={() => void recommended.refetch()} />
        ) : recommended.data.items.length === 0 ? (
          <EmptyState compact icon="search-outline" title="No professionals yet" message="Check back soon." />
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {recommended.data.items.slice(0, 4).map((p) => (
              <BentoCard
                key={p.id}
                layout="cell"
                className="min-w-[47%]"
                onPress={() => router.push(`/(app)/professional/${p.id}`)}
                accessibilityLabel={p.user.fullName}
              >
                <Avatar name={p.user.fullName} uri={p.user.avatarUrl} size={44} />
                <Text className="mt-2 text-sm font-bold text-text-heading" numberOfLines={1}>
                  {p.user.fullName}
                </Text>
                <Text className="text-xs text-text-body" numberOfLines={1}>
                  {p.headline || p.specializations[0] || p.city || 'Professional'}
                </Text>
                <View className="mt-1.5 flex-row items-center">
                  <Ionicons name="star" size={12} color={colors.warning} />
                  <Text className="ml-1 text-xs font-semibold text-text-heading">
                    {p.ratingAverage != null ? p.ratingAverage.toFixed(1) : 'New'}
                  </Text>
                </View>
              </BentoCard>
            ))}
          </View>
        )}

        {/* Categories */}
        <View className="mb-2.5 mt-6 flex-row items-end justify-between">
          <Text className="text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
            Explore top categories
          </Text>
          {categories.data && categories.data.length > 8 ? (
            <ViewAll
              onPress={() => router.push('/(app)/(tabs)/discover')}
              label="View all"
              accessibilityLabel="View all categories on Discover"
            />
          ) : null}
        </View>
        {categories.isPending ? (
          <View className="flex-row flex-wrap gap-2.5">
            <Skeleton height={92} width="31%" />
            <Skeleton height={92} width="31%" />
            <Skeleton height={92} width="31%" />
          </View>
        ) : categories.isError ? (
          <ErrorState compact error={categories.error} onRetry={() => void categories.refetch()} />
        ) : categories.data.length === 0 ? (
          <EmptyState compact icon="grid-outline" title="No categories yet" />
        ) : (
          <View className="flex-row flex-wrap gap-2.5">
            {categories.data.slice(0, 8).map((c, i) => <CategoryCard key={c.id} category={c} tone={CATEGORY_TONES[i % CATEGORY_TONES.length]} />)}
          </View>
        )}

        {/* Quick actions */}
        <Text className="mb-2.5 mt-6 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
          Quick actions
        </Text>
        <View className="flex-row gap-2.5">
          <QuickAction icon="search" label="Discover" href="/(app)/(tabs)/discover" />
          <QuickAction icon="document-text" label="Post a requirement" href="/(app)/(tabs)/requirements/create" />
          <QuickAction icon="wallet" label="Buy coins" href="/(app)/wallet/buy" />
          <QuickAction icon="person" label="Profile" href="/(app)/(tabs)/profile" />
        </View>
      </Screen>
    </View>
  );
}

function WalletHero({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  return (
    <GlowHeroCard
      onPress={() => router.push('/(app)/wallet')}
      icon="wallet"
      accessibilityLabel={wallet.data ? `${formatCoins(wallet.data.coinBalance)}. View wallet` : 'Wallet. View wallet'}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[15px] font-semibold text-white/90">FittinOS Coins</Text>
        <View className="flex-row items-center">
          <Text className="text-[13px] font-bold" style={{ color: ACCENT }}>
            Top up
          </Text>
          <Ionicons name="arrow-forward" size={14} color={ACCENT} style={{ marginLeft: 3 }} />
        </View>
      </View>
      {wallet.isPending ? (
        <View className="mt-2 w-32">
          <Skeleton height={32} />
        </View>
      ) : wallet.isError ? (
        <Text className="mt-1 text-sm text-white/80">Couldn&apos;t load. Pull down to retry.</Text>
      ) : (
        <Text className="mt-1 text-[32px] font-bold leading-[38px] tracking-tight text-white" numberOfLines={1} adjustsFontSizeToFit>
          {formatCoins(wallet.data.coinBalance)}
        </Text>
      )}
    </GlowHeroCard>
  );
}

function StatRow({ tiles }: { tiles: Array<{ icon: IconName; label: string; value: string; href: Href; hint?: string }> }) {
  const narrow = useWindowDimensions().width < 370;
  const rows = narrow ? [tiles.slice(0, 2), tiles.slice(2)] : [tiles];
  return (
    <View className="mt-4 gap-2.5">
      {rows.map((row, r) => (
        <View key={r} className="flex-row gap-2.5">
          {row.map((t) => (
            <StatTile key={t.label} label={t.label} value={t.value} icon={t.icon} hint={t.hint} onPress={() => router.push(t.href)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function SessionRow({ booking, first }: { booking: BookingDto; first: boolean }) {
  const { colors } = useTheme();
  const s = bookingStatus(booking.status);
  return (
    <Pressable
      onPress={() => router.push(`/(app)/(tabs)/bookings/${booking.id}`)}
      className={`flex-row items-center py-3 active:opacity-70 ${first ? '' : 'border-t border-border'}`}
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(booking.startTime)} ${formatTime(booking.startTime)}, ${booking.professional?.user.fullName ?? 'Professional'}, ${
        booking.service?.title ?? 'Session'
      }, ${s.label}`}
    >
      <View className="mr-3 w-[68px] rounded-xl bg-muted px-2 py-2">
        <Text className="text-[11px] text-text-body" numberOfLines={1}>
          {formatDate(booking.startTime)}
        </Text>
        <Text className="text-xs font-bold text-text-heading" numberOfLines={1}>
          {formatTime(booking.startTime)}
        </Text>
      </View>
      <Avatar name={booking.professional?.user.fullName} uri={booking.professional?.user.avatarUrl} size={40} />
      <View className="ml-3 mr-2 flex-1">
        <Text className="text-sm font-bold text-text-heading" numberOfLines={1}>
          {booking.professional?.user.fullName ?? 'Professional'}
        </Text>
        <Text className="text-xs text-text-body" numberOfLines={1}>
          {booking.service?.title ?? 'Session'}
        </Text>
      </View>
      <Badge label={s.label} tone={s.tone} />
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

function QuickAction({ icon, label, href }: { icon: IconName; label: string; href: Href }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      className="min-h-[100px] flex-1 items-center justify-center rounded-3xl border border-border bg-card px-1.5 py-3 active:bg-muted"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-action">
        <Ionicons name={icon} size={21} color="#FFFFFF" />
      </View>
      <Text className="mt-2 text-center text-xs font-semibold leading-4 text-text-heading" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A Bento-style category tile. Prefers the backend's real icon (`iconUrl`)
 * when set; absent one, falls back to a real, category-specific Ionicons
 * glyph keyed on the backend's own stable `slug` (see lib/category-icons.ts)
 * rather than a meaningless generic grid icon.
 */
function CategoryCard({ category, tone }: { category: CategoryDto; tone: Tone }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(app)/(tabs)/discover', params: { category: category.id } })}
      className="min-w-[31%] flex-1 rounded-3xl border border-border bg-card p-3 active:bg-muted"
      accessibilityRole="button"
      accessibilityLabel={category.name}
    >
      {category.iconUrl ? (
        <Image source={{ uri: category.iconUrl }} className="h-9 w-9 rounded-xl" accessibilityIgnoresInvertColors />
      ) : (
        <IconBadge icon={categoryIconFor(category.slug)} tone={tone} size={36} />
      )}
      <Text className="mt-2 text-[13px] font-semibold leading-4 text-text-heading" numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
}

function ViewAll({ onPress, label = 'View all', accessibilityLabel = 'View all bookings' }: { onPress: () => void; label?: string; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="link" accessibilityLabel={accessibilityLabel} className="min-h-[32px] flex-row items-center">
      <Text className="text-[13px] font-bold text-primary-ink">{label}</Text>
      <Ionicons name="arrow-forward" size={14} color={colors.primaryInk} style={{ marginLeft: 3 }} />
    </Pressable>
  );
}

function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
