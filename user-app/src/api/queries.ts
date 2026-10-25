import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  availabilityApi,
  bookingsApi,
  categoriesApi,
  conversationsApi,
  couponsApi,
  locationsApi,
  notificationsApi,
  paymentsApi,
  professionalsApi,
  requirementsApi,
  servicesApi,
  supportApi,
  walletApi,
  type BookingScope,
  type DiscoverProfessionalsParams,
} from './endpoints';
import type { PaymentHistoryStatus, PaymentPurposeValue } from './shared';

/** Every cache key in one place, so mutations invalidate exactly what they change. */
export const qk = {
  categories: ['categories'] as const,
  professionals: (params: object) => ['professionals', params] as const,
  professional: (id: string) => ['professionals', 'detail', id] as const,
  reviews: (id: string, params: object) => ['professionals', 'reviews', id, params] as const,
  services: (params: object) => ['services', params] as const,
  availability: (params: object) => ['availability', params] as const,
  bookings: (params: object) => ['bookings', params] as const,
  booking: (id: string) => ['bookings', 'detail', id] as const,
  bookingTracking: (id: string, destination?: { lat: number; lng: number } | null) => ['bookings', 'tracking', id, destination ?? null] as const,
  requirements: (params: object) => ['requirements', params] as const,
  requirement: (id: string) => ['requirements', 'detail', id] as const,
  conversations: (params: object) => ['conversations', params] as const,
  conversation: (id: string) => ['conversations', 'detail', id] as const,
  wallet: ['wallet'] as const,
  walletTx: (params: object) => ['wallet', 'transactions', params] as const,
  coinValue: ['wallet', 'coinValue'] as const,
  coinPackages: ['coinPackages'] as const,
  payments: (filters: object) => ['payments', filters] as const,
  payment: (id: string) => ['payments', 'detail', id] as const,
  notifications: (params: object) => ['notifications', params] as const,
  unreadCount: ['notifications', 'unreadCount'] as const,
  notificationPrefs: ['notifications', 'preferences'] as const,
  support: (params: object) => ['support', params] as const,
  supportTicket: (id: string) => ['support', 'detail', id] as const,
  couponsAvailable: (params: object) => ['coupons', 'available', params] as const,
  couponsHistory: ['coupons', 'history'] as const,
  locationSearch: (query: string) => ['locations', 'search', query] as const,
};

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: QueryKey[]) => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: categoriesApi.list, staleTime: 10 * 60_000 });

/** Place suggestions for a free-text query (e.g. a 6-digit PIN code) — disabled until `query` is meaningful. */
export const useLocationSearch = (query: string, enabled: boolean) =>
  useQuery({
    queryKey: qk.locationSearch(query),
    queryFn: () => locationsApi.search(query),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 10 * 60_000,
  });

export const useProfessionals = (params: DiscoverProfessionalsParams, enabled = true) =>
  useQuery({ queryKey: qk.professionals(params), queryFn: () => professionalsApi.discover(params), enabled });

export const useProfessional = (id: string) =>
  useQuery({ queryKey: qk.professional(id), queryFn: () => professionalsApi.get(id), enabled: !!id });

export const useProfessionalReviews = (id: string, params: { page?: number; limit?: number } = {}) =>
  useQuery({ queryKey: qk.reviews(id, params), queryFn: () => professionalsApi.reviews(id, params), enabled: !!id });

export const useServicesForProfessional = (professionalId: string) =>
  useQuery({
    queryKey: qk.services({ professionalId }),
    queryFn: () => servicesApi.list({ professionalId }),
    enabled: !!professionalId,
  });

export const useAvailability = (params: { professionalId: string; serviceId?: string; from?: string; to?: string }) =>
  useQuery({ queryKey: qk.availability(params), queryFn: () => availabilityApi.open(params), enabled: !!params.professionalId });

export const useBookings = (params: { status?: string; scope?: BookingScope; limit?: number; sortOrder?: 'asc' | 'desc' } = {}) =>
  useQuery({ queryKey: qk.bookings(params), queryFn: () => bookingsApi.list(params) });

