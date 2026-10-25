/**
 * Whether a conversation's call buttons should be usable right now, and if not,
 * the one-line reason to show. Pure and erasable-TypeScript only, so it runs
 * under `node --test`.
 *
 * The conversation rule mirrors the server's (which is what actually enforces
 * it): calls, like free two-way messaging, only exist once the conversation is
 * UNLOCKED — a call must never be a way around the message unlock. The other
 * reasons are about this browser or this moment.
 */
import type { ConversationStatus } from '@fittin/shared-types';
import type { CallPhase } from './call-status.ts';

export type CallViewerRole = 'CLIENT' | 'PROFESSIONAL';

export interface CallAvailabilityInput {
  viewerRole: CallViewerRole;
  conversationStatus: ConversationStatus;
  /** From `callSupport()`. */
  browserSupport: { supported: boolean; reason: string | null };
  socket: 'idle' | 'connecting' | 'connected' | 'disconnected';
  phase: CallPhase;
}

export interface CallAvailability {
  available: boolean;
  /** Why the buttons are disabled; null when they are usable. */
  reason: string | null;
}

export function conversationCallReason(status: ConversationStatus, viewerRole: CallViewerRole): string | null {
  switch (status) {
    case 'UNLOCKED':
      return null;
    case 'AWAITING_PROFESSIONAL':
      return viewerRole === 'CLIENT'
        ? 'Calls are available once the professional responds and you unlock their reply.'
        : 'Calls are available once you respond and the client unlocks your reply.';
    case 'RESPONSE_LOCKED':
      return viewerRole === 'CLIENT'
        ? 'Unlock the professional’s response to start a call.'
        : 'Calls are available once the client unlocks your response.';
    case 'DECLINED':
      return 'This conversation has ended.';
    default:
      return 'Calls aren’t available for this conversation.';
  }
}

export function callAvailability(input: CallAvailabilityInput): CallAvailability {
  const conversationReason = conversationCallReason(input.conversationStatus, input.viewerRole);
  if (conversationReason) return { available: false, reason: conversationReason };

  if (!input.browserSupport.supported) return { available: false, reason: input.browserSupport.reason };

  if (input.phase !== 'idle' && input.phase !== 'ended') {
    return { available: false, reason: 'You’re already on a call.' };
  }

  if (input.socket === 'connecting' || input.socket === 'idle') {
    return { available: false, reason: 'Connecting to the call service…' };
  }
  if (input.socket === 'disconnected') {
    return { available: false, reason: 'Can’t reach the call service. Check your connection.' };
  }

  return { available: true, reason: null };
}
