/**
 * Microphone/camera handling: what to ask the browser for, and how to explain
 * it when the browser says no. Pure — the real getUserMedia is injected by the
 * call engine — and erasable-TypeScript only, so it runs under `node --test`.
 */

export type MediaRequestType = 'VOICE' | 'VIDEO';

/**
 * Voice never asks for the camera. Video asks for both, preferring the front
 * camera at a size that works on a phone. Echo cancellation and noise
 * suppression are what make a speakerphone call usable.
 */
export function buildMediaConstraints(type: MediaRequestType): MediaStreamConstraints {
  const audio: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (type === 'VOICE') return { audio, video: false };
  return {
    audio,
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
  };
}

/** Just the camera, for turning it back on mid-call. */
export function buildCameraConstraints(): MediaStreamConstraints {
  return {
    audio: false,
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
  };
}

export type MediaFailureKind =
  | 'permission_denied'
  | 'device_not_found'
  | 'device_in_use'
  | 'insecure_context'
  | 'unsupported'
  | 'unknown';

export interface MediaFailure {
  kind: MediaFailureKind;
  /** Which device the failure is about. */
  device: 'microphone' | 'camera' | 'both';
  /** Plain-language, safe to show a user. */
  message: string;
  /** What the user can do about it. */
  hint: string | null;
}

const errorName = (error: unknown): string =>
  typeof error === 'object' && error !== null && typeof (error as { name?: unknown }).name === 'string'
    ? (error as { name: string }).name
    : '';

/**
 * Turns a getUserMedia rejection into something a person can act on. `wanted`
 * says what was being requested, since the browser's error rarely says which
 * device failed.
 */
export function classifyMediaError(error: unknown, wanted: MediaRequestType | 'CAMERA'): MediaFailure {
  const device: MediaFailure['device'] = wanted === 'VIDEO' ? 'both' : wanted === 'CAMERA' ? 'camera' : 'microphone';
  const thing = wanted === 'VIDEO' ? 'camera and microphone' : wanted === 'CAMERA' ? 'camera' : 'microphone';
  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return {
        kind: 'permission_denied',
        device,
        message: `Access to your ${thing} is blocked.`,
        hint: `Allow ${thing} access for this site in your browser’s settings (usually the icon beside the address bar), then try again.`,
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return {
        kind: 'device_not_found',
        device,
        message: `No ${thing} was found.`,
        hint: `Connect a ${thing} and try again.`,
      };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        kind: 'device_in_use',
        device,
        message: `Your ${thing} can’t be used right now.`,
        hint: 'Another app or browser tab may be using it. Close it and try again.',
      };
    default:
      return { kind: 'unknown', device, message: `We couldn’t start your ${thing}.`, hint: 'Please try again.' };
  }
}

export interface CallSupport {
  supported: boolean;
  /** Why not, in words a user can act on. */
  reason: string | null;
}

/** Whether this browser/page can place calls at all. Injected so it is testable. */
export function callSupport(env: {
  isSecureContext: boolean | undefined;
  hasPeerConnection: boolean;
  hasGetUserMedia: boolean;
}): CallSupport {
  if (env.isSecureContext === false) {
    return { supported: false, reason: 'Calls need a secure (https) connection.' };
  }
  if (!env.hasPeerConnection || !env.hasGetUserMedia) {
    return {
      supported: false,
      reason: 'This browser doesn’t support calls. Try an up-to-date Chrome, Edge, Firefox or Safari.',
    };
  }
  return { supported: true, reason: null };
}
