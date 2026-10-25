/** Coin transaction types in plain words (same labels as the web wallet). */
const TYPE_LABEL: Record<string, string> = {
  PURCHASE: 'Coin purchase',
  UNLOCK_RESPONSE: 'Unlocked a response',
  FEATURE_LISTING: 'Featured listing',
  REFUND: 'Refund',
  BONUS: 'Bonus coins',
  ADMIN_ADJUSTMENT: 'Admin adjustment',
};

export function coinTransactionLabel(type: string): string {
  return TYPE_LABEL[type] ?? type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
