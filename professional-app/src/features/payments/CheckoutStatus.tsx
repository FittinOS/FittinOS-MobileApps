import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Sheet, Spinner } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import type { useCashfreeCheckout } from './useCashfreeCheckout';
import { useTheme } from '@/theme/theme-provider';

/** Shared result sheet for every Cashfree purchase (coins, plans). */
export function CheckoutStatus({
  checkout,
  successTitle,
  successMessage,
  onDone,
}: {
  checkout: ReturnType<typeof useCashfreeCheckout>;
  successTitle: string;
  successMessage: string;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const { state } = checkout;
  const visible = state !== 'IDLE' && state !== 'PAYMENT_IN_PROGRESS';
  const close = () => {
    checkout.reset();
    onDone();
  };
  return (
    <Sheet visible={visible} title="Payment" onClose={state === 'OPENING' || state === 'VERIFYING' ? () => undefined : close}>
      {state === 'OPENING' ? (
        <Spinner label="Opening secure checkout…" />
      ) : state === 'VERIFYING' ? (
        <Spinner
          label={
            checkout.autoRetryCount > 0
              ? `Waiting for the bank to confirm… (${checkout.autoRetryCount}/${checkout.maxAutoRetries})`
              : 'Confirming your payment with Cashfree…'
          }
        />
      ) : state === 'SUCCESS' ? (
        <Result icon="checkmark-circle" color={colors.success} title={successTitle} message={successMessage}>
          {checkout.order ? <Text className="mt-1 text-sm text-text-body">Amount paid: {formatMoney(checkout.order.amount)}</Text> : null}
          <View className="mt-5 w-full">
            <Button title="Done" onPress={close} />
          </View>
        </Result>
      ) : state === 'CANCELLED' ? (
        <Result icon="close-circle" color={colors.body} title="Payment cancelled" message="No money was taken. If you completed the payment anyway, check its status.">
          <View className="mt-5 w-full gap-3">
            <Button title="Check payment status" variant="outline" onPress={checkout.checkStatus} />
            <Button title="Close" variant="ghost" onPress={close} />
          </View>
        </Result>
      ) : state === 'PENDING' ? (
        <Result icon="time" color={colors.warning} title="Payment still processing" message={checkout.error ?? 'Your bank has not confirmed this payment yet.'}>
          <View className="mt-5 w-full gap-3">
            <Button title="Check again" onPress={checkout.checkStatus} />
            <Button title="Close" variant="ghost" onPress={close} />
          </View>
        </Result>
      ) : state === 'UNAVAILABLE' ? (
        <Result icon="information-circle" color={colors.body} title="Payments aren't available here" message={checkout.error ?? 'This build cannot open checkout.'}>
          <View className="mt-5 w-full">
            <Button title="Close" variant="ghost" onPress={close} />
          </View>
        </Result>
      ) : (
        <Result icon="alert-circle" color={colors.danger} title="Payment not completed" message={checkout.error ?? 'Something went wrong with this payment.'}>
          <View className="mt-5 w-full gap-3">
            {checkout.hasOrder ? <Button title="Check payment status" variant="outline" onPress={checkout.checkStatus} /> : null}
            <Button title="Close" variant="ghost" onPress={close} />
          </View>
        </Result>
      )}
      <View className="h-4" />
    </Sheet>
  );
}

function Result({
  icon,
  color,
  title,
  message,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <View className="items-center py-4" accessibilityLiveRegion="polite">
      <View className="h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: `${color}22` }}>
        <Ionicons name={icon} size={46} color={color} />
      </View>
      <Text className="mt-4 text-center text-xl font-bold tracking-tight text-text-heading" accessibilityRole="header">
        {title}
      </Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-text-body">{message}</Text>
      {children}
    </View>
  );
}
