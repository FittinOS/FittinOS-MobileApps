import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/theme-provider';
import { Button, InfoBanner, Screen, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { validateEmail } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';
import { BrandHeader } from '@/components/BrandHeader';

export default function LoginScreen() {
  const { login, signOutReason, clearSignOutReason } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    const next = { email: validateEmail(email), password: password ? undefined : 'Enter your password.' };
    setErrors(next);
    if (next.email || next.password) return;
    setFormError(null);
    clearSignOutReason();
    setSubmitting(true);
    try {
      await login(email, password);
      // Navigation follows from the auth status change (root Stack.Protected guards).
    } catch (error) {
      setFormError(extractErrorMessage(error, "We couldn't sign you in. Check your connection and try again."));
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
        Welcome back
      </Text>
      <Text className="mb-6 mt-1 text-base text-text-body">Sign in to continue to FittinOS.</Text>

      {signOutReason ? (
        <View className="mb-4">
          <InfoBanner
            tone={/expired|revoked|again/i.test(signOutReason) ? 'warning' : 'success'}
            icon={/expired|revoked|again/i.test(signOutReason) ? 'time-outline' : 'checkmark-circle'}
            message={signOutReason}
          />
        </View>
      ) : null}
      {formError ? (
        <View className="mb-4">
          <InfoBanner tone="danger" message={formError} icon="alert-circle" />
        </View>
      ) : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="you@example.com"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        password
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Link href="/forgot-password" asChild>
        <Pressable className="mb-6 self-end py-2" accessibilityRole="link">
          <Text className="text-sm font-semibold text-primary-ink">Forgot password?</Text>
        </Pressable>
      </Link>

      <Button title="Sign in" onPress={submit} loading={submitting} />

      <View className="mt-6 flex-row justify-center">
        <Text className="text-sm text-text-body">New to FittinOS? </Text>
        <Link href="/signup" replace asChild>
          <Pressable accessibilityRole="link">
            <Text className="text-sm font-semibold text-primary-ink">Create an account</Text>
          </Pressable>
        </Link>
      </View>

      <View className="my-6 flex-row items-center">
        <View className="h-px flex-1 bg-border" />
        <Text className="mx-3 text-xs text-text-body">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>
      <View className="flex-row items-center rounded-2xl border border-dashed border-border px-4 py-3">
        <Ionicons name="logo-google" size={18} color={colors.body} />
        <Text className="ml-3 flex-1 text-xs leading-[18px] text-text-body">
          Google sign-in is available on the FittinOS website only for now.
        </Text>
      </View>
    </Screen>
  );
}
