import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '@/components/BottomTabBar';
import { useTheme } from '@/theme/theme-provider';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color as string} />;
  };
}

/**
 * The five primary destinations. Bookings, leads, messages, notifications and
 * every other workspace screen are stack routes pushed above the tabs (see
 * ../_layout.tsx), reached from Home, the header and the Profile hub.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="services" options={{ title: 'Service', tabBarIcon: tabIcon('briefcase', 'briefcase-outline') }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: tabIcon('wallet', 'wallet-outline') }} />
      <Tabs.Screen name="availability" options={{ title: 'Availability', tabBarIcon: tabIcon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
