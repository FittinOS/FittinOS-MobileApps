/**
 * Navigation + authentication flow tests against the REAL route tree
 * (src/app), real AuthProvider, real guards. Only the network layer
 * (src/api/endpoints) is stubbed, and the keystore is the in-memory mock.
 */
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, waitFor } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';

// Loading the whole route tree cold is slow on the first test.
jest.setTimeout(60_000);

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

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
const page = <T,>(items: T[] = []) => ({ items, total: items.length, page: 1, limit: 20, totalPages: 1 });

function stubWorkspace() {
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
    kycStatus: 'NOT_SUBMITTED',
    certificationStatus: 'NOT_SUBMITTED',
    isLive: false,
    acceptingWork: true,
    ratingAverage: null,
    ratingCount: 0,
    user: { id: 'u-pro', fullName: 'Rahul Verma', avatarUrl: null, email: 'pro@fittin.local' },
  });
  jest.spyOn(endpoints.servicesApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.leadsApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.leadsApi, 'stats').mockResolvedValue({
    totalLeads: 0, newLeads: 0, pendingLeads: 0, contactedLeads: 0, convertedLeads: 0, conversionRate: 0, recentLeads: [],
  });
  jest.spyOn(endpoints.bookingsApi, 'list').mockResolvedValue(page());
  jest.spyOn(endpoints.earningsApi, 'summary').mockResolvedValue({
    totalEarnings: 0, pendingEarnings: 0, availableForPayout: 0, paidOut: 0, completedSessions: 0, upcomingSessions: 0, currency: 'INR',
  });
  jest.spyOn(endpoints.earningsApi, 'payouts').mockResolvedValue(page());
  jest.spyOn(endpoints.notificationsApi, 'unreadCount').mockResolvedValue({ count: 3 });
  jest.spyOn(endpoints.conversationsApi, 'mine').mockResolvedValue(page());
}

function signedInKeystore() {
  store.set('fittin.accessToken', 'access-1');
  store.set('fittin.refreshToken', 'refresh-1');
}

beforeEach(() => {
  store.clear();
  resetTokenCacheForTests();
  jest.restoreAllMocks();
});

describe('session restore and guards', () => {
  it('no stored session → welcome / onboarding', async () => {
    const me = jest.spyOn(endpoints.authApi, 'me');
    const screen = await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByText('Create professional account')).toBeTruthy();
    expect(screen.getByText('Grow your fitness business')).toBeTruthy();
    expect(me).not.toHaveBeenCalled();
  });

  it('stored professional session → dashboard with the restored user', async () => {
    signedInKeystore();
    jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(proUser);
    stubWorkspace();
    const screen = await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByText(/Rahul/)).toBeTruthy();
    expect(await screen.findByText('Verification pending')).toBeTruthy();
    expect(screen.getByLabelText('Notifications, 3 unread')).toBeTruthy();
    // A restored session never passes through the one-time kyc-intro screen.
    expect(screen.queryByText('Verify your identity to unlock full access')).toBeNull();
  });

  it('a stored CLIENT session is rejected and cleared', async () => {
    signedInKeystore();
    jest.spyOn(endpoints.authApi, 'me').mockResolvedValue({ ...proUser, role: 'CLIENT' });
    const screen = await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByText('Create professional account')).toBeTruthy();
    expect(store.has('fittin.accessToken')).toBe(false);
  });

  it('backend unreachable at launch keeps the session and offers retry', async () => {
    signedInKeystore();
    jest.spyOn(endpoints.authApi, 'me').mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true }));
    const screen = await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByText("Can't reach FittinOS")).toBeTruthy();
    expect(store.get('fittin.refreshToken')).toBe('refresh-1');
  });

  it('unverified email → verification screen, not the workspace', async () => {
    signedInKeystore();
    jest.spyOn(endpoints.authApi, 'me').mockResolvedValue({ ...proUser, emailVerified: false });
    const screen = await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByText('Verify your email')).toBeTruthy();
    expect(screen.getByText('pro@fittin.local')).toBeTruthy();
  });
});

