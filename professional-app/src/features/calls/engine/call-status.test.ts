import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CallDto } from '@fittin/shared-types';
import {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  directionOf,
  formatDuration,
  historyEntryOf,
  isActiveStatus,
  isTerminalStatus,
  liveStatusLabel,
  outcomeOf,
  peerOf,
  phaseOf,
} from './call-status.ts';

const ME = 'user-me';
const THEM = 'user-them';

function call(overrides: Partial<CallDto> = {}): CallDto {
  return {
    id: 'call-1',
    conversationId: 'conv-1',
    callerId: ME,
    calleeId: THEM,
    caller: { id: ME, fullName: 'Me Myself', avatarUrl: null },
    callee: { id: THEM, fullName: 'Riya Coach', avatarUrl: null },
    type: 'VOICE',
    status: 'ENDED',
    endReason: null,
    version: 3,
    ringExpiresAt: '2026-09-24T10:00:45.000Z',
    acceptedAt: null,
    connectedAt: null,
    endedAt: null,
    durationSeconds: null,
    createdAt: '2026-09-24T10:00:00.000Z',
    ...overrides,
  };
}

describe('status groups', () => {
  it('splits every status into exactly one of active / terminal', () => {
    for (const status of [...ACTIVE_STATUSES, ...TERMINAL_STATUSES]) {
      assert.equal(isActiveStatus(status), !isTerminalStatus(status));
    }
    assert.equal(ACTIVE_STATUSES.length + TERMINAL_STATUSES.length, 10);
  });
});

describe('direction and peer', () => {
  it('is outgoing for the caller and incoming for the callee', () => {
    assert.equal(directionOf(call(), ME), 'OUTGOING');
    assert.equal(directionOf(call(), THEM), 'INCOMING');
  });

  it('always names the OTHER person', () => {
    assert.equal(peerOf(call(), ME).fullName, 'Riya Coach');
    assert.equal(peerOf(call(), THEM).fullName, 'Me Myself');
  });
});

describe('phaseOf', () => {
  it('maps every status for both directions', () => {
    assert.equal(phaseOf('REQUESTED', 'OUTGOING'), 'outgoing');
    assert.equal(phaseOf('RINGING', 'OUTGOING'), 'outgoing');
    assert.equal(phaseOf('REQUESTED', 'INCOMING'), 'incoming');
    assert.equal(phaseOf('RINGING', 'INCOMING'), 'incoming');
    assert.equal(phaseOf('ACCEPTED', 'OUTGOING'), 'connecting');
    assert.equal(phaseOf('CONNECTING', 'INCOMING'), 'connecting');
    assert.equal(phaseOf('CONNECTED', 'OUTGOING'), 'connected');
    for (const status of TERMINAL_STATUSES) assert.equal(phaseOf(status, 'OUTGOING'), 'ended');
  });
});

describe('liveStatusLabel', () => {
  it('says what is happening from each side', () => {
    assert.equal(liveStatusLabel(call({ status: 'REQUESTED' }), 'OUTGOING'), 'Calling…');
    assert.equal(liveStatusLabel(call({ status: 'RINGING' }), 'OUTGOING'), 'Ringing…');
    assert.equal(liveStatusLabel(call({ status: 'RINGING', type: 'VIDEO' }), 'INCOMING'), 'Incoming video call');
    assert.equal(liveStatusLabel(call({ status: 'REQUESTED', type: 'VOICE' }), 'INCOMING'), 'Incoming voice call');
    assert.equal(liveStatusLabel(call({ status: 'ACCEPTED' }), 'OUTGOING'), 'Connecting…');
    assert.equal(liveStatusLabel(call({ status: 'CONNECTING' }), 'INCOMING'), 'Connecting…');
    assert.equal(liveStatusLabel(call({ status: 'CONNECTED' }), 'OUTGOING'), 'Connected');
    assert.equal(liveStatusLabel(call({ status: 'ENDED' }), 'OUTGOING'), '');
  });
});

