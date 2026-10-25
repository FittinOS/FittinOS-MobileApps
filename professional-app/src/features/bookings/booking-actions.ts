/**
 * Which actions a professional is offered on a booking — the same rules the
 * web bookings table uses (apps/web/app/professional/(workspace)/bookings).
 * The backend re-checks every one of them; this only decides what to show.
 */
export interface BookingActions {
  track: boolean;
  start: boolean;
  reschedule: boolean;
  complete: boolean;
  reportNoShow: boolean;
  /** Mirrors the backend's CANCELLABLE_STATUSES (PENDING, PAYMENT_PENDING, CONFIRMED) — see bookings.service.ts. */
  cancel: boolean;
}

const NO_SHOW_WINDOW_MS = 48 * 60 * 60 * 1000;
const CANCELLABLE_STATUSES = new Set(['PENDING', 'PAYMENT_PENDING', 'CONFIRMED']);

export function bookingActions(
  booking: { status: string; startTime: string; endTime: string },
  nowMs: number = Date.now(),
): BookingActions {
  const started = new Date(booking.startTime).getTime() <= nowMs;
  const withinNoShowWindow = started && nowMs - new Date(booking.endTime).getTime() <= NO_SHOW_WINDOW_MS;
  const cancel = CANCELLABLE_STATUSES.has(booking.status);
  if (booking.status === 'CONFIRMED') {
    return { track: true, start: true, reschedule: true, complete: false, reportNoShow: withinNoShowWindow, cancel };
  }
  if (booking.status === 'IN_PROGRESS') {
    return { track: false, start: false, reschedule: false, complete: true, reportNoShow: withinNoShowWindow, cancel };
  }
  return { track: false, start: false, reschedule: false, complete: false, reportNoShow: false, cancel };
}

/** The backend requires a no-show reason of at least 10 characters (web form rule). */
export const NO_SHOW_REASON_MIN = 10;
