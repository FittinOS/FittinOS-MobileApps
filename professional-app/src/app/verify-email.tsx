import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, InfoBanner, OtpInput, Screen } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { validateVerificationCode } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { BrandHeader } from '@/components/BrandHeader';

const RESEND_COOLDOWN_S = 30;

/** Signed in but email unverified: the backend requires a verified email before professional work. */
export default function VerifyEmailScreen() {
  const { user, verifyEmail, resendVerificationCode, logout } = useAuth();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit() {
    const e = validateVerificationCode(code);
    setError(e);
    if (e) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await verifyEmail(code);
      toast.show('Email verified. Welcome to FittinOS!');
    } catch (err) {
      setFormError(extractErrorMessage(err, "We couldn't verify that code. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setResending(true);
    setFormError(null);
    try {
      await resendVerificationCode();
      setCooldown(RESEND_COOLDOWN_S);
      toast.show('A new code is on its way.', 'info');
    } catch (err) {
      setFormError(extractErrorMessage(err, "We couldn't send a new code. Please try again shortly."));
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mb-6 mt-2">
        <BrandHeader />
      </View>
      <Text className="text-[28px] font-bold leading-9 tracking-tight text-text-heading" accessibilityRole="header">
        Verify your email
      </Text>
      <Text className="mb-6 mt-1 text-base text-text-body">
        We sent a 6-digit code to <Text className="font-semibold text-text-heading">{user?.email}</Text>.
      </Text>
      {formError ? (
        <View className="mb-4">
          <InfoBanner tone="danger" message={formError} icon="alert-circle" />
        </View>
      ) : null}
      <OtpInput value={code} onChange={setCode} error={error} onSubmit={submit} />
      <Button title="Verify email" onPress={submit} loading={submitting} />
      <View className="mt-4">
        <Button
          title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          variant="ghost"
          onPress={resend}
          loading={resending}
          disabled={cooldown > 0}
        />
      </View>
      <View className="mt-8">
        <Button title="Use a different account" variant="outline" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}
