import { isMapsConfigured } from '../maps-config';

// expo-constants' real `expoConfig` export is a non-configurable property
// (jest.spyOn can't redefine it in this SDK version), so the module is
// mocked wholesale here instead — `__mockExpoConfig` is a plain, mutable
// property on the mock we control per test.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));

import Constants from 'expo-constants';

describe('isMapsConfigured', () => {
  afterEach(() => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = null;
  });

  it('is false when no Google Maps Android key was baked into this build', () => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = { android: { config: { googleMaps: { apiKey: undefined } } } };
    expect(isMapsConfigured()).toBe(false);
  });

  it('is false when expoConfig itself is unavailable', () => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = null;
    expect(isMapsConfigured()).toBe(false);
  });

  it('is true once a key is actually present in the resolved config', () => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = { android: { config: { googleMaps: { apiKey: 'AIza-example' } } } };
    expect(isMapsConfigured()).toBe(true);
  });
});
