/* Native modules that have no JS implementation under Jest. Tests that need
 * specific behaviour override these with jest.mock in the test file. */

// expo-secure-store: an in-memory keystore.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
  };
});

jest.mock('react-native-webrtc', () => ({
  mediaDevices: { getUserMedia: jest.fn() },
  MediaStream: jest.fn(),
  RTCPeerConnection: jest.fn(),
  RTCView: () => null,
}));

jest.mock('react-native-incall-manager', () => ({
  __esModule: true,
  default: { start: jest.fn(), stop: jest.fn(), setForceSpeakerphoneOn: jest.fn() },
}));

jest.mock('react-native-cashfree-pg-sdk', () => ({
  CFPaymentGatewayService: { setCallback: jest.fn(), removeCallback: jest.fn(), doWebPayment: jest.fn() },
}));

jest.mock('socket.io-client', () => ({ io: jest.fn(() => ({ on: jest.fn(), emit: jest.fn(), connect: jest.fn(), disconnect: jest.fn(), connected: false })) }));
