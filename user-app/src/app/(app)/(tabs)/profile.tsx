import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import { Avatar, Button, Card, ConfirmDialog, Divider, ListRow, Screen, SectionTitle, type IconName, type Tone } from '@/components/ui';
import { CoinIcon } from '@/features/coins/CoinIcon';
import { useAvatarUpload } from '@/features/profile/useAvatarUpload';
import { formatCoins } from '@/lib/format';
import { useAuth } from '@/providers/auth-provider';
import { useTheme } from '@/theme/theme-provider';

type MenuItem = { title: string; subtitle?: string; icon: IconName; href: Href; tone?: Tone; coin?: boolean };

/**
 * Profile hub: the user's account (photo, name) plus every secondary screen
 * — bookings/requirements/wallet shortcuts and account settings — so nothing
 * needs a sixth tab.
 */
export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const wallet = useWallet();
  const avatar = useAvatarUpload();
  const { colors } = useTheme();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const menus: Array<{ title: string; items: MenuItem[] }> = [
    {
      title: 'Your activity',
      items: [
        { title: 'Bookings', subtitle: 'Upcoming and past sessions', icon: 'calendar-outline', href: '/(app)/(tabs)/bookings', tone: 'info' },
        { title: 'Requirements', subtitle: 'Your posted requirements', icon: 'document-text-outline', href: '/(app)/(tabs)/requirements', tone: 'primary' },
        { title: 'Messages', subtitle: 'Chat with professionals', icon: 'chatbubble-ellipses-outline', href: '/(app)/messages/index', tone: 'info' },
        {
          title: 'Coin wallet',
          subtitle: wallet.data ? formatCoins(wallet.data.coinBalance) : undefined,
          icon: 'wallet-outline',
          href: '/(app)/wallet',
          tone: 'primary',
          coin: true,
        },
        { title: 'Payment history', subtitle: 'Receipts and refunds', icon: 'receipt-outline', href: '/(app)/payments' },
        { title: 'Offers & coupons', subtitle: 'See what you can save', icon: 'gift-outline', href: '/(app)/offers', tone: 'primary' },
      ],
    },
    {
      title: 'Account',
      items: [
        { title: 'Notifications', icon: 'notifications-outline', href: '/notifications', tone: 'info' },
        { title: 'Settings', subtitle: 'Account, password, privacy', icon: 'settings-outline', href: '/settings' },
        { title: 'Help & support', icon: 'help-buoy-outline', href: '/help', tone: 'info' },
        { title: 'Legal', subtitle: 'Terms, privacy, refunds', icon: 'document-text-outline', href: '/legal' },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Profile" subtitle={user?.email} />
      <Screen edges={[]}>
        <Card className="items-center pb-5 pt-6">
          <Pressable
            onPress={() => void avatar.change('library')}
            onLongPress={() => void avatar.change('camera')}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            accessibilityHint="Tap to choose from your gallery, long-press to use the camera"
          >
            <Avatar name={user?.fullName} uri={user?.avatarUrl} size={92} />
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-action">
              {avatar.uploading ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Ionicons name="camera" size={15} color={colors.onPrimary} />}
            </View>
          </Pressable>
          <Text className="mt-3 text-xl font-bold tracking-tight text-text-heading">{user?.fullName}</Text>
          <Text className="mt-0.5 text-sm text-text-body">{user?.phone || 'No phone number added'}</Text>
          <View className="mt-4 w-full">
            <Button title="Edit profile" size="sm" variant="soft" icon="create-outline" onPress={() => router.push('/profile/edit')} />
          </View>
        </Card>

        {menus.map((section) => (
          <View key={section.title}>
            <SectionTitle title={section.title} />
            <Card className="overflow-hidden p-0">
              {section.items.map((item, i) => (
                <View key={item.title}>
                  {i > 0 ? <Divider className="ml-[68px]" /> : null}
                  <ListRow
                    title={item.title}
                    subtitle={item.subtitle}
                    icon={item.icon}
                    leading={item.coin ? <CoinIcon size={24} /> : undefined}
                    tone={item.tone}
                    onPress={() => router.push(item.href)}
                  />
                </View>
              ))}
            </Card>
          </View>
        ))}

        <View className="mt-6">
          <Card className="overflow-hidden p-0">
            <ListRow title="Sign out" icon="log-out-outline" destructive onPress={() => setConfirmLogout(true)} />
          </Card>
        </View>
        <Text className="mt-4 text-center text-xs text-text-body">FittinOS · v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </Screen>

      <ConfirmDialog
        visible={confirmLogout}
        title="Sign out?"
        message="You'll need to sign in again to manage your bookings and wallet."
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
        onConfirm={async () => {
          setSigningOut(true);
          await logout({ reason: "You've been signed out of this device. See you soon!" });
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </View>
  );
}
