/**
 * Turns "this day, these time ranges, optionally repeating weekly" into the
 * concrete slots to create — same rules as the web availability page.
 * Times are wall-clock times on the device (the professional's local time).
 */
export interface TimeRange {
  /** "HH:MM" 24h */
  start: string;
  end: string;
}

export interface PlannedSlot {
  startTime: Date;
  endTime: Date;
}

export type SlotPlanResult = { ok: true; slots: PlannedSlot[] } | { ok: false; error: string };

export const FULL_DAY: TimeRange = { start: '00:00', end: '23:59' };

function combine(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function isValidTime(hhmm: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [h, m] = hhmm.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function planSlots(input: { date: Date; ranges: TimeRange[]; repeatWeeks?: number | null; now?: Date }): SlotPlanResult {
  const { date, ranges } = input;
  const now = input.now ?? new Date();
  if (ranges.length === 0) return { ok: false, error: 'Add at least one time slot.' };
  for (const r of ranges) {
    if (!isValidTime(r.start) || !isValidTime(r.end)) return { ok: false, error: 'Enter times as HH:MM.' };
    if (r.end <= r.start) return { ok: false, error: 'Each slot’s end time must be after its start time.' };
  }
  const weeks = input.repeatWeeks ?? 1;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) return { ok: false, error: 'Enter a number of weeks between 1 and 12.' };

  const dates: Date[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i * 7);
    dates.push(d);
  }
  const slots = dates.flatMap((d) => ranges.map((r) => ({ startTime: combine(d, r.start), endTime: combine(d, r.end) })));
  if (slots[0].startTime.getTime() <= now.getTime()) return { ok: false, error: 'Availability cannot be created in the past.' };
  return { ok: true, slots };
}

/** Groups slots by local calendar day, earliest first, dropping ones that already ended. */
export function groupByDay<T extends { startTime: string; endTime: string }>(slots: T[], now: Date = new Date()): Array<{ day: string; slots: T[] }> {
  const upcoming = slots
    .filter((s) => new Date(s.endTime).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const groups = new Map<string, T[]>();
  for (const s of upcoming) {
    const d = new Date(s.startTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, slots: list }));
}
