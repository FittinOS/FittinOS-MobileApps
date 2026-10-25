/**
 * How a call looks to the person looking at it — pure functions over the
 * server's CallDto: which phase the UI is in, what to call it, how to describe
 * a finished call in the history. No React, no browser APIs, and only erasable
 * TypeScript (no enums / parameter properties) so it runs under `node --test`.
 *
 * Calls are free: nothing here formats, mentions or depends on any money.
 */
import type { CallDto, CallStatus, CallType } from '@fittin/shared-types';

// Local string constants (not imported values) so this module has no runtime dependency on the shared package.
export const ACTIVE_STATUSES: readonly CallStatus[] = ['REQUESTED', 'RINGING', 'ACCEPTED', 'CONNECTING', 'CONNECTED'];
export const RINGING_STATUSES: readonly CallStatus[] = ['REQUESTED', 'RINGING'];
export const LIVE_STATUSES: readonly CallStatus[] = ['ACCEPTED', 'CONNECTING', 'CONNECTED'];
export const TERMINAL_STATUSES: readonly CallStatus[] = ['ENDED', 'REJECTED', 'MISSED', 'CANCELLED', 'FAILED'];

export type CallDirection = 'OUTGOING' | 'INCOMING';

export type CallPhase =
  /** Nothing in progress. */
  | 'idle'
  /** Getting the microphone/camera and the network servers ready, before the call is placed or answered. */
  | 'preparing'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'ended';

export const isActiveStatus = (status: CallStatus): boolean => ACTIVE_STATUSES.includes(status);
export const isTerminalStatus = (status: CallStatus): boolean => TERMINAL_STATUSES.includes(status);
export const isRingingStatus = (status: CallStatus): boolean => RINGING_STATUSES.includes(status);
export const isLiveStatus = (status: CallStatus): boolean => LIVE_STATUSES.includes(status);

export function directionOf(call: Pick<CallDto, 'callerId'>, selfUserId: string): CallDirection {
  return call.callerId === selfUserId ? 'OUTGOING' : 'INCOMING';
}

/** The other person on the call, from the viewer's side. */
export function peerOf(call: CallDto, selfUserId: string): CallDto['caller'] {
  return call.callerId === selfUserId ? call.callee : call.caller;
}

export function phaseOf(status: CallStatus, direction: CallDirection): CallPhase {
  if (isRingingStatus(status)) return direction === 'OUTGOING' ? 'outgoing' : 'incoming';
  if (status === 'ACCEPTED' || status === 'CONNECTING') return 'connecting';
  if (status === 'CONNECTED') return 'connected';
  return 'ended';
}

export function callNoun(type: CallType): string {
  return type === 'VIDEO' ? 'video call' : 'voice call';
}

/** The line under the person's name while a call is in progress. */
export function liveStatusLabel(call: Pick<CallDto, 'status' | 'type'>, direction: CallDirection): string {
  switch (call.status) {
    case 'REQUESTED':
      return direction === 'OUTGOING' ? 'Calling…' : `Incoming ${callNoun(call.type)}`;
    case 'RINGING':
      return direction === 'OUTGOING' ? 'Ringing…' : `Incoming ${callNoun(call.type)}`;
    case 'ACCEPTED':
    case 'CONNECTING':
      return 'Connecting…';
    case 'CONNECTED':
      return 'Connected';
    default:
      return '';
  }
}

export type OutcomeKind = 'ENDED' | 'REJECTED' | 'MISSED' | 'CANCELLED' | 'FAILED';

export interface CallOutcome {
  kind: OutcomeKind;
  /** Headline shown on the call-ended screen. */
  title: string;
  /** One helpful sentence, when there is something to add. */
  detail: string | null;
  durationSeconds: number | null;
  /** Whether it went wrong for the viewer, for styling. */
  tone: 'neutral' | 'missed' | 'failed';
}

const connectionLost = (call: CallDto): boolean => call.endReason === 'CONNECTION_LOST' || call.endReason === 'SYSTEM_TIMEOUT';

