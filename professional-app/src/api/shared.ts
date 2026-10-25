/**
 * Single import point for the monorepo's shared contract types, so screens
 * never reach into packages/ directly.
 */
export * from '@fittin/shared-types';

/** Not exported by shared-types; mirrors apps/web/hooks/useApi.ts. */
export type CouponDiscountType = 'FIXED' | 'PERCENTAGE';
