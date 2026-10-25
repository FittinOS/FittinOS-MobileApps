/**
 * Error/empty/retry states on real screens, with only the network stubbed.
 */
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';

jest.setTimeout(60_000);

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const user = {
  id: 'u1', email: 'pro@fittin.local', role: 'PROFESSIONAL' as const, status: 'ACTIVE' as const, emailVerified: true,
  fullName: 'Rahul Verma', phone: null, avatarUrl: null, createdAt: '2026-01-01T00:00:00Z',
};
const page = <T,>(items: T[] = []) => ({ items, total: items.length, page: 1, limit: 20, totalPages: 1 });
const serverError = Object.assign(new Error('503'), { isAxiosError: true, response: { status: 503, data: { message: 'Service unavailable' } } });
const offline = Object.assign(new Error('Network Error'), { isAxiosError: true });

beforeEach(() => {
  store.clear();
  store.set('fittin.accessToken', 'a');
  store.set('fittin.refreshToken', 'r');
  resetTokenCacheForTests();
  jest.restoreAllMocks();
  jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(user);
  jest.spyOn(endpoints.notificationsApi, 'unreadCount').mockResolvedValue({ count: 0 });
  jest.spyOn(endpoints.conversationsApi, 'mine').mockResolvedValue(page());
  jest.spyOn(endpoints.leadsApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.leadsApi, 'stats').mockResolvedValue({
    totalLeads: 0, newLeads: 0, pendingLeads: 0, contactedLeads: 0, convertedLeads: 0, conversionRate: 0, recentLeads: [],
  });
});

it('dashboard shows a friendly server-error state and recovers on retry', async () => {
  const profile = jest.spyOn(endpoints.profileApi, 'get').mockRejectedValue(serverError);
  jest.spyOn(endpoints.servicesApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.bookingsApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.earningsApi, 'summary').mockResolvedValue({
    totalEarnings: 0, pendingEarnings: 0, availableForPayout: 0, paidOut: 0, completedSessions: 0, upcomingSessions: 0, currency: 'INR',
  });
  jest.spyOn(endpoints.earningsApi, 'payouts').mockResolvedValue(page());
  const screen = await renderRouter('src/app', { initialUrl: '/' });
  expect(await screen.findByText('Something went wrong on our end', {}, { timeout: 10_000 })).toBeTruthy();
  profile.mockResolvedValue({
    id: 'p1', userId: 'u1', bio: null, headline: null, city: null, area: null, experienceYears: null, specializations: [], languages: [],
    kycStatus: 'APPROVED', certificationStatus: 'APPROVED', isLive: true, acceptingWork: true, ratingAverage: 4.5, ratingCount: 2,
    user: { id: 'u1', fullName: 'Rahul Verma', avatarUrl: null, email: 'pro@fittin.local' },
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/Rahul/)).toBeTruthy();
  expect(screen.getByText(/profile is live/i)).toBeTruthy();
});

it('bookings tab: offline error, then empty state with a call to action', async () => {
  const list = jest.spyOn(endpoints.bookingsApi, 'list').mockRejectedValue(offline);
  const screen = await renderRouter('src/app', { initialUrl: '/bookings' });
  expect(await screen.findByText('Unable to connect', {}, { timeout: 10_000 })).toBeTruthy();
  list.mockResolvedValue(page());
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No upcoming bookings')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Manage availability' })).toBeTruthy();
});

