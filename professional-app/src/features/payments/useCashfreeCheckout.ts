import { useCallback, useEffect, useRef, useState } from 'react';
import type { CFErrorResponse } from 'react-native-cashfree-pg-sdk';
import { paymentsApi } from '@/api/endpoints';
import type { PaymentOrderResponse } from '@/api/types';
import { qk, useInvalidate } from '@/api/queries';
import { CASHFREE_MODE } from '@/lib/config';
import { extractErrorMessage } from '@/lib/errors';
import { paymentsCapability } from '@/lib/native-capabilities';
import {
  AUTO_RETRY_DELAY_MS,
  MAX_AUTO_RETRIES,
  VERIFY_TIMEOUT_MS,
  assertCashfreeEnvironmentMatches,
  isPendingVerification,
  isUserCancellation,
} from './checkout-logic';

type CashfreeSdk = {
  gateway: typeof import('react-native-cashfree-pg-sdk').CFPaymentGatewayService;
  CFSession: typeof import('cashfree-pg-api-contract').CFSession;
  CFEnvironment: typeof import('cashfree-pg-api-contract').CFEnvironment;
};

/** Loaded lazily: the SDK throws on import where its native module is missing (Expo Go). */
function cashfreeSdk(): CashfreeSdk | null {
  if (!paymentsCapability().available) return null;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const sdk = require('react-native-cashfree-pg-sdk') as typeof import('react-native-cashfree-pg-sdk');
  const contract = require('cashfree-pg-api-contract') as typeof import('cashfree-pg-api-contract');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { gateway: sdk.CFPaymentGatewayService, CFSession: contract.CFSession, CFEnvironment: contract.CFEnvironment };
}

export type CheckoutState =
  | 'IDLE'
  | 'OPENING'
  | 'PAYMENT_IN_PROGRESS'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'PENDING'
  | 'FAILED'
  | 'CANCELLED'
  /** The native SDK isn't available (Expo Go, or a build missing the module) — refused
   *  before any order was created. Distinct from FAILED: no payment was ever attempted. */
  | 'UNAVAILABLE';

/**
 * Native Cashfree checkout (react-native-cashfree-pg-sdk, web checkout flow
 * with the backend-issued payment session). What the SDK reports is never
 * trusted: success is shown only after POST /payments/verify, a live
 * backend → Cashfree requery — exactly the web's model. No Cashfree secret
 * exists in the app; the session id is short-lived and per-order.
 */
export function useCashfreeCheckout() {
  const invalidate = useInvalidate();
  const [state, setStateRaw] = useState<CheckoutState>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, unknown> | null>(null);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const orderRef = useRef<PaymentOrderResponse | null>(null);
  const mounted = useRef(true);
  // Mirrors `state` synchronously so start()'s re-entrancy guard (below) reads
  // the current value immediately, rather than a stale one from its own closure.
  const stateRef = useRef<CheckoutState>('IDLE');
  const setState = useCallback((next: CheckoutState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cashfreeSdk()?.gateway.removeCallback();
    };
  }, []);

  const verify = useCallback(
    async (attempt = 0) => {
      const order = orderRef.current;
      if (!order) return;
      setState('VERIFYING');
      setError(null);
      try {
        const result = await Promise.race([
          paymentsApi.verify(order.transactionId),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), VERIFY_TIMEOUT_MS)),
        ]);
        if (!mounted.current) return;
        setVerified(result);
        setState('SUCCESS');
        void invalidate(qk.wallet, ['wallet'], qk.subscription, ['plans'], ['payments'], ['featured'], qk.services);
      } catch (err) {
        if (!mounted.current) return;
        const message = err instanceof Error && err.message === 'timeout'
          ? "We couldn't confirm this payment yet. Check again in a moment."
          : extractErrorMessage(err, "We couldn't verify this payment yet. Please try again.");
        if (isPendingVerification(message) && attempt < MAX_AUTO_RETRIES) {
          setAutoRetryCount(attempt + 1);
          setTimeout(() => void verify(attempt + 1), AUTO_RETRY_DELAY_MS);
          return;
        }
        setError(message);
        setState(isPendingVerification(message) ? 'PENDING' : 'FAILED');
      }
    },
    [invalidate],
  );

  const start = useCallback(
    async (createOrder: () => Promise<PaymentOrderResponse>) => {
      // Re-entrancy guard: belt-and-suspenders alongside the UI disabling its
      // buy button while busy — a second tap (or a race) must never open a
      // second order while one is already opening, in flight, or verifying.
      if (stateRef.current === 'OPENING' || stateRef.current === 'PAYMENT_IN_PROGRESS' || stateRef.current === 'VERIFYING') {
        return;
      }
      setError(null);
      setVerified(null);
      setAutoRetryCount(0);
      // Checked BEFORE asking the backend for an order, so Expo Go never creates one.
      // A dedicated state, not FAILED: no payment was ever attempted here.
      const sdk = cashfreeSdk();
      if (!sdk) {
        setError(paymentsCapability().reason);
        setState('UNAVAILABLE');
        return;
      }
      setState('OPENING');
      let order: PaymentOrderResponse;
      try {
        order = await createOrder();
        // Tracked as soon as the backend confirms it, even if the environment
        // check just below rejects opening checkout — a real order exists by
        // then, so "Check payment status" must still be offered for it.
        orderRef.current = order;
        assertCashfreeEnvironmentMatches(order.cashfreeEnvironment, CASHFREE_MODE);
      } catch (err) {
        setError(extractErrorMessage(err, 'Could not start the payment. Please try again.'));
        setState('FAILED');
        return;
      }
      sdk.gateway.setCallback({
        onVerify: () => void verify(0),
        onError: (cfError: CFErrorResponse) => {
          if (!mounted.current) return;
          if (isUserCancellation(cfError?.getCode?.(), cfError?.getMessage?.())) {
            setState('CANCELLED');
          } else {
            setError(cfError?.getMessage?.() || 'The payment did not go through.');
            // The SDK's word is not final either way — let the user ask the backend.
            setState('FAILED');
          }
        },
      });
      try {
        setState('PAYMENT_IN_PROGRESS');
        const env = order.cashfreeEnvironment === 'PRODUCTION' ? sdk.CFEnvironment.PRODUCTION : sdk.CFEnvironment.SANDBOX;
        sdk.gateway.doWebPayment(new sdk.CFSession(order.paymentSessionId, order.transactionId, env));
      } catch (err) {
        setError(extractErrorMessage(err, 'Could not open the payment window. Please try again.'));
        setState('FAILED');
      }
    },
    [verify],
  );

  /** Ask the backend what really happened (also usable after a cancel or SDK error). */
  const checkStatus = useCallback(() => void verify(0), [verify]);

  const reset = useCallback(() => {
    orderRef.current = null;
    setState('IDLE');
    setError(null);
    setVerified(null);
    setAutoRetryCount(0);
  }, []);

  return {
    state,
    error,
    order: orderRef.current,
    verified,
    autoRetryCount,
    maxAutoRetries: MAX_AUTO_RETRIES,
    hasOrder: !!orderRef.current,
    start,
    checkStatus,
    reset,
  };
}
