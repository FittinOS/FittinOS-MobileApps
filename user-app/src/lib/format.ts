/**
 * Display-only formatting. Money arrives from the backend as integer paise
 * and is only ever divided for display here — never used for any decision.
 * Dates are shown in India Standard Time, matching the web and the
 * backend's reports.
 */
const IST = 'Asia/Kolkata';

export function formatMoney(paise: number | null | undefined, opts: { decimals?: boolean } = {}): string {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return '—';
  const rupees = paise / 100;
  const hasFraction = Math.round(paise) % 100 !== 0;
  const digits = opts.decimals || hasFraction ? 2 : 0;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatCoins(coins: number | null | undefined): string {
  if (coins === null || coins === undefined) return '—';
  return `${coins.toLocaleString('en-IN')} ${Math.abs(coins) === 1 ? 'coin' : 'coins'}`;
}

/** Converts a rupee amount typed by the user to integer paise, or null if it isn't a valid amount. */
export function rupeesToPaise(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

export function paiseToRupeesInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '';
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return toDate(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST });
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return toDate(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = toDate(value);
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: IST });
  return `${day} · ${formatTime(d)}`;
}

/** "just now", "5m ago", "3h ago", "2d ago", else a date. */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const diffMs = now.getTime() - toDate(value).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m} min`;
}

export function formatCallDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** SNAKE_CASE enum → "Snake case". */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}
