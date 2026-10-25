/**
 * Every backend call the professional app makes, one typed function per real
 * route (apps/backend/src/** controllers on origin/main). Nothing here
 * computes money, balances or eligibility — the backend is the authority.
 */
import { API_URL } from '@/lib/config';
import { http, unwrap } from './client';
import type {
  AuthResult,
  AvailabilitySlotDto,
  BillingCycle,
  BookingDto,
  CallDto,
  CallIceServersDto,
  CategoryDto,
  CertificationSubmissionDto,
  CoinPackageDto,
  CoinTransactionDto,
  ConversationDto,
  EarningDto,
  EarningsSummaryDto,
  FeaturedListingDto,
  FeaturedPlanDto,
  KycSubmissionDto,
  LeadDto,
  LeadStatsDto,
  NotificationDto,
  Paginated,
  PayoutDto,
  ProfessionalPayoutAccountResponse,
  ProfessionalPlanDto,
  ProfessionalProfileDto,
  ProfessionalSubscriptionDto,
  ServiceDto,
  UserDto,
  WalletDto,
} from './shared';
import type {
  AadhaarStartResult,
  BookingSession,
  BookingTrackingView,
  CoinValue,
  CreatePaymentOrderInput,
  GeocodedLocation,
  LocationSuggestion,
  PaymentHistoryDetail,
  PaymentHistoryFilters,
  PaymentHistoryItem,
  PaymentOrderResponse,
  PayoutAccountInput,
  PlanCouponOffer,
  PlanCouponQuote,
  ProfessionalPromotion,
  ProfessionalPromotionAnalytics,
  SupportTicket,
  TripVehicleInput,
  UploadedFile,
} from './types';

type Params = Record<string, string | number | boolean | undefined | null>;

/** Drops undefined/null so they never reach the backend as the string "undefined". */
export function cleanParams(params?: Params): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

const get = async <T>(url: string, params?: Params) => unwrap<T>(await http.get(url, { params: cleanParams(params) }));
const post = async <T>(url: string, body?: unknown) => unwrap<T>(await http.post(url, body ?? {}));
const patch = async <T>(url: string, body?: unknown) => unwrap<T>(await http.patch(url, body ?? {}));
const del = async <T>(url: string, body?: unknown) => unwrap<T>(await http.delete(url, body ? { data: body } : undefined));

/** Public download route for an uploaded file (how the web builds avatar URLs). */
export const fileDownloadUrl = (fileId: string) => `${API_URL}/files/${fileId}/download`;

// ---------------------------------------------------------------- auth
export const authApi = {
  login: (email: string, password: string) => post<AuthResult>('/auth/login', { email, password }),
  register: (input: { email: string; password: string; fullName: string; phone?: string }) =>
    post<AuthResult>('/auth/register', { ...input, role: 'PROFESSIONAL' }),
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
};

// ---------------------------------------------------------------- files
export interface UploadableFile {
  uri: string;
  name: string;
  mimeType: string;
}

