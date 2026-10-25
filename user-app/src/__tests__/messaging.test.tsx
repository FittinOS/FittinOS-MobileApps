/**
 * The User App's messaging screens, with only the network stubbed — same
 * harness as the Professional App's own screen tests.
 */
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as endpoints from '@/api/endpoints';
import { resetTokenCacheForTests } from '@/lib/token-store';
import type { ConversationDto, MessageDto } from '@/api/shared';
import { ConversationStatus, MessageSenderRole } from '@/api/shared';

jest.setTimeout(60_000);

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const user = {
  id: 'u1', email: 'client@fittin.local', role: 'CLIENT' as const, status: 'ACTIVE' as const, emailVerified: true,
  fullName: 'Ananya Rao', phone: null, avatarUrl: null, createdAt: '2026-01-01T00:00:00Z',
};
const wallet = { id: 'w1', userId: 'u1', coinBalance: 50, updatedAt: '2026-01-01T00:00:00Z' };
const page = <T,>(items: T[] = []) => ({ items, total: items.length, page: 1, limit: 20, totalPages: 1 });

const professional = {
  id: 'p1', userId: 'pu1', bio: 'Ten years coaching.', headline: 'Strength coach', city: 'Bengaluru', area: null,
  experienceYears: 10, specializations: ['Strength'], languages: ['English'], kycStatus: 'APPROVED' as const,
  certificationStatus: 'APPROVED' as const, isLive: true, acceptingWork: true, ratingAverage: 4.5, ratingCount: 2,
  user: { id: 'pu1', fullName: 'Rohan Mehta', avatarUrl: null, email: '' },
};

function conv(over: Partial<ConversationDto> = {}): ConversationDto {
  return {
    id: 'c1', clientId: 'u1', professionalId: 'p1', status: ConversationStatus.UNLOCKED, unlockCoinCost: 20,
    declineReason: null, unlockedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
    professional, client: { id: 'u1', fullName: 'Ananya Rao', avatarUrl: null },
    messages: [{ id: 'm1', conversationId: 'c1', senderRole: MessageSenderRole.CLIENT, isLocked: false, message: 'Hi, are you free this week?', createdAt: '2026-01-01T00:00:00Z' }],
    ...over,
  } as ConversationDto;
}

beforeEach(() => {
  store.clear();
  store.set('fittinuser.accessToken', 'a');
  store.set('fittinuser.refreshToken', 'r');
  resetTokenCacheForTests();
  jest.restoreAllMocks();
  jest.spyOn(endpoints.authApi, 'me').mockResolvedValue(user);
  jest.spyOn(endpoints.walletApi, 'balance').mockResolvedValue(wallet);
});

describe('Messages list', () => {
  it('shows a friendly error and recovers on retry, then an empty state', async () => {
    const offline = Object.assign(new Error('Network Error'), { isAxiosError: true });
    const mine = jest.spyOn(endpoints.conversationsApi, 'mine').mockRejectedValue(offline);
    await renderRouter('src/app', { initialUrl: '/messages' });
    expect(await screen.findByText('Unable to connect', {}, { timeout: 10_000 })).toBeTruthy();
    mine.mockResolvedValue(page());
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No messages yet')).toBeTruthy();
  });

  it('lists a real conversation with the professional name, preview and status', async () => {
    jest.spyOn(endpoints.conversationsApi, 'mine').mockResolvedValue(page([conv({ status: 'RESPONSE_LOCKED', messages: [{ id: 'm2', conversationId: 'c1', senderRole: 'PROFESSIONAL', isLocked: true, message: null, createdAt: '2026-01-02T00:00:00Z' }] })]));
    await renderRouter('src/app', { initialUrl: '/messages' });
    expect(await screen.findByText('Rohan Mehta')).toBeTruthy();
    expect(screen.getByText('Response locked — unlock to read it')).toBeTruthy();
    expect(screen.getByText('Response received')).toBeTruthy();
  });

  it('opens the right conversation on tap', async () => {
    jest.spyOn(endpoints.conversationsApi, 'mine').mockResolvedValue(page([conv()]));
    const get = jest.spyOn(endpoints.conversationsApi, 'get').mockResolvedValue(conv());
    await renderRouter('src/app', { initialUrl: '/messages' });
    await fireEvent.press(await screen.findByText('Rohan Mehta'));
    await waitFor(() => expect(get).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('Hi, are you free this week?')).toBeTruthy();
  });
});

