import { FIRST_MESSAGE_MIN, lastMessage, previewText, REPLY_MAX_LENGTH } from '../messaging-helpers';

const msg = (over: Partial<Parameters<typeof previewText>[0]> = {}) => ({
  message: 'Hi there',
  isLocked: false,
  senderRole: 'PROFESSIONAL' as const,
  ...over,
});

describe('messaging-helpers', () => {
  it('lastMessage reads the list row\'s single preview item, already newest-first from the backend', () => {
    expect(lastMessage(undefined)).toBeUndefined();
    expect(lastMessage([])).toBeUndefined();
    const m = msg();
    expect(lastMessage([m as never])).toBe(m);
  });

  it('previewText never renders a locked body, and prefixes the client\'s own messages', () => {
    expect(previewText(undefined)).toBe('No messages yet');
    expect(previewText(msg({ isLocked: true, message: null }))).toBe('Response locked — unlock to read it');
    expect(previewText(msg({ senderRole: 'PROFESSIONAL', message: 'Sure, let\'s talk' }))).toBe("Sure, let's talk");
    expect(previewText(msg({ senderRole: 'CLIENT', message: 'Looking for a trainer' }))).toBe('You: Looking for a trainer');
  });

  it('exposes the backend DTO\'s own length limits rather than hardcoding them ad hoc', () => {
    expect(FIRST_MESSAGE_MIN).toBe(10);
    expect(REPLY_MAX_LENGTH).toBe(2000);
  });
});