export async function uploadFile(file: UploadableFile, purpose: 'PROFILE_IMAGE' | 'CERTIFICATION_DOCUMENT'): Promise<UploadedFile> {
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

// ---------------------------------------------------------------- professional profile
export const profileApi = {
  get: () => get<ProfessionalProfileDto>('/professionals/me'),
  update: (input: Partial<{
    headline: string;
    bio: string;
    city: string;
    area: string;
    experienceYears: number;
    specializations: string[];
    languages: string[];
    acceptingWork: boolean;
    latitude: number;
    longitude: number;
    placeId: string;
    formattedAddress: string;
    postalCode: string;
    serviceRadiusKm: number;
  }>) => patch<ProfessionalProfileDto>('/professionals/me', input),
  shareCurrentLocation: (input: { latitude: number; longitude: number; accuracyMeters?: number }) =>
    patch<unknown>('/professionals/me/location', input),
  reportLocationFailure: (input: {
    reason: string;
    code?: number;
    permissionState?: string;
    message?: string;
    page?: string;
    attempts?: number;
  }) => post<unknown>('/professionals/me/location/diagnostics', input),
  kycSubmissions: () => get<KycSubmissionDto[]>('/professionals/kyc/submissions'),
  startAadhaar: () => post<AadhaarStartResult>('/professionals/kyc/aadhaar/start', {}),
  fetchAadhaar: (input: { sessionId?: string; transactionId?: string }) =>
    post<unknown>('/professionals/kyc/aadhaar/fetch', input),
  certificationSubmissions: () => get<CertificationSubmissionDto[]>('/professionals/certifications/submissions'),
  submitCertification: (input: {
    title: string;
    issuingOrganization: string;
    issueDate: string;
    expiryDate?: string;
    credentialId?: string;
    documentFileIds: string[];
  }) => post<CertificationSubmissionDto>('/professionals/certifications/submit', input),
};

export const locationsApi = {
  search: (query: string) => get<LocationSuggestion[]>('/locations/search', { query }),
  geocode: (input: { placeId: string } | { latitude: number; longitude: number }) =>
    post<GeocodedLocation>('/locations/geocode', input),
};

// ---------------------------------------------------------------- catalog & services
export const servicesApi = {
  categories: () => get<CategoryDto[]>('/categories'),
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    get<Paginated<ServiceDto>>('/professional/services', { limit: 100, ...params }),
  get: (id: string) => get<ServiceDto>(`/professional/services/${id}`),
  create: (input: { categoryId: string; priceAmount: number; durationMinutes: number; mode?: string; location?: string; status?: string }) =>
    post<ServiceDto>('/professional/services', input),
  update: (id: string, input: Partial<{ priceAmount: number; durationMinutes: number; mode: string; location: string; status: string }>) =>
    patch<ServiceDto>(`/professional/services/${id}`, input),
  remove: (id: string) => del<unknown>(`/professional/services/${id}`),
};

// ---------------------------------------------------------------- availability
export const availabilityApi = {
  mine: (params?: { status?: string; from?: string; to?: string; serviceId?: string; page?: number; limit?: number }) =>
    get<Paginated<AvailabilitySlotDto>>('/availability/me', params),
  create: (input: { startTime: string; endTime: string; serviceId?: string }) =>
    post<AvailabilitySlotDto>('/availability', input),
  remove: (id: string) => del<unknown>(`/availability/${id}`),
  /** Public open slots — used to pick a reschedule target. */
  publicOpen: (params: { professionalId: string; serviceId?: string }) =>
    get<Paginated<AvailabilitySlotDto>>('/availability', params),
};

// ---------------------------------------------------------------- leads
export const leadsApi = {
  list: (params?: { categoryId?: string; includeResponded?: boolean; page?: number; limit?: number }) =>
    get<Paginated<LeadDto>>('/leads', params),
  stats: () => get<LeadStatsDto>('/leads/stats'),
  respond: (leadId: string, input: { message: string; quotedAmount?: number; availabilityNote?: string }) =>
    post<unknown>(`/leads/${leadId}/respond`, input),
};

// ---------------------------------------------------------------- bookings
export type BookingScope = 'upcoming' | 'today' | 'past' | 'all';

export const bookingsApi = {
  list: (params?: { status?: string; scope?: BookingScope; page?: number; limit?: number; sortOrder?: 'asc' | 'desc' }) =>
    get<Paginated<BookingDto>>('/bookings', params),
  get: (id: string) => get<BookingDto & { session?: BookingSession | null }>(`/bookings/${id}`),
  start: (id: string) => post<BookingDto>(`/bookings/${id}/start`),
  complete: (id: string, notes?: string) => post<BookingDto>(`/bookings/${id}/complete`, notes ? { notes } : {}),
  reportNoShow: (id: string, reason: string) => post<unknown>(`/bookings/${id}/report-no-show`, { reason }),
  cancel: (id: string, reason?: string) => post<BookingDto>(`/bookings/${id}/cancel`, reason ? { reason } : {}),
  reschedule: (id: string, newSlotId: string) => post<BookingDto>(`/bookings/${id}/reschedule`, { newSlotId }),
  tracking: (id: string) => get<BookingTrackingView>(`/bookings/${id}/tracking`),
  startTrip: (id: string, input: TripVehicleInput & { latitude?: number; longitude?: number; accuracyMeters?: number }) =>
    post<Record<string, unknown>>(`/bookings/${id}/tracking/start`, input),
  updateTripLocation: (id: string, input: { latitude: number; longitude: number; accuracyMeters?: number }) =>
    patch<Record<string, unknown>>(`/bookings/${id}/tracking/location`, input),
  updateTripVehicle: (id: string, input: TripVehicleInput) =>
    patch<Record<string, unknown>>(`/bookings/${id}/tracking/vehicle`, input),
  stopTrip: (id: string) => post<Record<string, unknown>>(`/bookings/${id}/tracking/stop`),
};

// ---------------------------------------------------------------- conversations & calls
export const conversationsApi = {
  mine: (params?: { status?: string; page?: number; limit?: number }) =>
    get<Paginated<ConversationDto & Record<string, unknown>>>('/conversations/my', params),
  get: (id: string) => get<ConversationDto & Record<string, unknown>>(`/conversations/${id}`),
  accept: (id: string, message: string) => post<unknown>(`/conversations/${id}/accept`, { message }),
  decline: (id: string, reason?: string) => post<unknown>(`/conversations/${id}/decline`, reason ? { reason } : {}),
  reply: (id: string, message: string) => post<unknown>(`/conversations/${id}/messages`, { message }),
  block: (id: string, reason?: string) => post<unknown>(`/conversations/${id}/block`, reason ? { reason } : {}),
  report: (id: string, reason: string) => post<unknown>(`/conversations/${id}/report`, { reason }),
  blocked: () => get<Array<{ userId: string; fullName: string; avatarUrl: string | null; blockedAt?: string }>>('/conversations/blocked'),
  /** Takes the blocked USER's id (ConversationsService.unblock). */
  unblock: (blockedUserId: string) => del<unknown>(`/conversations/blocked/${blockedUserId}`),
};

export const callsApi = {
  history: async (conversationId: string) =>
    (await get<{ items: CallDto[] }>('/calls', { conversationId, limit: 30 })).items,
  iceServers: () => get<CallIceServersDto>('/calls/ice-servers'),
};

// ---------------------------------------------------------------- wallet & payments
export const walletApi = {
  balance: () => get<WalletDto>('/wallet'),
  transactions: (params?: { page?: number; limit?: number }) =>
    get<Paginated<CoinTransactionDto>>('/wallet/transactions', params),
  coinValue: () => get<CoinValue>('/wallet/coin-value'),
  packages: () => get<CoinPackageDto[]>('/coin-packages'),
};

export const paymentsApi = {
  createOrder: (input: CreatePaymentOrderInput) => post<PaymentOrderResponse>('/payments/orders', input),
  /** Live backend → Cashfree requery. The only thing that ever marks a payment successful in this app. */
  verify: (transactionId: string) => post<Record<string, unknown>>('/payments/verify', { transactionId }),
  history: (filters: PaymentHistoryFilters) => get<Paginated<PaymentHistoryItem>>('/payments/history', { ...filters }),
  historyDetail: (id: string) => get<PaymentHistoryDetail>(`/payments/history/${id}`),
  receiptPath: (id: string) => `/payments/history/${id}/receipt`,
};

// ---------------------------------------------------------------- plans, featured, promotions
export const plansApi = {
  list: () => get<ProfessionalPlanDto[]>('/professional-plans'),
  current: () => get<ProfessionalSubscriptionDto | null>('/professional-plans/me'),
  couponOffers: () => get<PlanCouponOffer[]>('/professional-plans/coupons/available'),
  validateCoupon: (input: { professionalPlanId: string; billingCycle: BillingCycle; couponCode: string }) =>
    post<PlanCouponQuote>('/professional-plans/coupons/validate', input),
};

export const featuredApi = {
  plans: () => get<FeaturedPlanDto[]>('/featured-listings/plans'),
  mine: (params?: { page?: number; limit?: number }) => get<Paginated<FeaturedListingDto>>('/featured-listings/me', params),
  purchaseWithCoins: (input: { serviceId: string; planId: string; idempotencyKey?: string }) =>
    post<unknown>('/featured-listings/purchase/coins', input),
};

export const promotionsApi = {
  list: () => get<ProfessionalPromotion[]>('/professional/promotions'),
  analytics: () => get<ProfessionalPromotionAnalytics>('/professional/promotions/analytics'),
};

// ---------------------------------------------------------------- earnings & payout account
export const earningsApi = {
  summary: () => get<EarningsSummaryDto>('/earnings/summary'),
  list: (params?: { page?: number; limit?: number }) => get<Paginated<EarningDto>>('/earnings', params),
  payouts: (params?: { page?: number; limit?: number }) => get<Paginated<PayoutDto>>('/earnings/payouts', params),
};

export const payoutAccountApi = {
  get: () => get<ProfessionalPayoutAccountResponse>('/professional/payout-account'),
  save: (input: PayoutAccountInput, exists: boolean) =>
    exists ? patch<unknown>('/professional/payout-account', input) : post<unknown>('/professional/payout-account', input),
  remove: () => del<unknown>('/professional/payout-account'),
};

// ---------------------------------------------------------------- notifications & support
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

export const pushApi = {
  registerDevice: (token: string, platform: 'ios' | 'android') => post<unknown>('/notifications/push/register-device', { token, platform }),
  unregisterDevice: (token: string) => del<unknown>('/notifications/push/register-device', { token }),
};

export const supportApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) => get<Paginated<SupportTicket>>('/support', params),
  get: (id: string) => get<SupportTicket>(`/support/${id}`),
  create: (subject: string, message: string) => post<SupportTicket>('/support', { subject, message }),
  reply: (id: string, message: string) => post<SupportTicket>(`/support/${id}/reply`, { message }),
  contact: () => get<{ phone: string | null; email: string | null }>('/support/contact'),
};
