import { Stack } from 'expo-router';
import { useTheme } from '@/theme/theme-provider';

export default function BookingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
