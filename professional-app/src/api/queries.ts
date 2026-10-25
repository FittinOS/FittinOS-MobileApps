import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  availabilityApi,
  bookingsApi,
  callsApi,
  conversationsApi,
  earningsApi,
  featuredApi,
  leadsApi,
  notificationsApi,
  payoutAccountApi,
  paymentsApi,
  plansApi,
  profileApi,
  promotionsApi,
  servicesApi,
  supportApi,
  walletApi,
  type BookingScope,
} from './endpoints';
import type { PaymentHistoryFilters } from './types';

/** Every cache key in one place, so mutations invalidate exactly what they change. */
export const qk = {
  profile: ['profile'] as const,
  services: ['services'] as const,
  service: (id: string) => ['services', id] as const,
  categories: ['categories'] as const,
  availability: (params: object) => ['availability', params] as const,
  leads: (params: object) => ['leads', params] as const,
  leadStats: ['leads', 'stats'] as const,
  bookings: (params: object) => ['bookings', params] as const,
  booking: (id: string) => ['bookings', 'detail', id] as const,
  tracking: (id: string) => ['bookings', 'tracking', id] as const,
  conversations: (params: object) => ['conversations', params] as const,
  conversation: (id: string) => ['conversations', 'detail', id] as const,
  blocked: ['conversations', 'blocked'] as const,
  calls: (conversationId: string) => ['calls', conversationId] as const,
  wallet: ['wallet'] as const,
  walletTx: (params: object) => ['wallet', 'transactions', params] as const,
  coinValue: ['wallet', 'coinValue'] as const,
  coinPackages: ['coinPackages'] as const,
  payments: (filters: object) => ['payments', filters] as const,
  payment: (id: string) => ['payments', 'detail', id] as const,
  plans: ['plans'] as const,
  subscription: ['plans', 'subscription'] as const,
  planCoupons: ['plans', 'coupons'] as const,
  featuredPlans: ['featured', 'plans'] as const,
  featuredMine: ['featured', 'mine'] as const,
  promotions: ['promotions'] as const,
  promotionAnalytics: ['promotions', 'analytics'] as const,
  earningsSummary: ['earnings', 'summary'] as const,
  earnings: (params: object) => ['earnings', 'list', params] as const,
  payouts: (params: object) => ['earnings', 'payouts', params] as const,
  payoutAccount: ['payoutAccount'] as const,
  notifications: (params: object) => ['notifications', params] as const,
  unreadCount: ['notifications', 'unreadCount'] as const,
  notificationPrefs: ['notifications', 'preferences'] as const,
  support: (params: object) => ['support', params] as const,
  supportTicket: (id: string) => ['support', 'detail', id] as const,
  kycSubmissions: ['verification', 'kyc'] as const,
  certSubmissions: ['verification', 'certifications'] as const,
};

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: QueryKey[]) => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export const useProfile = () => useQuery({ queryKey: qk.profile, queryFn: profileApi.get });
export const useServices = () => useQuery({ queryKey: qk.services, queryFn: () => servicesApi.list() });
export const useService = (id: string) => useQuery({ queryKey: qk.service(id), queryFn: () => servicesApi.get(id), enabled: !!id });
export const useCategories = () => useQuery({ queryKey: qk.categories, queryFn: servicesApi.categories, staleTime: 10 * 60_000 });

export const useAvailability = (params: { status?: string; from?: string; to?: string; limit?: number }) =>
  useQuery({ queryKey: qk.availability(params), queryFn: () => availabilityApi.mine(params) });

export const useLeads = (params: { categoryId?: string; includeResponded?: boolean; limit?: number }) =>
  useQuery({ queryKey: qk.leads(params), queryFn: () => leadsApi.list(params) });
export const useLeadStats = () => useQuery({ queryKey: qk.leadStats, queryFn: leadsApi.stats });

export const useBookings = (params: { scope?: BookingScope; status?: string; limit?: number; sortOrder?: 'asc' | 'desc' }) =>
  useQuery({ queryKey: qk.bookings(params), queryFn: () => bookingsApi.list(params) });
export const useBooking = (id: string) => useQuery({ queryKey: qk.booking(id), queryFn: () => bookingsApi.get(id), enabled: !!id });

export const useConversations = (params: { status?: string; limit?: number } = {}) =>
  useQuery({ queryKey: qk.conversations(params), queryFn: () => conversationsApi.mine({ limit: 50, ...params }) });
