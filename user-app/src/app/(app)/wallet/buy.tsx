import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi } from '@/api/endpoints';
import { useCoinPackages, useWallet, useWalletTransactions } from '@/api/queries';
import type { CoinPackageDto } from '@/api/shared';
import { Button, EmptyState, ErrorState, Header, LoadingCards, Skeleton, ThemedRefreshControl } from '@/components/ui';
import { CoinIcon } from '@/features/coins/CoinIcon';
import { CoinPackageCard } from '@/features/coins/CoinPackageCard';
import { TransactionRow } from '@/features/coins/TransactionRow';
import { CheckoutStatus } from '@/features/payments/CheckoutStatus';
import { newIdempotencyKey } from '@/features/payments/checkout-logic';
import { useCashfreeCheckout } from '@/features/payments/useCashfreeCheckout';
import { useTheme } from '@/theme/theme-provider';

type IconName = keyof typeof Ionicons.glyphMap;

const WHY_CHOOSE: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'flash', title: 'Instant credit', text: 'Coins land in your wallet as soon as payment is confirmed.' },
  { icon: 'shield-checkmark', title: '100% secure', text: 'Secure Cashfree payment gateway with encrypted transactions.' },
  { icon: 'infinite', title: 'No expiry', text: 'Coins never expire. Use them anytime.' },
  { icon: 'lock-open', title: 'Unlock more', text: 'Use coins to unlock professional responses to your requirements.' },
];

/**
 * Buy coins — package cards with their own Buy now (real order → Cashfree
 * checkout → backend verification), why-coins section and recent activity.
 * In Expo Go checkout is refused before any order is created.
 */
export default function BuyCoinsScreen() {
  const { colors } = useTheme();
  const packages = useCoinPackages();
  const wallet = useWallet();
  const recent = useWalletTransactions({ limit: 4 });
  const checkout = useCashfreeCheckout();
  const [buyingId, setBuyingId] = useState<string | null>(null);

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
      <Header title="Buy coins" />
      <ScrollView
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

          <View className="mt-4 rounded-3xl border border-border bg-card p-4">
            <Text className="mb-3 text-base font-bold text-text-heading" accessibilityRole="header">
              Why choose FittinOS coins?
            </Text>
            <View className="gap-3.5">
              {WHY_CHOOSE.map((f) => (
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

          <View className="mb-2.5 mt-6 flex-row items-end justify-between">
            <Text className="text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
              Recent coin activity
            </Text>
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
