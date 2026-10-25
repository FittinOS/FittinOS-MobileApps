import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAvailableCoupons, useCouponHistory } from '@/api/queries';
import { Card, EmptyState, ErrorState, Header, LoadingCards, Screen, Segmented } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';

/** "20% OFF" / "₹100 OFF" — never re-derives the discount, only labels it. */
function discountLabel(discountType: 'PERCENTAGE' | 'FIXED', discountValue: number): string {
  return discountType === 'PERCENTAGE' ? `${discountValue}% OFF` : `${formatMoney(discountValue)} OFF`;
}

type Tab = 'available' | 'used';

export default function OffersScreen() {
  const [tab, setTab] = useState<Tab>('available');
  const available = useAvailableCoupons();
  const history = useCouponHistory();

  return (
    <>
      <Header title="Offers & coupons" />
      <Screen>
        <Segmented
          options={[
            { key: 'available', label: 'Available' },
            { key: 'used', label: 'My coupons' },
          ]}
          value={tab}
          onChange={setTab}
        />

        <View className="mt-4">
          {tab === 'available' ? (
            available.isPending ? (
              <LoadingCards count={3} />
            ) : available.isError ? (
              <ErrorState compact error={available.error} onRetry={() => void available.refetch()} />
            ) : available.data.length === 0 ? (
              <EmptyState icon="gift-outline" title="No offers available right now" message="Check back soon — new offers and coupons show up here as they go live." />
            ) : (
              <View className="gap-3">
                {available.data.map((offer) => (
                  <Card key={offer.id}>
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <View className="self-start rounded-full bg-primary-soft px-2.5 py-1">
                          <Text className="text-xs font-bold tracking-wide text-primary-ink">{offer.code}</Text>
                        </View>
                        <Text className="mt-2 text-base font-bold text-text-heading">{offer.name}</Text>
                        {offer.description ? <Text className="mt-1 text-sm text-text-body">{offer.description}</Text> : null}
                        {offer.minOrderAmount ? (
                          <Text className="mt-1 text-xs text-text-body">Minimum booking {formatMoney(offer.minOrderAmount)}</Text>
                        ) : null}
                        {offer.expiresAt ? <Text className="mt-1 text-xs text-text-body">Valid until {formatDate(offer.expiresAt)}</Text> : null}
                      </View>
                      <Text className="text-lg font-bold text-primary-ink">{discountLabel(offer.discountType, offer.discountValue)}</Text>
                    </View>
                  </Card>
                ))}
              </View>
            )
          ) : history.isPending ? (
            <LoadingCards count={3} />
          ) : history.isError ? (
            <ErrorState compact error={history.error} onRetry={() => void history.refetch()} />
          ) : history.data.used.length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" title="No coupons used yet" message="Coupons you apply at checkout will show up here with how much you saved." />
          ) : (
            <View className="gap-2">
              {history.data.used.map((u, idx) => (
                <Card key={`${u.code}-${u.bookingId}-${idx}`}>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-sm font-bold text-text-heading">{u.code}</Text>
                      <Text className="mt-0.5 text-xs text-text-body">{formatDate(u.usedAt)}</Text>
                    </View>
                    <Text className="text-sm font-bold text-success-ink">{formatMoney(u.discountAmount)} saved</Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </Screen>
    </>
  );
}