/** Human-readable result of a finished call, from the viewer's side of it. */
export function outcomeOf(call: CallDto, direction: CallDirection): CallOutcome {
  const durationSeconds = call.durationSeconds;
  switch (call.status) {
    case 'MISSED':
      return direction === 'OUTGOING'
        ? { kind: 'MISSED', title: 'No answer', detail: `${call.callee.fullName} didn’t pick up.`, durationSeconds, tone: 'missed' }
        : {
            kind: 'MISSED',
            title: 'Missed call',
            detail: `You missed a ${callNoun(call.type)} from ${call.caller.fullName}.`,
            durationSeconds,
            tone: 'missed',
          };
    case 'REJECTED':
      return direction === 'OUTGOING'
        ? { kind: 'REJECTED', title: 'Call declined', detail: `${call.callee.fullName} declined the call.`, durationSeconds, tone: 'missed' }
        : { kind: 'REJECTED', title: 'Call declined', detail: null, durationSeconds, tone: 'neutral' };
    case 'CANCELLED':
      return direction === 'OUTGOING'
        ? { kind: 'CANCELLED', title: 'Call cancelled', detail: null, durationSeconds, tone: 'neutral' }
        : {
            kind: 'CANCELLED',
            title: 'Missed call',
            detail: `${call.caller.fullName} hung up before you answered.`,
            durationSeconds,
            tone: 'missed',
          };
    case 'FAILED':
      return {
        kind: 'FAILED',
        title: 'Call failed',
        detail:
          call.endReason === 'MEDIA_ERROR'
            ? 'A microphone or camera problem stopped the call.'
            : connectionLost(call)
              ? 'The connection was lost.'
              : 'We couldn’t connect the call. Check your connection and try again.',
        durationSeconds,
        tone: 'failed',
      };
    default:
      return {
        kind: 'ENDED',
        title: 'Call ended',
        detail: connectionLost(call) ? 'The connection was lost.' : null,
        durationSeconds,
        tone: connectionLost(call) ? 'failed' : 'neutral',
      };
  }
}

/** 75 -> "1:15", 3725 -> "1:02:05". Never negative, never NaN. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds as number)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export interface CallHistoryEntry {
  /** "Voice call" / "Video call". */
  label: string;
  direction: CallDirection;
  /** "Outgoing" / "Incoming". */
  directionLabel: string;
  /** What happened: "Ended", "Missed", "Declined", "Cancelled", "Failed", "In progress". */
  statusLabel: string;
  /** "2:14" when the call connected and ended, otherwise null. */
  duration: string | null;
  tone: 'neutral' | 'missed' | 'failed';
  /** ISO time to show (when the call was placed). */
  at: string;
}

/**
 * One row of a conversation's call history, from the viewer's side. Shows the
 * type, direction, when, how long and how it ended — never anything about money.
 */
export function historyEntryOf(call: CallDto, selfUserId: string): CallHistoryEntry {
  const direction = directionOf(call, selfUserId);
  const base = {
    label: call.type === 'VIDEO' ? 'Video call' : 'Voice call',
    direction,
    directionLabel: direction === 'OUTGOING' ? 'Outgoing' : 'Incoming',
    at: call.createdAt,
  };

  if (isActiveStatus(call.status)) {
    return { ...base, statusLabel: 'In progress', duration: null, tone: 'neutral' };
  }

  const outcome = outcomeOf(call, direction);
  const statusLabel =
    outcome.kind === 'MISSED'
      ? direction === 'OUTGOING'
        ? 'No answer'
        : 'Missed'
      : outcome.kind === 'REJECTED'
        ? 'Declined'
        : outcome.kind === 'CANCELLED'
          ? direction === 'OUTGOING'
            ? 'Cancelled'
            : 'Missed'
          : outcome.kind === 'FAILED'
            ? 'Failed'
            : 'Ended';

  const duration = outcome.kind === 'ENDED' && outcome.durationSeconds != null ? formatDuration(outcome.durationSeconds) : null;
  return { ...base, statusLabel, duration, tone: outcome.tone };
}
