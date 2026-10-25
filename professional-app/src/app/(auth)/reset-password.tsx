import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { authApi } from '@/api/endpoints';
import { Button, InfoBanner, Screen, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { validatePassword } from '@/lib/validation';
import { BrandHeader } from '@/components/BrandHeader';

/**
 * Reached via the deep link fittinospro://reset-password?token=… . The
 * backend's reset email currently links to the web page, which works too —
 * this screen exists so a future app link can land here directly.
 */
export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const next = {
      password: validatePassword(password, 'New password'),
      confirm: confirm !== password ? 'Passwords do not match.' : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm || !token) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setFormError(extractErrorMessage(err, "We couldn't reset your password. The link may have expired."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="mb-6 mt-2">
        <BrandHeader />
      </View>
      <Text className="mb-6 text-[28px] font-bold leading-9 tracking-tight text-text-heading" accessibilityRole="header">
        Choose a new password
      </Text>
      {!token ? (
        <InfoBanner tone="warning" message="This reset link is incomplete. Request a new one from the sign-in screen." />
      ) : done ? (
        <>
          <InfoBanner tone="success" message="Your password was changed. Sign in with your new password." />
          <View className="mt-6">
            <Button title="Sign in" onPress={() => router.replace('/login')} />
          </View>
        </>
      ) : (
        <>
          {formError ? (
            <View className="mb-4">
              <InfoBanner tone="danger" message={formError} icon="alert-circle" />
            </View>
          ) : null}
          <TextField label="New password" value={password} onChangeText={setPassword} error={errors.password} password autoComplete="new-password" />
          <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} error={errors.confirm} password autoComplete="new-password" />
          <Button title="Update password" onPress={submit} loading={submitting} />
        </>
      )}
    </Screen>
  );
}
