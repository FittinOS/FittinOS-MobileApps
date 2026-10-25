import { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { bookingsApi } from '@/api/endpoints';
import type { BookingDto } from '@/api/shared';
import { useBookings, useEarningsSummary, useLeads, usePayouts, useProfile, useServices } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import {
  Avatar,
  Badge,
  BentoCard,
  Card,
  EmptyState,
  ErrorState,
  LinkText,
  Screen,
  SectionTitle,
  Segmented,
  Skeleton,
  Spinner,
  StatTile,
} from '@/components/ui';
import { AcceptingWorkToggle } from '@/features/profile/AcceptingWorkToggle';
import { useProfileSetup } from '@/features/profile/setup-steps';
import { formatDate, formatDuration, formatMoney, formatTime } from '@/lib/format';
import { bookingStatus, serviceStatus } from '@/lib/status';
import { useTheme } from '@/theme/theme-provider';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Home dashboard. Every figure is a backend value — nothing is estimated or
 * filled in: a tile shows "—" until its query has answered.
 */
export default function DashboardScreen() {
  const profile = useProfile();
  const services = useServices();
  // Leads the professional can act on right now. /leads/stats is deliberately not used for
  // these: its "new" count also includes closed requirements (see WEB_TO_MOBILE_PARITY.md).
  const leads = useLeads({ limit: 1 });
  const today = useBookings({ scope: 'today', sortOrder: 'asc', limit: 10 });
  const upcoming = useBookings({ scope: 'upcoming', sortOrder: 'asc', limit: 5 });
  const earnings = useEarningsSummary();
  const payouts = usePayouts({ limit: 5 });
  const setup = useProfileSetup();
  // Same endpoint apps/professional-app's reviews.tsx uses (a review IS a completed
  // booking's session rating + feedback) — just the newest one, for this preview card.
  const recentCompleted = useQuery({
    queryKey: ['bookings', { status: 'COMPLETED', limit: 20, sortOrder: 'desc', forHomeReviewPreview: true }],
    queryFn: () => bookingsApi.list({ status: 'COMPLETED', limit: 20, sortOrder: 'desc' }),
  });

  const [sessionsTab, setSessionsTab] = useState<'upcoming' | 'today'>('upcoming');

  const refreshing = profile.isRefetching || upcoming.isRefetching || today.isRefetching || earnings.isRefetching;
  const refresh = () => {
    void profile.refetch();
    void services.refetch();
    void leads.refetch();
    void today.refetch();
    void upcoming.refetch();
    void earnings.refetch();
    void payouts.refetch();
    void recentCompleted.refetch();
    setup.refetch();
  };

  const latestReview = useMemo(() => {
    const items = recentCompleted.data?.items ?? [];
    for (const b of items) {
      const session = (b as BookingDto & { session?: { rating: number | null; clientFeedback: string | null } | null }).session;
      if (session?.rating != null) return { booking: b, rating: session.rating, feedback: session.clientFeedback };
    }
    return null;
  }, [recentCompleted.data]);

  const lastPaid = payouts.data?.items.find((p) => p.status === 'PAID');

  if (profile.isPending) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader brand />
        <Spinner label="Loading your workspace" />
      </View>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader brand />
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </View>
    );
  }

  const p = profile.data;
  const firstName = p.user.fullName.split(' ')[0] || 'there';
  const serviceItems = services.data?.items ?? [];
  const activeServiceItems = serviceItems.filter((s) => s.status === 'ACTIVE');
  const todayItems = today.data?.items ?? [];
  const todayConfirmed = todayItems.filter((b) => b.status === 'CONFIRMED').length;
  const todayPending = todayItems.filter((b) => b.status === 'PENDING' || b.status === 'PAYMENT_PENDING').length;
  const nextUpcoming = upcoming.data?.items[0];
  const setupPct = setup.total > 0 ? Math.round((setup.done / setup.total) * 100) : 0;
  const sessionsList = sessionsTab === 'upcoming' ? upcoming : today;

  return (
    <View className="flex-1 bg-background">
      <AppHeader brand />
      <Screen refreshing={refreshing} onRefresh={refresh} edges={[]}>
        {/* Greeting + availability switch */}
        <View className="mb-4 flex-row items-start justify-between">
          <View className="mr-3 flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-body" numberOfLines={1}>
              Coach dashboard · {todayLabel()}
            </Text>
            <Text className="mt-0.5 text-[26px] font-bold leading-8 tracking-tight text-text-heading" accessibilityRole="header" numberOfLines={1}>
              {greeting()}, {firstName} 👋
            </Text>
            <Text className="mt-0.5 text-sm text-text-body" numberOfLines={1}>
              {p.isLive ? 'Your profile is live — clients can book you.' : 'Finish setup to go live.'}
            </Text>
          </View>
          <View className="mt-1">
            <AcceptingWorkToggle variant="pill" />
          </View>
        </View>

        {/* Independent of setup.ready (services/availability loading) — KYC status alone,
            from the already-loaded profile, is reason enough to show this. */}
        {p.kycStatus !== 'APPROVED' || setup.done < setup.total ? (
          <View className="mb-4">
            <StatusBanner kycStatus={p.kycStatus} pct={setupPct} nextHref={setup.next?.href ?? '/profile-setup'} />
          </View>
        ) : null}

        {/* Four headline tiles */}
        <StatRow
          tiles={[
            {
              icon: 'calendar-outline',
              label: "Today's bookings",
              value: today.data ? String(today.data.total) : '—',
              href: '/bookings',
              hint: today.isError ? "Couldn't load — tap to retry" : today.data ? `${todayConfirmed} confirmed · ${todayPending} pending` : undefined,
            },
            {
              icon: 'time-outline',
              label: 'Upcoming sessions',
              value: upcoming.data ? String(upcoming.data.total) : '—',
              href: '/bookings',
              hint: upcoming.isError ? "Couldn't load — tap to retry" : nextUpcoming ? `Next at ${formatTime(nextUpcoming.startTime)}` : undefined,
            },
            {
              icon: 'briefcase-outline',
              label: 'Active services',
              value: services.data ? String(activeServiceItems.length) : '—',
              href: '/services',
              hint: services.isError ? "Couldn't load — tap to retry" : services.data ? `of ${serviceItems.length} listed` : undefined,
            },
            {
              icon: 'star-outline',
              label: 'Rating',
              value: p.ratingAverage != null ? p.ratingAverage.toFixed(1) : '—',
              href: '/reviews',
              hint: p.ratingCount ? `${p.ratingCount} review${p.ratingCount === 1 ? '' : 's'}` : 'No reviews yet',
            },
          ]}
        />

        {/* Earnings */}
        <EarningsCard summary={earnings} lastPaidAt={lastPaid?.processedAt ?? lastPaid?.createdAt} />

        {/* Sessions: upcoming or today */}
        <BentoCard layout="block" className="mt-4" bodyClassName="pb-1">
          <View className="mb-3">
            <Segmented
              options={[
                { key: 'upcoming', label: 'Upcoming sessions' },
                { key: 'today', label: "Today's bookings" },
              ]}
              value={sessionsTab}
              onChange={setSessionsTab}
            />
          </View>
          {sessionsList.isPending ? (
            <View className="pb-3">
              <Skeleton height={48} />
              <Skeleton height={48} className="mt-3" />
            </View>
          ) : sessionsList.isError ? (
            <ErrorState compact error={sessionsList.error} onRetry={() => void sessionsList.refetch()} />
          ) : sessionsList.data.items.length === 0 ? (
            <EmptyState
              compact
              icon="calendar-outline"
              title={sessionsTab === 'upcoming' ? 'No upcoming sessions' : 'No bookings today'}
              message="Confirmed bookings appear here. Open more slots to get booked."
              actionLabel="Open availability"
              onAction={() => router.push('/availability')}
            />
          ) : (
            sessionsList.data.items.map((b, i) => <SessionRow key={b.id} booking={b} first={i === 0} />)
          )}
        </BentoCard>

        {/* Active services preview */}
        <SectionTitle title="Active services" action={<LinkText label="Manage services" onPress={() => router.push('/services')} />} />
        {services.isPending ? (
          <Skeleton height={100} />
        ) : services.isError ? (
          <ErrorState compact error={services.error} onRetry={() => void services.refetch()} />
        ) : activeServiceItems.length === 0 ? (
          <Card>
            <EmptyState compact icon="briefcase-outline" title="No active services yet" message="Add a service so clients can book you." />
          </Card>
        ) : (
          <View className="flex-row gap-2.5">
            {activeServiceItems.slice(0, 2).map((s) => {
              const st = serviceStatus(s.status);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/services/${s.id}`)}
                  className="flex-1 rounded-3xl border border-border bg-card p-4 active:bg-muted"
                  accessibilityRole="button"
                  accessibilityLabel={`${s.title}, ${formatMoney(s.priceAmount)} per session, ${st.label}`}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
                      <Ionicons name="briefcase" size={16} color="#FF5500" />
                    </View>
                    <Badge label={st.label} tone={st.tone} />
                  </View>
                  <Text className="mt-3 text-[15px] font-bold text-text-heading" numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text className="mt-0.5 text-sm text-text-body">{formatMoney(s.priceAmount)} / session</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Reviews preview */}
        <SectionTitle title="Reviews" action={<LinkText label="View all" onPress={() => router.push('/reviews')} />} />
        <Card>
          <View className="flex-row items-center">
            <Text className="text-[28px] font-bold tracking-tight text-text-heading">
              {p.ratingAverage != null ? p.ratingAverage.toFixed(1) : '—'}
            </Text>
            <View className="ml-3 flex-1">
              <Stars rating={p.ratingAverage ?? 0} />
              <Text className="mt-0.5 text-xs text-text-body">{p.ratingCount ?? 0} reviews</Text>
            </View>
          </View>
          {recentCompleted.isPending ? (
            <View className="mt-3">
              <Skeleton height={36} />
            </View>
          ) : latestReview ? (
            <View className="mt-3 border-t border-border pt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-text-heading" numberOfLines={1}>
                  {latestReview.booking.client?.fullName ?? 'Client'}
                </Text>
                <Text className="text-xs text-text-body">{formatDate(latestReview.booking.completedAt ?? latestReview.booking.startTime)}</Text>
              </View>
              {latestReview.feedback ? (
                <Text className="mt-1 text-sm text-text-body" numberOfLines={2}>
                  {latestReview.feedback}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Card>

        {/* Quick actions */}
        <SectionTitle title="Quick actions" />
        <View className="flex-row gap-2.5">
          <QuickAction icon="briefcase" label="Services" href="/services" />
          <QuickAction icon="calendar" label="Availability" href="/availability" />
          <QuickAction icon="people" label="Leads" href="/leads" badge={leads.data?.total} />
          <QuickAction icon="person" label="Edit profile" href="/profile/edit" />
        </View>
      </Screen>
    </View>
  );
}

/** Combines KYC status and profile-setup progress into one banner — they're
 *  the same checklist (KYC is itself one of useProfileSetup's steps). */
function StatusBanner({ kycStatus, pct, nextHref }: { kycStatus: string; pct: number; nextHref: Href }) {
  const { colors } = useTheme();
  const kycDone = kycStatus === 'APPROVED';
  const danger = kycStatus === 'REJECTED';
  const title = kycDone ? 'Complete your profile' : 'Verification pending';
  const kycLine =
    kycStatus === 'PENDING'
      ? "We're reviewing your Aadhaar verification."
      : kycStatus === 'REJECTED'
        ? 'Your verification was not approved — open Verification to try again.'
        : 'Payouts unlock after KYC review.';

  return (
    <Pressable
      onPress={() => router.push(nextHref)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Profile ${pct}% complete. Finish setup`}
      className={`rounded-2xl p-3.5 active:opacity-80 ${danger ? 'bg-danger-soft' : 'bg-warning-soft'}`}
    >
      <View className="flex-row items-start">
        <Ionicons name="shield-outline" size={20} color={danger ? colors.danger : colors.warning} style={{ marginRight: 10, marginTop: 1 }} />
        <View className="flex-1">
          <Text className={`mb-0.5 text-sm font-bold ${danger ? 'text-danger-ink' : 'text-warning-ink'}`}>{title}</Text>
          {!kycDone ? <Text className="text-sm leading-5 text-text-heading">{kycLine}</Text> : null}
          <View className="mt-1.5 flex-row items-center justify-between">
            <Text className="text-sm text-text-heading">Profile {pct}% complete</Text>
            <View className="flex-row items-center">
              <Text className="text-[13px] font-bold text-primary-ink">Finish</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primaryInk} style={{ marginLeft: 2 }} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Flat earnings breakdown: available / pending / paid out, each with its own caption. */
function EarningsCard({
  summary,
  lastPaidAt,
}: {
  summary: ReturnType<typeof useEarningsSummary>;
  lastPaidAt: string | null | undefined;
}) {
  return (
    <Card className="mt-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wide text-text-body">Earnings · {monthLabel()}</Text>
        <LinkText label="View earnings" onPress={() => router.push('/earnings')} />
      </View>
      {summary.isPending ? (
        <View className="mt-3">
          <Skeleton height={48} />
        </View>
      ) : summary.isError ? (
        <Text className="mt-3 text-sm text-text-body">Couldn&apos;t load. Pull down to retry.</Text>
      ) : (
        <View className="mt-3 flex-row">
          <EarningsFigure label="Available" value={formatMoney(summary.data.availableForPayout)} caption="Can be paid out" />
          <View className="mx-3 w-px bg-border" />
          <EarningsFigure label="Pending" value={formatMoney(summary.data.pendingEarnings)} caption="Clears after sessions" />
          <View className="mx-3 w-px bg-border" />
          <EarningsFigure label="Paid out" value={formatMoney(summary.data.paidOut)} caption={lastPaidAt ? `Last payout ${formatDate(lastPaidAt)}` : 'No payouts yet'} />
        </View>
      )}
    </Card>
  );
}

function EarningsFigure({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-text-body" numberOfLines={1}>
        {label}
      </Text>
      <Text className="mt-0.5 text-base font-bold text-text-heading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="mt-0.5 text-[11px] text-text-muted" numberOfLines={2}>
        {caption}
      </Text>
    </View>
  );
}

function Stars({ rating }: { rating: number }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row" accessibilityLabel={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(rating) ? 'star' : 'star-outline'} size={14} color={colors.warning} />
      ))}
    </View>
  );
}