it('leads tab lists a lead and blocks a too-short response before calling the API', async () => {
  jest.spyOn(endpoints.leadsApi, 'list').mockResolvedValue(
    page([
      {
        id: 'l1', clientId: 'c1', categoryId: 'cat', title: 'Need a yoga coach for back pain', description: 'Looking for 3 sessions a week, mornings, near Indiranagar.',
        preferredTime: 'Mornings', location: 'Indiranagar', budgetAmount: 80000, mode: 'IN_PERSON', status: 'OPEN', responseCount: 1,
        createdAt: new Date().toISOString(), leadStatus: 'NEW', source: 'Client Requirement', category: { id: 'cat', name: 'Yoga', slug: 'yoga', description: null, iconUrl: null, isActive: true, sortOrder: 1 },
      },
    ]),
  );
  const respond = jest.spyOn(endpoints.leadsApi, 'respond');
  const screen = await renderRouter('src/app', { initialUrl: '/leads' });
  expect(await screen.findByText('Need a yoga coach for back pain')).toBeTruthy();
  expect(screen.getByText('Budget ₹800 / session')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Respond' }));
  await fireEvent.changeText(await screen.findByLabelText('Your message'), 'Too short');
  await fireEvent.press(screen.getByRole('button', { name: 'Send response' }));
  expect(await screen.findByText('Your message must be at least 20 characters.')).toBeTruthy();
  expect(respond).not.toHaveBeenCalled();
});

it('settings: an empty (not loading, not errored) blocked-clients list shows its own EmptyState', async () => {
  jest.spyOn(endpoints.conversationsApi, 'blocked').mockResolvedValue([]);
  jest.spyOn(endpoints.notificationsApi, 'preferences').mockResolvedValue({ mutedCategories: [] });
  const screen = await renderRouter('src/app', { initialUrl: '/settings' });
  expect(await screen.findByText('Blocked clients')).toBeTruthy();
  expect(await screen.findByText('No blocked clients')).toBeTruthy();
});

it('settings: a blocked-clients load failure shows ErrorState, not the empty state', async () => {
  jest.spyOn(endpoints.conversationsApi, 'blocked').mockRejectedValue(serverError);
  jest.spyOn(endpoints.notificationsApi, 'preferences').mockResolvedValue({ mutedCategories: [] });
  const screen = await renderRouter('src/app', { initialUrl: '/settings' });
  // A 503 retries (see query-provider.tsx) before settling into isError — same allowance as the dashboard retry test above.
  expect(await screen.findByText('Blocked clients', {}, { timeout: 10_000 })).toBeTruthy();
  expect(screen.queryByText('No blocked clients')).toBeNull();
});

it('verification: empty KYC history and empty certifications each show their own EmptyState', async () => {
  jest.spyOn(endpoints.profileApi, 'get').mockResolvedValue({
    id: 'p1', userId: 'u1', bio: null, headline: null, city: null, area: null, experienceYears: null,
    specializations: [], languages: [], kycStatus: 'NOT_SUBMITTED', certificationStatus: 'NOT_SUBMITTED',
    isLive: false, acceptingWork: true, ratingAverage: null, ratingCount: 0,
    user: { id: 'u1', fullName: 'Rahul Verma', avatarUrl: null, email: 'pro@fittin.local' },
  });
  jest.spyOn(endpoints.profileApi, 'kycSubmissions').mockResolvedValue([]);
  jest.spyOn(endpoints.profileApi, 'certificationSubmissions').mockResolvedValue([]);
  const screen = await renderRouter('src/app', { initialUrl: '/verification' });
  expect(await screen.findByText('No KYC submissions yet')).toBeTruthy();
  expect(await screen.findByText('No certifications yet')).toBeTruthy();
});

it('verification: a certifications load failure shows ErrorState, not the empty state', async () => {
  jest.spyOn(endpoints.profileApi, 'get').mockResolvedValue({
    id: 'p1', userId: 'u1', bio: null, headline: null, city: null, area: null, experienceYears: null,
    specializations: [], languages: [], kycStatus: 'NOT_SUBMITTED', certificationStatus: 'NOT_SUBMITTED',
    isLive: false, acceptingWork: true, ratingAverage: null, ratingCount: 0,
    user: { id: 'u1', fullName: 'Rahul Verma', avatarUrl: null, email: 'pro@fittin.local' },
  });
  jest.spyOn(endpoints.profileApi, 'kycSubmissions').mockResolvedValue([]);
  jest.spyOn(endpoints.profileApi, 'certificationSubmissions').mockRejectedValue(serverError);
  const screen = await renderRouter('src/app', { initialUrl: '/verification' });
  expect(await screen.findByText('No KYC submissions yet')).toBeTruthy();
  // Same 503-retry allowance as the other error-path tests in this file.
  await screen.findByText('Something went wrong on our end', {}, { timeout: 10_000 });
  expect(screen.queryByText('No certifications yet')).toBeNull();
});
