/**
 * Response/request shapes the backend returns that are NOT already in
 * @fittin/shared-types. Each mirrors an existing web type (apps/web/hooks/useApi.ts
 * on origin/main) or a backend service return value — never invented fields.
 */
import type { BillingCycle, CouponDiscountType } from './shared';

export interface PlanCouponOffer {
  code: string;
  name: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  expiresAt: string | null;
}

export interface PlanCouponQuote {
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  billingCycle: BillingCycle | null;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

/** POST /payments/orders — PaymentsService.PaymentOrderResponse. */
export interface PaymentOrderResponse {
  paymentOrderId: string;
  /** Equals the Cashfree order id; the only key /payments/verify accepts. */
  transactionId: string;
  amount: number;
  currency: string;
  paymentSessionId: string;
  purpose: PaymentPurposeValue;
  cashfreeEnvironment: 'PRODUCTION' | 'SANDBOX' | 'DISABLED';
  originalAmount?: number;
  discountAmount?: number;
  couponCode?: string;
}

export type PaymentPurposeValue = 'BOOKING' | 'COIN_PACKAGE' | 'FEATURED_LISTING' | 'PROFESSIONAL_SUBSCRIPTION';

export interface CreatePaymentOrderInput {
  purpose: PaymentPurposeValue;
  coinPackageId?: string;
  professionalPlanId?: string;
  billingCycle?: BillingCycle;
  couponCode?: string;
  idempotencyKey?: string;
}

export type PaymentHistoryStatus = 'CREATED' | 'PENDING' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

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
  coinPackage: {
    name: string;
    coins: number;
    bonusCoins: number;
    walletTransaction: { id: string; amount: number; balanceAfter: number; description: string; createdAt: string } | null;
  } | null;
  professionalPlan: {
    name: string;
    durationDays: number;
    subscription: { status: string; startDate: string; endDate: string } | null;
  } | null;
  featuredListing: { planName: string; durationDays: number } | null;
  refunds: Array<{
    id: string;
    amount: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    statusLabel: string;
    reason: string;
    processedAt: string | null;
    createdAt: string;
  }>;
  refundSummary: { originalAmount: number; totalRefunded: number; remaining: number } | null;
}

export interface PaymentHistoryFilters {
  page?: number;
  limit?: number;
  status?: PaymentHistoryStatus;
  purpose?: PaymentPurposeValue;
}

export interface ProfessionalPromotion {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  startsAt: string | null;
  expiresAt: string | null;
  status: string;
  service: { id: string; category: { name: string } | null } | null;
  category: { id: string; name: string } | null;
}

export interface ProfessionalPromotionAnalytics {
  totalPromotionalBookings: number;
  totalDiscountAttributed: number;
  /** Not returned by origin/main's backend; shown only when present. */
  totalProfessionalEarningAmount?: number;
  byCoupon: Array<{
    code: string;
    name: string;
    bookings: number;
    grossValue: number;
    discount: number;
    netValue: number;
    professionalEarningAmount?: number;
  }>;
}

export interface CoinValue {
  /** Integer paise one coin is worth (WalletController#getCoinValue). */
  coinValuePaise: number;
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

export interface UploadedFile {
  id: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  url?: string;
  [key: string]: unknown;
}

export interface AadhaarStartResult {
  sessionId: string;
  transactionId: string;
  kycUrl: string;
  shortUrl?: string;
  expiresAt: string;
}

/** LocationsService PlaceSuggestion. */
export interface LocationSuggestion {
  placeId: string;
  description: string;
}

/** LocationsService GeocodedLocation. */
export interface GeocodedLocation {
  placeId: string | null;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  city: string | null;
  area: string | null;
  postalCode: string | null;
}

export interface TripVehicleInput {
  vehicleType: 'CAR' | 'BIKE' | 'SCOOTER' | 'AUTO' | 'OTHER';
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
}

export interface PayoutAccountInput {
  accountType: 'BANK_ACCOUNT' | 'UPI';
  accountHolderName: string;
  accountNumber?: string;
  confirmAccountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
}

/** GET /bookings/:id/tracking — BookingTrackingService.BookingTrackingView (professional caller: never a route). */
export type TrackingEligibility = 'NOT_YET_AVAILABLE' | 'WAITING' | 'LIVE' | 'STALE' | 'STOPPED' | 'COMPLETED' | 'NO_DATA';

export interface BookingTrackingView {
  eligibility: TrackingEligibility;
  trackingWindowOpensAt: string | null;
  hasStarted: boolean;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number | null;
  locationUpdatedAt?: string;
  vehicleType?: TripVehicleInput['vehicleType'];
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehicleUpdatedAt?: string;
  sharingStartedAt?: string;
}

/** The `session` block GET /bookings/:id includes (BookingsService detail). */
export interface BookingSession {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  professionalNotes: string | null;
  clientFeedback: string | null;
  rating: number | null;
}
