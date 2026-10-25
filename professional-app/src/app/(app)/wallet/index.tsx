import { useMemo, useRef } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBookings, useCoinPackages, useCoinValue, useWallet, useWalletTransactions } from '@/api/queries';
import { Button, EmptyState, ErrorState, Header, LoadingCards, Skeleton, ThemedRefreshControl, useToneColor, type Tone } from '@/components/ui';
import { CoinIcon } from '@/features/coins/CoinIcon';
import { CoinPackageCard } from '@/features/coins/CoinPackageCard';
import { TransactionRow } from '@/features/coins/TransactionRow';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

const walletArt = require('../../../../assets/wallet-coins.png');
const coinsArt = require('../../../../assets/coins-stack.png');

type IconName = keyof typeof Ionicons.glyphMap;

/** Theme-aware background per tone, matching the soft-fill tokens used everywhere else (primitives.tsx's toneClass). */
const TONE_BG: Record<Tone, string> = {
  neutral: 'bg-muted',
  primary: 'bg-primary-soft',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  info: 'bg-info-soft',
};

/** The web wallet's reasons, kept true to this app: professionals spend coins on featured listings. */
const WHY_BUY: Array<{ icon: IconName; tone: Tone; title: string; text: string }> = [
  { icon: 'trending-up', tone: 'warning', title: 'Get discovered more', text: 'Featured listing, better visibility and higher ranking.' },
  { icon: 'people', tone: 'info', title: 'Reach more clients', text: 'Featured services are shown first when clients browse.' },
  { icon: 'rocket', tone: 'primary', title: 'Grow your business', text: 'Boost your profile and highlight your services.' },
  { icon: 'shield-checkmark', tone: 'success', title: 'Secure and hassle-free', text: 'Secure Cashfree payments; coins are credited once payment is confirmed.' },
];

/**
 * Coins & wallet — the web's professional wallet page laid out for a phone:
 * balance hero, overview, buy-more prompt, trending packages, why coins,
 * featured-listings shortcut and the coin transaction history.
 */
