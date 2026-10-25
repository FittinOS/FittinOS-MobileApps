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

jest.mock('react-native-cashfree-pg-sdk', () => ({
  CFPaymentGatewayService: { setCallback: jest.fn(), removeCallback: jest.fn(), doWebPayment: jest.fn() },
}));

// react-native-maps: see __mocks__/react-native-maps.js (a manual mock, not
// an inline jest.mock() factory here — nativewind's babel transform injects
// a helper reference when `react-native` is required inside this file,
// which trips babel-plugin-jest-hoist's "no out-of-scope variables in a
// jest.mock() factory" check; a separate file isn't subject to that check).