export const useBooking = (id: string) => useQuery({ queryKey: qk.booking(id), queryFn: () => bookingsApi.get(id), enabled: !!id });

/**
 * Polls GET /bookings/:id/tracking. The backend is the sole authority on
 * `eligibility` — this hook never computes it. Pass `enabled: false` to pause
 * polling (e.g. once the tracking screen is backgrounded/closed).
 */
export const useBookingTracking = (id: string, options: { enabled?: boolean; destination?: { lat: number; lng: number } | null } = {}) =>
  useQuery({
    queryKey: qk.bookingTracking(id, options.destination),
    queryFn: () => bookingsApi.tracking(id, options.destination),
    enabled: !!id && options.enabled !== false,
    refetchInterval: options.enabled === false ? false : 6_000,
    refetchIntervalInBackground: false,
  });

export const useRequirements = (params: { status?: string; limit?: number } = {}) =>
  useQuery({ queryKey: qk.requirements(params), queryFn: () => requirementsApi.mine(params) });

export const useRequirement = (id: string) =>
  useQuery({ queryKey: qk.requirement(id), queryFn: () => requirementsApi.get(id), enabled: !!id });

export const useConversations = (params: { status?: string; limit?: number } = {}) =>
  useQuery({ queryKey: qk.conversations(params), queryFn: () => conversationsApi.mine(params) });

export const useConversation = (id: string) =>
  useQuery({ queryKey: qk.conversation(id), queryFn: () => conversationsApi.get(id), enabled: !!id });

export const useWallet = () => useQuery({ queryKey: qk.wallet, queryFn: walletApi.balance });
export const useWalletTransactions = (params: { limit?: number } = {}) =>
  useQuery({ queryKey: qk.walletTx(params), queryFn: () => walletApi.transactions(params) });
export const useCoinValue = () => useQuery({ queryKey: qk.coinValue, queryFn: walletApi.coinValue, staleTime: 10 * 60_000 });
export const useCoinPackages = () => useQuery({ queryKey: qk.coinPackages, queryFn: walletApi.packages, staleTime: 5 * 60_000 });

export const useAvailableCoupons = (params: { serviceId?: string } = {}) =>
  useQuery({ queryKey: qk.couponsAvailable(params), queryFn: () => couponsApi.available(params) });
export const useCouponHistory = () => useQuery({ queryKey: qk.couponsHistory, queryFn: couponsApi.history });

export const usePayments = (
  params: { page?: number; status?: PaymentHistoryStatus; purpose?: PaymentPurposeValue; search?: string; from?: string; to?: string; limit?: number } = {},
) => useQuery({ queryKey: qk.payments(params), queryFn: () => paymentsApi.history(params) });
export const usePaymentDetail = (id: string) =>
  useQuery({ queryKey: qk.payment(id), queryFn: () => paymentsApi.historyDetail(id), enabled: !!id });

export const useNotifications = (params: { category?: string; unreadOnly?: boolean; limit?: number } = {}) =>
  useQuery({ queryKey: qk.notifications(params), queryFn: () => notificationsApi.list(params) });
export const useUnreadCount = () => useQuery({ queryKey: qk.unreadCount, queryFn: notificationsApi.unreadCount, refetchInterval: 60_000 });
export const useNotificationPreferences = () => useQuery({ queryKey: qk.notificationPrefs, queryFn: notificationsApi.preferences });

export const useSupportTickets = (params: { status?: string; limit?: number } = {}) =>
  useQuery({ queryKey: qk.support(params), queryFn: () => supportApi.list(params) });
export const useSupportTicket = (id: string) =>
  useQuery({ queryKey: qk.supportTicket(id), queryFn: () => supportApi.get(id), enabled: !!id });
/** Admin-configured contact — `phone`/`email` are null until set, never a fabricated fallback. */
export const useSupportContact = () => useQuery({ queryKey: ['support', 'contact'], queryFn: supportApi.contact, staleTime: 10 * 60_000 });
