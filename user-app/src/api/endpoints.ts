/**
 * Every backend call the User app makes, one typed function per real route
 * (apps/backend/src/** controllers on origin/main). Nothing here computes
 * money, balances or eligibility — the backend is the authority.
 */
import { API_URL } from '@/lib/config';
import { http, unwrap } from './client';
import type {
  AuthResult,
  AvailabilitySlotDto,
  BookingDto,
  CategoryDto,
  CoinPackageDto,
  CoinTransactionDto,
  ConversationDto,
  MessageDto,
  NotificationDto,
  Paginated,
  ProfessionalProfileDto,
  RequirementDto,
  ServiceDto,
  UserDto,
  WalletDto,
} from './shared';
import type {
  PaymentHistoryDetail,
  PaymentHistoryItem,
  PaymentHistoryStatus,
  PaymentOrderResponse,
  PaymentPurposeValue,
  ReviewDto,
  SupportTicket,
} from './shared';

type Params = Record<string, string | number | boolean | undefined | null>;

/**
 * Drops undefined/null so they never reach the backend as the string
 * "undefined". Accepts any plain params object (not just the `Params`
 * index-signature type) — named param interfaces like
 * DiscoverProfessionalsParams don't structurally satisfy `Record<string, V>`
 * even when every field matches, so `get` takes `object` and narrows here.
 */
export function cleanParams(params?: object): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params as Params)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

const get = async <T>(url: string, params?: object) => unwrap<T>(await http.get(url, { params: cleanParams(params) }));
const post = async <T>(url: string, body?: unknown) => unwrap<T>(await http.post(url, body ?? {}));
const patch = async <T>(url: string, body?: unknown) => unwrap<T>(await http.patch(url, body ?? {}));
const del = async <T>(url: string, body?: unknown) => unwrap<T>(await http.delete(url, body ? { data: body } : undefined));

/** Public download route for an uploaded file (how the web builds avatar URLs). */
export const fileDownloadUrl = (fileId: string) => `${API_URL}/files/${fileId}/download`;

