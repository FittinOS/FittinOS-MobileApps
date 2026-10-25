import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi, plansApi } from '@/api/endpoints';
import { usePlanCouponOffers, usePlans, useProfile, useSubscription } from '@/api/queries';
import { BILLING_CYCLE_META, type BillingCycle, type ProfessionalPlanDto } from '@/api/shared';
import type { PlanCouponQuote } from '@/api/types';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, Header, InfoBanner, LoadingCards, Screen, SectionTitle, TextField } from '@/components/ui';
import { CheckoutStatus } from '@/features/payments/CheckoutStatus';
import { newIdempotencyKey } from '@/features/payments/checkout-logic';
import { useCashfreeCheckout } from '@/features/payments/useCashfreeCheckout';
import { cycleChoices, daysRemaining, planAction, resolveCycle } from '@/features/plans/plan-logic';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate, formatMoney } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

const money = (paise: number) => (paise === 0 ? 'Free' : formatMoney(paise));

export default function PlansScreen() {
  const { colors } = useTheme();
  const plans = usePlans();
  const subscription = useSubscription();
  const profile = useProfile();
  const offers = usePlanCouponOffers();
  const checkout = useCashfreeCheckout();
  const [picked, setPicked] = useState<BillingCycle | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, PlanCouponQuote>>({});
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [buyingPlanId, setBuyingPlanId] = useState<string | null>(null);
  const idem = useRef<{ key: string; signature: string } | null>(null);

  if (plans.isPending || profile.isPending) {
    return (
      <>
        <Header title="Subscription plans" />
        <View className="px-4 pt-4">
          <LoadingCards count={3} label="Loading plans" />
        </View>
      </>
    );
  }
  if (plans.isError) {
    return (
      <>
        <Header title="Subscription plans" />
        <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      </>
    );
  }

  const items = [...plans.data].filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const kycApproved = profile.data?.kycStatus === 'APPROVED';
  const choices = cycleChoices(items);
  const cycle = resolveCycle(choices, picked);
  const active = subscription.data && subscription.data.status === 'ACTIVE' ? subscription.data : null;
  const currentPlanIndex = items.findIndex((p) => p.id === active?.planId);
  const busy = checkout.state === 'OPENING' || checkout.state === 'PAYMENT_IN_PROGRESS';

  /** Asks the server what `code` takes off each paid plan for this billing period (web behaviour). */
  async function applyCoupon(code: string, forCycle: BillingCycle | null = cycle) {
    if (!forCycle || !code.trim()) return;
    setCheckingCoupon(true);
    setCouponMessage(null);
    const next: Record<string, PlanCouponQuote> = {};
    let firstError: string | null = null;
    let skipped = 0;
    for (const plan of items.filter((p) => p.type === 'PAID' && p.billingOptions?.some((o) => o.cycle === forCycle))) {
      try {
        next[plan.id] = await plansApi.validateCoupon({ professionalPlanId: plan.id, billingCycle: forCycle, couponCode: code.trim() });
      } catch (err) {
        skipped += 1;
        firstError = firstError ?? extractErrorMessage(err, "That coupon can't be applied.");
      }
    }
    setCheckingCoupon(false);
    if (Object.keys(next).length === 0) {
      setApplied(null);
      setQuotes({});
      setCouponMessage(firstError ?? "That coupon can't be applied.");
      return;
    }
    setApplied(code.trim());
    setQuotes(next);
    setCouponMessage(skipped > 0 ? 'This coupon does not apply to every plan or billing period.' : null);
  }

  function buy(plan: ProfessionalPlanDto) {
    if (!cycle) return;
    // A code is sent only for a plan the server quoted it for; the server decides the amount.
    const couponCode = applied && quotes[plan.id] ? applied : undefined;
    const signature = `${plan.id}:${cycle}:${couponCode ?? ''}`;
    if (idem.current?.signature !== signature) idem.current = { key: newIdempotencyKey(), signature };
    const key = idem.current.key;
    setBuyingPlanId(plan.id);
    void checkout.start(() =>
      paymentsApi.createOrder({
        purpose: 'PROFESSIONAL_SUBSCRIPTION',
        professionalPlanId: plan.id,
        billingCycle: cycle,
        ...(couponCode ? { couponCode } : {}),
        idempotencyKey: key,
      }),
    );
  }

  return (
    <>
      <Header title="Subscription plans" />
      <Screen
        refreshing={plans.isRefetching || subscription.isRefetching}
        onRefresh={() => {
          void plans.refetch();
          void subscription.refetch();
          void offers.refetch();
        }}
      >
        {active ? (
          <Card className="mb-2 border-primary">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase text-primary-ink">Current plan</Text>
              {active.planType === 'PAID' ? <Badge label={`${daysRemaining(active.endDate)} days left`} tone="info" /> : null}
            </View>
            <Text className="mt-1 text-xl font-bold text-text-heading">{active.planName}</Text>
            <Text className="text-sm text-text-body">
              {active.planType === 'FREE'
                ? 'Free plan — no expiry'
                : `${BILLING_CYCLE_META[active.billingCycle ?? 'MONTHLY'].label} · expires ${formatDate(active.endDate)}`}
            </Text>
          </Card>
        ) : subscription.isError ? (
          <View className="mb-2">
            <ErrorState compact error={subscription.error} onRetry={() => void subscription.refetch()} />
          </View>
        ) : subscription.data === null ? (
          <View className="mb-2">
            <InfoBanner message="You don't have an active plan. The Free plan is activated when your KYC is approved." />
          </View>
        ) : null}

        {!kycApproved ? (
          <View className="mb-2">
            <InfoBanner tone="warning" message="Plans can be bought once your KYC is approved." />
            <View className="mt-2">
              <Button title="Go to verification" variant="outline" size="sm" onPress={() => router.push('/verification')} />
            </View>
          </View>
        ) : null}

        {choices.length > 0 ? (
          <>
            <SectionTitle title="Billing period" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {choices.map((c) => (
                <Chip
                  key={c.cycle}
                  label={c.badge ? `${c.label} · ${c.badge}` : c.label}
                  selected={cycle === c.cycle}
                  onPress={() => {
                    setPicked(c.cycle);
                    if (applied) void applyCoupon(applied, c.cycle);
                  }}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        {kycApproved && items.some((p) => p.type === 'PAID') ? (
          <>
            <SectionTitle title="Offer code" />
            <Card>
              {applied ? (
                <View className="flex-row items-center">
                  <Ionicons name="pricetag" size={18} color={colors.success} />
                  <Text className="ml-2 flex-1 text-sm font-semibold text-text-heading">{applied} applied</Text>
                  <Button
                    title="Remove"
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    onPress={() => {
                      setApplied(null);
                      setQuotes({});
                      setCouponMessage(null);
                      idem.current = null;
                    }}
                  />
                </View>
              ) : (
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <TextField value={couponInput} onChangeText={(t) => setCouponInput(t.toUpperCase())} placeholder="Enter code" accessibilityLabel="Offer code" autoCapitalize="characters" maxLength={32} containerClassName="mb-0" />
                  </View>
                  <Button title="Apply" fullWidth={false} loading={checkingCoupon} disabled={couponInput.trim().length < 3 || busy} onPress={() => void applyCoupon(couponInput)} />
                </View>
              )}
              {couponMessage ? <Text className="mt-2 text-xs text-warning-ink">{couponMessage}</Text> : null}
              {!applied && offers.data && offers.data.length > 0 ? (
                <View className="mt-3">
                  <Text className="mb-1 text-xs font-semibold uppercase text-text-body">Available offers</Text>
                  {offers.data.map((o) => (
                    <Pressable
                      key={o.code}
                      onPress={() => {
                        setCouponInput(o.code);
                        void applyCoupon(o.code);
                      }}
                      className="mt-1 min-h-[44px] flex-row items-center rounded-xl border border-dashed border-primary px-3 py-2"
                      accessibilityRole="button"
                      accessibilityLabel={`Apply offer ${o.code}`}
                    >
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-primary-ink">{o.code}</Text>
                        <Text className="text-xs text-text-body">
                          {o.name}
                          {o.expiresAt ? ` · until ${formatDate(o.expiresAt)}` : ''}
                        </Text>
                      </View>
                      <Text className="text-sm font-semibold text-primary-ink">Apply</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Card>
          </>
        ) : null}

        <SectionTitle title="Plans" />
        {items.length === 0 ? (
          <EmptyState icon="ribbon-outline" title="No plans available" message="Check back later." />
        ) : (
          <View className="gap-3">
            {items.map((plan, index) => {
              const option = plan.type === 'PAID' ? plan.billingOptions?.find((o) => o.cycle === cycle) : undefined;
              const action = planAction({ plan, index, cycle, activeSubscription: active, currentPlanIndex });
              const quote = applied ? quotes[plan.id] : undefined;
              const isCurrent = active?.planId === plan.id;
              return (
                <Card key={plan.id} className={plan.badge && !isCurrent ? 'border-2 border-primary' : isCurrent ? 'border-2 border-success' : ''}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-bold text-text-heading">{plan.name}</Text>
                    {isCurrent ? <Badge label="Current" tone="success" /> : plan.badge ? <Badge label={plan.badge} tone="primary" /> : null}
                  </View>
                  {plan.description ? <Text className="mt-1 text-sm text-text-body">{plan.description}</Text> : null}
                  <View className="mt-2 flex-row items-end">
                    {option?.offer && !quote ? (
                      <>
                        <Text className="mr-1.5 mb-1 text-sm text-text-body line-through">{money(option.offer.originalPriceAmount)}</Text>
                        <Text className="text-2xl font-bold text-success-ink">{money(option.offer.finalPriceAmount)}</Text>
                      </>
                    ) : (
                      <Text className="text-2xl font-bold text-text-heading">{plan.type === 'FREE' ? 'Free' : option ? money(option.priceAmount) : '—'}</Text>
                    )}
                    {option ? <Text className="mb-1 ml-1 text-sm text-text-body">/ {option.label.toLowerCase()}</Text> : null}
                  </View>
                  {option && option.months > 1 ? (
                    <Text className="text-xs text-text-body">
                      {formatMoney(option.effectiveMonthlyAmount)}/month
                      {option.savingsAmount > 0 ? ` · save ${formatMoney(option.savingsAmount)}` : ''}
                    </Text>
                  ) : null}
                  {option?.offer && !quote ? (
                    <Text className="mt-1 text-sm font-semibold text-success-ink">
                      {option.offer.title}
                      {option.offer.description ? ` — ${option.offer.description}` : ''}
                    </Text>
                  ) : null}
                  {(!quote && option?.offer?.bonusCoins != null ? option.offer.bonusCoins : plan.bonusCoins) > 0 ? (
                    <Text className="mt-1 text-sm font-semibold text-success-ink">
                      +{!quote && option?.offer?.bonusCoins != null ? option.offer.bonusCoins : plan.bonusCoins} bonus coins
                    </Text>
                  ) : null}
                  <View className="mt-3">
                    {[...plan.featureTags]
                      .filter((t) => t.enabled)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((t) => (
                        <View key={t.key} className="mb-1 flex-row items-start">
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginTop: 2 }} />
                          <Text className="ml-2 flex-1 text-sm text-text-heading">
                            {t.label}
                            {t.value ? `: ${t.value}` : ''}
                          </Text>
                        </View>
                      ))}
                    {plan.features.map((f) => (
                      <View key={f} className="mb-1 flex-row items-start">
                        <Ionicons name="checkmark" size={16} color={colors.body} style={{ marginTop: 2 }} />
                        <Text className="ml-2 flex-1 text-sm text-text-body">{f}</Text>
                      </View>
                    ))}
                  </View>
                  <View className="mt-3">
                    {action.kind === 'current' ? (
                      <Button title="Current plan" disabled variant="outline" />
                    ) : action.kind === 'free' ? (
                      <Button title="Activated on KYC approval" disabled variant="outline" />
                    ) : action.kind === 'unavailable' ? (
                      <Button title="Unavailable for this period" disabled variant="outline" />
                    ) : (
                      <>
                        <Button
                          title={action.label}
                          disabled={!kycApproved || busy}
                          loading={busy && buyingPlanId === plan.id}
                          onPress={() => buy(plan)}
                        />
                        {quote && option ? (
                          <Text className="mt-2 text-center text-sm text-text-heading">
                            With {quote.code}: <Text className="font-bold">{money(quote.finalAmount)}</Text>{' '}
                            <Text className="text-text-body line-through">{money(quote.originalAmount)}</Text>
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
        <Text className="mt-4 text-center text-xs text-text-body">
          Prices, durations and bonus coins are set by FittinOS and charged exactly as shown at checkout. Payments are processed by Cashfree.
        </Text>
      </Screen>
      <CheckoutStatus
        checkout={checkout}
        successTitle="Plan activated"
        successMessage="Your payment was confirmed and your plan is active."
        onDone={() => {
          idem.current = null;
          setBuyingPlanId(null);
          void subscription.refetch();
        }}
      />
    </>
  );
}
