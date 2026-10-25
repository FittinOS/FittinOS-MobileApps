import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandHeader } from '@/components/BrandHeader';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/theme/theme-provider';

/** Shown when a stored session exists but the backend was unreachable at launch. */
export default function OfflineScreen() {
  const { colors } = useTheme();
  const { retryRestore, logout } = useAuth();
  return (
    <SafeAreaView className="flex-1 bg-background px-4">
      <View className="pt-3">
        <BrandHeader />
      </View>
      <View className="flex-1 justify-center">
        <Card className="items-center px-6 py-8">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-warning-soft">
            <Ionicons name="cloud-offline-outline" size={36} color={colors.warning} />
          </View>
          <Text className="text-center text-xl font-bold tracking-tight text-text-heading" accessibilityRole="header">
            Can&apos;t reach FittinOS
          </Text>
          <Text className="mt-2 text-center text-sm leading-5 text-text-body">
            Check your internet connection. You&apos;re still signed in — we&apos;ll pick up where you left off.
          </Text>
          <View className="mt-6 w-full gap-3">
            <Button title="Try again" icon="refresh" onPress={retryRestore} />
            <Button title="Sign out" variant="ghost" onPress={() => void logout()} />
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}
