import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { UserRole, type CallType } from '@/api/shared';
import { qk } from '@/api/queries';
import { callsCapability, type Capability } from '@/lib/native-capabilities';
import { useAuth } from '@/providers/auth-provider';
import { CallEngine, IDLE_CALL_STATE, type CallEngineState, type PeerInfo } from './engine/call-engine.ts';
import { createNativeCallEnv } from './native-env';

interface CallContextValue {
  state: CallEngineState;
  /** Whether this app binary can place calls at all (not in Expo Go), and why not. */
  support: Capability;
  speakerOn: boolean;
  startCall(input: { conversationId: string; type: CallType; peer: PeerInfo }): void;
  accept(): void;
  reject(): void;
  end(): void;
  dismiss(): void;
  retry(): void;
  toggleMute(): void;
  toggleCamera(): void;
  toggleSpeaker(): void;
  getLocalStream(): MediaStream | null;
  getRemoteStream(): MediaStream | null;
}

const CallContext = createContext<CallContextValue | null>(null);
const noopSubscribe = () => () => undefined;
const getIdle = () => IDLE_CALL_STATE;

type InCall = { start(o: { media: 'audio' | 'video' }): void; stop(): void; setForceSpeakerphoneOn(on: boolean): void };
/** Loaded lazily: the package has no native module in Expo Go. */
function inCallManager(): InCall | null {
  if (!callsCapability().available) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('react-native-incall-manager') as { default: InCall }).default;
}

/**
 * Hosts the shared call engine for a signed-in, email-verified professional
 * (the same eligibility as the web's CallProvider). Calls are free: nothing
 * here touches the wallet, coins or any price.
 *
 * Limitation: the signaling socket only lives while the app is running, so
 * an incoming call rings only while FittinOS Pro is open — the backend has
 * no native push channel to wake the app (see WEB_TO_MOBILE_PARITY.md).
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const eligible = Boolean(user && user.emailVerified && user.role === UserRole.PROFESSIONAL);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [support] = useState(callsCapability);

  const engine = useMemo(
    () => (userId && eligible && support.available ? new CallEngine(createNativeCallEnv(userId)) : null),
    [userId, eligible, support.available],
  );

  useEffect(() => {
    if (!engine) return;
    engine.connect();
    // Reconnect promptly when the app returns to the foreground (Android may drop the socket in background).
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') engine.connect();
    });
    return () => {
      sub.remove();
      engine.disconnect();
    };
  }, [engine]);

  const state = useSyncExternalStore(engine?.subscribe ?? noopSubscribe, engine?.getSnapshot ?? getIdle, getIdle);

  // Audio session: in-call mode while a call is live, speaker on by default for video.
  const inCall = state.phase === 'connecting' || state.phase === 'connected' || state.phase === 'outgoing';
  const isVideo = state.type === 'VIDEO';
  useEffect(() => {
    const manager = inCall ? inCallManager() : null;
    if (!manager) return;
    manager.start({ media: isVideo ? 'video' : 'audio' });
    manager.setForceSpeakerphoneOn(isVideo);
    setSpeakerOn(isVideo);
    return () => {
      manager.setForceSpeakerphoneOn(false);
      manager.stop();
    };
  }, [inCall, isVideo]);

  // A finished call shows up in the conversation's history immediately.
  const endedConversationId = state.phase === 'ended' && state.call ? state.call.conversationId : null;
  const endedCallId = state.phase === 'ended' && state.call ? state.call.id : null;
  useEffect(() => {
    if (endedConversationId) void queryClient.invalidateQueries({ queryKey: qk.calls(endedConversationId) });
  }, [endedConversationId, endedCallId, queryClient]);

  const startCall = useCallback((input: { conversationId: string; type: CallType; peer: PeerInfo }) => void engine?.start(input), [engine]);
  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((on) => {
      inCallManager()?.setForceSpeakerphoneOn(!on);
      return !on;
    });
  }, []);

  const value = useMemo<CallContextValue>(
    () => ({
      state,
      support,
      speakerOn,
      startCall,
      accept: () => void engine?.accept(),
      reject: () => void engine?.reject(),
      end: () => void engine?.end(),
      dismiss: () => engine?.dismiss(),
      retry: () => void engine?.retryStart(),
      toggleMute: () => engine?.toggleMute(),
      toggleCamera: () => void engine?.toggleCamera(),
      toggleSpeaker,
      getLocalStream: () => engine?.getLocalStream() ?? null,
      getRemoteStream: () => engine?.getRemoteStream() ?? null,
    }),
    [state, support, speakerOn, startCall, engine, toggleSpeaker],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall(): CallContextValue {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCall must be used within CallProvider');
  return value;
}