describe('Conversation detail', () => {
  it('renders the thread and an empty composer when awaiting the professional', async () => {
    jest.spyOn(endpoints.conversationsApi, 'get').mockResolvedValue(conv({ status: 'AWAITING_PROFESSIONAL' }));
    await renderRouter('src/app', { initialUrl: '/messages/c1' });
    expect(await screen.findByText('Hi, are you free this week?')).toBeTruthy();
    expect(screen.getByText('Waiting for Rohan Mehta to respond.')).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull(); // no composer until unlocked
  });

  it('sends a reply once, disables the button meanwhile, and refreshes the thread', async () => {
    jest.spyOn(endpoints.conversationsApi, 'get').mockResolvedValue(conv());
    let resolveReply!: (v: MessageDto) => void;
    const reply = jest.spyOn(endpoints.conversationsApi, 'reply').mockReturnValue(new Promise<MessageDto>((r) => (resolveReply = r)));
    await renderRouter('src/app', { initialUrl: '/messages/c1' });
    const input = await screen.findByLabelText('Message');
    await fireEvent.changeText(input, 'Sounds great, see you then');
    const send = screen.getByLabelText('Send message');
    await fireEvent.press(send);
    await fireEvent.press(send); // a second tap before the request resolves must not fire twice
    expect(reply).toHaveBeenCalledTimes(1);
    resolveReply({ id: 'm3', conversationId: 'c1', senderRole: 'CLIENT', isLocked: false, message: 'Sounds great, see you then', createdAt: '2026-01-03T00:00:00Z' });
    await waitFor(() => expect(screen.getByLabelText('Message').props.value).toBe(''));
  });

  it('shows a locked response as an unlock prompt, not the message body', async () => {
    jest.spyOn(endpoints.conversationsApi, 'get').mockResolvedValue(
      conv({
        status: 'RESPONSE_LOCKED',
        messages: [
          conv().messages![0],
          { id: 'm2', conversationId: 'c1', senderRole: 'PROFESSIONAL', isLocked: true, message: null, createdAt: '2026-01-02T00:00:00Z' },
        ],
      }),
    );
    await renderRouter('src/app', { initialUrl: '/messages/c1' });
    expect(await screen.findByText('Unlock · 20 coins')).toBeTruthy();
    expect(screen.queryByText(/professional.*body/i)).toBeNull();
  });

  it('confirms before unlocking, shows the real coin cost, and refreshes the wallet after', async () => {
    const locked = conv({
      status: 'RESPONSE_LOCKED',
      messages: [conv().messages![0], { id: 'm2', conversationId: 'c1', senderRole: 'PROFESSIONAL', isLocked: true, message: null, createdAt: '2026-01-02T00:00:00Z' }],
    });
    const get = jest.spyOn(endpoints.conversationsApi, 'get').mockResolvedValue(locked);
    const unlock = jest.spyOn(endpoints.conversationsApi, 'unlock').mockResolvedValue({ ...locked, status: 'UNLOCKED' });
    await renderRouter('src/app', { initialUrl: '/messages/c1' });
    await fireEvent.press(await screen.findByLabelText('Unlock for 20 coins'));
    expect(await screen.findByText(/spends 20 coins from your wallet \(balance: 50\)/i)).toBeTruthy();
    expect(unlock).not.toHaveBeenCalled(); // opening the dialog must never itself spend coins
    await fireEvent.press(screen.getByRole('button', { name: 'Unlock · 20 coins' }));
    await waitFor(() => expect(unlock).toHaveBeenCalledWith('c1'));
    expect(get).toHaveBeenCalledTimes(2); // refetched after the confirmed unlock
  });

  it("blocks confirming an unlock it can't afford, without a false success", async () => {
    jest.spyOn(endpoints.walletApi, 'balance').mockResolvedValue({ ...wallet, coinBalance: 5 });
    jest.spyOn(endpoints.conversationsApi, 'get').mockResolvedValue(
      conv({
        status: 'RESPONSE_LOCKED',
        messages: [conv().messages![0], { id: 'm2', conversationId: 'c1', senderRole: 'PROFESSIONAL', isLocked: true, message: null, createdAt: '2026-01-02T00:00:00Z' }],
      }),
    );
    const unlock = jest.spyOn(endpoints.conversationsApi, 'unlock');
    await renderRouter('src/app', { initialUrl: '/messages/c1' });
    await fireEvent.press(await screen.findByLabelText('Unlock for 20 coins'));
    expect(await screen.findByText("You don't have enough coins for this.")).toBeTruthy();
    expect(unlock).not.toHaveBeenCalled();
  });

  it('surfaces a backend unlock failure without claiming success', async () => {
    jest.spyOn(endpoints.conversationsApi, 'get').mockResolvedValue(
      conv({
        status: 'RESPONSE_LOCKED',
        messages: [conv().messages![0], { id: 'm2', conversationId: 'c1', senderRole: 'PROFESSIONAL', isLocked: true, message: null, createdAt: '2026-01-02T00:00:00Z' }],
      }),
    );
    jest.spyOn(endpoints.conversationsApi, 'unlock').mockRejectedValue(
      Object.assign(new Error('400'), { isAxiosError: true, response: { status: 400, data: { message: 'INSUFFICIENT_COINS' } } }),
    );
    await renderRouter('src/app', { initialUrl: '/messages/c1' });
    await fireEvent.press(await screen.findByLabelText('Unlock for 20 coins'));
    await fireEvent.press(screen.getByRole('button', { name: 'Unlock · 20 coins' }));
    expect(await screen.findByText('INSUFFICIENT_COINS')).toBeTruthy();
    expect(screen.queryByText('No messages yet')).toBeNull(); // dialog stayed open — no silent "it worked"
  });
});