describe('sign in', () => {
  it('shows the backend message for wrong credentials and stays signed out', async () => {
    const err = Object.assign(new Error('401'), {
      isAxiosError: true,
      response: { status: 401, data: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' } },
    });
    jest.spyOn(endpoints.authApi, 'login').mockRejectedValue(err);
    const screen = await renderRouter('src/app', { initialUrl: '/login' });
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'pro@fittin.local');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'WrongPassword1');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
    expect(store.has('fittin.accessToken')).toBe(false);
  });

  it('validates the form before calling the API', async () => {
    const login = jest.spyOn(endpoints.authApi, 'login');
    const screen = await renderRouter('src/app', { initialUrl: '/login' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it('a successful professional login stores both tokens and opens the dashboard', async () => {
    jest.spyOn(endpoints.authApi, 'login').mockResolvedValue({ user: proUser, accessToken: 'A', refreshToken: 'R' });
    stubWorkspace();
    const screen = await renderRouter('src/app', { initialUrl: '/login' });
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'Pro@Fittin.local ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'Demo@Password1');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/Rahul/)).toBeTruthy();
    expect(endpoints.authApi.login).toHaveBeenCalledWith('pro@fittin.local', 'Demo@Password1');
    await waitFor(() => expect(store.get('fittin.refreshToken')).toBe('R'));
    // An ordinary login never passes through the one-time kyc-intro screen either.
    expect(screen.queryByText('Verify your identity to unlock full access')).toBeNull();
  });

  it('a client account cannot sign in to the professional app (and its session is revoked)', async () => {
    jest.spyOn(endpoints.authApi, 'login').mockResolvedValue({ user: { ...proUser, role: 'CLIENT' }, accessToken: 'A', refreshToken: 'R' });
    const logout = jest.spyOn(endpoints.authApi, 'logout').mockResolvedValue(null);
    const screen = await renderRouter('src/app', { initialUrl: '/login' });
    await fireEvent.changeText(await screen.findByLabelText('Email'), 'client@fittin.local');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'Demo@Password1');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/This app is for FittinOS professionals/)).toBeTruthy();
    expect(logout).toHaveBeenCalledWith('R');
    expect(store.has('fittin.accessToken')).toBe(false);
  });
});

describe('kyc-intro after signup verification', () => {
  it('a fresh email verification shows the kyc-intro screen before the dashboard, and "Skip for now" proceeds', async () => {
    signedInKeystore();
    const me = jest.spyOn(endpoints.authApi, 'me').mockResolvedValue({ ...proUser, emailVerified: false });
    const verifyEmail = jest.spyOn(endpoints.authApi, 'verifyEmail').mockResolvedValue(null);
    stubWorkspace();
    const screen = await renderRouter('src/app', { initialUrl: '/' });
    expect(await screen.findByText('Verify your email')).toBeTruthy();

    me.mockResolvedValue({ ...proUser, emailVerified: true });
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));

    expect(verifyEmail).toHaveBeenCalledWith('pro@fittin.local', '123456');
    expect(await screen.findByText('Verify your identity to unlock full access')).toBeTruthy();
    // The dashboard underneath hasn't rendered yet — the interstitial is exclusive, not an overlay.
    expect(screen.queryByText('Rahul')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    expect(await screen.findByText(/Rahul/)).toBeTruthy();
    expect(screen.queryByText('Verify your identity to unlock full access')).toBeNull();
  });

  it('"Verify KYC" dismisses the intro and opens the verification screen directly', async () => {
    signedInKeystore();
    const me = jest.spyOn(endpoints.authApi, 'me').mockResolvedValue({ ...proUser, emailVerified: false });
    jest.spyOn(endpoints.authApi, 'verifyEmail').mockResolvedValue(null);
    stubWorkspace();
    jest.spyOn(endpoints.profileApi, 'kycSubmissions').mockResolvedValue([]);
    jest.spyOn(endpoints.profileApi, 'certificationSubmissions').mockResolvedValue([]);
    const screen = await renderRouter('src/app', { initialUrl: '/' });
    await screen.findByText('Verify your email');

    me.mockResolvedValue({ ...proUser, emailVerified: true });
    await fireEvent.changeText(screen.getByLabelText('Verification code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify email' }));
    await screen.findByText('Verify your identity to unlock full access');

    await fireEvent.press(screen.getByRole('button', { name: 'Verify KYC' }));
    expect(await screen.findByRole('button', { name: 'Continue with DigiLocker' })).toBeTruthy();
  });
});
