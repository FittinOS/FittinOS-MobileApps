import { useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandHeader } from '@/components/BrandHeader';
import { Button, InfoBanner } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/theme/theme-provider';

const SLIDES: Array<{ key: string; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = [
  {
    key: 'discover',
    icon: 'search',
    title: 'Find trusted professionals near you',
    body: 'Browse verified fitness and wellness professionals, compare services and prices, and pick the right one.',
  },
  {
    key: 'book',
    icon: 'calendar',
    title: 'Book a slot in seconds',
    body: 'See real availability, pick a time that works, and confirm — no back-and-forth messages needed.',
  },
  {
    key: 'wallet',
    icon: 'wallet',
    title: 'Pay securely with FittinOS Coins',
    body: 'Top up your wallet and pay for bookings and unlocks — all through a secure, verified checkout.',
  },
  {
    key: 'track',
    icon: 'checkmark-circle',
    title: 'Track every booking',
    body: 'See your upcoming and past sessions, reschedule or cancel when the policy allows, and rate your experience.',
  },
];

const FEATURES: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { icon: 'search-outline', label: 'Discover professionals by category and location' },
  { icon: 'calendar-outline', label: 'Book, reschedule and track sessions' },
  { icon: 'wallet-outline', label: 'Manage your FittinOS Coins wallet' },
];

/** Welcome + onboarding: what the app does, then sign in or create an account. */
export default function WelcomeScreen() {
  const { colors } = useTheme();
  const { signOutReason } = useAuth();
  const { width } = useWindowDimensions();
  const slideWidth = width - 32;
  const [index, setIndex] = useState(0);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-4 pb-6 pt-3" bounces={false}>
        <BrandHeader />

        {signOutReason ? (
          <View className="mt-4">
            <InfoBanner
              tone={/expired|revoked|again/i.test(signOutReason) ? 'warning' : 'success'}
              icon={/expired|revoked|again/i.test(signOutReason) ? 'time-outline' : 'checkmark-circle'}
              title="Signed out"
              message={signOutReason}
            />
          </View>
        ) : null}

        <View className="mt-4 overflow-hidden rounded-[28px] bg-secondary py-7">
          <FlatList
            data={SLIDES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(s) => s.key}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            renderItem={({ item }) => (
              <View style={{ width: slideWidth }} className="items-center px-7">
                <View className="mb-5 h-20 w-20 items-center justify-center rounded-3xl bg-primary">
                  <Ionicons name={item.icon} size={38} color={colors.onPrimary} />
                </View>
                <Text className="text-center text-2xl font-bold tracking-tight text-white" accessibilityRole="header">
                  {item.title}
                </Text>
                <Text className="mt-2 text-center text-[15px] leading-6 text-white/80">{item.body}</Text>
              </View>
            )}
          />
          <View className="mt-5 flex-row justify-center" accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}>
            {SLIDES.map((s, i) => (
              <View key={s.key} className={`mx-1 h-2 rounded-full ${i === index ? 'w-6 bg-primary' : 'w-2 bg-white/30'}`} />
            ))}
          </View>
        </View>

        <View className="mt-5 gap-3">
          {FEATURES.map((f) => (
            <View key={f.label} className="flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                <Ionicons name={f.icon} size={19} color={colors.primary} />
              </View>
              <Text className="flex-1 text-[15px] font-medium text-text-heading">{f.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="gap-3 px-4 pb-4 pt-2">
        <Button title="Create an account" onPress={() => router.push('/signup')} />
        <View className="flex-row items-center justify-center">
          <Text className="text-sm text-text-body">Already have an account? </Text>
          <Pressable
            onPress={() => router.push('/login')}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="I already have an account"
            className="min-h-[40px] justify-center"
          >
            <Text className="text-sm font-bold text-primary-ink">Sign in</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
