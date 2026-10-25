import { Text, View } from 'react-native';
import { router, useSegments } from 'expo-router';
import { useWallet, useWalletTransactions } from '@/api/queries';
import { Button, EmptyState, ErrorState, GlowHeroCard, Header, LoadingCards, Screen, Skeleton } from '@/components/ui';
import { CoinIcon } from '@/features/coins/CoinIcon';
import { TransactionRow } from '@/features/coins/TransactionRow';

export default function WalletScreen() {
  const wallet = useWallet();
  const transactions = useWalletTransactions({ limit: 20 });
  // `router.canGoBack()` reflects the whole nav history, not whether THIS
  // mount is the active tab root — it can be true even on the tab (e.g.
  // after visiting other tabs). The route's own file segments tell the two
  // mounts apart reliably: the tab mount's path always runs through (tabs).
  // Cast to string[]: this file backs two different routes, so expo-router's
  // typed-routes generic can't infer one static segments tuple for it.
  const isTabRoot = (useSegments() as string[]).includes('(tabs)');

  return (
    <>
      <Header title="Wallet" showBack={!isTabRoot} />
      <Screen
        refreshing={wallet.isRefetching}
        onRefresh={() => {
          void wallet.refetch();
          void transactions.refetch();
        }}
      >
        <GlowHeroCard glow={false}>
          <View className="flex-row items-center">
            <CoinIcon size={40} />
            <Text className="ml-3 text-[15px] font-semibold text-white/90">FittinOS Coins</Text>
          </View>
          {wallet.isPending ? (
            <View className="mt-3 w-32">
              <Skeleton height={36} />
            </View>
          ) : wallet.isError ? (
            <Text className="mt-3 text-sm text-white/80">Couldn&apos;t load. Pull down to retry.</Text>
          ) : (
            <Text className="mt-3 text-[34px] font-bold tracking-tight text-white">{wallet.data.coinBalance.toLocaleString('en-IN')} coins</Text>
          )}
          <View className="mt-4">
            <Button title="Buy coins" onPress={() => router.push('/(app)/wallet/buy')} />
          </View>
        </GlowHeroCard>

        <Text className="mb-2.5 mt-6 text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
          Transaction history
        </Text>
        {transactions.isPending ? (
          <LoadingCards count={3} />
        ) : transactions.isError ? (
          <ErrorState compact error={transactions.error} onRetry={() => void transactions.refetch()} />
        ) : transactions.data.items.length === 0 ? (
          <EmptyState compact icon="receipt-outline" title="No transactions yet" />
        ) : (
          <View className="gap-2">
            {transactions.data.items.map((t) => (
              <TransactionRow key={t.id} tx={t} />
            ))}
          </View>
        )}
      </Screen>
    </>
  );
}
