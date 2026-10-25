import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ErrorState, Header, InfoBanner, ProgressBar, Screen, Spinner } from '@/components/ui';
import { useProfileSetup } from '@/features/profile/setup-steps';
import { useTheme } from '@/theme/theme-provider';

/**
 * Profile setup: one place that shows what is left before the professional
 * can be booked, and opens the existing screen for each step. Progress comes
 * from backend facts only (see useProfileSetup).
 */
export default function ProfileSetupScreen() {
  const setup = useProfileSetup();
  const { colors } = useTheme();

  if (setup.isPending) {
    return (
      <>
        <Header title="Profile setup" />
        <Spinner label="Checking your profile" />
      </>
    );
  }
  if (setup.isError) {
    return (
      <>
        <Header title="Profile setup" />
        <ErrorState error={setup.error} onRetry={setup.refetch} />
      </>
    );
  }

  const complete = setup.done === setup.total;
  return (
    <>
      <Header title="Profile setup" />
      <Screen
        footer={
          setup.next ? (
            <Button title={`Next: ${setup.next.label}`} icon="arrow-forward" onPress={() => setup.next && router.push(setup.next.href)} />
          ) : (
            <Button title="Back to dashboard" variant="outline" onPress={() => router.navigate('/')} />
          )
        }
      >
        <Card>
          <Text className="text-xl font-bold tracking-tight text-text-heading" accessibilityRole="header">
            {complete ? 'Your profile is complete' : 'Complete your profile'}
          </Text>
          <Text className="mt-1 text-sm text-text-body">
            {complete ? 'Clients can find and book you.' : 'Finish these steps so clients can find and book you.'}
          </Text>
          <View className="mt-4 flex-row items-center">
            <View className="flex-1">
              <ProgressBar value={setup.done / setup.total} tone={complete ? 'success' : 'primary'} label="Profile setup progress" />
            </View>
            <Text className="ml-3 text-sm font-bold text-text-heading">
              {setup.done}/{setup.total}
            </Text>
          </View>
        </Card>

        {!setup.ready ? (
          <View className="mt-3">
            <InfoBanner message="Still checking your services and availability — some steps may update in a moment." />
          </View>
        ) : null}

        <Card className="mt-3 p-0">
          {setup.steps.map((step, i) => (
            <Pressable
              key={step.key}
              onPress={() => router.push(step.href)}
              className={`min-h-[68px] flex-row items-center px-4 py-3 active:bg-muted ${i > 0 ? 'border-t border-border' : ''}`}
              accessibilityRole="button"
              accessibilityLabel={`${step.label}, ${step.done ? 'done' : 'to do'}. ${step.description}`}
            >
              <View
                className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${step.done ? 'bg-success-soft' : 'bg-primary-soft'}`}
              >
                <Ionicons name={step.done ? 'checkmark' : step.icon} size={20} color={step.done ? colors.success : colors.primary} />
              </View>
              <View className="flex-1">
                <Text className={`text-[15px] font-semibold ${step.done ? 'text-text-body' : 'text-text-heading'}`}>{step.label}</Text>
                <Text className="text-xs text-text-body">{step.done ? 'Done' : step.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>
      </Screen>
    </>
  );
}
