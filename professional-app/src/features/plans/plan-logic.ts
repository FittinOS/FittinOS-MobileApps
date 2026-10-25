import { BILLING_CYCLES, BILLING_CYCLE_META, type BillingCycle, type ProfessionalPlanDto, type ProfessionalSubscriptionDto } from '@/api/shared';

/**
 * Display rules for the plans screen — identical to the web plans page.
 * Every price comes from the backend's billingOptions; nothing here prices anything.
 */
export interface CycleChoice {
  cycle: BillingCycle;
  label: string;
  badge?: string;
}

/** The cycles at least one PAID plan actively sells, in canonical order, with the best discount as a badge. */
export function cycleChoices(plans: ProfessionalPlanDto[]): CycleChoice[] {
  const options = plans.filter((p) => p.type === 'PAID').flatMap((p) => p.billingOptions ?? []);
  return BILLING_CYCLES.filter((c) => options.some((o) => o.cycle === c)).map((c) => {
    const discounts = options.filter((o) => o.cycle === c).map((o) => o.discountPercent);
    const best = Math.max(...discounts);
    const allSame = discounts.every((d) => d === best);
    return { cycle: c, label: BILLING_CYCLE_META[c].label, badge: best > 0 ? (allSame ? `${best}% OFF` : `Up to ${best}% OFF`) : undefined };
  });
}

/** The picked cycle if still offered, else Monthly, else the first offered. */
export function resolveCycle(choices: CycleChoice[], picked: BillingCycle | null): BillingCycle | null {
  return choices.find((c) => c.cycle === picked)?.cycle ?? choices.find((c) => c.cycle === 'MONTHLY')?.cycle ?? choices[0]?.cycle ?? null;
}

/** A subscription bought before billing cycles existed was monthly. */
export function subscriptionCycle(sub: Pick<ProfessionalSubscriptionDto, 'billingCycle'> | null | undefined): BillingCycle {
  return sub?.billingCycle ?? 'MONTHLY';
}

export type PlanAction =
  | { kind: 'current' }
  | { kind: 'free' }
  | { kind: 'unavailable' }
  | { kind: 'buy'; label: string };

export function planAction(input: {
  plan: ProfessionalPlanDto;
  index: number;
  cycle: BillingCycle | null;
  activeSubscription: ProfessionalSubscriptionDto | null;
  currentPlanIndex: number;
}): PlanAction {
  const { plan, index, cycle, activeSubscription, currentPlanIndex } = input;
  const isCurrent = !!activeSubscription && plan.id === activeSubscription.planId;
  const isPaid = plan.type === 'PAID';
  const option = isPaid ? plan.billingOptions?.find((o) => o.cycle === cycle) : undefined;
  if (isCurrent && (!isPaid || subscriptionCycle(activeSubscription) === cycle)) return { kind: 'current' };
  // The Free plan is granted on KYC approval, never bought.
  if (!isPaid) return { kind: 'free' };
  if (!option) return { kind: 'unavailable' };
  if (isCurrent) return { kind: 'buy', label: `Switch to ${option.label}` };
  return { kind: 'buy', label: currentPlanIndex > index ? 'Switch plan' : 'Upgrade' };
}

export function daysRemaining(endDateIso: string, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(endDateIso).getTime() - now) / 86_400_000));
}
