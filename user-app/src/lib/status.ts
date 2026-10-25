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

const REQUIREMENT: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: 'Open', tone: 'primary' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  FULFILLED: { label: 'Fulfilled', tone: 'success' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
};

// Client-side wording — mirrors apps/web/components/messaging/messaging-helpers.ts's
// CLIENT_STATUS_LABEL (the professional sees different wording for the same statuses).
const CONVERSATION: Record<string, { label: string; tone: Tone }> = {
  AWAITING_PROFESSIONAL: { label: 'Waiting for response', tone: 'info' },
  RESPONSE_LOCKED: { label: 'Response received', tone: 'warning' },
  UNLOCKED: { label: 'Active', tone: 'success' },
  DECLINED: { label: 'Declined', tone: 'danger' },
};

// Mirrors the backend's TrackingEligibility (apps/backend/src/bookings/
// booking-tracking.service.ts) — the client never computes eligibility
// itself, only labels whatever the server returned.
const TRACKING: Record<string, { label: string; tone: Tone }> = {
  NOT_YET_AVAILABLE: { label: 'Tracking opens closer to your session', tone: 'neutral' },
  WAITING: { label: 'Waiting for your professional to start sharing', tone: 'warning' },
  LIVE: { label: 'Live', tone: 'success' },
  STALE: { label: "Hasn't updated in a while", tone: 'warning' },
  STOPPED: { label: 'Sharing stopped', tone: 'neutral' },
  COMPLETED: { label: 'Session completed', tone: 'neutral' },
  NO_DATA: { label: 'No location shared yet', tone: 'neutral' },
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
export const requirementStatus = (s?: string | null) => lookup(REQUIREMENT, s);
export const conversationStatus = (s?: string | null) => lookup(CONVERSATION, s);
export const trackingStatus = (s?: string | null) => lookup(TRACKING, s);
export const genericStatus = (s?: string | null) => lookup({}, s);
