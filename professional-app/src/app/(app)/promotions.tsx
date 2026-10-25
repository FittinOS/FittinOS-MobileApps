import { Text, View } from 'react-native';
import { usePromotionAnalytics, usePromotions } from '@/api/queries';
import { Badge, Card, EmptyState, ErrorState, Header, KeyValue, LoadingCards, Screen, SectionTitle } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { genericStatus } from '@/lib/status';

/** Read-only: admin-run offers that apply to this professional's services, and how they performed. */
export default function PromotionsScreen() {
  const promotions = usePromotions();
  const analytics = usePromotionAnalytics();

  return (
    <>
      <Header title="Promotions" />
      <Screen
        refreshing={promotions.isRefetching}
        onRefresh={() => {
          void promotions.refetch();
          void analytics.refetch();
        }}
      >
        <Text className="mb-1 text-sm text-text-body">
          Offers FittinOS runs that apply to your services, and how bookings made with them performed.
        </Text>

        {analytics.data ? (
          <>
            <SectionTitle title="Performance" />
            <Card>
              <KeyValue label="Promotional bookings" value={String(analytics.data.totalPromotionalBookings)} />
              <KeyValue label="Discount given to clients" value={formatMoney(analytics.data.totalDiscountAttributed)} />
              {analytics.data.totalProfessionalEarningAmount != null ? (
                <KeyValue label="Your earnings from these" value={formatMoney(analytics.data.totalProfessionalEarningAmount)} emphasize />
              ) : null}
            </Card>
            {analytics.data.byCoupon.length > 0 ? (
              <Card className="mt-3 p-0">
                {analytics.data.byCoupon.map((c, i) => (
                  <View key={c.code} className={`px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                    <Text className="text-sm font-semibold text-text-heading">
                      {c.code} · {c.name}
                    </Text>
                    <Text className="text-xs text-text-body">
                      {c.bookings} bookings · gross {formatMoney(c.grossValue)} · discount {formatMoney(c.discount)}
                      {c.professionalEarningAmount != null ? ` · you earned ${formatMoney(c.professionalEarningAmount)}` : ''}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : analytics.isError ? (
          <ErrorState compact error={analytics.error} onRetry={() => void analytics.refetch()} />
        ) : null}

        <SectionTitle title="Offers on your services" />
        {promotions.isPending ? (
          <LoadingCards count={3} label="Loading promotions" />
        ) : promotions.isError ? (
          <ErrorState error={promotions.error} onRetry={() => void promotions.refetch()} />
        ) : promotions.data.length === 0 ? (
          <EmptyState icon="pricetag-outline" title="No promotions right now" />
        ) : (
          <View className="gap-3">
            {promotions.data.map((p) => {
              const s = genericStatus(p.status);
              return (
                <Card key={p.id}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-bold text-primary-ink">{p.code}</Text>
                    <Badge label={s.label} tone={s.tone} />
                  </View>
                  <Text className="text-sm font-semibold text-text-heading">{p.name}</Text>
                  {p.description ? <Text className="mt-1 text-sm text-text-body">{p.description}</Text> : null}
                  <Text className="mt-2 text-sm text-text-heading">
                    {p.discountType === 'PERCENTAGE' ? `${p.discountValue}% off` : `${formatMoney(p.discountValue)} off`}
                    {p.service?.category?.name ? ` · ${p.service.category.name}` : p.category ? ` · ${p.category.name}` : ' · all your services'}
                  </Text>
                  {p.startsAt || p.expiresAt ? (
                    <Text className="text-xs text-text-body">
                      {p.startsAt ? `From ${formatDate(p.startsAt)}` : ''}
                      {p.expiresAt ? ` until ${formatDate(p.expiresAt)}` : ''}
                    </Text>
                  ) : null}
                </Card>
              );
            })}
          </View>
        )}
      </Screen>
    </>
  );
}
