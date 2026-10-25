/**
 * The browser side of a call: signaling protocol + WebRTC peer + local media.
 *
 * Framework-agnostic on purpose. Every browser and network dependency (socket,
 * getUserMedia, RTCPeerConnection, the ICE-server fetch, ringing) is injected
 * through `CallEngineEnv`, so the whole protocol — who sends the offer, how
 * candidates are ordered and buffered, what happens on reconnect, on a lost
 * connection, when another tab answers — is unit-tested with fakes (see
 * call-engine.test.ts). The React layer (providers/call-provider.tsx) is a thin
 * shell that renders this engine's state.
 *
 * What the client does and does not decide:
 *  - The SERVER is the authority on the call's state; the engine only applies
 *    updates it receives, and only if their `version` is newer than what it
 *    holds, so a delayed or replayed update can never move a call backwards.
 *  - The engine never trusts or sends an identity: the socket is authenticated
 *    by the server, and payloads carry only a call id and negotiation data.
 *  - Calls are free. Nothing in here knows about coins, balances or billing.
 *
 * Only erasable TypeScript is used (no enums / parameter properties) so it can
 * run under `node --test`.
 */
import type { CallAck, CallDto, CallIceServersDto, CallSignalDto, CallSocketEvent, CallType } from '@fittin/shared-types';
import {
  directionOf,
  isActiveStatus,
  isLiveStatus,
  isRingingStatus,
  isTerminalStatus,
  outcomeOf,
  phaseOf,
  type CallDirection,
  type CallOutcome,
  type CallPhase,
} from './call-status.ts';
import { buildCameraConstraints, buildMediaConstraints, classifyMediaError, type MediaFailure } from './media.ts';

// String literals (checked against the shared type below) so this module has no runtime import of the shared package.
const EV = {
  INVITE: 'call:invite',
  RINGING: 'call:ringing',
  ACCEPT: 'call:accept',
  REJECT: 'call:reject',
  END: 'call:end',
  FAIL: 'call:fail',
  CONNECTED: 'call:connected',
  SIGNAL: 'call:signal',
  HEARTBEAT: 'call:heartbeat',
  RESUME: 'call:resume',
  STATE: 'call:state',
} as const satisfies Record<string, CallSocketEvent>;

export const TIMING = {
  /** Matches the server: 35s of silence abandons a call, so beat well inside it. */
  heartbeatMs: 10_000,
  /** How long a dropped media path may take to recover before the call is ended. */
  mediaGraceMs: 10_000,
  ackTimeoutMs: 6_000,
  /** How long to wait for the signaling socket to be usable before failing a start. */
  socketWaitMs: 6_000,
  /** If the server never tells us a ringing call ended, give up locally this long after it should have. */
  ringWatchdogMarginMs: 5_000,
  retryInitialMs: 2_000,
  retryMaxMs: 30_000,
} as const;

/** Used only if the server can't be asked for ICE servers: public STUN, which needs no credential. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302'] }];

// ---------------------------------------------------------------------------
// Injected environment
// ---------------------------------------------------------------------------

export interface SocketLike {
  connected: boolean;
  on(event: string, handler: (...args: any[]) => void): unknown;
  emit(event: string, ...args: any[]): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

export interface CallEngineEnv {
  /** The signed-in user. The engine only ever uses it to work out which side of a call it is on. */
  selfUserId: string;
  /** Creates the (not yet connected) signaling socket. Its auth callback supplies a fresh token on every attempt. */
  createSocket(): SocketLike;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createMediaStream(tracks: MediaStreamTrack[]): MediaStream;
  createPeerConnection(config: RTCConfiguration): RTCPeerConnection;
  fetchIceServers(): Promise<CallIceServersDto>;
  /** Starts whatever tells the user a call is arriving; returns a function that stops it. */
  startRinging(call: CallDto): () => void;
}

// ---------------------------------------------------------------------------
// Public state
// ---------------------------------------------------------------------------

export interface PeerInfo {
  fullName: string;
  avatarUrl: string | null;
}

export interface CallNotice {
  message: string;
  hint: string | null;
}

