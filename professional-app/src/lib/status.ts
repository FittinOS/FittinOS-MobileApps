import type { Tone } from '@/components/ui';
import { humanize } from './format';

/** Display mapping only — status values always come from the backend. */
const BOOKING: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  PAYMENT_PENDING: { label: 'Awaiting payment', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  NO_SHOW: { label: 'No-show', tone: 'danger' },
  REFUND_PENDING: { label: 'Refund pending', tone: 'warning' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
};

const VERIFICATION: Record<string, { label: string; tone: Tone }> = {
  NOT_SUBMITTED: { label: 'Not submitted', tone: 'neutral' },
  PENDING: { label: 'Under review', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

const SERVICE: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  ACTIVE: { label: 'Active', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'warning' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
};

const LEAD: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: 'New', tone: 'primary' },
  PENDING: { label: 'Responded', tone: 'warning' },
  CONTACTED: { label: 'Contacted', tone: 'info' },
  CONVERTED: { label: 'Converted', tone: 'success' },
};

// Same professional-side wording as apps/web/components/messaging/messaging-helpers.ts.
const CONVERSATION: Record<string, { label: string; tone: Tone }> = {
  AWAITING_PROFESSIONAL: { label: 'New lead', tone: 'primary' },
  RESPONSE_LOCKED: { label: 'Awaiting unlock', tone: 'warning' },
  UNLOCKED: { label: 'Active', tone: 'success' },
  DECLINED: { label: 'Declined', tone: 'neutral' },
};

const PAYOUT_ACCOUNT: Record<string, { label: string; tone: Tone }> = {
  NOT_VERIFIED: { label: 'Not verified', tone: 'neutral' },
  PENDING: { label: 'Verification pending', tone: 'warning' },
  VERIFIED: { label: 'Verified', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

const GENERIC_TONE: Record<string, Tone> = {
  CAPTURED: 'success',
  PAID: 'success',
  AVAILABLE: 'success',
  ACTIVE: 'success',
  COMPLETED: 'success',
  RESOLVED: 'success',
  PENDING: 'warning',
  PROCESSING: 'warning',
  CREATED: 'warning',
  OPEN: 'info',
  IN_PROGRESS: 'info',
  APPROVED: 'info',
  FAILED: 'danger',
  CANCELLED: 'danger',
  REVERSED: 'danger',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
  EXPIRED: 'neutral',
  CLOSED: 'neutral',
};

function lookup(table: Record<string, { label: string; tone: Tone }>, status: string | null | undefined) {
  if (!status) return { label: '—', tone: 'neutral' as Tone };
  return table[status] ?? { label: humanize(status), tone: GENERIC_TONE[status] ?? 'neutral' };
}

export const bookingStatus = (s?: string | null) => lookup(BOOKING, s);
export const verificationStatus = (s?: string | null) => lookup(VERIFICATION, s);
export const serviceStatus = (s?: string | null) => lookup(SERVICE, s);
export const leadStatus = (s?: string | null) => lookup(LEAD, s);
export const conversationStatus = (s?: string | null) => lookup(CONVERSATION, s);
export const payoutAccountStatus = (s?: string | null) => lookup(PAYOUT_ACCOUNT, s);
export const genericStatus = (s?: string | null) => lookup({}, s);
