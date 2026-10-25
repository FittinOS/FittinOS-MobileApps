/**
 * Notifications carry web routes as `actionUrl` (the backend writes them for
 * the web app, e.g. "/professional/messages/<id>"). This maps them to the
 * equivalent app screen. Anything unknown maps to null — the app then just
 * marks the notification read instead of guessing a destination.
 */
const STATIC: Record<string, string> = {
  '/professional': '/',
  '/professional/dashboard': '/',
  '/professional/bookings': '/bookings',
  '/professional/leads': '/leads',
  '/professional/messages': '/messages',
  '/professional/profile': '/profile',
  '/professional/verification': '/verification',
  '/professional/kyc-intro': '/verification',
  '/professional/services': '/services',
  '/professional/services/create': '/services/create',
  '/professional/availability': '/availability',
  '/professional/earnings': '/earnings',
  '/professional/payout-account': '/payout-account',
  '/professional/wallet': '/wallet',
  '/professional/wallet/buy': '/wallet/buy',
  '/professional/wallet/payment-history': '/payments',
  '/professional/plans': '/plans',
  '/professional/featured-listings': '/featured-listings',
  '/professional/promotions': '/promotions',
  '/professional/reviews': '/reviews',
  '/professional/notifications': '/notifications',
  '/professional/settings': '/settings',
  '/professional/help': '/help',
};

const DYNAMIC: Array<[RegExp, (id: string) => string]> = [
  [/^\/professional\/messages\/([A-Za-z0-9-]+)$/, (id) => `/messages/${id}`],
  [/^\/professional\/bookings\/([A-Za-z0-9-]+)$/, (id) => `/bookings/${id}`],
  [/^\/professional\/services\/([A-Za-z0-9-]+)$/, (id) => `/services/${id}`],
  [/^\/professional\/wallet\/payment-history\/([A-Za-z0-9-]+)$/, (id) => `/payments/${id}`],
];

export function appRouteForActionUrl(actionUrl: string | null | undefined): string | null {
  if (!actionUrl || !actionUrl.startsWith('/')) return null;
  const path = actionUrl.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (STATIC[path]) return STATIC[path];
  for (const [pattern, build] of DYNAMIC) {
    const match = pattern.exec(path);
    if (match) return build(match[1]);
  }
  return null;
}