export interface CallEngineState {
  /** Health of the signaling connection. */
  socket: 'idle' | 'connecting' | 'connected' | 'disconnected';
  phase: CallPhase;
  call: CallDto | null;
  direction: CallDirection | null;
  type: CallType | null;
  /** The other person, known before the call exists (while preparing) and after it. */
  peer: PeerInfo | null;
  isMuted: boolean;
  isCameraOff: boolean;
  /** A video call that had to fall back to audio because the camera couldn't be used. */
  cameraUnavailable: boolean;
  /** How a finished call ended, from this user's side. */
  outcome: CallOutcome | null;
  /** Something the user should read: why a call couldn't start, or why Accept didn't work. */
  notice: CallNotice | null;
  /** The media path dropped and is being given a moment to recover. */
  reconnecting: boolean;
  /** Bumps whenever the local/remote stream changes, so a view knows to re-attach it. */
  mediaVersion: number;
  /** A failed start can be retried. */
  canRetry: boolean;
}

function initialState(): CallEngineState {
  return {
    socket: 'idle',
    phase: 'idle',
    call: null,
    direction: null,
    type: null,
    peer: null,
    isMuted: false,
    isCameraOff: false,
    cameraUnavailable: false,
    outcome: null,
    notice: null,
    reconnecting: false,
    mediaVersion: 0,
    canRetry: false,
  };
}

/** What a view renders before an engine exists (server render, signed-out, unsupported). */
export const IDLE_CALL_STATE: CallEngineState = initialState();

export interface StartCallInput {
  conversationId: string;
  type: CallType;
  peer: PeerInfo;
}

type AckHandler = (ack: CallAck<{ call?: CallDto; signals?: CallSignalDto[] }>) => void;

const ERROR_MESSAGES: Record<string, string> = {
  OFFLINE: 'You appear to be offline. Check your connection and try again.',
  TIMEOUT: 'The call service didn’t respond. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  NOT_FOUND: 'That conversation isn’t available.',
  CALL_NOT_FOUND: 'That call isn’t available any more.',
};

