import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCameraConstraints, buildMediaConstraints, callSupport, classifyMediaError } from './media.ts';

describe('buildMediaConstraints', () => {
  it('a voice call never asks for the camera', () => {
    const constraints = buildMediaConstraints('VOICE');
    assert.equal(constraints.video, false);
    assert.ok(constraints.audio);
  });

  it('a video call asks for both, preferring the front camera', () => {
    const constraints = buildMediaConstraints('VIDEO');
    assert.ok(constraints.audio);
    assert.equal((constraints.video as MediaTrackConstraints).facingMode, 'user');
  });

  it('turns on the call-quality audio processing', () => {
    const audio = buildMediaConstraints('VOICE').audio as MediaTrackConstraints;
    assert.equal(audio.echoCancellation, true);
    assert.equal(audio.noiseSuppression, true);
  });

  it('turning the camera back on asks for the camera only', () => {
    const constraints = buildCameraConstraints();
    assert.equal(constraints.audio, false);
    assert.ok(constraints.video);
  });
});

describe('classifyMediaError', () => {
  it('explains a blocked permission and how to fix it', () => {
    const failure = classifyMediaError({ name: 'NotAllowedError' }, 'VOICE');
    assert.equal(failure.kind, 'permission_denied');
    assert.equal(failure.device, 'microphone');
    assert.match(failure.message, /microphone is blocked/);
    assert.match(failure.hint ?? '', /browser’s settings/);
  });

  it('names the camera too for a video call', () => {
    const failure = classifyMediaError({ name: 'NotAllowedError' }, 'VIDEO');
    assert.equal(failure.device, 'both');
    assert.match(failure.message, /camera and microphone/);
  });

  it('can be about the camera alone (re-enabling it mid-call)', () => {
    const failure = classifyMediaError({ name: 'NotFoundError' }, 'CAMERA');
    assert.equal(failure.kind, 'device_not_found');
    assert.equal(failure.device, 'camera');
    assert.match(failure.message, /No camera was found/);
  });

  it('recognises a device that is busy elsewhere', () => {
    const failure = classifyMediaError({ name: 'NotReadableError' }, 'VOICE');
    assert.equal(failure.kind, 'device_in_use');
    assert.match(failure.hint ?? '', /Another app or browser tab/);
  });

  // node:test has no it.each, so the aliases are covered by this loop.
  for (const [name, kind] of [
    ['PermissionDeniedError', 'permission_denied'],
    ['SecurityError', 'permission_denied'],
    ['DevicesNotFoundError', 'device_not_found'],
    ['OverconstrainedError', 'device_not_found'],
    ['TrackStartError', 'device_in_use'],
    ['AbortError', 'device_in_use'],
  ] as const) {
    it(`treats ${name} as ${kind}`, () => {
      assert.equal(classifyMediaError({ name }, 'VOICE').kind, kind);
    });
  }

  it('falls back to a generic message for anything unexpected — including non-errors', () => {
    for (const weird of [new Error('boom'), null, undefined, 'string', 42, {}]) {
      const failure = classifyMediaError(weird, 'VOICE');
      assert.equal(failure.kind, 'unknown');
      assert.ok(failure.message.length > 0);
    }
  });

  it('never leaks a raw browser message into what the user sees', () => {
    const failure = classifyMediaError({ name: 'NotAllowedError', message: 'Permission denied by system (0x8007)' }, 'VOICE');
    assert.doesNotMatch(JSON.stringify(failure), /0x8007|by system/);
  });
});

describe('callSupport', () => {
  it('is supported on a secure page with WebRTC and getUserMedia', () => {
    assert.deepEqual(callSupport({ isSecureContext: true, hasPeerConnection: true, hasGetUserMedia: true }), {
      supported: true,
      reason: null,
    });
  });

  it('refuses an insecure page, and says why', () => {
    const support = callSupport({ isSecureContext: false, hasPeerConnection: true, hasGetUserMedia: true });
    assert.equal(support.supported, false);
    assert.match(support.reason ?? '', /secure \(https\)/);
  });

  it('refuses a browser missing either API', () => {
    assert.equal(callSupport({ isSecureContext: true, hasPeerConnection: false, hasGetUserMedia: true }).supported, false);
    assert.equal(callSupport({ isSecureContext: true, hasPeerConnection: true, hasGetUserMedia: false }).supported, false);
    assert.match(callSupport({ isSecureContext: true, hasPeerConnection: false, hasGetUserMedia: false }).reason ?? '', /doesn’t support calls/);
  });

  it('treats an unknown secure-context flag (older browsers) as fine and lets the API checks decide', () => {
    assert.equal(callSupport({ isSecureContext: undefined, hasPeerConnection: true, hasGetUserMedia: true }).supported, true);
  });
});
