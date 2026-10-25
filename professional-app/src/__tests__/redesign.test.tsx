/**
 * Redesign navigation + theme tests against the REAL route tree: the five
 * primary tabs, header shortcuts, moved secondary routes, and the persisted
 * light/dark preference. Only src/api/endpoints is stubbed.
 */
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';
import { THEME_PREFERENCE_KEY } from '@/theme/theme-provider';

jest.setTimeout(60_000);

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const page = <T,>(items: T[] = []) => ({ items, total: items.length, page: 1, limit: 20, totalPages: 1 });

const proUser = {
  id: 'u-pro',
  email: 'pro@fittin.local',
  role: 'PROFESSIONAL' as const,
  status: 'ACTIVE' as const,
  emailVerified: true,
  fullName: 'Rahul Verma',
  phone: null,
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
};

function stubWorkspace() {
  store.set('fittin.accessToken', 'access-1');
  store.set('fittin.refreshToken', 'refresh-1');
  jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(proUser);
  jest.spyOn(endpoints.profileApi, 'get').mockResolvedValue({
    id: 'p1',
    userId: 'u-pro',
    bio: null,
    headline: null,
    city: null,
    area: null,
    experienceYears: null,
    specializations: [],
    languages: [],
    kycStatus: 'APPROVED',
    certificationStatus: 'NOT_SUBMITTED',
    isLive: true,
    acceptingWork: true,
    ratingAverage: null,
    ratingCount: 0,
    user: { id: 'u-pro', fullName: 'Rahul Verma', avatarUrl: null, email: 'pro@fittin.local' },
  } as never);
  jest.spyOn(endpoints.profileApi, 'certificationSubmissions').mockResolvedValue([]);
  jest.spyOn(endpoints.servicesApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.leadsApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.leadsApi, 'stats').mockResolvedValue({
    totalLeads: 0, newLeads: 0, pendingLeads: 0, contactedLeads: 0, convertedLeads: 0, conversionRate: 0, recentLeads: [],
  });
  jest.spyOn(endpoints.bookingsApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.availabilityApi, 'mine').mockResolvedValue(page());
  jest.spyOn(endpoints.earningsApi, 'summary').mockResolvedValue({
    totalEarnings: 0, pendingEarnings: 0, availableForPayout: 0, paidOut: 0, completedSessions: 0, upcomingSessions: 0, currency: 'INR',
  });
  jest.spyOn(endpoints.earningsApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.earningsApi, 'payouts').mockResolvedValue(page());
  jest.spyOn(endpoints.payoutAccountApi, 'get').mockResolvedValue({ account: null, readiness: { canReceivePayout: false, blockedReason: null } } as never);
  jest.spyOn(endpoints.walletApi, 'balance').mockResolvedValue({ coinBalance: 0 } as never);
  jest.spyOn(endpoints.notificationsApi, 'unreadCount').mockResolvedValue({ count: 2 });
  jest.spyOn(endpoints.notificationsApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.conversationsApi, 'mine').mockResolvedValue({ ...page(), total: 1 });
}

beforeEach(() => {
  store.clear();
  resetTokenCacheForTests();
  jest.restoreAllMocks();
});

describe('primary navigation', () => {
  it('shows exactly five tabs in order: Home, Service, Earnings, Availability, Profile', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByText(/Rahul/)).toBeTruthy();
    const NAV_TABS = ['Home', 'Service', 'Earnings', 'Availability', 'Profile'];
    // The Home dashboard's own Upcoming/Today Segmented control also uses role="tab" (it's a
    // tablist too) — filter to just the bottom nav's five before checking order.
    const tabs = screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel).filter((l) => NAV_TABS.includes(l));
    expect(tabs).toEqual(NAV_TABS);
    expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState).toEqual({ selected: true });
  });

  it('each tab opens its screen and becomes the active tab', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/' });
    await screen.findByText(/Rahul/);

    await fireEvent.press(screen.getByRole('tab', { name: 'Service' }));
    expect(await screen.findByText('No services yet')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Service' }).props.accessibilityState).toEqual({ selected: true });

    await fireEvent.press(screen.getByRole('tab', { name: 'Earnings' }));
    expect(await screen.findByText('How your money moves')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Availability' }));
    expect(await screen.findByText('Next two weeks')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    expect(await screen.findByText('Your work')).toBeTruthy();
  });

  it('header shortcuts open the existing messages and notifications screens, with real counts', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/' });
    await screen.findByText(/Rahul/);
    await fireEvent.press(await screen.findByLabelText('Messages, 1 awaiting your reply'));
    expect(await screen.findByText('Chat and call clients — calls are free.')).toBeTruthy();
  });

  it('the notifications shortcut shows the unread count and opens notifications', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByLabelText('Notifications, 2 unread'));
    await waitFor(() => expect(endpoints.notificationsApi.list).toHaveBeenCalled());
  });

  it('former tab routes and /more still resolve', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/more' });
    expect(await screen.findByText('Your work')).toBeTruthy();
  });

  it('/bookings is a stack screen above the tabs', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/bookings' });
    expect(await screen.findByText('No upcoming bookings')).toBeTruthy();
    expect(screen.queryAllByRole('tab', { name: 'Home' })).toHaveLength(0);
  });
});

