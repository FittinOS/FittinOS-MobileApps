import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/theme/theme-provider';

// Same copy as the web app's /professional/kyc-intro — only information the
// product already states elsewhere (verification.tsx's own HOW_IT_WORKS,
// and the real gates on services/availability/leads).
const HOW_IT_WORKS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'hand-left-outline', text: 'Tap "Verify KYC" below' },
  { icon: 'open-outline', text: "DigiLocker, UIDAI's official portal, opens in a secure browser" },
  { icon: 'lock-closed-outline', text: 'Enter your Aadhaar number and OTP there — FittinOS never sees either' },
  { icon: 'checkmark-circle-outline', text: 'Give consent, then come back to this app and tap "I\'ve finished"' },
  { icon: 'time-outline', text: 'Your verified submission goes to our team for a quick review' },
];

const UNLOCKS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'briefcase-outline', text: 'Create and publish services clients can book' },
  { icon: 'calendar-outline', text: 'Open availability so clients can book real time slots' },
  { icon: 'people-outline', text: 'Respond to leads and go live in client search' },
];

/**
 * Shown once, right after a brand-new signup verifies its email — before the
 * dashboard. Neither button blocks anything: "Verify KYC" goes straight into
 * the real Aadhaar flow; "Skip for now" goes straight into the dashboard —
 * the workspace itself doesn't gate on kycStatus either. Restricted actions
 * stay locked server-side regardless of which button is pressed here.
 */
export default function KycIntroScreen() {
  const { colors } = useTheme();
  const { dismissKycIntro } = useAuth();

  function skip() {
    dismissKycIntro();
  }

  function verifyNow() {
    dismissKycIntro();
    // Dismissing swaps the root Stack.Protected branch from this screen to
    // (app) on the next render; the replace has to wait for that swap to
    // land (next tick) or it targets a navigator that hasn't mounted yet.
    setTimeout(() => router.replace('/verification'), 0);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="items-center">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
          <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary} />
        </View>
      </View>
      <Text className="text-center text-xl font-bold leading-7 text-text-heading" accessibilityRole="header">
        Verify your identity to unlock full access
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-text-body">
        FittinOS verifies every professional&apos;s identity through Aadhaar via DigiLocker, UIDAI&apos;s own
        verification service, to keep clients safe and build trust in the marketplace. It only takes a minute, and
        you can explore your dashboard either way.
      </Text>

      <Card className="mt-6">
        <Text className="mb-3 text-xs font-bold uppercase tracking-wide text-text-body">How it works</Text>
        {HOW_IT_WORKS.map((step) => (
          <View key={step.text} className="mb-2 flex-row items-start">
            <Ionicons name={step.icon} size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text className="ml-3 flex-1 text-sm text-text-heading">{step.text}</Text>
          </View>
        ))}
      </Card>

      <Card className="mt-3">
        <Text className="mb-3 text-xs font-bold uppercase tracking-wide text-text-body">Verified professionals get</Text>
        {UNLOCKS.map((item) => (
          <View key={item.text} className="mb-2 flex-row items-start">
            <Ionicons name={item.icon} size={16} color={colors.success} style={{ marginTop: 2 }} />
            <Text className="ml-3 flex-1 text-sm text-text-heading">{item.text}</Text>
          </View>
        ))}
      </Card>

      <View className="mt-6 gap-3">
        <Button title="Verify KYC" icon="arrow-forward" onPress={verifyNow} />
        <Button title="Skip for now" variant="outline" onPress={skip} />
      </View>
      <Text className="mt-4 text-center text-xs text-text-body">
        You can complete verification anytime from your dashboard — nothing you explore now is lost.
      </Text>
    </Screen>
  );
}
