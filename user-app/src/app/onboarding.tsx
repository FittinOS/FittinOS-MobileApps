import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/theme/theme-provider';

const STEPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'search-outline', text: 'Discover verified professionals by category, location or search' },
  { icon: 'calendar-outline', text: 'Pick a real available slot and book instantly' },
  { icon: 'wallet-outline', text: 'Top up FittinOS Coins and pay securely for bookings' },
  { icon: 'star-outline', text: 'Rate your session afterwards to help other clients choose' },
];

/**
 * Shown once, right after a brand-new signup verifies its email — before the
 * dashboard. Mirrors the web app's /user-onboarding redirect target.
 * Dismissing never blocks anything; it's purely informational.
 */
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { dismissOnboarding } = useAuth();

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="items-center">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft">
          <Ionicons name="sparkles-outline" size={30} color={colors.primary} />
        </View>
      </View>
      <Text className="text-center text-xl font-bold leading-7 text-text-heading" accessibilityRole="header">
        You&apos;re all set
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-text-body">
        Here&apos;s what you can do on FittinOS.
      </Text>

      <Card className="mt-6">
        {STEPS.map((step) => (
          <View key={step.text} className="mb-2 flex-row items-start">
            <Ionicons name={step.icon} size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text className="ml-3 flex-1 text-sm text-text-heading">{step.text}</Text>
          </View>
        ))}
      </Card>

      <View className="mt-6">
        <Button title="Get started" icon="arrow-forward" onPress={dismissOnboarding} />
      </View>
    </Screen>
  );
}