describe('theme', () => {
  it('the header toggle switches to dark and persists the choice', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByLabelText('Switch to dark mode'));
    expect(await screen.findByLabelText('Switch to light mode')).toBeTruthy();
    await waitFor(() => expect(store.get(THEME_PREFERENCE_KEY)).toBe('dark'));
  });

  it('a stored dark preference is applied on the first screen after launch', async () => {
    stubWorkspace();
    store.set(THEME_PREFERENCE_KEY, 'dark');
    await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByLabelText('Switch to light mode')).toBeTruthy();
  });

  it('the Appearance screen stores an explicit light choice', async () => {
    stubWorkspace();
    store.set(THEME_PREFERENCE_KEY, 'dark');
    await renderRouter('src/app', { initialUrl: '/appearance' });
    await fireEvent.press(await screen.findByLabelText('Light theme'));
    await waitFor(() => expect(store.get(THEME_PREFERENCE_KEY)).toBe('light'));
    expect(await screen.findByText(/Always light/)).toBeTruthy();
  });

  it('Profile links to the Appearance screen', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/profile' });
    await fireEvent.press(await screen.findByLabelText('Appearance. Light, dark or follow your phone'));
    expect(await screen.findByText(/Saved on this device/)).toBeTruthy();
  });
});

const lead = {
  id: 'lead-1',
  clientId: 'c1',
  categoryId: 'cat1',
  title: 'Morning yoga for two',
  description: 'Looking for a calm hatha session twice a week at home.',
  preferredTime: 'Weekday mornings',
  location: 'Indiranagar',
  budgetAmount: 60000,
  mode: 'IN_PERSON',
  status: 'OPEN',
  responseCount: 2,
  createdAt: '2026-10-01T05:00:00Z',
  category: { id: 'cat1', name: 'Yoga' },
  leadStatus: 'NEW',
  source: 'Client Requirement',
};

describe('reference screens added in the redesign', () => {
  it('Profile setup lists real steps and offers the first unfinished one', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/profile-setup' });
    expect(await screen.findByText('Complete your profile')).toBeTruthy();
    // KYC is APPROVED in the stub; headline/bio are empty, so basic info is next.
    expect(await screen.findByRole('button', { name: 'Next: Basic information' })).toBeTruthy();
    expect(screen.getByLabelText(/KYC verification, done/)).toBeTruthy();
    expect(screen.getByLabelText(/Services, to do/)).toBeTruthy();
  });

  it('a lead card opens its details, built from the loaded list', async () => {
    stubWorkspace();
    jest.spyOn(endpoints.leadsApi, 'list').mockResolvedValue({ ...page([lead] as never[]), total: 1 });
    await renderRouter('src/app', { initialUrl: '/leads' });
    await fireEvent.press(await screen.findByLabelText('Morning yoga for two, New. Open lead details'));
    expect(await screen.findByText('Lead progress')).toBeTruthy();
    expect(screen.getByText('Looking for a calm hatha session twice a week at home.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Respond to this lead' })).toBeTruthy();
  });

  it('a deep link to an unknown lead says so instead of inventing one', async () => {
    stubWorkspace();
    await renderRouter('src/app', { initialUrl: '/leads/missing' });
    expect(await screen.findByText("This lead isn't available")).toBeTruthy();
  });

  it('a 403 offers Contact support instead of a pointless retry', async () => {
    stubWorkspace();
    jest.spyOn(endpoints.servicesApi, 'list').mockRejectedValue(
      Object.assign(new Error('403'), { isAxiosError: true, response: { status: 403, data: { message: 'Not allowed.' } } }),
    );
    await renderRouter('src/app', { initialUrl: '/services' });
    expect(await screen.findByRole('button', { name: 'Contact support' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
