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
 * The five primary destinations. Professional detail, booking, payment and
 * every other secondary screen are stack routes pushed above the tabs (see
 * ../_layout.tsx), reached from Home, Discover and the Profile hub.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: tabIcon('search', 'search-outline') }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarIcon: tabIcon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarIcon: tabIcon('wallet', 'wallet-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }} />
      {/*
        Requirements is no longer a visible tab, but its route must stay registered and
        navigable (Home's "Post a requirement" quick action still pushes straight to it).
        Expo Router adds every file under this layout as a tab by default; simply omitting
        a <Tabs.Screen> declaration does NOT remove it — it would still appear, just with
        an unstyled default icon/label. `href: null` is the documented way to keep a route
        registered while hiding its tab-bar button.
      */}
      <Tabs.Screen name="requirements" options={{ href: null }} />
    </Tabs>
  );
}
