import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi } from '@/api/endpoints';
import { useCoinPackages, useWallet, useWalletTransactions } from '@/api/queries';
import type { CoinPackageDto } from '@/api/shared';
import { Button, EmptyState, ErrorState, Header, LinkText, LoadingCards, Skeleton, ThemedRefreshControl } from '@/components/ui';
import { CoinIcon } from '@/features/coins/CoinIcon';
import { CoinPackageCard } from '@/features/coins/CoinPackageCard';
import { TransactionRow } from '@/features/coins/TransactionRow';
import { CheckoutStatus } from '@/features/payments/CheckoutStatus';
import { newIdempotencyKey } from '@/features/payments/checkout-logic';
import { useCashfreeCheckout } from '@/features/payments/useCashfreeCheckout';
import { useTheme } from '@/theme/theme-provider';

type IconName = keyof typeof Ionicons.glyphMap;

// Same sections and copy as the web's Buy Coins page.
const GROWTH_POINTS = ['Increase your visibility in search', 'Get more booking requests', 'Access exclusive professional offers'];
const WHY_CHOOSE: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'trending-up', title: 'Higher visibility', text: 'Get more service requests' },
  { icon: 'ribbon', title: 'Featured badge', text: 'Stand out to customers' },
  { icon: 'gift', title: 'Exclusive offers', text: 'Special campaigns for professionals' },
  { icon: 'people', title: 'More bookings', text: 'Grow your business' },
];
const PURCHASE_FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'flash', title: 'Instant credit', text: 'Coins are added to your wallet as soon as the payment is confirmed.' },
  { icon: 'shield-checkmark', title: '100% secure', text: 'Secure Cashfree payment gateway with encrypted transactions.' },
  { icon: 'infinite', title: 'No expiry', text: 'Coins never expire. Use them anytime.' },
  { icon: 'refresh', title: 'Easy refunds', text: "Hassle-free refunds if there's any issue." },
];

/**
 * Buy coins — the web's Coin Packages page: swipeable package cards with
 * their own Buy now (real order → Cashfree checkout → backend verification,
 * unchanged), then the growth banner, why coins, purchase features and recent
 * coin activity. In Expo Go checkout is refused before any order is created.
 */