function StatRow({ tiles }: { tiles: Array<{ icon: IconName; label: string; value: string; href: Href; hint?: string }> }) {
  // Four across like the dashboard design; two rows of two on narrow phones.
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
      onPress={() => router.push(`/bookings/${booking.id}`)}
      className={`flex-row items-center py-3 active:opacity-70 ${first ? '' : 'border-t border-border'}`}
      accessibilityRole="button"
      accessibilityLabel={`${dayLabel(booking.startTime)} ${formatTime(booking.startTime)}, ${booking.client?.fullName ?? 'Client'}, ${
        booking.service?.title ?? 'Session'
      }, ${s.label}`}
    >
      <View className="mr-3 w-[68px] rounded-xl bg-muted px-2 py-2">
        <Text className="text-[11px] text-text-body" numberOfLines={1}>
          {dayLabel(booking.startTime)}
        </Text>
        <Text className="text-xs font-bold text-text-heading" numberOfLines={1}>
          {formatTime(booking.startTime)}
        </Text>
      </View>
      <Avatar name={booking.client?.fullName} uri={booking.client?.avatarUrl} size={40} />
      <View className="ml-3 mr-2 flex-1">
        <Text className="text-sm font-bold text-text-heading" numberOfLines={1}>
          {booking.client?.fullName ?? 'Client'}
        </Text>
        <Text className="text-xs text-text-body" numberOfLines={1}>
          {booking.service?.title ?? 'Session'}
          {booking.service?.durationMinutes ? ` · ${formatDuration(booking.service.durationMinutes)}` : ''}
        </Text>
      </View>
      <Badge label={s.label} tone={s.tone} />
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

function QuickAction({ icon, label, href, badge }: { icon: IconName; label: string; href: Href; badge?: number }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      className="min-h-[100px] flex-1 items-center justify-center rounded-3xl border border-border bg-card px-1.5 py-3 active:bg-muted"
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
    >
      <View className="h-11 w-11 items-center justify-center rounded-2xl bg-action">
        <Ionicons name={icon} size={21} color="#FFFFFF" />
        {badge ? (
          <View className="absolute -right-1.5 -top-1.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-danger px-1">
            <Text className="text-[9px] font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-2 text-center text-xs font-semibold leading-4 text-text-heading" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Time-of-day greeting in the device's local time. */
function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** "Sat, 24 Oct" — today's date in the device's local time. */
function todayLabel(now: Date = new Date()): string {
  return now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "October" — the current month, for the earnings card's title. */
function monthLabel(now: Date = new Date()): string {
  return now.toLocaleDateString('en-IN', { month: 'long' });
}

/** "Today" / "Tomorrow" / "Mon, 12 Oct" for a booking start. */
function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(now)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
