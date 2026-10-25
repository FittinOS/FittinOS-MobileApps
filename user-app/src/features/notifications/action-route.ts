/**
 * Notifications carry web routes as `actionUrl` (the backend writes them for
 * the web app, e.g. "/user/bookings/<id>"). This maps them to the equivalent
 * app screen. Anything unknown maps to null — the app then just marks the
 * notification read instead of guessing a destination.
 */
const STATIC: Record<string, string> = {
  '/user': '/(app)/(tabs)',
  '/user/dashboard': '/(app)/(tabs)',
  '/user/explore': '/(app)/(tabs)/discover',
  '/user/bookings': '/(app)/(tabs)/bookings',
  '/user/requirements': '/(app)/(tabs)/requirements',
  '/user/requirements/create': '/(app)/(tabs)/requirements/create',
  '/user/wallet': '/(app)/wallet',
  '/user/wallet/buy': '/(app)/wallet/buy',
  '/user/wallet/payment-history': '/(app)/payments',
  '/user/messages': '/(app)/messages',
  '/user/profile': '/(app)/(tabs)/profile',
  '/user/notifications': '/notifications',
  '/user/settings': '/settings',
  '/user/help': '/help',
};

const DYNAMIC: Array<[RegExp, (id: string) => string]> = [
  [/^\/user\/bookings\/([A-Za-z0-9-]+)\/tracking$/, (id) => `/(app)/(tabs)/bookings/${id}/tracking`],
  [/^\/user\/bookings\/([A-Za-z0-9-]+)$/, (id) => `/(app)/(tabs)/bookings/${id}`],
  [/^\/user\/requirements\/([A-Za-z0-9-]+)$/, (id) => `/(app)/(tabs)/requirements/${id}`],
  [/^\/professional\/([A-Za-z0-9-]+)$/, (id) => `/(app)/professional/${id}`],
  [/^\/user\/wallet\/payment-history\/([A-Za-z0-9-]+)$/, (id) => `/(app)/payments/${id}`],
  [/^\/user\/messages\/([A-Za-z0-9-]+)$/, (id) => `/(app)/messages/${id}`],
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
