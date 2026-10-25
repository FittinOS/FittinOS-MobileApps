import { PermissionsAndroid, Platform, Vibration } from 'react-native';
import { io } from 'socket.io-client';
import type { CallDto } from '@/api/shared';
import { api } from '@/api/client';
import { callsApi } from '@/api/endpoints';
import { API_URL } from '@/lib/config';
import type { CallEngineEnv, SocketLike } from './engine/call-engine.ts';

/**
 * Where the call-signaling socket lives: same host as the REST API, Socket.IO
 * namespace `/calls`, handshake path `<api prefix>/socket.io` — identical to
 * apps/web/lib/calls/call-socket-config.ts, without relying on a full WHATWG
 * URL implementation (React Native's is partial).
 */
export function socketTarget(apiUrl: string): { url: string; path: string } {
  const match = /^(https?:\/\/[^/?#]+)([^?#]*)/i.exec(apiUrl.trim());
  if (!match) throw new Error(`Invalid API URL: ${apiUrl}`);
  const origin = match[1];
  const prefix = match[2].replace(/\/+$/, '');
  return { url: `${origin}/calls`, path: `${prefix}/socket.io` };
}

/** A DOMException-like error so the shared classifyMediaError() reports "permission denied". */
function permissionError(what: string): Error {
  const error = new Error(`${what} permission was denied.`);
  error.name = 'NotAllowedError';
  return error;
}

async function ensureAndroidPermissions(constraints: MediaStreamConstraints): Promise<void> {
  if (Platform.OS !== 'android') return;
  const wanted: Array<(typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]> = [];
  if (constraints.audio) wanted.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (constraints.video) wanted.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  if (!wanted.length) return;
  const result = await PermissionsAndroid.requestMultiple(wanted);
  if (constraints.audio && result[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED) {
    throw permissionError('Microphone');
  }
  if (constraints.video && result[PermissionsAndroid.PERMISSIONS.CAMERA] !== PermissionsAndroid.RESULTS.GRANTED) {
    throw permissionError('Camera');
  }
}

/** Vibrate in a ring pattern until stopped. No audio is played — nothing is bundled to play. */
export function startIncomingRing(): () => void {
  Vibration.vibrate([0, 600, 400, 600, 1400], true);
  return () => Vibration.cancel();
}

/**
 * The real native environment for the shared CallEngine. Types are cast at
 * the boundary: react-native-webrtc implements the same W3C API surface the
 * engine uses (addTrack, addTransceiver, replaceTrack, on* handlers), but
 * its classes are not nominally the DOM lib types.
 */
export function createNativeCallEnv(selfUserId: string, onRing: (call: CallDto) => () => void = () => startIncomingRing()): CallEngineEnv {
  // Loaded here, not at module scope: react-native-webrtc throws on import where its
  // native module is missing (Expo Go). Callers only get here when callsCapability() is available.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MediaStream: RNMediaStream, RTCPeerConnection: RNPeerConnection, mediaDevices } = require('react-native-webrtc') as typeof import('react-native-webrtc');
  const target = socketTarget(API_URL);
  return {
    selfUserId,
    createSocket: () =>
      io(target.url, {
        path: target.path,
        transports: ['websocket'],
        // React Native's Android WebSocket adds `Origin: <scheme>://<api host>` unless
        // one is given, and CallsGateway rejects any Origin outside the web CORS
        // allow-list ("This origin is not allowed.") while accepting native clients
        // that send none. A native app has no web origin, so send it empty.
        extraHeaders: { origin: '' },
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 10_000,
        auth: (callback) => {
          void api.getFreshAccessToken().then((token) => callback({ token: token ?? '' }));
        },
      }) as unknown as SocketLike,
    getUserMedia: async (constraints) => {
      await ensureAndroidPermissions(constraints);
      return (await mediaDevices.getUserMedia(constraints as never)) as unknown as MediaStream;
    },
    createMediaStream: (tracks) => new RNMediaStream(tracks as never) as unknown as MediaStream,
    createPeerConnection: (config) => new RNPeerConnection(config as never) as unknown as RTCPeerConnection,
    fetchIceServers: callsApi.iceServers,
    startRinging: onRing,
  };
}