// ---------------------------------------------------------------- auth
export const authApi = {
  login: (email: string, password: string) => post<AuthResult>('/auth/login', { email, password }),
  register: (input: { email: string; password: string; fullName: string; phone?: string; goals?: string[] }) =>
    post<AuthResult>('/auth/register', { ...input, role: 'CLIENT' }),
  me: () => get<UserDto>('/auth/me'),
  updateMe: (input: { fullName?: string; phone?: string; avatarUrl?: string }) => patch<UserDto>('/auth/me', input),
  sendVerificationCode: (email: string) => post<null>('/auth/email/send-code', { email }),
  verifyEmail: (email: string, code: string) => post<unknown>('/auth/email/verify', { email, code }),
  forgotPassword: (email: string) => post<null>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => post<null>('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<null>('/auth/change-password', { currentPassword, newPassword }),
  logout: (refreshToken: string) => post<null>('/auth/logout', { refreshToken }),
  logoutAll: () => post<null>('/auth/logout-all'),
  deleteAccount: (currentPassword: string) => del<null>('/auth/me', { currentPassword }),
  googleAuthorizeUrl: (role: 'CLIENT') => get<{ url: string; state?: string }>('/auth/oauth/google/authorize-url', { role }),
  googleCallback: (code: string, state: string) => post<AuthResult>('/auth/oauth/google/callback', { code, state }),
};

// ---------------------------------------------------------------- files
export interface UploadableFile {
  uri: string;
  name: string;
  mimeType: string;
}

export interface UploadedFile {
  id: string;
  url: string;
}

export async function uploadFile(file: UploadableFile, purpose: 'PROFILE_IMAGE'): Promise<UploadedFile> {
  const form = new FormData();
  // React Native's FormData accepts {uri,name,type} file descriptors.
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  form.append('purpose', purpose);
  const response = await http.post('/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  });
  return unwrap<UploadedFile>(response);
}

// ---------------------------------------------------------------- categories & locations
export const categoriesApi = {
  list: () => get<CategoryDto[]>('/categories'),
  get: (idOrSlug: string) => get<CategoryDto>(`/categories/${idOrSlug}`),
};

export interface LocationSuggestion {
  placeId: string;
  description: string;
}
export interface GeocodedLocation {
  latitude: number;
  longitude: number;
  placeId: string | null;
  formattedAddress: string;
  city: string | null;
  /** Neighbourhood/locality, e.g. "Indiranagar". */
  area: string | null;
  postalCode: string | null;
}

export const locationsApi = {
  search: (query: string) => get<LocationSuggestion[]>('/locations/search', { query }),
  geocode: (input: { placeId: string } | { latitude: number; longitude: number }) =>
    post<GeocodedLocation>('/locations/geocode', input),
};

// ---------------------------------------------------------------- professional discovery
export interface DiscoverProfessionalsParams {
  category?: string;
  city?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  mode?: string;
  minRating?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sortBy?: 'rating' | 'experience' | 'price' | 'newest' | 'distance';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const professionalsApi = {
  discover: (params?: DiscoverProfessionalsParams) => get<Paginated<ProfessionalProfileDto>>('/professionals', params),
  topRated: (params?: { limit?: number; skip?: number; city?: string }) =>
    get<ProfessionalProfileDto[]>('/professionals/top-rated', params),
  get: (id: string) => get<ProfessionalProfileDto>(`/professionals/${id}`),
  reviews: (id: string, params?: { page?: number; limit?: number }) =>
    get<Paginated<ReviewDto>>(`/professionals/${id}/reviews`, params),
};

// ---------------------------------------------------------------- services & availability
export const servicesApi = {
  /** Public browse — e.g. list(professionalId) for a professional's services shown on their detail page. */
  list: (params?: { professionalId?: string; categoryId?: string; page?: number; limit?: number }) =>
    get<Paginated<ServiceDto> | ServiceDto[]>('/services', params),
  get: (id: string) => get<ServiceDto>(`/services/${id}`),
};

export const availabilityApi = {
  /** Public open future slots for a given professional (optionally scoped to one service). */
  open: (params: { professionalId: string; serviceId?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    get<Paginated<AvailabilitySlotDto>>('/availability', params),
};

// ---------------------------------------------------------------- coupons
/** Matches CouponsService.listAvailable's actual response (apps/backend/src/coupons/coupons.service.ts). */
export interface CouponPreview {
  id: string;
  code: string;
  name: string;
  description: string | null;
  bannerImageUrl: string | null;
  ctaLabel: string | null;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderAmount: number | null;
  expiresAt: string | null;
  /** What this coupon would save right now, given no booking context yet. */
  previewDiscountAmount: number;
}

export interface CouponUsage {
  code: string;
  name: string;
  bookingId: string;
  discountAmount: number;
  usedAt: string;
}

/** Matches CouponsService.getHistory's response shape exactly. */
export interface CouponHistoryResponse {
  available: Array<{ code: string; name: string; description: string | null; expiresAt: string | null }>;
  used: CouponUsage[];
  expiredCount: number;
}

/** Matches CouponsService.validate's response (apps/backend/src/coupons/coupons.service.ts). */
export interface CouponQuote {
  code: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
}

export const couponsApi = {
  validate: (input: { couponCode: string; serviceId?: string; coinPackageId?: string }) => post<CouponQuote>('/coupons/validate', input),
  available: (params?: { serviceId?: string }) => get<CouponPreview[]>('/coupons/available', params),
  history: () => get<CouponHistoryResponse>('/coupons/history'),
};

// ---------------------------------------------------------------- bookings
export type BookingScope = 'upcoming' | 'today' | 'past' | 'all';

export const bookingsApi = {
  create: (input: { serviceId: string; slotId: string; couponCode?: string }) => post<BookingDto>('/bookings', input),
  list: (params?: { status?: string; scope?: BookingScope; from?: string; to?: string; page?: number; limit?: number; sortOrder?: 'asc' | 'desc' }) =>
    get<Paginated<BookingDto>>('/bookings', params),
  get: (id: string) => get<BookingDto>(`/bookings/${id}`),
  cancel: (id: string, reason?: string) => post<BookingDto>(`/bookings/${id}/cancel`, reason ? { reason } : {}),
  reschedule: (id: string, newSlotId: string) => post<BookingDto>(`/bookings/${id}/reschedule`, { newSlotId }),
  feedback: (id: string, rating: number, feedback?: string) =>
    post<unknown>(`/bookings/${id}/feedback`, feedback ? { rating, feedback } : { rating }),
  tracking: (id: string, destination?: { lat: number; lng: number } | null) =>
    get<BookingTrackingView>(
      `/bookings/${id}/tracking`,
      destination ? { destinationLat: destination.lat, destinationLng: destination.lng } : undefined,
    ),
};

/**
 * Mirrors the backend's BookingTrackingView (apps/backend/src/bookings/
 * booking-tracking.service.ts) — the client only ever renders whatever
 * `eligibility` the server returns, never computes it. Coordinates/vehicle
 * fields are only ever populated by the server when eligibility is LIVE or
 * STALE; `route` only when this caller is the client and sent a destination.
 */
export type TrackingEligibility = 'NOT_YET_AVAILABLE' | 'WAITING' | 'LIVE' | 'STALE' | 'STOPPED' | 'COMPLETED' | 'NO_DATA';

export interface BookingRouteView {
  available: boolean;
  polyline?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  staticDurationSeconds?: number;
}

export interface BookingTrackingView {
  eligibility: TrackingEligibility;
  trackingWindowOpensAt?: string | null;
  hasStarted: boolean;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number | null;
  locationUpdatedAt?: string;
  vehicleType?: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehicleUpdatedAt?: string;
  sharingStartedAt?: string;
  route?: BookingRouteView;
}

// ---------------------------------------------------------------- requirements
export const requirementsApi = {
  create: (input: {
    title: string;
    description: string;
    categoryId: string;
    preferredTime?: string;
    location?: string;
    budgetAmount?: number;
    mode?: string;
  }) => post<RequirementDto>('/requirements', input),
  mine: (params?: { status?: string; page?: number; limit?: number }) => get<Paginated<RequirementDto>>('/requirements/my', params),
  get: (id: string) => get<RequirementDto & { responses?: Record<string, unknown>[] }>(`/requirements/${id}`),
  close: (id: string) => post<RequirementDto>(`/requirements/${id}/close`),
};

// ---------------------------------------------------------------- conversations (messaging with professionals)
export const conversationsApi = {
  mine: (params?: { status?: string; page?: number; limit?: number }) =>
    get<Paginated<ConversationDto>>('/conversations/my', params),
  get: (id: string) => get<ConversationDto>(`/conversations/${id}`),
  start: (input: { professionalId: string; message: string; requirementId?: string }) => post<ConversationDto>('/conversations', input),
  reply: (id: string, message: string) => post<MessageDto>(`/conversations/${id}/messages`, { message }),
  unlock: (id: string) => post<ConversationDto>(`/conversations/${id}/unlock`),
};

// ---------------------------------------------------------------- wallet & payments
export interface CoinValue {
  coinValuePaise: number;
}

export const walletApi = {
  balance: () => get<WalletDto>('/wallet'),
  transactions: (params?: { page?: number; limit?: number }) => get<Paginated<CoinTransactionDto>>('/wallet/transactions', params),
  coinValue: () => get<CoinValue>('/wallet/coin-value'),
  packages: () => get<CoinPackageDto[]>('/coin-packages'),
};

export type CreatePaymentOrderInput =
  | { purpose: 'COIN_PACKAGE'; coinPackageId: string; idempotencyKey?: string }
  | { purpose: 'BOOKING'; bookingId: string; idempotencyKey?: string };

export const paymentsApi = {
  createOrder: (input: CreatePaymentOrderInput) => post<PaymentOrderResponse>('/payments/orders', input),
  /** Live backend → Cashfree requery. The only thing that ever marks a payment successful in this app. */
  verify: (transactionId: string) => post<Record<string, unknown>>('/payments/verify', { transactionId }),
  history: (params?: { page?: number; limit?: number; status?: PaymentHistoryStatus; purpose?: PaymentPurposeValue; search?: string; from?: string; to?: string }) =>
    get<Paginated<PaymentHistoryItem>>('/payments/history', params),
  historyDetail: (id: string) => get<PaymentHistoryDetail>(`/payments/history/${id}`),
  receiptPath: (id: string) => `/payments/history/${id}/receipt`,
};

// ---------------------------------------------------------------- notifications
export const notificationsApi = {
  list: (params?: { category?: string; unreadOnly?: boolean; page?: number; limit?: number }) =>
    get<Paginated<NotificationDto>>('/notifications', params),
  unreadCount: () => get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => patch<unknown>(`/notifications/${id}/read`),
  markAllRead: () => patch<unknown>('/notifications/read-all'),
  remove: (id: string) => del<unknown>(`/notifications/${id}`),
  preferences: () => get<{ mutedCategories: string[] }>('/notifications/preferences'),
  setPreferences: (mutedCategories: string[]) => patch<unknown>('/notifications/preferences', { mutedCategories }),
};

// ---------------------------------------------------------------------- push
export const pushApi = {
  registerDevice: (token: string, platform: 'ios' | 'android') => post<unknown>('/notifications/push/register-device', { token, platform }),
  unregisterDevice: (token: string) => del<unknown>('/notifications/push/register-device', { token }),
};

// ---------------------------------------------------------------- support
export const supportApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) => get<Paginated<SupportTicket>>('/support', params),
  get: (id: string) => get<SupportTicket>(`/support/${id}`),
  create: (subject: string, message: string) => post<SupportTicket>('/support', { subject, message }),
  reply: (id: string, message: string) => post<SupportTicket>(`/support/${id}/reply`, { message }),
  contact: () => get<{ phone: string | null; email: string | null }>('/support/contact'),
};
