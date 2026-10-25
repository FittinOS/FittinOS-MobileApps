/**
 * Earnings by calendar month (device local time) for the Earnings chart.
 * REVERSED earnings are excluded — they were taken back. Callers must only
 * chart this when they hold every earning record (no further pages), so a
 * month total is never a partial sum.
 */
export interface MonthBucket {
  key: string;
  label: string;
  /** Integer paise. */
  amount: number;
}

export function monthlyEarnings(
  items: Array<{ amount: number; status: string; createdAt: string }>,
  months = 6,
  now: Date = new Date(),
): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      amount: 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const item of items) {
    if (item.status === 'REVERSED') continue;
    const d = new Date(item.createdAt);
    const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.amount += item.amount;
  }
  return buckets;
}

/**
 * Percent change this month vs last month; null when either month has nothing
 * (a "-100%" on the 1st of the month would only alarm, not inform).
 */
export function monthOverMonth(buckets: MonthBucket[]): number | null {
  if (buckets.length < 2) return null;
  const last = buckets[buckets.length - 2].amount;
  const current = buckets[buckets.length - 1].amount;
  if (last <= 0 || current <= 0) return null;
  return Math.round(((current - last) / last) * 100);
}
