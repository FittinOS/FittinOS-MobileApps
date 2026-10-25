import type { MessageDto } from '@/api/shared';

/** Latest message of a conversation, whatever order the backend sent them in. */
export function lastMessage(messages: MessageDto[] | undefined): MessageDto | undefined {
  if (!messages?.length) return undefined;
  return [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[messages.length - 1];
}

/** List preview from the professional's side — mirrors the web's previewText(). */
export function previewText(last: Pick<MessageDto, 'message' | 'isLocked' | 'senderRole'> | undefined): string {
  if (!last) return 'No messages yet';
  if (last.isLocked) return 'Your response is locked for the client';
  return `${last.senderRole === 'PROFESSIONAL' ? 'You: ' : ''}${last.message ?? ''}`;
}

/** Accepting a conversation needs a first response of at least this many characters (web rule). */
export const ACCEPT_MESSAGE_MIN = 10;