describe('outcomeOf — what the ended screen says', () => {
  it('outgoing, not answered: "No answer"', () => {
    const o = outcomeOf(call({ status: 'MISSED' }), 'OUTGOING');
    assert.equal(o.title, 'No answer');
    assert.match(o.detail ?? '', /Riya Coach didn’t pick up/);
    assert.equal(o.tone, 'missed');
  });

  it('incoming, not answered: "Missed call" naming the caller and the kind of call', () => {
    const o = outcomeOf(call({ status: 'MISSED', type: 'VIDEO', callerId: THEM, calleeId: ME, caller: call().callee, callee: call().caller }), 'INCOMING');
    assert.equal(o.title, 'Missed call');
    assert.match(o.detail ?? '', /video call from Riya Coach/);
  });

  it('a caller who hangs up before answer is a missed call for the callee, a plain cancel for the caller', () => {
    assert.equal(outcomeOf(call({ status: 'CANCELLED' }), 'OUTGOING').title, 'Call cancelled');
    assert.equal(outcomeOf(call({ status: 'CANCELLED' }), 'INCOMING').title, 'Missed call');
  });

  it('declined', () => {
    assert.equal(outcomeOf(call({ status: 'REJECTED' }), 'OUTGOING').title, 'Call declined');
    assert.match(outcomeOf(call({ status: 'REJECTED' }), 'OUTGOING').detail ?? '', /declined/);
  });

  it('failed: explains the cause in plain words', () => {
    assert.match(outcomeOf(call({ status: 'FAILED', endReason: 'MEDIA_ERROR' }), 'OUTGOING').detail ?? '', /microphone or camera/);
    assert.match(outcomeOf(call({ status: 'FAILED', endReason: 'NEGOTIATION_FAILED' }), 'OUTGOING').detail ?? '', /couldn’t connect/);
    assert.match(outcomeOf(call({ status: 'FAILED', endReason: 'SYSTEM_TIMEOUT' }), 'OUTGOING').detail ?? '', /connection was lost/);
    assert.equal(outcomeOf(call({ status: 'FAILED' }), 'OUTGOING').tone, 'failed');
  });

  it('ended: carries the duration, and flags a lost connection', () => {
    const ok = outcomeOf(call({ status: 'ENDED', endReason: 'HANGUP', durationSeconds: 134 }), 'OUTGOING');
    assert.equal(ok.title, 'Call ended');
    assert.equal(ok.durationSeconds, 134);
    assert.equal(ok.tone, 'neutral');
    const lost = outcomeOf(call({ status: 'ENDED', endReason: 'CONNECTION_LOST' }), 'OUTGOING');
    assert.match(lost.detail ?? '', /connection was lost/);
    assert.equal(lost.tone, 'failed');
  });
});

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(5), '0:05');
    assert.equal(formatDuration(75), '1:15');
    assert.equal(formatDuration(3599), '59:59');
    assert.equal(formatDuration(3725), '1:02:05');
  });

  it('never returns garbage for bad input', () => {
    assert.equal(formatDuration(null), '0:00');
    assert.equal(formatDuration(undefined), '0:00');
    assert.equal(formatDuration(Number.NaN), '0:00');
    assert.equal(formatDuration(-30), '0:00');
    assert.equal(formatDuration(12.9), '0:12');
  });
});

describe('historyEntryOf — one row of the conversation\'s call history', () => {
  it('outgoing completed call: type, direction, status, duration, time', () => {
    const entry = historyEntryOf(call({ type: 'VIDEO', status: 'ENDED', endReason: 'HANGUP', durationSeconds: 134 }), ME);
    assert.deepEqual(entry, {
      label: 'Video call',
      direction: 'OUTGOING',
      directionLabel: 'Outgoing',
      statusLabel: 'Ended',
      duration: '2:14',
      tone: 'neutral',
      at: '2026-09-24T10:00:00.000Z',
    });
  });

  it('the same call reads as incoming from the callee\'s side', () => {
    const entry = historyEntryOf(call({ status: 'ENDED', durationSeconds: 60 }), THEM);
    assert.equal(entry.direction, 'INCOMING');
    assert.equal(entry.directionLabel, 'Incoming');
  });

  it('missed / declined / cancelled / failed read correctly per side and carry no duration', () => {
    assert.equal(historyEntryOf(call({ status: 'MISSED' }), ME).statusLabel, 'No answer');
    assert.equal(historyEntryOf(call({ status: 'MISSED' }), THEM).statusLabel, 'Missed');
    assert.equal(historyEntryOf(call({ status: 'REJECTED' }), ME).statusLabel, 'Declined');
    assert.equal(historyEntryOf(call({ status: 'CANCELLED' }), ME).statusLabel, 'Cancelled');
    assert.equal(historyEntryOf(call({ status: 'CANCELLED' }), THEM).statusLabel, 'Missed');
    assert.equal(historyEntryOf(call({ status: 'FAILED' }), ME).statusLabel, 'Failed');
    for (const status of ['MISSED', 'REJECTED', 'CANCELLED', 'FAILED'] as const) {
      assert.equal(historyEntryOf(call({ status }), ME).duration, null);
    }
    assert.equal(historyEntryOf(call({ status: 'MISSED' }), THEM).tone, 'missed');
    assert.equal(historyEntryOf(call({ status: 'FAILED' }), ME).tone, 'failed');
  });

  it('an unfinished call is shown as in progress', () => {
    assert.equal(historyEntryOf(call({ status: 'CONNECTED' }), ME).statusLabel, 'In progress');
  });

  it('never mentions money, whatever the call', () => {
    for (const status of [...ACTIVE_STATUSES, ...TERMINAL_STATUSES]) {
      const text = JSON.stringify(historyEntryOf(call({ status }), ME)) + JSON.stringify(outcomeOf(call({ status }), 'OUTGOING'));
      assert.doesNotMatch(text, /coin|price|charge|wallet|payment|balance|bill|₹|rs\./i);
    }
  });
});
