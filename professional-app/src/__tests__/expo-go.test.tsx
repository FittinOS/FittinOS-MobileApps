/**
 * Expo Go safety: where the native modules for calls/payments are missing,
 * nothing may import them and no payment order may be created.
 */
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { callsCapability, hasNativeModule, paymentsCapability } from '@/lib/native-capabilities';
import { useCashfreeCheckout } from '@/features/payments/useCashfreeCheckout';

describe('native capabilities without the native modules (Expo Go / Jest)', () => {
  it('reports calls and payments as unavailable with a reason', () => {
    expect(hasNativeModule('WebRTCModule')).toBe(false);
    expect(callsCapability()).toEqual({ available: false, reason: expect.stringMatching(/calls need the FittinOS Pro app build/i) });
    expect(paymentsCapability()).toEqual({ available: false, reason: expect.stringMatching(/No order was created/) });
  });

  it('checkout refuses BEFORE asking the backend for an order', async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn();
    await act(async () => {
      await result.current.start(createOrder);
    });
    expect(createOrder).not.toHaveBeenCalled();
    // Distinct from FAILED: nothing was ever attempted, so it must not read as a failed payment.
    expect(result.current.state).toBe('UNAVAILABLE');
    expect(result.current.error).toMatch(/Online payments need the FittinOS Pro app build/);
  });
});
