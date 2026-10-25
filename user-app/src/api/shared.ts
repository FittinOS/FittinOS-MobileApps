/**
 * Single import point for the monorepo's shared contract types, so screens
 * never reach into packages/ directly.
 */
export * from '@fittin/shared-types';

/** Not exported by shared-types; mirrors apps/web/hooks/useApi.ts. */
export type CouponDiscountType = 'FIXED' | 'PERCENTAGE';

/**
 * ReviewsService.toDto's ad-hoc return shape (apps/backend/src/reviews) —
 * not a Prisma-backed model, so there is no shared ReviewDto to import.
 */
export interface ReviewDto {
  id: string;
  rating: number;
  feedback: string | null;
  client: { id: string; fullName: string; avatarUrl: string | null };
  serviceCategory: string | null;
  createdAt: string;
}

/**
 * POST /payments/orders' actual response (payments.service.ts) — slimmer
 * than the admin-facing PaymentOrderDto in shared-types, not exported there.
 */
export interface PaymentOrderResponse {
  paymentOrderId: string;
  transactionId: string;
  amount: number;
  currency: string;
  paymentSessionId: string;
  purpose: string;
  cashfreeEnvironment: 'PRODUCTION' | 'SANDBOX' | 'DISABLED';
  originalAmount?: number;
  discountAmount?: number;
  couponCode?: string;
}

export type PaymentPurposeValue = 'BOOKING' | 'COIN_PACKAGE' | 'FEATURED_LISTING' | 'PROFESSIONAL_SUBSCRIPTION';
export type PaymentHistoryStatus = 'CAPTURED' | 'PENDING' | 'FAILED' | 'REFUNDED';

/** PaymentsService's own history-list shape (payments.service.ts), not in shared-types. */
export interface PaymentHistoryItem {
  id: string;
  reference: string;
  purpose: PaymentPurposeValue;
  purposeLabel: string;
  summary: string;
  amount: number;
  currency: string;
  status: PaymentHistoryStatus;
  statusLabel: string;
  createdAt: string;
}

export interface PaymentHistoryDetail {
  id: string;
  reference: string;
  gatewayOrderId: string;
  gatewayPaymentId: string | null;
  purpose: PaymentPurposeValue;
  purposeLabel: string;
  amount: number;
  currency: string;
  status: PaymentHistoryStatus;
  statusLabel: string;
  paymentMethod: string | null;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payerId: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string | null;
  booking: {
    id: string;
    professionalName: string | null;
    serviceName: string | null;
    startTime: string;
    durationMinutes: number | null;
    status: string;
    paymentStatus: string | null;
  } | null;
  coinPackage: { name: string; coins: number; bonusCoins: number } | null;
  invoiceNumber?: string | null;
}

export interface SupportTicketMessage {
  id: string;
  body: string;
  isAdminReply: boolean;
  sender: { id: string; fullName: string; role: string };
  createdAt: string;
}

/** SupportService#toSummaryDto (list) / #toDetailDto (detail, with messages). */
export interface SupportTicket {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  relatedConversationId: string | null;
  assignedTo: { id: string; fullName: string } | null;
  lastMessage?: string | null;
  messages?: SupportTicketMessage[];
  createdAt: string;
  updatedAt: string;
}
