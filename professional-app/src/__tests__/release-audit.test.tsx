/**
 * Regression tests for defects found in the release-readiness audit.
 */
import * as SecureStore from 'expo-secure-store';
import { renderRouter } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';

jest.setTimeout(60_000);

describe('release configuration guard (app.config.ts)', () => {
  // app.config.ts refuses to load as a release config without its inputs, so load it as dev.
  process.env.APP_VARIANT = 'development';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { releaseConfigProblems } = require('../../app.config') as typeof import('../../app.config');

  it('a release with nothing set is refused on every input', () => {
    expect(releaseConfigProblems({})).toHaveLength(3);
  });
  it('rejects a dev application id, an http/emulator API URL and an unset Cashfree mode', () => {
    const problems = releaseConfigProblems({
      ANDROID_APPLICATION_ID: 'com.fittinos.professional.dev',
      EXPO_PUBLIC_API_URL: 'http://10.0.2.2:4100/api',
    });
    expect(problems.join(' ')).toMatch(/not a valid release application id/);
    expect(problems.join(' ')).toMatch(/https:\/\/<host>\/api/);
    expect(problems.join(' ')).toMatch(/SANDBOX or PRODUCTION/);
  });
  it('accepts a complete release configuration', () => {
    expect(
      releaseConfigProblems({
        ANDROID_APPLICATION_ID: 'com.example.pro',
        EXPO_PUBLIC_API_URL: 'https://api.example.com/api',
        EXPO_PUBLIC_CASHFREE_ENVIRONMENT: 'production',
      }),
    ).toEqual([]);
  });
});

describe('lead counts come from actionable /leads, not /leads/stats', () => {
  const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
  const page = <T,>(items: T[] = []) => ({ items, total: items.length, page: 1, limit: 20, totalPages: 1 });

  it('6 closed requirements counted as "new" by stats produce no badge and no fake open leads', async () => {
    store.clear();
    store.set('fittin.accessToken', 'a');
    store.set('fittin.refreshToken', 'r');
    resetTokenCacheForTests();
    jest.spyOn(endpoints.authApi, 'me').mockResolvedValue({
      id: 'u1', email: 'pro@fittin.local', role: 'PROFESSIONAL', status: 'ACTIVE', emailVerified: true,
      fullName: 'Rohan Mehta', phone: null, avatarUrl: null, createdAt: '2026-01-01T00:00:00Z',
    });
    jest.spyOn(endpoints.profileApi, 'get').mockResolvedValue({
      id: 'p1', userId: 'u1', bio: 'b', headline: 'h', city: null, area: null, experienceYears: 3, specializations: [], languages: [],
      kycStatus: 'APPROVED', certificationStatus: 'APPROVED', isLive: true, acceptingWork: true, ratingAverage: null, ratingCount: 0,
      user: { id: 'u1', fullName: 'Rohan Mehta', avatarUrl: null, email: 'pro@fittin.local' },
    });
    const stats = jest.spyOn(endpoints.leadsApi, 'stats').mockResolvedValue({
      totalLeads: 6, newLeads: 6, pendingLeads: 0, contactedLeads: 0, convertedLeads: 0, conversionRate: 0, recentLeads: [],
    });
    jest.spyOn(endpoints.leadsApi, 'list').mockResolvedValue(page());
    jest.spyOn(endpoints.servicesApi, 'list').mockResolvedValue(page());
    jest.spyOn(endpoints.bookingsApi, 'list').mockResolvedValue(page());
    jest.spyOn(endpoints.earningsApi, 'summary').mockResolvedValue({
      totalEarnings: 0, pendingEarnings: 0, availableForPayout: 0, paidOut: 0, completedSessions: 0, upcomingSessions: 0, currency: 'INR',
    });
    jest.spyOn(endpoints.earningsApi, 'payouts').mockResolvedValue(page());
    jest.spyOn(endpoints.notificationsApi, 'unreadCount').mockResolvedValue({ count: 0 });
    jest.spyOn(endpoints.conversationsApi, 'mine').mockResolvedValue(page());

    const screen = await renderRouter('src/app', { initialUrl: '/' });
    // The Leads quick action's badge counts actionable leads (/leads), never /leads/stats'
    // all-time "new" — zero leads renders no badge at all, never the stats' fake count of 6.
    expect(await screen.findByLabelText('Leads')).toBeTruthy();
    expect(screen.queryByLabelText(/Leads, 6/)).toBeNull();
    expect(screen.queryByText('6')).toBeNull();
    expect(stats).not.toHaveBeenCalled();
  });
});
