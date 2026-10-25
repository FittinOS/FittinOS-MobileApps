import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { featuredApi } from '@/api/endpoints';
import { qk, useFeaturedMine, useFeaturedPlans, useInvalidate, useServices, useWallet } from '@/api/queries';
import type { ServiceDto } from '@/api/shared';
import { Badge, Button, Card, EmptyState, ErrorState, Header, InfoBanner, KeyValue, LoadingCards, Screen, SectionTitle, Sheet } from '@/components/ui';
import { newIdempotencyKey } from '@/features/payments/checkout-logic';
import { extractErrorMessage } from '@/lib/errors';
import { CoinIcon } from '@/features/coins/CoinIcon';
import { formatCoins, formatDate } from '@/lib/format';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

export default function FeaturedListingsScreen() {
  const { colors } = useTheme();
  const plans = useFeaturedPlans();
  const mine = useFeaturedMine();
  const services = useServices();
  const wallet = useWallet();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [service, setService] = useState<ServiceDto | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const purchaseKey = useRef('');

  const purchase = useMutation({
    mutationFn: () => featuredApi.purchaseWithCoins({ serviceId: service!.id, planId: planId!, idempotencyKey: purchaseKey.current }),
    onSuccess: () => {
      toast.show('Your service is now featured.');
      setService(null);
      void invalidate(qk.wallet, ['wallet'], qk.featuredMine, qk.services);
    },
    onError: (err) => setError(extractErrorMessage(err, 'Could not feature this service.')),
  });

  if (plans.isPending || services.isPending) {
    return (
      <>
        <Header title="Featured listings" />
        <View className="px-4 pt-4">
          <LoadingCards count={3} label="Loading featured listings" />
        </View>
      </>
    );
  }
  if (plans.isError) {
    return (
      <>
        <Header title="Featured listings" />
        <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      </>
    );
  }
  if (services.isError) {
    return (
      <>
        <Header title="Featured listings" />
        <ErrorState error={services.error} onRetry={() => void services.refetch()} />
      </>
    );
  }

  const coinPlans = plans.data.filter((p) => p.isActive && p.coinCost != null);
  const activeServices = services.data.items.filter((s) => s.status === 'ACTIVE');
  const activeListings = (mine.data?.items ?? []).filter((l) => l.isActive);
  const balance = wallet.data?.coinBalance ?? 0;
  const selectedPlan = coinPlans.find((p) => p.id === planId) ?? null;
  const insufficient = selectedPlan ? balance < (selectedPlan.coinCost ?? 0) : false;

  return (
    <>
      <Header title="Featured listings" />
      <Screen
        refreshing={mine.isRefetching}
        onRefresh={() => {
          void plans.refetch();
          void mine.refetch();
          void wallet.refetch();
        }}
      >
        <Card className="flex-row items-center">
          <Ionicons name="rocket" size={26} color={colors.primary} />
          <View className="ml-3 flex-1">
            <Text className="text-sm text-text-heading">Featured services are shown first when clients browse services.</Text>
            <View className="mt-1.5 flex-row items-center">
              <CoinIcon size={16} />
              <Text className="ml-1 text-xs font-semibold text-text-heading">Balance: {formatCoins(balance)}</Text>
            </View>
          </View>
        </Card>

        <SectionTitle title="Active featured listings" />
        {activeListings.length === 0 ? (
          <Card>
            <EmptyState compact icon="rocket-outline" title="No active featured listings" message="Feature a service below to get shown first." />
          </Card>
        ) : (
          <Card className="p-0">
            {activeListings.map((l, i) => (
              <View key={l.id} className={`px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                <View className="flex-row items-center justify-between">
                  <Text className="mr-2 flex-1 text-sm font-semibold text-text-heading">{l.serviceTitle}</Text>
                  <Badge label={l.planName} tone="primary" />
                </View>
                <Text className="text-xs text-text-body">
                  {formatDate(l.featuredFrom)} – {formatDate(l.featuredUntil)}
                  {l.paidCoins != null ? ` · ${formatCoins(l.paidCoins)}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <SectionTitle title="Feature a service" />
        {activeServices.length === 0 ? (
          <EmptyState icon="barbell-outline" title="No active services" message="Activate a service first to feature it." actionLabel="My services" onAction={() => router.push('/services')} />
        ) : (
          <View className="gap-3">
            {activeServices.map((s) => (
              <Card key={s.id} className="flex-row items-center">
                <View className="mr-3 flex-1">
                  <Text className="text-sm font-semibold text-text-heading">{s.title}</Text>
                  {s.isFeatured && s.featuredUntil ? <Text className="text-xs text-primary-ink">Featured until {formatDate(s.featuredUntil)}</Text> : null}
                </View>
                <Button
                  title="Feature"
                  size="sm"
                  fullWidth={false}
                  disabled={coinPlans.length === 0}
                  onPress={() => {
                    purchaseKey.current = newIdempotencyKey();
                    setError(null);
                    setPlanId(coinPlans[0]?.id ?? null);
                    setService(s);
                  }}
                />
              </Card>
            ))}
          </View>
        )}
      </Screen>

      <Sheet visible={!!service} title="Feature this service" onClose={() => setService(null)}>
        <Text className="mb-3 text-base font-semibold text-text-heading">{service?.title}</Text>
        {error ? (
          <View className="mb-3">
            <InfoBanner tone="danger" message={error} icon="alert-circle" />
          </View>
        ) : null}
        <View className="gap-2">
          {coinPlans.map((p) => {
            const selected = p.id === planId;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlanId(p.id)}
                className={`min-h-[56px] flex-row items-center rounded-xl border px-4 py-2 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-heading">{p.name}</Text>
                  <Text className="text-xs text-text-body">{p.durationDays} days</Text>
                </View>
                <View className="flex-row items-center">
                  <CoinIcon size={18} />
                  <Text className="ml-1 font-bold text-primary-ink">{formatCoins(p.coinCost)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {selectedPlan ? (
          <Card className="mt-3">
            <KeyValue label="Current balance" value={formatCoins(balance)} />
            <KeyValue label="Cost" value={formatCoins(selectedPlan.coinCost)} />
            <KeyValue label="Balance after" value={formatCoins(balance - (selectedPlan.coinCost ?? 0))} emphasize />
          </Card>
        ) : null}
        {insufficient ? (
          <View className="mt-3">
            <InfoBanner tone="warning" message={`This needs ${formatCoins(selectedPlan?.coinCost)}; you have ${formatCoins(balance)}.`} />
            <View className="mt-2">
              <Button title="Buy coins" variant="outline" onPress={() => { setService(null); router.push('/wallet/buy'); }} />
            </View>
          </View>
        ) : null}
        <View className="mt-4">
          <Button title="Confirm purchase" loading={purchase.isPending} disabled={!planId || insufficient} onPress={() => purchase.mutate()} />
        </View>
        <View className="h-4" />
      </Sheet>
    </>
  );
}