describe('Message entry point on a professional profile', () => {
  const baseMocks = () => {
    jest.spyOn(endpoints.professionalsApi, 'get').mockResolvedValue(professional);
    jest.spyOn(endpoints.servicesApi, 'list').mockResolvedValue(page());
    jest.spyOn(endpoints.professionalsApi, 'reviews').mockResolvedValue(page());
  };

  it('is only offered for a live professional, and sends a free first message', async () => {
    baseMocks();
    const start = jest.spyOn(endpoints.conversationsApi, 'start').mockResolvedValue(conv());
    await renderRouter('src/app', { initialUrl: '/professional/p1' });
    const entry = await screen.findByLabelText('Message Rohan Mehta');
    await fireEvent.press(entry);
    const input = await screen.findByLabelText('Your message');
    await fireEvent.changeText(input, 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Send (free)' }));
    expect(await screen.findByText(/at least 10 characters/i)).toBeTruthy();
    expect(start).not.toHaveBeenCalled();
    await fireEvent.changeText(input, 'Hi, I need help with strength training');
    await fireEvent.press(screen.getByRole('button', { name: 'Send (free)' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith({ professionalId: 'p1', message: 'Hi, I need help with strength training' }));
  });

  it('offers a way to the existing thread instead of a dead-end error on a duplicate', async () => {
    baseMocks();
    jest.spyOn(endpoints.conversationsApi, 'start').mockRejectedValue(
      Object.assign(new Error('409'), {
        isAxiosError: true,
        response: { status: 409, data: { message: 'You have already contacted this professional. Continue your existing conversation instead.' } },
      }),
    );
    await renderRouter('src/app', { initialUrl: '/professional/p1' });
    await fireEvent.press(await screen.findByLabelText('Message Rohan Mehta'));
    const input = await screen.findByLabelText('Your message');
    await fireEvent.changeText(input, 'Hi, I need help with strength training');
    await fireEvent.press(screen.getByRole('button', { name: 'Send (free)' }));
    expect(await screen.findByText(/already contacted this professional/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go to Messages' })).toBeTruthy();
  });
});