export default function BuyCoinsScreen() {
  const { colors } = useTheme();
  const packages = useCoinPackages();
  const wallet = useWallet();
  const recent = useWalletTransactions({ limit: 4 });
  const checkout = useCashfreeCheckout();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const busy = checkout.state === 'OPENING' || checkout.state === 'PAYMENT_IN_PROGRESS';
  const sorted = useMemo(
    () => [...(packages.data ?? [])].filter((p) => p.isActive).sort((a, b) => b.priceAmount - a.priceAmount),
    [packages.data],
  );

  function buy(pkg: CoinPackageDto) {
    setBuyingId(pkg.id);
    const idempotencyKey = newIdempotencyKey();
    void checkout.start(() => paymentsApi.createOrder({ purpose: 'COIN_PACKAGE', coinPackageId: pkg.id, idempotencyKey }));
  }

  return (
    <>
      <Header title="Coin packages" />
      <ScrollView
        ref={scrollRef}
        className="flex-1 bg-background"
        contentContainerClassName="pb-10 pt-4"
        refreshControl={
          <ThemedRefreshControl
            refreshing={packages.isRefetching}
            onRefresh={() => {
              void packages.refetch();
              void wallet.refetch();
              void recent.refetch();
            }}
          />
        }
      >
        <View className="px-4">
          <Text className="text-sm text-text-body">Choose a package and get more value</Text>
          <View className="mt-2 flex-row items-center self-start rounded-full border border-border bg-card px-3 py-1.5">
            <CoinIcon size={18} />
            {wallet.data ? (
              <Text className="ml-1.5 text-sm font-semibold text-text-heading">Balance: {wallet.data.coinBalance.toLocaleString('en-IN')} coins</Text>
            ) : (
              <View className="ml-1.5 w-24">
                <Skeleton height={14} />
              </View>
            )}
          </View>
        </View>

        {/* Package cards — swipe sideways, like the web on phones. */}
        {packages.isPending ? (
          <View className="mt-4 px-4">
            <LoadingCards count={1} label="Loading coin packages" />
          </View>
        ) : packages.isError ? (
          <ErrorState error={packages.error} onRetry={() => void packages.refetch()} />
        ) : sorted.length === 0 ? (
          <View className="mx-4 mt-4 rounded-3xl border border-border bg-card">
            <EmptyState icon="file-tray-outline" title="No coin packages available" message="Check back later." />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={162}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, gap: 12 }}
          >
            {sorted.map((p) => (
              <View key={p.id} style={{ width: 150 }}>
                <CoinPackageCard pkg={p} onBuy={buy} buying={busy && buyingId === p.id} disabled={busy} />
              </View>
            ))}
          </ScrollView>
        )}

        <View className="px-4">
          <View className="mt-3 flex-row items-center">
            <Ionicons name="lock-closed" size={13} color={colors.body} />
            <Text className="ml-1.5 text-xs text-text-body">Your payment information is 100% secure and encrypted.</Text>
          </View>

          {/* Growth banner */}
          <View className="mt-5 flex-row items-start rounded-3xl border border-primary/20 bg-primary-soft p-4">
            <View className="mr-3 flex-1">
              <Text className="text-base font-bold leading-snug text-text-heading">More bookings. More growth.</Text>
              <View className="mt-2.5 gap-1.5">
                {GROWTH_POINTS.map((point) => (
                  <View key={point} className="flex-row items-start">
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginTop: 2 }} />
                    <Text className="ml-1.5 flex-1 text-xs leading-[18px] text-text-body">{point}</Text>
                  </View>
                ))}
              </View>
              <View className="mt-3">
                <Button title="Explore packages" size="sm" icon="arrow-forward" fullWidth={false} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
              </View>
            </View>
            <View className="self-center" style={{ width: 64, height: 64 }} accessible={false}>
              <View style={{ position: 'absolute', left: 0, bottom: 0 }}>
                <CoinIcon size={56} />
              </View>
              <View className="absolute right-0 top-0 h-6 w-6 items-center justify-center rounded-full bg-action">
                <Ionicons name="trending-up" size={13} color="#FFFFFF" />
              </View>
            </View>
          </View>

          {/* Why choose coins */}
          <View className="mt-4 rounded-3xl border border-border bg-card p-4">
            <Text className="mb-3 text-base font-bold text-text-heading" accessibilityRole="header">
              Why choose FittinOS coins?
            </Text>
            <View className="flex-row flex-wrap" style={{ rowGap: 14 }}>
              {WHY_CHOOSE.map((w) => (
                <View key={w.title} className="w-1/2 items-center px-1.5">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                    <Ionicons name={w.icon} size={17} color={colors.primary} />
                  </View>
                  <Text className="mt-1.5 text-center text-xs font-semibold text-text-heading">{w.title}</Text>
                  <Text className="mt-0.5 text-center text-[11px] leading-4 text-text-body">{w.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Purchase features */}
          <View className="mt-4 rounded-3xl border border-border bg-card p-4">
            <Text className="mb-3 text-base font-bold text-text-heading" accessibilityRole="header">
              Coin purchase features
            </Text>
            <View className="gap-3.5">
              {PURCHASE_FEATURES.map((f) => (
                <View key={f.title} className="flex-row items-start">
                  <View className="mr-3 h-9 w-9 items-center justify-center rounded-lg bg-primary-soft">
                    <Ionicons name={f.icon} size={16} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-text-heading">{f.title}</Text>
                    <Text className="mt-0.5 text-xs leading-[18px] text-text-body">{f.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Recent coin activity */}
          <View className="mb-2.5 mt-6 flex-row items-end justify-between">
            <Text className="text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
              Recent coin activity
            </Text>
            <LinkText label="View all" onPress={() => router.back()} />
          </View>
          {recent.isPending ? (
            <LoadingCards count={2} label="Loading recent activity" />
          ) : recent.isError ? (
            <ErrorState compact error={recent.error} onRetry={() => void recent.refetch()} />
          ) : recent.data.items.length === 0 ? (
            <View className="rounded-3xl border border-border bg-card">
              <EmptyState compact icon="document-text-outline" title="No activity yet" message="Your coin purchases and spending will appear here." />
            </View>
          ) : (
            <View className="gap-2">
              {recent.data.items.map((t) => (
                <TransactionRow key={t.id} tx={t} />
              ))}
            </View>
          )}

          {/* No promo-code system exists on the backend yet — a disabled placeholder, as on the web. */}
          <View className="mt-5">
            <Button title="Have a promo code? (Coming soon)" variant="outline" disabled onPress={() => undefined} />
          </View>
        </View>
      </ScrollView>
      <CheckoutStatus
        checkout={checkout}
        successTitle="Coins added"
        successMessage="Your payment was confirmed and the coins are in your wallet."
        onDone={() => {
          setBuyingId(null);
          router.back();
        }}
      />
    </>
  );
}
