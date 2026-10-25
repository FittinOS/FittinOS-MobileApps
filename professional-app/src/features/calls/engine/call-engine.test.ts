import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { CallDto, CallSignalDto } from '@fittin/shared-types';
import { CallEngine, TIMING, type CallEngineEnv, type SocketLike } from './call-engine.ts';

const ME = 'user-me';
const THEM = 'user-them';
const PEER = { fullName: 'Riya Coach', avatarUrl: null };

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeTrack {
  kind: 'audio' | 'video';
  enabled = true;
  stopped = false;
  constructor(kind: 'audio' | 'video') {
    this.kind = kind;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  tracks: FakeTrack[];
  constructor(tracks: FakeTrack[]) {
    this.tracks = tracks;
  }
  getTracks() {
    return [...this.tracks];
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  addTrack(track: FakeTrack) {
    this.tracks.push(track);
  }
  removeTrack(track: FakeTrack) {
    this.tracks = this.tracks.filter((t) => t !== track);
  }
}

class FakeSender {
  track: FakeTrack | null;
  replaced: (FakeTrack | null)[] = [];
  constructor(track: FakeTrack) {
    this.track = track;
  }
  async replaceTrack(track: FakeTrack | null) {
    this.track = track;
    this.replaced.push(track);
  }
}

/** Candidates every fake peer "finds" as soon as it applies a local description. */
let autoGather: RTCIceCandidateInit[] = [];

class FakePeer {
  connectionState = 'new';
  iceConnectionState = 'new';
  remoteDescription: { type: string; sdp: string } | null = null;
  localDescription: { type: string; sdp: string } | null = null;
  onicecandidate: ((e: { candidate: { toJSON: () => RTCIceCandidateInit } | null }) => void) | null = null;
  ontrack: ((e: { streams: unknown[]; track: unknown }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  senders: FakeSender[] = [];
  transceivers: { kind: string; init: unknown }[] = [];
  calls: string[] = [];
  addedCandidates: RTCIceCandidateInit[] = [];
  closed = false;

  addTrack(track: FakeTrack) {
    const sender = new FakeSender(track);
    this.senders.push(sender);
    this.calls.push(`addTrack:${track.kind}`);
    return sender;
  }
  addTransceiver(kind: string, init: unknown) {
    this.transceivers.push({ kind, init });
    this.calls.push(`addTransceiver:${kind}`);
  }
  async createOffer() {
    this.calls.push('createOffer');
    return { type: 'offer', sdp: 'v=0 offer' };
  }
  async createAnswer() {
    this.calls.push('createAnswer');
    return { type: 'answer', sdp: 'v=0 answer' };
  }
  async setLocalDescription(d: { type: string; sdp: string }) {
    this.localDescription = d;
    this.calls.push(`setLocal:${d.type}`);
    // A real browser starts gathering the moment a local description is applied — before the app has had a
    // chance to send that description anywhere. Candidates it finds then must not overtake it.
    for (const candidate of autoGather) this.gather(candidate);
  }
  async setRemoteDescription(d: { type: string; sdp: string }) {
    this.remoteDescription = d;
    this.calls.push(`setRemote:${d.type}`);
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.addedCandidates.push(c);
    this.calls.push('addIce');
  }
  close() {
    this.closed = true;
  }
  // test helpers
  gather(candidate: RTCIceCandidateInit) {
    this.onicecandidate?.({ candidate: { toJSON: () => candidate } });
  }
  setState(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

type Responder = (event: string, payload: Record<string, unknown>) => unknown;

class FakeSocket implements SocketLike {
  connected = false;
  handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  sent: { event: string; payload: Record<string, unknown> }[] = [];
  responder: Responder = () => ({ ok: true });
  autoConnect = true;

  on(event: string, handler: (...args: unknown[]) => void) {
    (this.handlers[event] ??= []).push(handler);
  }
  emit(event: string, payload: Record<string, unknown>, ack?: (a: unknown) => void) {
    this.sent.push({ event, payload });
    if (!ack) return;
    const response = this.responder(event, payload);
    if (response !== 'NO_ACK') queueMicrotask(() => ack(response));
  }
  connect() {
    if (!this.autoConnect) return;
    this.connected = true;
    queueMicrotask(() => this.fire('connect'));
  }
  disconnect() {
    this.connected = false;
    this.fire('disconnect');
  }
  fire(event: string, ...args: unknown[]) {
    for (const handler of this.handlers[event] ?? []) handler(...args);
  }
  pushState(call: CallDto) {
    this.fire('call:state', call);
  }
  pushSignal(signal: CallSignalDto) {
    this.fire('call:signal', signal);
  }
  events(event: string) {
    return this.sent.filter((s) => s.event === event);
  }
}

function callDto(overrides: Partial<CallDto> = {}): CallDto {
  return {
    id: 'call-1',
    conversationId: 'conv-1',
    callerId: ME,
    calleeId: THEM,
    caller: { id: ME, fullName: 'Me Myself', avatarUrl: null },
    callee: { id: THEM, fullName: 'Riya Coach', avatarUrl: null },
    type: 'VOICE',
    status: 'REQUESTED',
    endReason: null,
    version: 1,
    ringExpiresAt: new Date(Date.now() + 45_000).toISOString(),
    acceptedAt: null,
    connectedAt: null,
    endedAt: null,
    durationSeconds: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** The same call as the callee sees it. */
const incomingCall = (overrides: Partial<CallDto> = {}) => callDto({ callerId: THEM, calleeId: ME, caller: callDto().callee, callee: callDto().caller, ...overrides });

const signal = (id: number, kind: CallSignalDto['kind'], payload: Record<string, unknown>, callId = 'call-1'): CallSignalDto => ({ id, callId, kind, payload });
const OFFER = { type: 'offer', sdp: 'v=0 remote-offer' };
const ANSWER = { type: 'answer', sdp: 'v=0 remote-answer' };
const CAND = (n: number) => ({ candidate: `candidate:${n} 1 udp 1 10.0.0.${n} 5000 typ host`, sdpMid: '0', sdpMLineIndex: 0 });

interface HarnessOptions {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<FakeStream>;
  fetchIceServers?: CallEngineEnv['fetchIceServers'];
}

/** Every engine a test created — disposed after each test so no heartbeat/ring timer outlives it. */
const engines: CallEngine[] = [];
afterEach(() => {
  autoGather = [];
  for (const engine of engines.splice(0)) engine.disconnect();
});

function makeHarness(options: HarnessOptions = {}) {
  const socket = new FakeSocket();
  const peers: FakePeer[] = [];
  const streams: FakeStream[] = [];
  const mediaRequests: MediaStreamConstraints[] = [];
  const ringing = { started: 0, stopped: 0 };
  let iceRequests = 0;

  const env: CallEngineEnv = {
    selfUserId: ME,
    createSocket: () => socket,
    getUserMedia: async (constraints) => {
      mediaRequests.push(constraints);
      if (options.getUserMedia) {
        const stream = await options.getUserMedia(constraints);
        streams.push(stream);
        return stream as unknown as MediaStream;
      }
      const stream = new FakeStream([new FakeTrack('audio'), ...(constraints.video ? [new FakeTrack('video')] : [])]);
      streams.push(stream);
      return stream as unknown as MediaStream;
    },
    createMediaStream: (tracks) => new FakeStream(tracks as unknown as FakeTrack[]) as unknown as MediaStream,
    createPeerConnection: () => {
      const peer = new FakePeer();
      peers.push(peer);
      return peer as unknown as RTCPeerConnection;
    },
    fetchIceServers:
      options.fetchIceServers ??
      (async () => {
        iceRequests++;
        return { iceServers: [{ urls: ['stun:stun.test:3478'] }], expiresAt: new Date().toISOString(), turnConfigured: false };
      }),
    startRinging: () => {
      ringing.started++;
      return () => {
        ringing.stopped++;
      };
    },
  };

  const engine = new CallEngine(env);
  engines.push(engine);
  return { engine, socket, peers, streams, mediaRequests, ringing, iceRequests: () => iceRequests };
}

/** Lets pending promise continuations run. */
const flush = async (turns = 12) => {
  for (let i = 0; i < turns; i++) await new Promise<void>((resolve) => setImmediate(resolve));
};

async function connectedHarness(options: HarnessOptions = {}) {
  const h = makeHarness(options);
  h.engine.connect();
  await flush();
  return h;
}

/** A caller mid-call: invite acked as REQUESTED. */
async function placeCall(h: Awaited<ReturnType<typeof connectedHarness>>, type: 'VOICE' | 'VIDEO' = 'VOICE') {
  h.socket.responder = (event) => (event === 'call:invite' ? { ok: true, call: callDto({ type }) } : { ok: true });
  await h.engine.start({ conversationId: 'conv-1', type, peer: PEER });
  await flush();
}

// ---------------------------------------------------------------------------

describe('CallEngine — placing a call', () => {
  it('walks a voice call from invite to hang-up, negotiating as the caller', async () => {
    const h = await connectedHarness();
    await placeCall(h);

    // Only the microphone was requested; the invite carries only the conversation and type.
    assert.equal(h.mediaRequests.length, 1);
    assert.equal(h.mediaRequests[0].video, false);
    assert.deepEqual(h.socket.events('call:invite')[0].payload, { conversationId: 'conv-1', type: 'VOICE' });
    assert.equal(h.engine.getSnapshot().phase, 'outgoing');
    assert.equal(h.engine.getSnapshot().peer?.fullName, 'Riya Coach');

    h.socket.pushState(callDto({ status: 'RINGING', version: 2 }));
    assert.equal(h.engine.getSnapshot().call?.status, 'RINGING');
    assert.equal(h.engine.getSnapshot().phase, 'outgoing');

    // The callee answers -> the caller (and only the caller) creates the offer.
    // A candidate found while the offer is still being made must not be sent ahead of it.
    autoGather = [CAND(1)];
    h.socket.pushState(callDto({ status: 'ACCEPTED', version: 3 }));
    await flush();

    assert.equal(h.peers.length, 1);
    assert.deepEqual(h.peers[0].calls.slice(0, 3), ['addTrack:audio', 'createOffer', 'setLocal:offer']);
    const signals = h.socket.events('call:signal');
    assert.equal(signals[0].payload.kind, 'OFFER');
    assert.deepEqual(signals[0].payload.payload, { type: 'offer', sdp: 'v=0 offer' });
    assert.equal(signals[1].payload.kind, 'ICE_CANDIDATE');
    assert.equal((signals[1].payload.payload as { candidate: string }).candidate, CAND(1).candidate);

    // The answer, with a remote candidate that raced ahead of it: the candidate waits for the description.
    h.socket.pushSignal(signal(11, 'ICE_CANDIDATE', CAND(7)));
    h.socket.pushSignal(signal(12, 'ANSWER', ANSWER));
    await flush();
    const applied = h.peers[0].calls.filter((c) => c.startsWith('setRemote') || c === 'addIce');
    assert.deepEqual(applied, ['setRemote:answer', 'addIce']);

    // Media comes up: reported to the server exactly once.
    h.peers[0].setState('connected');
    h.peers[0].setState('connected');
    await flush();
    assert.equal(h.socket.events('call:connected').length, 1);
    h.socket.pushState(callDto({ status: 'CONNECTED', version: 5, connectedAt: new Date().toISOString() }));
    assert.equal(h.engine.getSnapshot().phase, 'connected');

    // Hang up: the server's answer ends it and everything is released.
    h.socket.responder = (event) => (event === 'call:end' ? { ok: true, call: callDto({ status: 'ENDED', version: 6, durationSeconds: 42, endReason: 'HANGUP' }) } : { ok: true });
    await h.engine.end();
    const state = h.engine.getSnapshot();
    assert.equal(state.phase, 'ended');
    assert.equal(state.outcome?.title, 'Call ended');
    assert.equal(state.outcome?.durationSeconds, 42);
    assert.ok(h.peers[0].closed);
    assert.ok(h.streams[0].tracks.every((t) => t.stopped));
    assert.equal(h.engine.getLocalStream(), null);
  });

  it('asks for camera and microphone on a video call, and offers to receive video even if there is no camera', async () => {
    const h = await connectedHarness();
    await placeCall(h, 'VIDEO');
    assert.ok(h.mediaRequests[0].video);

    // Camera denied but microphone fine: the call carries on as audio + can still see them.
    const h2 = await connectedHarness({
      getUserMedia: async (constraints) => {
        if (constraints.video) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
        return new FakeStream([new FakeTrack('audio')]);
      },
    });
    await placeCall(h2, 'VIDEO');
    assert.equal(h2.engine.getSnapshot().cameraUnavailable, true);
    assert.equal(h2.engine.getSnapshot().phase, 'outgoing');
    h2.socket.pushState(callDto({ type: 'VIDEO', status: 'ACCEPTED', version: 3 }));
    await flush();
    assert.deepEqual(h2.peers[0].transceivers, [{ kind: 'video', init: { direction: 'recvonly' } }]);
  });

  it('stops before ringing anyone when the microphone is blocked, and explains how to fix it', async () => {
    const h = await connectedHarness({
      getUserMedia: async () => {
        throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
      },
    });
    await h.engine.start({ conversationId: 'conv-1', type: 'VOICE', peer: PEER });
    await flush();

    const state = h.engine.getSnapshot();
    assert.equal(state.phase, 'ended');
    assert.equal(state.call, null);
    assert.match(state.notice?.message ?? '', /microphone is blocked/);
    assert.match(state.notice?.hint ?? '', /settings/);
    assert.equal(state.canRetry, true);
    assert.equal(h.socket.events('call:invite').length, 0);
  });

  it('reports a refused invite in the server\'s own words and releases the microphone', async () => {
    const h = await connectedHarness();
    h.socket.responder = (event) => (event === 'call:invite' ? { ok: false, code: 'CALL_BUSY', message: 'They’re on another call right now.' } : { ok: true });
    await h.engine.start({ conversationId: 'conv-1', type: 'VOICE', peer: PEER });
    await flush();

    const state = h.engine.getSnapshot();
    assert.equal(state.phase, 'ended');
    assert.equal(state.notice?.message, 'They’re on another call right now.');
    assert.ok(h.streams[0].tracks.every((t) => t.stopped));
  });

  it('says so when the call service cannot be reached', async () => {
    const h = makeHarness();
    h.socket.autoConnect = false; // never connects
    mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
    try {
      h.engine.connect();
      const starting = h.engine.start({ conversationId: 'conv-1', type: 'VOICE', peer: PEER });
      await flush(5);
      mock.timers.tick(TIMING.socketWaitMs + 200);
      await starting;
    } finally {
      mock.timers.reset();
    }
    assert.match(h.engine.getSnapshot().notice?.message ?? '', /offline/i);
  });

  it('lets the caller abandon a call while still preparing', async () => {
    let releaseMedia: (s: FakeStream) => void = () => undefined;
    const h = await connectedHarness({ getUserMedia: () => new Promise<FakeStream>((resolve) => (releaseMedia = resolve)) });
    const starting = h.engine.start({ conversationId: 'conv-1', type: 'VOICE', peer: PEER });
    await flush(3);
    assert.equal(h.engine.getSnapshot().phase, 'preparing');

    await h.engine.end();
    const late = new FakeStream([new FakeTrack('audio')]);
    releaseMedia(late); // the permission prompt is answered afterwards
    await starting;
    await flush();

    assert.equal(h.engine.getSnapshot().phase, 'idle');
    assert.ok(late.tracks.every((t) => t.stopped), 'a microphone granted after cancelling must be released');
    assert.equal(h.socket.events('call:invite').length, 0);
  });

  it('cancels a call the server created after the caller had already given up', async () => {
    const h = await connectedHarness();
    let finishInvite: (v: unknown) => void = () => undefined;
    h.socket.responder = (event) => (event === 'call:invite' ? 'NO_ACK' : { ok: true });
    h.socket.emit = ((event: string, payload: Record<string, unknown>, ack?: (a: unknown) => void) => {
      h.socket.sent.push({ event, payload });
      if (event === 'call:invite') finishInvite = (v) => ack?.(v);
      else if (ack) queueMicrotask(() => ack({ ok: true }));
    }) as FakeSocket['emit'];

    const starting = h.engine.start({ conversationId: 'conv-1', type: 'VOICE', peer: PEER });
    await flush(6);
    await h.engine.end(); // gives up during "preparing"/asking
    finishInvite({ ok: true, call: callDto() });
    await starting;
    await flush();

    assert.equal(h.socket.events('call:end').length, 1);
    assert.equal(h.engine.getSnapshot().phase, 'idle');
  });

  it('applies an update about our own call that beat the invite acknowledgement', async () => {
    const h = await connectedHarness();
    let finishInvite: (v: unknown) => void = () => undefined;
    h.socket.emit = ((event: string, payload: Record<string, unknown>, ack?: (a: unknown) => void) => {
      h.socket.sent.push({ event, payload });
      if (event === 'call:invite') finishInvite = (v) => ack?.(v);
      else if (ack) queueMicrotask(() => ack({ ok: true }));
    }) as FakeSocket['emit'];

    const starting = h.engine.start({ conversationId: 'conv-1', type: 'VOICE', peer: PEER });
    await flush(8);
    // The callee's device answered and the server pushed it before our acknowledgement arrived.
    h.socket.pushState(callDto({ status: 'ACCEPTED', version: 3 }));
    finishInvite({ ok: true, call: callDto({ version: 1 }) });
    await starting;
    await flush();

    assert.equal(h.engine.getSnapshot().call?.status, 'ACCEPTED');
    assert.equal(h.peers.length, 1);
    assert.equal(h.socket.events('call:signal')[0].payload.kind, 'OFFER');
  });
});

describe('CallEngine — receiving a call', () => {
  it('rings, is answered, and negotiates as the callee', async () => {
    const h = await connectedHarness();

    h.socket.pushState(incomingCall({ type: 'VIDEO' }));
    await flush();
    assert.equal(h.engine.getSnapshot().phase, 'incoming');
    assert.equal(h.engine.getSnapshot().peer?.fullName, 'Riya Coach');
    assert.equal(h.ringing.started, 1);
    // The device tells the server it is actually ringing.
    assert.equal(h.socket.events('call:ringing').length, 1);
    // Nothing is asked of the user's microphone/camera until they answer.
    assert.equal(h.mediaRequests.length, 0);

    h.socket.responder = (event) => (event === 'call:accept' ? { ok: true, call: incomingCall({ type: 'VIDEO', status: 'ACCEPTED', version: 3 }) } : { ok: true });
    await h.engine.accept();
    await flush();

    assert.ok(h.mediaRequests[0].video, 'a video call asks for the camera on answering');
    assert.equal(h.ringing.stopped, 1);
    assert.equal(h.engine.getSnapshot().phase, 'connecting');
    // The peer (with our tracks) existed before we told the server we'd answered.
    assert.deepEqual(h.peers[0].calls.slice(0, 2), ['addTrack:audio', 'addTrack:video']);

    // The caller's offer arrives, with a candidate ahead of it.
    autoGather = [CAND(9)];
    h.socket.pushSignal(signal(21, 'ICE_CANDIDATE', CAND(3)));
    h.socket.pushSignal(signal(22, 'OFFER', OFFER));
    await flush();
    assert.deepEqual(
      h.peers[0].calls.filter((c) => c.startsWith('set') || c.startsWith('create') || c === 'addIce'),
      ['setRemote:offer', 'addIce', 'createAnswer', 'setLocal:answer'],
    );
    const answerSignal = h.socket.events('call:signal').find((s) => s.payload.kind === 'ANSWER');
    assert.deepEqual(answerSignal?.payload.payload, { type: 'answer', sdp: 'v=0 answer' });

    // Our own candidate, found while the answer was being made, goes out only after the answer.
    const kinds = h.socket.events('call:signal').map((s) => s.payload.kind);
    assert.deepEqual(kinds, ['ANSWER', 'ICE_CANDIDATE']);
  });

  it('declines a call', async () => {
    const h = await connectedHarness();
    h.socket.pushState(incomingCall());
    await flush();
    h.socket.responder = (event) => (event === 'call:reject' ? { ok: true, call: incomingCall({ status: 'REJECTED', version: 2 }) } : { ok: true });
    await h.engine.reject();

    assert.equal(h.socket.events('call:reject').length, 1);
    assert.equal(h.engine.getSnapshot().phase, 'ended');
    assert.equal(h.engine.getSnapshot().outcome?.title, 'Call declined');
    assert.equal(h.ringing.stopped, 1);
    assert.equal(h.mediaRequests.length, 0, 'declining never touches the microphone');
  });

  it('stays on the incoming screen if the microphone is blocked, so the person can fix it and try again', async () => {
    let allow = false;
    const h = await connectedHarness({
      getUserMedia: async () => {
        if (!allow) throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
        return new FakeStream([new FakeTrack('audio')]);
      },
    });
    h.socket.pushState(incomingCall());
    await flush();

    await h.engine.accept();
    assert.equal(h.engine.getSnapshot().phase, 'incoming');
    assert.match(h.engine.getSnapshot().notice?.message ?? '', /microphone is blocked/);
    assert.equal(h.socket.events('call:accept').length, 0);

    allow = true;
    h.socket.responder = (event) => (event === 'call:accept' ? { ok: true, call: incomingCall({ status: 'ACCEPTED', version: 3 }) } : { ok: true });
    await h.engine.accept();
    assert.equal(h.engine.getSnapshot().phase, 'connecting');
    assert.equal(h.engine.getSnapshot().notice, null);
  });

  it('shows a missed call when the caller hangs up before it is answered', async () => {
    const h = await connectedHarness();
    h.socket.pushState(incomingCall());
    await flush();
    h.socket.pushState(incomingCall({ status: 'CANCELLED', version: 2 }));

    const state = h.engine.getSnapshot();
    assert.equal(state.phase, 'ended');
    assert.equal(state.outcome?.title, 'Missed call');
    assert.equal(h.ringing.stopped, 1, 'the ringing stops');
  });

  it('shows a missed call when it rings out', async () => {
    const h = await connectedHarness();
    h.socket.pushState(incomingCall());
    await flush();
    h.socket.pushState(incomingCall({ status: 'MISSED', version: 2 }));
    assert.equal(h.engine.getSnapshot().outcome?.title, 'Missed call');
  });

  it('quietly stops ringing when another window answered', async () => {
    const h = await connectedHarness();
    h.socket.pushState(incomingCall());
    await flush();
    h.socket.pushState(incomingCall({ status: 'ACCEPTED', version: 3 }));

    assert.equal(h.engine.getSnapshot().phase, 'idle');
    assert.equal(h.ringing.stopped, 1);
    assert.equal(h.mediaRequests.length, 0);
  });

  it('tells the person when Accept was too late', async () => {
    const h = await connectedHarness();
    h.socket.pushState(incomingCall());
    await flush();
    h.socket.responder = (event) => (event === 'call:accept' ? { ok: false, code: 'INVALID_CALL_STATE', message: 'This call is no longer available.' } : { ok: true });
    await h.engine.accept();

    assert.equal(h.engine.getSnapshot().notice?.message, 'This call is no longer available.');
    assert.equal(h.peers[0].closed, true, 'the half-built peer is discarded');
    assert.ok(h.streams[0].tracks.every((t) => t.stopped), 'and the microphone is released');
  });

  it('ignores a call that another of the user\'s windows placed, and one that already finished', async () => {
    const h = await connectedHarness();
    h.socket.pushState(callDto({ status: 'RINGING', version: 2 })); // outgoing from elsewhere
    h.socket.pushState(incomingCall({ id: 'old', status: 'ENDED', version: 5 })); // already over
    assert.equal(h.engine.getSnapshot().phase, 'idle');
    assert.equal(h.ringing.started, 0);
  });

  it('never acts on a call that is not between this user and someone else', async () => {
    const h = await connectedHarness();
    h.socket.pushState(callDto({ callerId: 'stranger-a', calleeId: 'stranger-b' }));
    assert.equal(h.engine.getSnapshot().phase, 'idle');
    assert.equal(h.ringing.started, 0);
  });

  it('is not interrupted by a second incoming call while one is in progress', async () => {
    const h = await connectedHarness();
    h.socket.pushState(incomingCall());
    await flush();
    h.socket.pushState(incomingCall({ id: 'call-2' }));
    assert.equal(h.engine.getSnapshot().call?.id, 'call-1');
    assert.equal(h.ringing.started, 1);
  });
});

describe('CallEngine — stale and duplicate messages', () => {
  it('applies only strictly newer versions, so a delayed update cannot move a call backwards', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    h.socket.pushState(callDto({ status: 'RINGING', version: 2 }));
    let notified = 0;
    h.engine.subscribe(() => notified++);

    h.socket.pushState(callDto({ status: 'REQUESTED', version: 1 })); // a late arrival of an older update
    h.socket.pushState(callDto({ status: 'RINGING', version: 2 })); // an exact duplicate

    assert.equal(h.engine.getSnapshot().call?.status, 'RINGING');
    assert.equal(h.engine.getSnapshot().call?.version, 2);
    assert.equal(notified, 0, 'stale and duplicate updates change nothing, not even for the view');
  });

  it('a finished call stays finished even if an older "connected" update turns up', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    h.socket.pushState(callDto({ status: 'ENDED', version: 9 }));
    h.socket.pushState(callDto({ status: 'CONNECTED', version: 5 }));
    assert.equal(h.engine.getSnapshot().phase, 'ended');
  });

  it('processes each signal once and ignores signals for another call', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    h.socket.pushState(callDto({ status: 'ACCEPTED', version: 3 }));
    await flush();

    h.socket.pushSignal(signal(31, 'ANSWER', ANSWER));
    h.socket.pushSignal(signal(31, 'ANSWER', ANSWER)); // redelivered
    h.socket.pushSignal(signal(32, 'ANSWER', ANSWER, 'some-other-call'));
    await flush();

    assert.equal(h.peers[0].calls.filter((c) => c === 'setRemote:answer').length, 1);
  });
});

describe('CallEngine — controls', () => {
  it('mutes and unmutes by silencing the microphone track', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    const [mic] = h.streams[0].getAudioTracks();

    h.engine.toggleMute();
    assert.equal(mic.enabled, false);
    assert.equal(h.engine.getSnapshot().isMuted, true);
    h.engine.toggleMute();
    assert.equal(mic.enabled, true);
    assert.equal(h.engine.getSnapshot().isMuted, false);
  });

  it('turns the camera off for real (releases it) and back on again', async () => {
    const h = await connectedHarness();
    await placeCall(h, 'VIDEO');
    h.socket.pushState(callDto({ type: 'VIDEO', status: 'ACCEPTED', version: 3 }));
    await flush();
    const [camera] = h.streams[0].getVideoTracks();
    const sender = h.peers[0].senders.find((s) => s.track === camera)!;

    await h.engine.toggleCamera();
    assert.equal(camera.stopped, true, 'the camera light goes out');
    assert.equal(sender.replaced.length, 1);
    assert.equal(sender.replaced[0], null);
    assert.equal(h.engine.getSnapshot().isCameraOff, true);
    assert.equal(h.streams[0].getVideoTracks().length, 0);

    await h.engine.toggleCamera();
    assert.equal(h.engine.getSnapshot().isCameraOff, false);
    assert.equal(sender.replaced.length, 2);
    assert.ok(sender.replaced[1] instanceof FakeTrack && sender.replaced[1].kind === 'video');
  });

  it('explains it when the camera cannot be turned back on, and leaves the call alone', async () => {
    let denyCamera = false;
    const h = await connectedHarness({
      getUserMedia: async (constraints) => {
        if (denyCamera && constraints.video && !constraints.audio) throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
        return new FakeStream([new FakeTrack('audio'), ...(constraints.video ? [new FakeTrack('video')] : [])]);
      },
    });
    await placeCall(h, 'VIDEO');
    await h.engine.toggleCamera(); // off
    denyCamera = true;
    await h.engine.toggleCamera(); // on -> denied

    assert.equal(h.engine.getSnapshot().isCameraOff, true);
    assert.match(h.engine.getSnapshot().notice?.message ?? '', /camera is blocked/);
  });

  it('has no camera control on a voice call or when the camera was unavailable', async () => {
    const h = await connectedHarness();
    await placeCall(h, 'VOICE');
    await h.engine.toggleCamera();
    assert.equal(h.engine.getSnapshot().isCameraOff, false);
  });
});

describe('CallEngine — a media path that breaks', () => {
  let timers = false;
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
    timers = true;
  });
  afterEach(() => {
    if (timers) mock.timers.reset();
  });

  async function liveCall() {
    const h = await connectedHarness();
    await placeCall(h);
    h.socket.pushState(callDto({ status: 'ACCEPTED', version: 3 }));
    await flush();
    return h;
  }

  it('ends a connected call whose media path never recovers', async () => {
    const h = await liveCall();
    h.socket.pushState(callDto({ status: 'CONNECTED', version: 4, connectedAt: new Date().toISOString() }));
    h.peers[0].setState('connected');
    await flush();
    h.socket.responder = (event) => (event === 'call:end' ? { ok: true, call: callDto({ status: 'ENDED', version: 9, endReason: 'CONNECTION_LOST' }) } : { ok: true });

    h.peers[0].setState('disconnected');
    assert.equal(h.engine.getSnapshot().reconnecting, true);
    mock.timers.tick(TIMING.mediaGraceMs + 100);
    await flush();

    assert.deepEqual(h.socket.events('call:end')[0].payload, { callId: 'call-1', reason: 'CONNECTION_LOST' });
    assert.equal(h.engine.getSnapshot().phase, 'ended');
    assert.match(h.engine.getSnapshot().outcome?.detail ?? '', /connection was lost/);
  });

  it('keeps the call if the media path heals within the grace period', async () => {
    const h = await liveCall();
    h.peers[0].setState('connected');
    await flush();
    h.peers[0].setState('disconnected');
    mock.timers.tick(TIMING.mediaGraceMs - 2_000);
    h.peers[0].setState('connected');
    mock.timers.tick(TIMING.mediaGraceMs);
    await flush();

    assert.equal(h.engine.getSnapshot().reconnecting, false);
    assert.equal(h.socket.events('call:end').length, 0);
  });

  it('reports a failure when the connection never gets established', async () => {
    const h = await liveCall();
    h.socket.responder = (event) => (event === 'call:fail' ? { ok: true, call: callDto({ status: 'FAILED', version: 9, endReason: 'NEGOTIATION_FAILED' }) } : { ok: true });
    h.peers[0].setState('failed');
    await flush();

    assert.deepEqual(h.socket.events('call:fail')[0].payload, { callId: 'call-1', reason: 'NEGOTIATION_FAILED' });
    assert.equal(h.engine.getSnapshot().outcome?.title, 'Call failed');
  });

  it('gives up locally if the server never answers the hang-up', async () => {
    const h = await liveCall();
    h.socket.responder = () => 'NO_ACK';
    const ending = h.engine.end();
    await flush(4);
    mock.timers.tick(TIMING.ackTimeoutMs + 100);
    await ending;

    assert.equal(h.engine.getSnapshot().phase, 'ended');
    assert.ok(h.peers[0].closed);
    assert.ok(h.streams[0].tracks.every((t) => t.stopped));
  });

  it('sends a heartbeat only while a call is live, and applies what it returns', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    mock.timers.tick(TIMING.heartbeatMs * 2);
    await flush();
    assert.equal(h.socket.events('call:heartbeat').length, 0, 'no heartbeat while it is still ringing');

    h.socket.pushState(callDto({ status: 'ACCEPTED', version: 3 }));
    await flush();
    h.socket.responder = (event) =>
      event === 'call:heartbeat'
        ? { ok: true, call: callDto({ status: 'CONNECTING', version: 4 }), signals: [signal(41, 'ANSWER', ANSWER)] }
        : { ok: true };
    mock.timers.tick(TIMING.heartbeatMs + 100);
    await flush();

    assert.equal(h.socket.events('call:heartbeat').length, 1);
    assert.equal(h.engine.getSnapshot().call?.status, 'CONNECTING');
    // The heartbeat also delivered a signal we had missed.
    assert.ok(h.peers[0].calls.includes('setRemote:answer'));
  });

  it('resumes a live call when the socket comes back, from where it left off', async () => {
    const h = await liveCall();
    h.socket.pushSignal(signal(51, 'ANSWER', ANSWER));
    await flush();

    h.socket.responder = (event) =>
      event === 'call:resume' ? { ok: true, call: callDto({ status: 'CONNECTED', version: 6 }), signals: [signal(52, 'ICE_CANDIDATE', CAND(4))] } : { ok: true };
    h.socket.fire('disconnect');
    h.socket.fire('connect');
    await flush();

    assert.deepEqual(h.socket.events('call:resume')[0].payload, { callId: 'call-1', afterSignalId: 51 });
    assert.equal(h.engine.getSnapshot().call?.status, 'CONNECTED');
    assert.equal(h.peers[0].addedCandidates.length, 1);
  });

  it('ends its own view of a call the server no longer knows about', async () => {
    const h = await liveCall();
    h.socket.responder = (event) => (event === 'call:resume' ? { ok: false, code: 'CALL_NOT_FOUND', message: 'gone' } : { ok: true });
    h.socket.fire('connect');
    await flush();
    assert.equal(h.engine.getSnapshot().phase, 'ended');
  });

  it('gives up on a call nobody answers, even if the server never says so', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    mock.timers.tick(45_000 + TIMING.ringWatchdogMarginMs + 100);
    await flush();
    assert.equal(h.engine.getSnapshot().phase, 'ended');
    assert.equal(h.engine.getSnapshot().outcome?.title, 'No answer');
  });
});

