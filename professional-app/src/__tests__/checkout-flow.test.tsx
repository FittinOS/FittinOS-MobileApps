/**
 * Full Cashfree checkout state machine — covers every outcome a real build
 * can reach (the Expo Go / "no native module" guard itself is covered
 * separately in expo-go.test.tsx). Native modules are mocked as *available*
 * here so start() runs past the capability check and exercises the real
 * state transitions: order creation, the SDK callbacks, server-side verify
 * (including auto-retry and timeout), and re-entrancy.
 */
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import { paymentsApi } from '@/api/endpoints';
import type { PaymentOrderResponse } from '@/api/types';
import { useCashfreeCheckout } from '@/features/payments/useCashfreeCheckout';

// Makes paymentsCapability() report the native module as present, as a real
// FittinOS Pro build would — this file is testing that path, not Expo Go's
// (see expo-go.test.tsx for the module-missing guard itself). Mutating the
// real NativeModules export, rather than jest.mock('react-native', ...),
// avoids breaking jest-expo's own component mocking machinery.
(NativeModules as Record<string, unknown>).CashfreePgApi = {};

jest.mock('@/api/endpoints', () => ({
  paymentsApi: { verify: jest.fn() },
}));

const baseOrder: PaymentOrderResponse = {
  paymentOrderId: 'po_1',
  transactionId: 'txn_1',
  amount: 1000,
  currency: 'INR',
  paymentSessionId: 'session_1',
  purpose: 'COIN_PACKAGE',
  cashfreeEnvironment: 'SANDBOX',
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The callback object the hook most recently handed to the SDK. */
function latestCallback() {
  const calls = (CFPaymentGatewayService.setCallback as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as { onVerify: () => void; onError: (e: unknown) => void };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCashfreeCheckout — order creation', () => {
  it('fails cleanly when the backend refuses to create an order — no SDK call made', async () => {
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockRejectedValue(new Error('Insufficient something'));

    await act(async () => {
      await result.current.start(createOrder);
    });

    expect(result.current.state).toBe('FAILED');
    expect(result.current.hasOrder).toBe(false);
    expect(CFPaymentGatewayService.doWebPayment).not.toHaveBeenCalled();
  });

  it('refuses to open checkout when the order environment does not match the app, but still tracks the real order', async () => {
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue({ ...baseOrder, cashfreeEnvironment: 'DISABLED' });

    await act(async () => {
      await result.current.start(createOrder);
    });

    expect(result.current.state).toBe('FAILED');
    // A real order WAS created server-side — "Check payment status" must stay available for it.
    expect(result.current.hasOrder).toBe(true);
    expect(CFPaymentGatewayService.doWebPayment).not.toHaveBeenCalled();
  });
});

describe('useCashfreeCheckout — SDK callbacks', () => {
  it('treats a user-cancelled checkout as CANCELLED, not FAILED', async () => {
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue(baseOrder);

    await act(async () => {
      await result.current.start(createOrder);
    });
    expect(result.current.state).toBe('PAYMENT_IN_PROGRESS');

    await act(async () => {
      latestCallback().onError({ getCode: () => 'USER_CANCELLED', getMessage: () => 'User cancelled' });
    });

    expect(result.current.state).toBe('CANCELLED');
  });

  it('treats a genuine SDK error as FAILED, with the order still trackable', async () => {
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue(baseOrder);

    await act(async () => {
      await result.current.start(createOrder);
    });

    await act(async () => {
      latestCallback().onError({ getCode: () => '500', getMessage: () => 'Gateway error' });
    });

    expect(result.current.state).toBe('FAILED');
    expect(result.current.error).toBe('Gateway error');
    expect(result.current.hasOrder).toBe(true);
  });
});

describe('useCashfreeCheckout — server-side verification (the SDK is never trusted alone)', () => {
  it('shows SUCCESS only after the backend confirms it, and invalidates cached data', async () => {
    (paymentsApi.verify as jest.Mock).mockResolvedValue({ status: 'CAPTURED' });
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue(baseOrder);

    await act(async () => {
      await result.current.start(createOrder);
    });
    await act(async () => {
      latestCallback().onVerify();
    });

    await waitFor(() => expect(result.current.state).toBe('SUCCESS'));
    expect(paymentsApi.verify).toHaveBeenCalledWith('txn_1');
    expect(result.current.verified).toEqual({ status: 'CAPTURED' });
  });

  it('auto-retries a still-pending verification and then succeeds', async () => {
    jest.useFakeTimers();
    (paymentsApi.verify as jest.Mock)
      .mockRejectedValueOnce({ response: { data: { message: 'Payment has not been completed yet.' } } })
      .mockResolvedValueOnce({ status: 'CAPTURED' });
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue(baseOrder);

    await act(async () => {
      await result.current.start(createOrder);
    });
    await act(async () => {
      latestCallback().onVerify();
    });
    expect(result.current.autoRetryCount).toBe(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(4_000);
    });

    expect(result.current.state).toBe('SUCCESS');
    expect(paymentsApi.verify).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('gives up after the retry budget and shows PENDING, not a false failure', async () => {
    jest.useFakeTimers();
    (paymentsApi.verify as jest.Mock).mockRejectedValue({ response: { data: { message: 'Payment has not been completed yet.' } } });
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue(baseOrder);

    await act(async () => {
      await result.current.start(createOrder);
    });
    await act(async () => {
      latestCallback().onVerify();
    });

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(4_000);
      });
    }

    expect(result.current.state).toBe('PENDING');
    expect(result.current.hasOrder).toBe(true);
    jest.useRealTimers();
  });

  it('treats a hard verify error as FAILED, not PENDING', async () => {
    (paymentsApi.verify as jest.Mock).mockRejectedValue({ response: { data: { message: 'Signature mismatch.' } } });
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue(baseOrder);

    await act(async () => {
      await result.current.start(createOrder);
    });
    await act(async () => {
      latestCallback().onVerify();
    });

    await waitFor(() => expect(result.current.state).toBe('FAILED'));
    expect(result.current.error).toBe('Signature mismatch.');
  });

  it('treats a verify that never responds (network loss) as a surfaced failure, never a silent success', async () => {
    jest.useFakeTimers();
    (paymentsApi.verify as jest.Mock).mockImplementation(() => new Promise(() => {})); // never resolves
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue(baseOrder);

    await act(async () => {
      await result.current.start(createOrder);
    });
    await act(async () => {
      latestCallback().onVerify();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(25_000);
    });

    expect(result.current.state).toBe('FAILED');
    expect(result.current.state).not.toBe('SUCCESS');
    jest.useRealTimers();
  });
});

describe('useCashfreeCheckout — duplicate taps and reset', () => {
  it('never opens a second order while one is already opening, in flight, or verifying', async () => {
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    let resolveOrder: (v: PaymentOrderResponse) => void = () => {};
    const createOrder = jest.fn().mockReturnValue(new Promise<PaymentOrderResponse>((res) => (resolveOrder = res)));

    // Fire twice before the first order resolves — simulates a double-tap or a UI race.
    await act(async () => {
      void result.current.start(createOrder);
      void result.current.start(createOrder);
    });

    await act(async () => {
      resolveOrder(baseOrder);
    });

    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it('reset() returns to IDLE and clears the order, error and verified result', async () => {
    const { result } = await renderHook(() => useCashfreeCheckout(), { wrapper });
    const createOrder = jest.fn().mockResolvedValue({ ...baseOrder, cashfreeEnvironment: 'DISABLED' });

    await act(async () => {
      await result.current.start(createOrder);
    });
    expect(result.current.hasOrder).toBe(true);

    await act(async () => result.current.reset());

    expect(result.current.state).toBe('IDLE');
    expect(result.current.hasOrder).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.verified).toBeNull();
  });
});