export default function WalletScreen() {
  const { colors } = useTheme();
  const successColor = useToneColor('success');
  const dangerColor = useToneColor('danger');
  const infoColor = useToneColor('info');
  const wallet = useWallet();
  const coinValue = useCoinValue();
  const tx = useWalletTransactions({ limit: 100 });
  const packages = useCoinPackages();
  const upcoming = useBookings({ scope: 'upcoming', limit: 1 });
  const scrollRef = useRef<ScrollView>(null);
  const txY = useRef(0);

  const items = useMemo(() => tx.data?.items ?? [], [tx.data]);
  const { purchased, spent } = useMemo(() => {
    let p = 0;
    let s = 0;
    for (const t of items) {
      if (t.amount > 0 && t.type === 'PURCHASE') p += t.amount;
      if (t.amount < 0) s += Math.abs(t.amount);
    }
    return { purchased: p, spent: s };
  }, [items]);
  const partialTotals = !!tx.data && tx.data.total > items.length;

  const trending = useMemo(
    () =>
      [...(packages.data ?? [])]
        .filter((p) => p.isActive)
        .sort((a, b) => (a.tag ? -1 : 1) - (b.tag ? -1 : 1) || a.sortOrder - b.sortOrder)
        .slice(0, 2),
    [packages.data],
  );

  const refresh = () => {
    void wallet.refetch();
    void tx.refetch();
    void packages.refetch();
    void upcoming.refetch();
  };

  return (
    <View className="flex-1 bg-background">
      <Header title="Coins & wallet" />
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="px-4 pb-10 pt-4"
        refreshControl={<ThemedRefreshControl refreshing={wallet.isRefetching || tx.isRefetching} onRefresh={refresh} />}
      >
        {/* Balance hero (web: orange gradient card with the wallet art) */}
        {wallet.isError ? (
          <ErrorState compact error={wallet.error} onRetry={() => void wallet.refetch()} />
        ) : (
          <View className="min-h-[176px] justify-center overflow-hidden rounded-[28px] bg-action p-5">
            {[300, 220, 150].map((s, i) => (
              <View
                key={s}
                pointerEvents="none"
                className="absolute rounded-full"
                style={{ width: s, height: s, right: -s / 3, top: -s / 3, backgroundColor: '#FFFFFF', opacity: 0.05 + i * 0.02 }}
              />
            ))}
            <Image source={walletArt} style={{ position: 'absolute', right: 6, width: 136, height: 112 }} resizeMode="contain" accessible={false} />
            <View style={{ maxWidth: '62%' }}>
              <Text className="text-sm font-semibold text-white">Wallet balance</Text>
              {wallet.isPending ? (
                <View className="mt-2 w-32">
                  <Skeleton height={36} />
                </View>
              ) : (
                <View className="mt-1 flex-row items-center">
                  <CoinIcon size={30} />
                  <Text className="ml-2 text-[34px] font-bold leading-10 text-white" numberOfLines={1} adjustsFontSizeToFit>
                    {wallet.data.coinBalance.toLocaleString('en-IN')}
                  </Text>
                  <Text className="ml-1.5 mt-2 text-base text-white">Coins</Text>
                </View>
              )}
              {coinValue.data ? (
                <Text className="mt-0.5 text-xs text-white">1 coin = {formatMoney(coinValue.data.coinValuePaise, { decimals: true })}</Text>
              ) : null}
              <Pressable
                onPress={() => scrollRef.current?.scrollTo({ y: txY.current, animated: true })}
                className="mt-4 flex-row items-center self-start rounded-full bg-black/20 px-4 py-2.5 active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel="Transaction history"
              >
                <Ionicons name="time-outline" size={15} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-semibold text-white">Transaction history</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Wallet overview */}
        <View className="mt-4 rounded-3xl border border-border bg-card p-4">
          <Text className="mb-3 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
            Wallet overview
          </Text>
          <View className="flex-row flex-wrap" style={{ rowGap: 14 }}>
            <OverviewStat icon={<CoinIcon size={22} />} tone="primary" value={wallet.data?.coinBalance} label="Total coins" />
            <OverviewStat icon={<Ionicons name="arrow-up" size={18} color={successColor} />} tone="success" value={tx.data ? purchased : undefined} label="Coins purchased" />
            <OverviewStat icon={<Ionicons name="arrow-down" size={18} color={dangerColor} />} tone="danger" value={tx.data ? spent : undefined} label="Coins spent" />
            <OverviewStat icon={<Ionicons name="calendar" size={18} color={infoColor} />} tone="info" value={upcoming.data?.total} label="Upcoming bookings" />
          </View>
          {partialTotals ? <Text className="mt-3 text-[11px] text-text-body">Purchased and spent are from your latest {items.length} transactions.</Text> : null}
        </View>

        {/* Low on coins (web: dark card with the coin-stack art) */}
        <View className="mt-4 min-h-[140px] justify-center overflow-hidden rounded-[28px] p-5" style={{ backgroundColor: colors.hero }}>
          <Image source={coinsArt} style={{ position: 'absolute', right: 4, width: 150, height: 100 }} resizeMode="contain" accessible={false} />
          <View style={{ maxWidth: '58%' }}>
            <Text className="text-lg font-bold text-white">Low on coins?</Text>
            <Text className="mt-1 text-sm text-white/80">Buy coins and keep growing your business.</Text>
            <Pressable
              onPress={() => router.push('/wallet/buy')}
              className="mt-3 flex-row items-center self-start rounded-xl bg-action px-4 py-2.5 active:bg-action-pressed"
              accessibilityRole="button"
              accessibilityLabel="Buy coins now"
            >
              <Text className="text-sm font-bold text-white">Buy coins now</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </Pressable>
          </View>
        </View>

        {/* Trending packages */}
        {trending.length > 0 ? (
          <>
            <SectionHeader title="Trending coin packages" actionLabel="View all" onAction={() => router.push('/wallet/buy')} />
            <View className="flex-row gap-3">
              {trending.map((p) => (
                <View key={p.id} className="flex-1">
                  {/* As on the web dashboard: Buy now opens Buy Coins, where checkout lives. */}
                  <CoinPackageCard pkg={p} compact onBuy={() => router.push('/wallet/buy')} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Why buy coins */}
        <View className="mt-6 rounded-3xl border border-border bg-card p-4">
          <Text className="mb-3 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
            Why buy coins?
          </Text>
          <View className="gap-3.5">
            {WHY_BUY.map((w) => (
              <WhyBuyRow key={w.title} {...w} />
            ))}
          </View>
        </View>

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Button title="Buy coins" icon="add-circle" onPress={() => router.push('/wallet/buy')} />
          </View>
          <View className="flex-1">
            <Button title="Payment history" variant="outline" icon="receipt-outline" onPress={() => router.push('/payments')} />
          </View>
        </View>

        {/* Featured listings shortcut */}
        <Pressable
          onPress={() => router.push('/featured-listings')}
          className="mt-4 flex-row items-center rounded-3xl border border-primary/30 bg-primary-soft p-4 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Spend coins on featured listings. Manage featured listings"
        >
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-card">
            <Ionicons name="star" size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold text-text-heading">Spend coins on featured listings</Text>
            <Text className="mt-0.5 text-xs text-text-body">Get more visibility for your services in client search.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryInk} />
        </Pressable>

        <View className="mt-3 flex-row items-start rounded-2xl bg-muted px-3.5 py-3">
          <Ionicons name="information-circle" size={18} color={colors.info} style={{ marginTop: 1 }} />
          <Text className="ml-2 flex-1 text-xs leading-[18px] text-text-body">Messaging and calls with clients never cost you coins.</Text>
        </View>

        {/* Coin transactions */}
        <View onLayout={(e) => (txY.current = e.nativeEvent.layout.y)}>
          <View className="mb-2.5 mt-6 flex-row items-end justify-between">
            <Text className="text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
              Coin transactions
            </Text>
            {tx.data && tx.data.total > 0 ? <Text className="text-sm text-text-body">{tx.data.total} total</Text> : null}
          </View>
          {tx.isPending ? (
            <LoadingCards count={3} label="Loading transactions" />
          ) : tx.isError ? (
            <ErrorState compact error={tx.error} onRetry={() => void tx.refetch()} />
          ) : items.length === 0 ? (
            <View className="rounded-3xl border border-border bg-card">
              <EmptyState compact icon="document-text-outline" title="No transactions yet" message="Your coin purchases and spending will appear here." />
            </View>
          ) : (
            <View className="gap-2">
              {items.map((t) => (
                <TransactionRow key={t.id} tx={t} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function OverviewStat({ icon, tone, value, label }: { icon: React.ReactNode; tone: Tone; value: number | undefined; label: string }) {
  return (
    <View className="w-1/2 flex-row items-center pr-2">
      <View className={`mr-2.5 h-10 w-10 items-center justify-center rounded-xl ${TONE_BG[tone]}`}>{icon}</View>
      <View className="flex-1">
        <Text className="text-xl font-bold leading-6 text-text-heading" numberOfLines={1} adjustsFontSizeToFit>
          {value != null ? value.toLocaleString('en-IN') : '—'}
        </Text>
        <Text className="text-xs text-text-body" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function WhyBuyRow({ icon, tone, title, text }: { icon: IconName; tone: Tone; title: string; text: string }) {
  const color = useToneColor(tone);
  return (
    <View className="flex-row items-start">
      <View className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${TONE_BG[tone]}`}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-heading">{title}</Text>
        <Text className="mt-0.5 text-xs leading-[18px] text-text-body">{text}</Text>
      </View>
    </View>
  );
}

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View className="mb-3 mt-6 flex-row items-end justify-between">
      <Text className="text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="link" className="min-h-[32px] justify-center">
          <Text className="text-sm font-bold text-primary-ink">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