/** The words to show for a refused request. Server messages are already written for users. */
export function describeAckFailure(ack: { code: string; message: string }): string {
  return ERROR_MESSAGES[ack.code] ?? (ack.message || 'Something went wrong. Please try again.');
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export class CallEngine {
  private readonly env: CallEngineEnv;
  private state: CallEngineState = initialState();
  private readonly listeners = new Set<() => void>();

  private socket: SocketLike | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelayMs: number = TIMING.retryInitialMs;
  private stopped = false;

  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pc: RTCPeerConnection | null = null;
  private videoSender: RTCRtpSender | null = null;
  private iceServers: RTCIceServer[] | null = null;

  /** Bumped whenever a start/accept is abandoned, so an in-flight one notices and stands down. */
  private attempt = 0;
  private lastStart: StartCallInput | null = null;
  /** The call this window is running (placed or answered here) — as opposed to one it merely hears about. */
  private ownedCallId: string | null = null;
  /** The newest push about OUR OWN call that arrived before the invite was acknowledged (so we didn't know its id yet). */
  private earlyOwnCall: CallDto | null = null;
  private acceptedHere = false;
  private accepting = false;
  private negotiationStarted = false;
  private connectedReported = false;
  private localDescriptionSent = false;
  private pendingLocalCandidates: RTCIceCandidateInit[] = [];
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private readonly processedSignalIds = new Set<number>();
  private maxSignalId = 0;
  private outbound: Promise<unknown> = Promise.resolve();
  private inbound: Promise<unknown> = Promise.resolve();

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private ringWatchdog: ReturnType<typeof setTimeout> | null = null;
  private mediaGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private stopRinging: (() => void) | null = null;

  constructor(env: CallEngineEnv) {
    this.env = env;
  }

  // -- subscription (useSyncExternalStore-shaped) ---------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): CallEngineState => this.state;

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private setState(patch: Partial<CallEngineState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of [...this.listeners]) listener();
  }

  private bumpMedia(patch: Partial<CallEngineState> = {}): void {
    this.setState({ ...patch, mediaVersion: this.state.mediaVersion + 1 });
  }

  // -- connection -----------------------------------------------------------

  /** Opens the signaling socket (idempotent). Call once the user is signed in; safe to call again after disconnect(). */
  connect(): void {
    if (this.socket) return;
    this.stopped = false;
    const socket = this.env.createSocket();
    this.socket = socket;

    socket.on('connect', () => {
      this.clearRetry();
      this.retryDelayMs = TIMING.retryInitialMs;
      this.setState({ socket: 'connected' });
      this.onSocketConnected();
    });
    socket.on('disconnect', () => {
      this.setState({ socket: 'disconnected' });
    });
    socket.on('connect_error', (error: { data?: { code?: string } }) => {
      this.setState({ socket: 'disconnected' });
      // These will never succeed by retrying; anything else (network, server restarting, an expired token that
      // the next attempt will refresh) will.
      const code = error?.data?.code;
      if (code === 'FORBIDDEN' || code === 'EMAIL_NOT_VERIFIED' || code === 'ACCOUNT_SUSPENDED') return;
      this.scheduleRetry();
    });
    socket.on(EV.STATE, (call: CallDto) => this.onServerCall(call));
    socket.on(EV.SIGNAL, (signal: CallSignalDto) => this.onServerSignal(signal));

    this.setState({ socket: 'connecting' });
    socket.connect();
  }

  /** Signing out / unmounting: leave any call, drop the socket, forget everything. */
  disconnect(): void {
    this.stopped = true;
    this.clearRetry();
    const call = this.state.call;
    if (call && this.ownedCallId === call.id && isActiveStatus(call.status)) {
      this.socket?.emit(EV.END, { callId: call.id });
    }
    this.teardownCall();
    this.socket?.disconnect();
    this.socket = null;
    this.state = initialState();
    for (const listener of [...this.listeners]) listener();
  }

  /** The page is going away (tab closed / navigated): tell the other person now rather than after a timeout. */
  handlePageHide(): void {
    const call = this.state.call;
    if (call && this.ownedCallId === call.id && isActiveStatus(call.status)) {
      this.socket?.emit(EV.END, { callId: call.id });
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.stopped) return;
    const delay = this.retryDelayMs;
    this.retryDelayMs = Math.min(this.retryDelayMs * 2, TIMING.retryMaxMs);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped && this.socket && !this.socket.connected) this.socket.connect();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private onSocketConnected(): void {
    // A call we were running survived the socket dropping (the media path is separate): pick up where we left off.
    const call = this.state.call;
    if (call && this.ownedCallId === call.id && isActiveStatus(call.status) && !isRingingStatus(call.status)) {
      void this.resume();
    }
  }

  private async resume(): Promise<void> {
    const call = this.state.call;
    if (!call) return;
    const ack = await this.request(EV.RESUME, { callId: call.id, afterSignalId: this.maxSignalId });
    if (!ack.ok) {
      if (ack.code === 'CALL_NOT_FOUND') this.finishLocally('FAILED');
      return;
    }
    if (ack.call) this.applyServerCall(ack.call);
    for (const signal of ack.signals ?? []) this.onServerSignal(signal);
  }

  /** Waits (briefly) for the socket to be usable, connecting it if needed. */
  private async ensureSocket(): Promise<boolean> {
    this.connect();
    if (this.socket?.connected) return true;
    return new Promise<boolean>((resolve) => {
      const started = Date.now();
      const poll = setInterval(() => {
        if (this.socket?.connected) {
          clearInterval(poll);
          resolve(true);
        } else if (Date.now() - started >= TIMING.socketWaitMs) {
          clearInterval(poll);
          resolve(false);
        }
      }, 100);
    });
  }

  /** Emits an event and waits for the server's acknowledgement, never hanging: offline and timeout are answered too. */
  private request(event: string, payload: unknown, timeoutMs: number = TIMING.ackTimeoutMs): Promise<Parameters<AckHandler>[0]> {
    const socket = this.socket;
    if (!socket || !socket.connected) {
      return Promise.resolve({ ok: false, code: 'OFFLINE', message: ERROR_MESSAGES.OFFLINE });
    }
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, code: 'TIMEOUT', message: ERROR_MESSAGES.TIMEOUT });
      }, timeoutMs);
      socket.emit(event, payload, (ack: Parameters<AckHandler>[0] | undefined) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ack ?? { ok: false, code: 'NO_ACK', message: ERROR_MESSAGES.TIMEOUT });
      });
    });
  }

  // -- placing a call -------------------------------------------------------

  async start(input: StartCallInput): Promise<void> {
    if (this.state.phase !== 'idle' && this.state.phase !== 'ended') return;

    this.resetCallState();
    this.earlyOwnCall = null;
    this.lastStart = input;
    const attempt = ++this.attempt;
    this.setState({
      phase: 'preparing',
      direction: 'OUTGOING',
      type: input.type,
      peer: input.peer,
      call: null,
      outcome: null,
      notice: null,
      canRetry: false,
    });

    const icePromise = this.loadIceServers();
    const media = await this.acquireMedia(input.type);
    if (attempt !== this.attempt) {
      if ('stream' in media) this.stopStream(media.stream);
      return;
    }
    if ('failure' in media) {
      this.failStart(media.failure.message, media.failure.hint);
      return;
    }
    this.localStream = media.stream;
    this.bumpMedia({ cameraUnavailable: media.cameraUnavailable });

    await icePromise;
    if (attempt !== this.attempt) return;

    if (!(await this.ensureSocket())) {
      if (attempt !== this.attempt) return;
      this.failStart(ERROR_MESSAGES.OFFLINE, null);
      return;
    }
    if (attempt !== this.attempt) return;

    const ack = await this.request(EV.INVITE, { conversationId: input.conversationId, type: input.type });
    if (attempt !== this.attempt) {
      // The user gave up while we were asking; if the server did create the call, cancel it.
      if (ack.ok && ack.call) void this.request(EV.END, { callId: ack.call.id });
      return;
    }
    if (!ack.ok || !ack.call) {
      this.failStart(ack.ok ? ERROR_MESSAGES.TIMEOUT : describeAckFailure(ack), null);
      return;
    }

    this.ownedCallId = ack.call.id;
    this.setState({ call: ack.call, phase: phaseOf(ack.call.status, 'OUTGOING'), peer: ack.call.callee });
    this.armRingWatchdog(ack.call);
    // The callee may already have answered by the time the ack arrives.
    if (ack.call.status === 'ACCEPTED') void this.beginNegotiationAsCaller();
    // (Cast: TypeScript remembers the `= null` at the top of start() across the awaits above.)
    const early = this.earlyOwnCall as CallDto | null;
    this.earlyOwnCall = null;
    if (early && early.id === ack.call.id) this.applyServerCall(early);
  }

  /** After a failed start: try the same call again. */
  retryStart(): Promise<void> {
    const input = this.lastStart;
    if (!input || this.state.phase !== 'ended' || this.state.call) return Promise.resolve();
    return this.start(input);
  }

  private failStart(message: string, hint: string | null): void {
    this.attempt++;
    this.releaseMedia();
    this.setState({
      phase: 'ended',
      call: null,
      outcome: null,
      notice: { message, hint },
      canRetry: true,
      mediaVersion: this.state.mediaVersion + 1,
    });
  }

  // -- answering ------------------------------------------------------------

  async accept(): Promise<void> {
    const call = this.state.call;
    if (this.state.phase !== 'incoming' || !call || this.accepting) return;
    this.accepting = true;
    const attempt = ++this.attempt;
    this.setState({ notice: null });

    try {
      const icePromise = this.loadIceServers();
      const media = await this.acquireMedia(call.type);
      if (attempt !== this.attempt) {
        if ('stream' in media) this.stopStream(media.stream);
        return;
      }
      if ('failure' in media) {
        // Stay on the incoming screen so the person can fix their permissions and try again, or decline.
        this.setState({ notice: { message: media.failure.message, hint: media.failure.hint } });
        return;
      }
      this.localStream = media.stream;
      this.bumpMedia({ cameraUnavailable: media.cameraUnavailable });
      await icePromise;
      if (attempt !== this.attempt) return;

      this.createPeer();
      // Set BEFORE asking: the server's "answered" push can arrive ahead of our acknowledgement.
      this.acceptedHere = true;
      this.ownedCallId = call.id;
      const ack = await this.request(EV.ACCEPT, { callId: call.id });
      if (attempt !== this.attempt) return;

      if (!ack.ok || !ack.call) {
        this.acceptedHere = false;
        this.ownedCallId = null;
        this.closePeer();
        this.releaseMedia();
        this.bumpMedia();
        this.setState({ notice: { message: ack.ok ? ERROR_MESSAGES.TIMEOUT : describeAckFailure(ack), hint: null } });
        return;
      }
      this.applyServerCall(ack.call);
    } finally {
      this.accepting = false;
    }
  }

  async reject(): Promise<void> {
    const call = this.state.call;
    if (this.state.phase !== 'incoming' || !call) return;
    this.attempt++;
    const ack = await this.request(EV.REJECT, { callId: call.id });
    if (ack.ok && ack.call) this.applyServerCall(ack.call);
    else this.finishLocally('REJECTED');
  }

  /** The hang-up button: cancels while ringing out, declines while ringing in, ends a live call, abandons a start in progress. */
  async end(): Promise<void> {
    const { phase, call } = this.state;
    if (phase === 'preparing') {
      this.attempt++;
      this.releaseMedia();
      this.resetCallState();
      this.setState({ ...initialState(), socket: this.state.socket });
      return;
    }
    if (!call || phase === 'idle' || phase === 'ended') return;
    if (phase === 'incoming') return this.reject();

    this.attempt++;
    const ack = await this.request(EV.END, { callId: call.id });
    if (ack.ok && ack.call) this.applyServerCall(ack.call);
    else this.finishLocally(phase === 'outgoing' ? 'CANCELLED' : 'ENDED');
  }

  /** Closes the ended/failed screen. */
  dismiss(): void {
    if (this.state.phase !== 'ended' && this.state.phase !== 'idle') return;
    this.resetCallState();
    this.setState({ ...initialState(), socket: this.state.socket });
  }

  // -- controls -------------------------------------------------------------

  toggleMute(): void {
    const stream = this.localStream;
    if (!stream) return;
    const muted = !this.state.isMuted;
    for (const track of stream.getAudioTracks()) track.enabled = !muted;
    this.setState({ isMuted: muted });
  }

  /** Turning the camera off really releases it (the light goes out); turning it on asks for it again. */
  async toggleCamera(): Promise<void> {
    const stream = this.localStream;
    if (!stream || this.state.type !== 'VIDEO' || this.state.cameraUnavailable) return;

    if (!this.state.isCameraOff) {
      for (const track of stream.getVideoTracks()) {
        track.stop();
        stream.removeTrack(track);
      }
      try {
        await this.videoSender?.replaceTrack(null);
      } catch {
        /* the sender can be gone if the call just ended */
      }
      this.bumpMedia({ isCameraOff: true });
      return;
    }

    try {
      const camera = await this.env.getUserMedia(buildCameraConstraints());
      const [track] = camera.getVideoTracks();
      if (!track || this.localStream !== stream) {
        camera.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.addTrack(track);
      await this.videoSender?.replaceTrack(track);
      this.bumpMedia({ isCameraOff: false, notice: null });
    } catch (error) {
      const failure = classifyMediaError(error, 'CAMERA');
      this.setState({ notice: { message: failure.message, hint: failure.hint } });
    }
  }

  // -- server -> engine -----------------------------------------------------

  private onServerCall(call: CallDto): void {
    // Only ever act on a call we are one of the two people on. (The server already guarantees it; this is a seatbelt.)
    if (!call || (call.callerId !== this.env.selfUserId && call.calleeId !== this.env.selfUserId)) return;

    const current = this.state.call;
    if (current && current.id === call.id) {
      this.applyServerCall(call);
      return;
    }

    // Our own call, pushed before the invite was acknowledged: hold on to the newest and apply it once we know its id.
    if (this.state.phase === 'preparing' && call.callerId === this.env.selfUserId) {
      if (!this.earlyOwnCall || call.version > this.earlyOwnCall.version) this.earlyOwnCall = call;
      return;
    }

    // A call we're not tracking. Busy with another one: ignore (the server won't ring a busy person anyway).
    if (this.state.phase !== 'idle' && this.state.phase !== 'ended') return;
    // Only an incoming, still-ringing call is ours to show. A call placed from another window, or one that
    // has already finished, is not.
    if (directionOf(call, this.env.selfUserId) === 'INCOMING' && isRingingStatus(call.status)) {
      this.beginIncoming(call);
    }
  }

  private beginIncoming(call: CallDto): void {
    this.resetCallState();
    this.setState({
      phase: 'incoming',
      call,
      direction: 'INCOMING',
      type: call.type,
      peer: call.caller,
      outcome: null,
      notice: null,
      canRetry: false,
    });
    this.stopRinging = this.env.startRinging(call);
    void this.request(EV.RINGING, { callId: call.id });
    this.armRingWatchdog(call);
  }

  /** Applies a server snapshot of the call we're tracking — only if it is newer than what we hold. */
  private applyServerCall(call: CallDto): void {
    const current = this.state.call;
    if (!current || current.id !== call.id || call.version <= current.version) return;
    const direction = this.state.direction ?? directionOf(call, this.env.selfUserId);

    if (isTerminalStatus(call.status)) {
      this.finish(call, direction);
      return;
    }

    // Someone (another window of ours) answered a call that was ringing here: stop ringing, quietly.
    if (direction === 'INCOMING' && isLiveStatus(call.status) && !this.acceptedHere) {
      this.teardownCall();
      this.resetCallState();
      this.setState({ ...initialState(), socket: this.state.socket });
      return;
    }

    this.setState({ call, phase: phaseOf(call.status, direction) });

    if (isLiveStatus(call.status)) {
      this.stopRingingAndWatchdog();
      this.startHeartbeat();
    }
    if (direction === 'OUTGOING' && call.status === 'ACCEPTED') void this.beginNegotiationAsCaller();
  }

  private finish(call: CallDto, direction: CallDirection): void {
    this.teardownCall();
    this.setState({
      call,
      direction,
      phase: 'ended',
      outcome: outcomeOf(call, direction),
      reconnecting: false,
      canRetry: false,
      mediaVersion: this.state.mediaVersion + 1,
    });
  }

  /** Ends the call on this side without the server's say-so (its answer never came). The server's row still converges by timeout. */
  private finishLocally(status: 'ENDED' | 'REJECTED' | 'CANCELLED' | 'FAILED' | 'MISSED'): void {
    const call = this.state.call;
    const direction = this.state.direction;
    if (!call || !direction || this.state.phase === 'ended') return;
    this.finish(
      { ...call, status, version: call.version + 1, endedAt: new Date().toISOString(), endReason: status === 'FAILED' ? 'NEGOTIATION_FAILED' : call.endReason },
      direction,
    );
  }

  // -- negotiation ----------------------------------------------------------

  private async beginNegotiationAsCaller(): Promise<void> {
    if (this.negotiationStarted) return;
    this.negotiationStarted = true;
    const call = this.state.call;
    if (!call) return;
    try {
      const pc = this.pc ?? this.createPeer();
      if (call.type === 'VIDEO' && !this.localStream?.getVideoTracks().length) {
        // No camera here, but we can still SEE their video.
        pc.addTransceiver('video', { direction: 'recvonly' });
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const ack = await this.request(EV.SIGNAL, {
        callId: call.id,
        kind: 'OFFER',
        payload: { type: 'offer', sdp: pc.localDescription?.sdp ?? offer.sdp },
      });
      if (!ack.ok) throw new Error(ack.message);
      this.localDescriptionSent = true;
      this.flushLocalCandidates();
    } catch {
      void this.reportFailure('NEGOTIATION_FAILED');
    }
  }

  private onServerSignal(signal: CallSignalDto): void {
    const call = this.state.call;
    if (!signal || !call || signal.callId !== call.id) return;
    if (this.processedSignalIds.has(signal.id)) return;
    this.processedSignalIds.add(signal.id);
    this.maxSignalId = Math.max(this.maxSignalId, signal.id);
    // One at a time, in order — an offer must be applied before the candidates that follow it.
    this.inbound = this.inbound.then(() => this.processSignal(signal)).catch(() => undefined);
  }

  private async processSignal(signal: CallSignalDto): Promise<void> {
    const pc = this.pc;
    if (!pc || !this.state.call) return;
    const payload = signal.payload as { type?: string; sdp?: string } & RTCIceCandidateInit;

    try {
      if (signal.kind === 'OFFER' && this.state.direction === 'INCOMING') {
        await pc.setRemoteDescription({ type: 'offer', sdp: String(payload.sdp) });
        await this.flushRemoteCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const ack = await this.request(EV.SIGNAL, {
          callId: this.state.call.id,
          kind: 'ANSWER',
          payload: { type: 'answer', sdp: pc.localDescription?.sdp ?? answer.sdp },
        });
        if (!ack.ok) throw new Error(ack.message);
        this.localDescriptionSent = true;
        this.flushLocalCandidates();
      } else if (signal.kind === 'ANSWER' && this.state.direction === 'OUTGOING') {
        await pc.setRemoteDescription({ type: 'answer', sdp: String(payload.sdp) });
        await this.flushRemoteCandidates();
      } else if (signal.kind === 'ICE_CANDIDATE') {
        const candidate: RTCIceCandidateInit = {
          candidate: payload.candidate,
          sdpMid: payload.sdpMid ?? null,
          sdpMLineIndex: payload.sdpMLineIndex ?? null,
          usernameFragment: payload.usernameFragment ?? undefined,
        };
        if (!pc.remoteDescription) this.pendingRemoteCandidates.push(candidate);
        else await pc.addIceCandidate(candidate).catch(() => undefined);
      }
    } catch {
      void this.reportFailure('NEGOTIATION_FAILED');
    }
  }

  private async flushRemoteCandidates(): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    const pending = this.pendingRemoteCandidates.splice(0);
    for (const candidate of pending) await pc.addIceCandidate(candidate).catch(() => undefined);
  }

  private onLocalCandidate(candidate: RTCIceCandidateInit): void {
    // Not before our own offer/answer has gone out: the other side can't use a candidate for a description it hasn't seen.
    if (!this.localDescriptionSent) this.pendingLocalCandidates.push(candidate);
    else this.sendCandidate(candidate);
  }

  private flushLocalCandidates(): void {
    for (const candidate of this.pendingLocalCandidates.splice(0)) this.sendCandidate(candidate);
  }

  private sendCandidate(candidate: RTCIceCandidateInit): void {
    const call = this.state.call;
    if (!call) return;
    const payload = {
      candidate: candidate.candidate ?? '',
      sdpMid: candidate.sdpMid ?? null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      ...(candidate.usernameFragment ? { usernameFragment: candidate.usernameFragment } : {}),
    };
    // Sent strictly in order, one at a time.
    this.outbound = this.outbound.then(() => this.request(EV.SIGNAL, { callId: call.id, kind: 'ICE_CANDIDATE', payload })).catch(() => undefined);
  }

  // -- the peer connection --------------------------------------------------

  private createPeer(): RTCPeerConnection {
    const pc = this.env.createPeerConnection({
      iceServers: this.iceServers ?? FALLBACK_ICE_SERVERS,
      bundlePolicy: 'max-bundle',
    });
    this.pc = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) this.onLocalCandidate(event.candidate.toJSON());
    };
    pc.ontrack = (event) => {
      const stream = event.streams?.[0] ?? this.env.createMediaStream([event.track]);
      this.remoteStream = stream;
      this.bumpMedia();
    };
    pc.onconnectionstatechange = () => this.onMediaState(pc.connectionState);
    // Older Safari reports only iceConnectionState.
    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState;
      if (ice === 'connected' || ice === 'completed') this.onMediaState('connected');
      else if (ice === 'failed') this.onMediaState('failed');
      else if (ice === 'disconnected') this.onMediaState('disconnected');
    };

    const stream = this.localStream;
    if (stream) {
      for (const track of stream.getTracks()) {
        const sender = pc.addTrack(track, stream);
        if (track.kind === 'video') this.videoSender = sender;
      }
    }
    return pc;
  }

  private onMediaState(state: string): void {
    const call = this.state.call;
    if (!call || !this.pc) return;

    if (state === 'connected') {
      if (this.mediaGraceTimer) clearTimeout(this.mediaGraceTimer);
      this.mediaGraceTimer = null;
      if (this.state.reconnecting) this.setState({ reconnecting: false });
      if (!this.connectedReported) {
        this.connectedReported = true;
        void this.request(EV.CONNECTED, { callId: call.id }).then((ack) => {
          if (ack.ok && ack.call) this.applyServerCall(ack.call);
        });
      }
    } else if (state === 'disconnected') {
      // Often a blip that heals itself. Give it a moment before giving up.
      if (this.mediaGraceTimer) return;
      this.setState({ reconnecting: true });
      this.mediaGraceTimer = setTimeout(() => {
        this.mediaGraceTimer = null;
        if (this.pc) void this.reportConnectionLost();
      }, TIMING.mediaGraceMs);
    } else if (state === 'failed') {
      void this.reportConnectionLost();
    }
  }

  private async reportConnectionLost(): Promise<void> {
    const call = this.state.call;
    if (!call || isTerminalStatus(call.status)) return;
    if (call.status === 'CONNECTED') {
      const ack = await this.request(EV.END, { callId: call.id, reason: 'CONNECTION_LOST' });
      if (ack.ok && ack.call) this.applyServerCall(ack.call);
      else this.finishLocally('ENDED');
    } else {
      await this.reportFailure('NEGOTIATION_FAILED');
    }
  }

  private async reportFailure(reason: 'NEGOTIATION_FAILED' | 'MEDIA_ERROR'): Promise<void> {
    const call = this.state.call;
    if (!call || isTerminalStatus(call.status)) return;
    const ack = await this.request(EV.FAIL, { callId: call.id, reason });
    if (ack.ok && ack.call) this.applyServerCall(ack.call);
    else this.finishLocally('FAILED');
  }

  // -- keep-alive -----------------------------------------------------------

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => void this.beat(), TIMING.heartbeatMs);
  }

  private async beat(): Promise<void> {
    const call = this.state.call;
    if (!call || this.ownedCallId !== call.id || !isLiveStatus(call.status)) return;
    const ack = await this.request(EV.HEARTBEAT, { callId: call.id, afterSignalId: this.maxSignalId });
    if (!ack.ok) return;
    if (ack.call) this.applyServerCall(ack.call);
    for (const signal of ack.signals ?? []) this.onServerSignal(signal);
  }

  private armRingWatchdog(call: CallDto): void {
    if (this.ringWatchdog) clearTimeout(this.ringWatchdog);
    const delay = Math.max(0, Date.parse(call.ringExpiresAt) - Date.now()) + TIMING.ringWatchdogMarginMs;
    this.ringWatchdog = setTimeout(() => {
      this.ringWatchdog = null;
      const current = this.state.call;
      if (current && current.id === call.id && isRingingStatus(current.status)) this.finishLocally('MISSED');
    }, delay);
  }

  // -- media & cleanup ------------------------------------------------------

  private async loadIceServers(): Promise<void> {
    if (this.iceServers) return;
    try {
      const result = await this.env.fetchIceServers();
      this.iceServers = result.iceServers as RTCIceServer[];
    } catch {
      this.iceServers = FALLBACK_ICE_SERVERS;
    }
  }

  private async acquireMedia(
    type: CallType,
  ): Promise<{ stream: MediaStream; cameraUnavailable: boolean } | { failure: MediaFailure }> {
    try {
      return { stream: await this.env.getUserMedia(buildMediaConstraints(type)), cameraUnavailable: false };
    } catch (error) {
      if (type === 'VIDEO') {
        const failure = classifyMediaError(error, 'VIDEO');
        if (failure.kind === 'permission_denied' || failure.kind === 'device_not_found' || failure.kind === 'device_in_use') {
          // A camera problem shouldn't cost the whole call: carry on with audio if the microphone works.
          try {
            return { stream: await this.env.getUserMedia(buildMediaConstraints('VOICE')), cameraUnavailable: true };
          } catch (audioError) {
            return { failure: classifyMediaError(audioError, 'VOICE') };
          }
        }
        return { failure };
      }
      return { failure: classifyMediaError(error, 'VOICE') };
    }
  }

  private stopStream(stream: MediaStream): void {
    for (const track of stream.getTracks()) track.stop();
  }

  private releaseMedia(): void {
    if (this.localStream) this.stopStream(this.localStream);
    this.localStream = null;
    this.remoteStream = null;
    this.videoSender = null;
  }

  private closePeer(): void {
    const pc = this.pc;
    this.pc = null;
    if (!pc) return;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;
    try {
      pc.close();
    } catch {
      /* already closed */
    }
  }

  private stopRingingAndWatchdog(): void {
    this.stopRinging?.();
    this.stopRinging = null;
    if (this.ringWatchdog) clearTimeout(this.ringWatchdog);
    this.ringWatchdog = null;
  }

  /** Stops everything a live call owns: media, peer, timers, ringing. Leaves the state (and summary) alone. */
  private teardownCall(): void {
    this.stopRingingAndWatchdog();
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    if (this.mediaGraceTimer) clearTimeout(this.mediaGraceTimer);
    this.mediaGraceTimer = null;
    this.closePeer();
    this.releaseMedia();
    this.ownedCallId = null;
    this.acceptedHere = false;
    this.accepting = false;
    this.negotiationStarted = false;
  }

  /** Clears the per-call protocol bookkeeping ahead of a new call. */
  private resetCallState(): void {
    this.teardownCall();
    this.connectedReported = false;
    this.localDescriptionSent = false;
    this.pendingLocalCandidates = [];
    this.pendingRemoteCandidates = [];
    this.processedSignalIds.clear();
    this.maxSignalId = 0;
    this.outbound = Promise.resolve();
    this.inbound = Promise.resolve();
    this.setState({ isMuted: false, isCameraOff: false, cameraUnavailable: false, reconnecting: false });
  }
}
