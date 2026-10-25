import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, InfoBanner, Screen, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { openWebPage } from '@/lib/links';
import { validateEmail, validateFullName, validatePassword } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/theme/theme-provider';
import { BrandHeader } from '@/components/BrandHeader';

type Field = 'fullName' | 'email' | 'phone' | 'password' | 'confirm' | 'agreed';

export default function SignupScreen() {
  const { colors } = useTheme();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  async function submit() {
    const digits = phone.replace(/\s/g, '');
    const next: Partial<Record<Field, string>> = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      // Same rule as the web signup form: an Indian mobile number, sent as +91XXXXXXXXXX.
      phone: digits && !/^[0-9]{7,15}$/.test(digits) ? 'Enter a valid phone number.' : undefined,
      password: validatePassword(password),
      confirm: confirm !== password ? 'Passwords do not match.' : undefined,
      agreed: agreed ? undefined : 'You must agree to the Terms of Service and Privacy Policy.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await register({ fullName, email, password, phone: digits ? `+91${digits}` : undefined });
      // Root guards move the user to the email-verification screen.
    } catch (error) {
      setFormError(extractErrorMessage(error, "We couldn't create your account. Please try again."));
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
        Create your account
      </Text>
      <Text className="mb-6 mt-1 text-base text-text-body">Join FittinOS to discover and book trusted professionals.</Text>

      {formError ? (
        <View className="mb-4">
          <InfoBanner tone="danger" message={formError} icon="alert-circle" />
        </View>
      ) : null}

      <TextField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        error={errors.fullName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
      />
      <TextField
        ref={phoneRef}
        label="Phone (optional)"
        prefix="+91"
        value={phone}
        onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ''))}
        error={errors.phone}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={15}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        hint="At least 10 characters, with upper and lower case letters and a number."
        password
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        password
        autoComplete="new-password"
        returnKeyType="done"
      />

      <Pressable
        onPress={() => setAgreed((a) => !a)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        className="mb-1 flex-row items-start py-2"
      >
        <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={22} color={agreed ? colors.primary : colors.body} />
        <Text className="ml-2 flex-1 text-sm text-text-heading">
          I agree to the{' '}
          <Text className="font-semibold text-primary-ink" onPress={() => void openWebPage('/terms')}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text className="font-semibold text-primary-ink" onPress={() => void openWebPage('/privacy')}>
            Privacy Policy
          </Text>
          .
        </Text>
      </Pressable>
      {errors.agreed ? <Text className="mb-3 text-xs text-danger-ink">{errors.agreed}</Text> : <View className="mb-3" />}

      <Button title="Create account" onPress={submit} loading={submitting} />

      <View className="mt-6 flex-row justify-center">
        <Text className="text-sm text-text-body">Already have an account? </Text>
        <Link href="/login" replace asChild>
          <Pressable accessibilityRole="link">
            <Text className="text-sm font-semibold text-primary-ink">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}
