import type { MessageDto } from '@/api/shared';

/**
 * A conversation-list row carries only its most recent message, already
 * sorted newest-first by the backend (`listMine`'s `messages: { take: 1,
 * orderBy: desc }`) — so there is nothing to sort or search here.
 */
export function lastMessage(messages: MessageDto[] | undefined): MessageDto | undefined {
  return messages?.[0];
}

/**
 * List preview from the client's side — mirrors apps/web/components/messaging
 * /messaging-helpers.ts's previewText() for role === 'CLIENT'. A locked
 * message's body never reaches this viewer in the first place (see the
 * backend's toMessageDto), so this only has to pick the right copy for the
 * two cases where there's nothing real to show.
 */
export function previewText(last: Pick<MessageDto, 'message' | 'isLocked' | 'senderRole'> | undefined): string {
  if (!last) return 'No messages yet';
  if (last.isLocked) return 'Response locked — unlock to read it';
  return `${last.senderRole === 'CLIENT' ? 'You: ' : ''}${last.message ?? ''}`;
}

/** The client's first message to a professional needs at least this many characters (backend DTO rule). */
export const FIRST_MESSAGE_MIN = 10;

/** Longest reply the API accepts (SendMessageDto: 1-2000 characters). */
export const REPLY_MAX_LENGTH = 2000;