describe('CallEngine — leaving', () => {
  it('tells the other person straight away when the page is closed mid-call', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    h.socket.pushState(callDto({ status: 'ACCEPTED', version: 3 }));
    await flush();

    h.engine.handlePageHide();
    assert.deepEqual(h.socket.events('call:end')[0].payload, { callId: 'call-1' });
  });

  it('does not end a call this window is merely watching', async () => {
    const h = await connectedHarness();
    h.socket.pushState(incomingCall({ status: 'CONNECTED', version: 4 })); // someone else\'s window is running it
    h.engine.handlePageHide();
    assert.equal(h.socket.events('call:end').length, 0);
  });

  it('signing out ends any call and releases the microphone, the peer and the socket', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    h.socket.pushState(callDto({ status: 'ACCEPTED', version: 3 }));
    await flush();

    h.engine.disconnect();
    assert.equal(h.socket.events('call:end').length, 1);
    assert.ok(h.peers[0].closed);
    assert.ok(h.streams[0].tracks.every((t) => t.stopped));
    assert.equal(h.socket.connected, false);
    assert.equal(h.engine.getSnapshot().phase, 'idle');
  });

  it('can be dismissed after a call and then place another', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    h.socket.pushState(callDto({ status: 'REJECTED', version: 2 }));
    assert.equal(h.engine.getSnapshot().phase, 'ended');

    h.engine.dismiss();
    assert.equal(h.engine.getSnapshot().phase, 'idle');
    assert.equal(h.engine.getSnapshot().call, null);

    h.socket.responder = (event) => (event === 'call:invite' ? { ok: true, call: callDto({ id: 'call-2' }) } : { ok: true });
    await h.engine.start({ conversationId: 'conv-1', type: 'VOICE', peer: PEER });
    assert.equal(h.engine.getSnapshot().call?.id, 'call-2');
  });

  it('ignores a request to start a call while one is in progress', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    await h.engine.start({ conversationId: 'conv-1', type: 'VIDEO', peer: PEER });
    assert.equal(h.socket.events('call:invite').length, 1);
  });

  it('retries a failed start with the same details', async () => {
    let block = true;
    const h = await connectedHarness({
      getUserMedia: async () => {
        if (block) throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
        return new FakeStream([new FakeTrack('audio')]);
      },
    });
    await h.engine.start({ conversationId: 'conv-1', type: 'VOICE', peer: PEER });
    assert.equal(h.engine.getSnapshot().canRetry, true);

    block = false;
    h.socket.responder = (event) => (event === 'call:invite' ? { ok: true, call: callDto() } : { ok: true });
    await h.engine.retryStart();
    assert.equal(h.engine.getSnapshot().phase, 'outgoing');
    assert.deepEqual(h.socket.events('call:invite')[0].payload, { conversationId: 'conv-1', type: 'VOICE' });
  });
});

describe('CallEngine — nothing about money', () => {
  it('sends nothing that names a price, coin or balance, over the whole life of a call', async () => {
    const h = await connectedHarness();
    await placeCall(h);
    h.socket.pushState(callDto({ status: 'ACCEPTED', version: 3 }));
    await flush();
    h.peers[0].gather(CAND(1));
    h.peers[0].setState('connected');
    await flush();

    assert.doesNotMatch(JSON.stringify(h.socket.sent), /coin|price|charge|wallet|payment|balance|bill/i);
  });
});
