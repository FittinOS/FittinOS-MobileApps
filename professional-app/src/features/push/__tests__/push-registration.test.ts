jest.mock('@/lib/native-capabilities', () => ({ isExpoGo: false }));

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-project-id' } } } },
}));

// Picked up automatically from __mocks__/expo-notifications.js (a manual
// mock, not an inline factory — see jest.setup.js's comment on why
// react-native-maps uses the same pattern in this app).
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as nativeCapabilities from '@/lib/native-capabilities';
import { pushApi } from '@/api/endpoints';
import * as SecureStore from 'expo-secure-store';
import { registerPushDevice, unregisterPushDevice } from '../push-registration';

function clearSecureStore() {
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
}

describe('registerPushDevice', () => {
  const registerDevice = jest.spyOn(pushApi, 'registerDevice');
  const unregisterDevice = jest.spyOn(pushApi, 'unregisterDevice');
  const getPermissionsAsync = jest.spyOn(Notifications, 'getPermissionsAsync');
  const requestPermissionsAsync = jest.spyOn(Notifications, 'requestPermissionsAsync');
  const getExpoPushTokenAsync = jest.spyOn(Notifications, 'getExpoPushTokenAsync');

  beforeEach(() => {
    jest.clearAllMocks();
    clearSecureStore();
    registerDevice.mockResolvedValue(undefined as never);
    unregisterDevice.mockResolvedValue(undefined as never);
    (nativeCapabilities as any).isExpoGo = false;
    (Device as any).isDevice = true;
    getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true } as never);
    getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' } as never);
  });

  it('registers a granted-permission device with the backend', async () => {
    await registerPushDevice();

    expect(registerDevice).toHaveBeenCalledWith('ExponentPushToken[abc]', expect.any(String));
  });

  it('requests permission when not yet decided, and proceeds if granted', async () => {
    getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true } as never);
    requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);

    await registerPushDevice();

    expect(requestPermissionsAsync).toHaveBeenCalled();
    expect(registerDevice).toHaveBeenCalled();
  });

  it('never calls the backend when permission is denied, and never throws', async () => {
    getPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as never);

    await expect(registerPushDevice()).resolves.toBeUndefined();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('skips entirely in Expo Go (remote push unsupported since SDK 53)', async () => {
    (nativeCapabilities as any).isExpoGo = true;

    await registerPushDevice();

    expect(getPermissionsAsync).not.toHaveBeenCalled();
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('skips on a simulator/emulator (no physical device)', async () => {
    (Device as any).isDevice = false;

    await registerPushDevice();

    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('does not re-register when the token has not changed since last time', async () => {
    await registerPushDevice();
    registerDevice.mockClear();

    await registerPushDevice();

    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('re-registers when the token DID change', async () => {
    await registerPushDevice();
    registerDevice.mockClear();
    getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[new]' } as never);

    await registerPushDevice();

    expect(registerDevice).toHaveBeenCalledWith('ExponentPushToken[new]', expect.any(String));
  });

  it('never throws when the backend call fails (network/server error)', async () => {
    registerDevice.mockRejectedValue(new Error('network down'));

    await expect(registerPushDevice()).resolves.toBeUndefined();
  });

  it('never throws when token retrieval itself fails', async () => {
    getExpoPushTokenAsync.mockRejectedValue(new Error('no EAS project'));

    await expect(registerPushDevice()).resolves.toBeUndefined();
    expect(registerDevice).not.toHaveBeenCalled();
  });
});

describe('unregisterPushDevice', () => {
  const registerDevice = jest.spyOn(pushApi, 'registerDevice');
  const unregisterDevice = jest.spyOn(pushApi, 'unregisterDevice');
  const getPermissionsAsync = jest.spyOn(Notifications, 'getPermissionsAsync');
  const getExpoPushTokenAsync = jest.spyOn(Notifications, 'getExpoPushTokenAsync');

  beforeEach(() => {
    jest.clearAllMocks();
    clearSecureStore();
    registerDevice.mockResolvedValue(undefined as never);
    unregisterDevice.mockResolvedValue(undefined as never);
    (nativeCapabilities as any).isExpoGo = false;
    (Device as any).isDevice = true;
    getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true } as never);
    getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' } as never);
  });

  it('is a no-op when no device was ever registered', async () => {
    await expect(unregisterPushDevice()).resolves.toBeUndefined();
    expect(unregisterDevice).not.toHaveBeenCalled();
  });

  it('unregisters the previously-stored token and clears it locally', async () => {
    await registerPushDevice(); // stores the token
    await unregisterPushDevice();

    expect(unregisterDevice).toHaveBeenCalledWith('ExponentPushToken[abc]');

    // A subsequent register call should treat this as a fresh token again.
    registerDevice.mockClear();
    await registerPushDevice();
    expect(registerDevice).toHaveBeenCalled();
  });

  it('never throws when the backend call fails', async () => {
    await registerPushDevice();
    unregisterDevice.mockRejectedValue(new Error('network down'));

    await expect(unregisterPushDevice()).resolves.toBeUndefined();
  });
});