export const useConversation = (id: string) =>
  useQuery({ queryKey: qk.conversation(id), queryFn: () => conversationsApi.get(id), enabled: !!id });
export const useBlocked = () => useQuery({ queryKey: qk.blocked, queryFn: conversationsApi.blocked });
export const useCallHistory = (conversationId: string) =>
  useQuery({ queryKey: qk.calls(conversationId), queryFn: () => callsApi.history(conversationId), enabled: !!conversationId, staleTime: 30_000 });

export const useWallet = () => useQuery({ queryKey: qk.wallet, queryFn: walletApi.balance });
export const useWalletTransactions = (params: { page?: number; limit?: number } = {}) =>
  useQuery({ queryKey: qk.walletTx(params), queryFn: () => walletApi.transactions({ limit: 30, ...params }) });
export const useCoinValue = () => useQuery({ queryKey: qk.coinValue, queryFn: walletApi.coinValue, staleTime: 10 * 60_000 });
export const useCoinPackages = () => useQuery({ queryKey: qk.coinPackages, queryFn: walletApi.packages, staleTime: 5 * 60_000 });

export const usePaymentHistory = (filters: PaymentHistoryFilters) =>
  useQuery({ queryKey: qk.payments(filters), queryFn: () => paymentsApi.history(filters) });
export const usePaymentDetail = (id: string) =>
  useQuery({ queryKey: qk.payment(id), queryFn: () => paymentsApi.historyDetail(id), enabled: !!id });

export const usePlans = () => useQuery({ queryKey: qk.plans, queryFn: plansApi.list });
export const useSubscription = () => useQuery({ queryKey: qk.subscription, queryFn: plansApi.current });
export const usePlanCouponOffers = () => useQuery({ queryKey: qk.planCoupons, queryFn: plansApi.couponOffers });

export const useFeaturedPlans = () => useQuery({ queryKey: qk.featuredPlans, queryFn: featuredApi.plans });
export const useFeaturedMine = () => useQuery({ queryKey: qk.featuredMine, queryFn: () => featuredApi.mine({ limit: 50 }) });

export const usePromotions = () => useQuery({ queryKey: qk.promotions, queryFn: promotionsApi.list });
export const usePromotionAnalytics = () => useQuery({ queryKey: qk.promotionAnalytics, queryFn: promotionsApi.analytics });

export const useEarningsSummary = () => useQuery({ queryKey: qk.earningsSummary, queryFn: earningsApi.summary });
export const useEarnings = (params: { page?: number; limit?: number } = {}) =>
  useQuery({ queryKey: qk.earnings(params), queryFn: () => earningsApi.list({ limit: 30, ...params }) });
export const usePayouts = (params: { page?: number; limit?: number } = {}) =>
  useQuery({ queryKey: qk.payouts(params), queryFn: () => earningsApi.payouts({ limit: 30, ...params }) });
export const usePayoutAccount = () => useQuery({ queryKey: qk.payoutAccount, queryFn: payoutAccountApi.get });

export const useNotifications = (params: { category?: string; unreadOnly?: boolean; limit?: number }) =>
  useQuery({ queryKey: qk.notifications(params), queryFn: () => notificationsApi.list(params) });
export const useUnreadCount = () =>
  useQuery({ queryKey: qk.unreadCount, queryFn: notificationsApi.unreadCount, refetchInterval: 60_000 });
export const useNotificationPrefs = () => useQuery({ queryKey: qk.notificationPrefs, queryFn: notificationsApi.preferences });

export const useSupportTickets = () => useQuery({ queryKey: qk.support({}), queryFn: () => supportApi.list({ limit: 50 }) });
export const useSupportTicket = (id: string) =>
  useQuery({ queryKey: qk.supportTicket(id), queryFn: () => supportApi.get(id), enabled: !!id });
/** Admin-configured contact — `phone`/`email` are null until set, never a fabricated fallback. */
export const useSupportContact = () => useQuery({ queryKey: ['support', 'contact'], queryFn: supportApi.contact, staleTime: 10 * 60_000 });

export const useKycSubmissions = () => useQuery({ queryKey: qk.kycSubmissions, queryFn: profileApi.kycSubmissions });
export const useCertSubmissions = () => useQuery({ queryKey: qk.certSubmissions, queryFn: profileApi.certificationSubmissions });
