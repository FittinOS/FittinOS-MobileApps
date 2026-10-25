import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ConversationStatus } from '@fittin/shared-types';
import { callAvailability, conversationCallReason, type CallAvailabilityInput } from './availability.ts';

const OK: CallAvailabilityInput = {
  viewerRole: 'CLIENT',
  conversationStatus: 'UNLOCKED',
  browserSupport: { supported: true, reason: null },
  socket: 'connected',
  phase: 'idle',
};

describe('callAvailability', () => {
  it('is available in an unlocked conversation on a capable browser with a live connection', () => {
    assert.deepEqual(callAvailability(OK), { available: true, reason: null });
  });

  it('stays available after a call has ended (the summary is showing)', () => {
    assert.equal(callAvailability({ ...OK, phase: 'ended' }).available, true);
  });

  it('is unavailable until the conversation is unlocked — a call must not bypass the message unlock', () => {
    for (const status of ['AWAITING_PROFESSIONAL', 'RESPONSE_LOCKED', 'DECLINED'] as ConversationStatus[]) {
      for (const viewerRole of ['CLIENT', 'PROFESSIONAL'] as const) {
        const result = callAvailability({ ...OK, conversationStatus: status, viewerRole });
        assert.equal(result.available, false, `${status}/${viewerRole}`);
        assert.ok(result.reason && result.reason.length > 0);
      }
    }
  });

  it('gives each side a reason that makes sense to them', () => {
    assert.match(conversationCallReason('RESPONSE_LOCKED', 'CLIENT') ?? '', /Unlock the professional/);
    assert.match(conversationCallReason('RESPONSE_LOCKED', 'PROFESSIONAL') ?? '', /client unlocks/);
    assert.match(conversationCallReason('DECLINED', 'CLIENT') ?? '', /has ended/);
    assert.equal(conversationCallReason('UNLOCKED', 'CLIENT'), null);
  });

  it('explains an unsupported browser', () => {
    const result = callAvailability({ ...OK, browserSupport: { supported: false, reason: 'Calls need a secure (https) connection.' } });
    assert.deepEqual(result, { available: false, reason: 'Calls need a secure (https) connection.' });
  });

  it('is unavailable while already on a call, in any live phase', () => {
    for (const phase of ['preparing', 'outgoing', 'incoming', 'connecting', 'connected'] as const) {
      assert.equal(callAvailability({ ...OK, phase }).reason, 'You’re already on a call.');
    }
  });

  it('waits for, and reports on, the call service connection', () => {
    assert.match(callAvailability({ ...OK, socket: 'connecting' }).reason ?? '', /Connecting/);
    assert.match(callAvailability({ ...OK, socket: 'idle' }).reason ?? '', /Connecting/);
    assert.match(callAvailability({ ...OK, socket: 'disconnected' }).reason ?? '', /Can’t reach/);
  });

  it('reports the conversation problem first, since it will not fix itself', () => {
    const result = callAvailability({ ...OK, conversationStatus: 'RESPONSE_LOCKED', socket: 'disconnected', phase: 'connected' });
    assert.match(result.reason ?? '', /Unlock/);
  });
});
