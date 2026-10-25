import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/api/endpoints';
import { Button, InfoBanner, Screen, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { validateEmail } from '@/lib/validation';
import { BrandHeader } from '@/components/BrandHeader';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const e = validateEmail(email);
    setError(e);
    if (e) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setFormError(extractErrorMessage(err, "We couldn't send the reset email. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="mb-6 mt-2">
        <BrandHeader />
      </View>
      <Text className="text-[28px] font-bold leading-9 tracking-tight text-text-heading" accessibilityRole="header">
        Reset your password
      </Text>
      <Text className="mb-6 mt-1 text-base text-text-body">
        Enter your account email and we&apos;ll send you a link to choose a new password.
      </Text>
      {sent ? (
        <>
          <InfoBanner
            tone="success"
            icon="mail"
            title="Check your inbox"
            message="If an account exists for that email, a reset link is on its way. Open it on this phone to set a new password, then sign in."
          />
          <View className="mt-6">
            <Button title="Back to sign in" onPress={() => router.replace('/login')} />
          </View>
        </>
      ) : (
        <>
          {formError ? (
            <View className="mb-4">
              <InfoBanner tone="danger" message={formError} icon="alert-circle" />
            </View>
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <Button title="Send reset link" onPress={submit} loading={submitting} />
        </>
      )}
    </Screen>
  );
}
