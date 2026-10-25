import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { authApi, conversationsApi, notificationsApi } from '@/api/endpoints';
import { qk, useBlocked, useInvalidate, useNotificationPrefs } from '@/api/queries';
import { NotificationCategory } from '@/api/shared';
import { Avatar, Button, Card, ConfirmDialog, Divider, EmptyState, ErrorState, Header, InfoBanner, ListRow, Screen, SectionTitle, Spinner, TextField } from '@/components/ui';
import { useAvatarUpload } from '@/features/profile/useAvatarUpload';
import { errorCodeOf, extractErrorMessage } from '@/lib/errors';
import { humanize } from '@/lib/format';
import { validatePassword } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

// Same list as the web's NotificationPreferences for a professional: every category except ADMIN.
const CATEGORIES = Object.values(NotificationCategory).filter((c) => c !== 'ADMIN');
const CATEGORY_LABEL: Record<string, string> = { KYC: 'KYC verification', SYSTEM: 'System & account', MARKETING: 'Offers & promotions' };

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const avatar = useAvatarUpload();
  const toast = useToast();
  const [dialog, setDialog] = useState<'password' | 'delete' | 'logoutAll' | null>(null);

  return (
    <>
      <Header title="Settings" />
      <Screen>
        <SectionTitle title="Account" />
        <Card>
          <View className="flex-row items-center">
            <Pressable onPress={() => void avatar.change('library')} accessibilityRole="button" accessibilityLabel="Change profile photo">
              <Avatar name={user?.fullName} uri={user?.avatarUrl} size={56} />
              {avatar.uploading ? (
                <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
                  <ActivityIndicator color={colors.onPrimary} />
                </View>
              ) : null}
            </Pressable>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-text-heading">{user?.fullName}</Text>
              <Text className="text-sm text-text-body">{user?.email}</Text>
            </View>
          </View>
          <View className="mt-3 flex-row gap-3">
            <View className="flex-1">
              <Button title="Gallery" size="sm" variant="outline" icon="images-outline" onPress={() => void avatar.change('library')} />
            </View>
            <View className="flex-1">
              <Button title="Camera" size="sm" variant="outline" icon="camera-outline" onPress={() => void avatar.change('camera')} />
            </View>
          </View>
        </Card>
        <Card className="mt-3 overflow-hidden p-0">
          <ListRow title="Edit profile details" icon="person-outline" onPress={() => router.push('/profile/edit')} />
          <Divider className="ml-16" />
          <ListRow title="Change password" icon="key-outline" onPress={() => setDialog('password')} />
          <Divider className="ml-16" />
          <ListRow title="Payout account" icon="card-outline" onPress={() => router.push('/payout-account')} />
          <Divider className="ml-16" />
          <ListRow title="Appearance" subtitle="Light, dark or follow your phone" icon="contrast-outline" onPress={() => router.push('/appearance')} />
        </Card>

        <NotificationPreferences />
        <BlockedClients />

        <SectionTitle title="Security" />
        <Card className="overflow-hidden p-0">
          <ListRow title="Sign out of all devices" subtitle="Ends every session, including this one" icon="phone-portrait-outline" onPress={() => setDialog('logoutAll')} />
          <Divider className="ml-16" />
          <ListRow title="Delete account" subtitle="Permanently anonymize and lock this account" icon="trash-outline" destructive onPress={() => setDialog('delete')} />
        </Card>
        <View className="mt-4">
          <Button title="Sign out" variant="ghost" onPress={() => void logout({ reason: "You've been signed out of this device. See you soon!" })} />
        </View>
      </Screen>

      <ChangePasswordDialog visible={dialog === 'password'} onClose={() => setDialog(null)} onDone={() => { setDialog(null); toast.show('Password changed.'); }} />
      <DeleteAccountDialog visible={dialog === 'delete'} onClose={() => setDialog(null)} />
      <ConfirmDialog
        visible={dialog === 'logoutAll'}
        title="Sign out everywhere?"
        message="Every device signed in to this account — including this phone — will be signed out."
        confirmLabel="Sign out all"
        destructive
        onConfirm={() => void logout({ everywhere: true, reason: 'You signed out of all devices.' })}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

function NotificationPreferences() {
  const { colors } = useTheme();
  const prefs = useNotificationPrefs();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [muted, setMuted] = useState<string[] | null>(null);
  useEffect(() => {
    if (prefs.data && muted === null) setMuted(prefs.data.mutedCategories);
  }, [prefs.data, muted]);
  const save = useMutation({
    mutationFn: notificationsApi.setPreferences,
    onSuccess: () => void invalidate(qk.notificationPrefs),
    onError: (err) => {
      setMuted(prefs.data?.mutedCategories ?? []);
      toast.show(extractErrorMessage(err, 'Could not save notification settings.'), 'error');
    },
  });

  return (
    <>
      <SectionTitle title="In-app notifications" />
      <Card className="p-0">
        {prefs.isPending || muted === null ? (
          <Spinner />
        ) : (
          CATEGORIES.map((c, i) => {
            const enabled = !muted.includes(c);
            return (
              <View key={c} className={`min-h-[52px] flex-row items-center px-4 ${i > 0 ? 'border-t border-border' : ''}`}>
                <Text className="flex-1 text-sm text-text-heading">{CATEGORY_LABEL[c] ?? humanize(c)}</Text>
                <Switch
                  value={enabled}
                  onValueChange={(on) => {
                    const next = on ? muted.filter((m) => m !== c) : [...muted, c];
                    setMuted(next);
                    save.mutate(next);
                  }}
                  trackColor={{ true: colors.primary, false: colors.trackOff }}
                  thumbColor={enabled ? colors.onPrimary : colors.thumbOff}
                  accessibilityLabel={`${CATEGORY_LABEL[c] ?? humanize(c)} notifications`}
                />
              </View>
            );
          })
        )}
      </Card>
      <Text className="mt-1 text-xs text-text-body">Phone push notifications aren&apos;t available yet — you&apos;ll see everything in the app.</Text>
    </>
  );
}

function BlockedClients() {
  const blocked = useBlocked();
  const invalidate = useInvalidate();
  const toast = useToast();
  const unblock = useMutation({
    mutationFn: conversationsApi.unblock,
    onSuccess: () => {
      toast.show('Client unblocked.');
      void invalidate(qk.blocked);
    },
    onError: (err) => toast.show(extractErrorMessage(err, 'Could not unblock.'), 'error'),
  });
  if (blocked.isError) {
    return (
      <>
        <SectionTitle title="Blocked clients" />
        <ErrorState compact error={blocked.error} onRetry={() => void blocked.refetch()} />
      </>
    );
  }
  // Pending: nothing yet, same as before — only a genuinely empty *successful*
  // response gets the EmptyState below, never a loading state mistaken for one.
  if (blocked.isPending) return null;
  if (!blocked.data?.length) {
    return (
      <>
        <SectionTitle title="Blocked clients" />
        <EmptyState compact icon="person-remove-outline" title="No blocked clients" message="Clients you block will appear here." />
      </>
    );
  }
  return (
    <>
      <SectionTitle title="Blocked clients" />
      <Card className="p-0">
        {blocked.data.map((b, i) => (
          <View key={b.userId} className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
            <Avatar name={b.fullName} uri={b.avatarUrl} size={36} />
            <Text className="ml-3 flex-1 text-sm text-text-heading">{b.fullName}</Text>
            <Button title="Unblock" size="sm" variant="outline" fullWidth={false} onPress={() => unblock.mutate(b.userId)} />
          </View>
        ))}
      </Card>
    </>
  );
}

function ChangePasswordDialog({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      onDone();
    },
    onError: (err) => setFormError(extractErrorMessage(err, 'Could not change your password.')),
  });
  return (
    <ConfirmDialog
      visible={visible}
      title="Change password"
      confirmLabel="Update"
      loading={change.isPending}
      onCancel={onClose}
      onConfirm={() => {
        const e = {
          current: current ? undefined : 'Enter your current password.',
          next: validatePassword(next, 'New password'),
          confirm: confirm !== next ? 'Passwords do not match.' : undefined,
        };
        setErrors(e);
        if (e.current || e.next || e.confirm) return;
        setFormError(null);
        change.mutate();
      }}
    >
      {formError ? (
        <View className="mb-3">
          <InfoBanner tone="danger" message={formError} icon="alert-circle" />
        </View>
      ) : null}
      <TextField label="Current password" value={current} onChangeText={setCurrent} error={errors.current} password />
      <TextField label="New password" value={next} onChangeText={setNext} error={errors.next} password />
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} error={errors.confirm} password />
    </ConfirmDialog>
  );
}

function DeleteAccountDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () => authApi.deleteAccount(password),
    onSuccess: () => void logout({ reason: 'Your account was deleted.' }),
    onError: (err) =>
      setError(
        errorCodeOf(err) === 'HAS_UPCOMING_BOOKINGS'
          ? extractErrorMessage(err, 'You have upcoming bookings. Complete or resolve them before deleting your account.')
          : extractErrorMessage(err, 'Could not delete your account.'),
      ),
  });
  return (
    <ConfirmDialog
      visible={visible}
      title="Delete your account?"
      message="Your personal details are removed and you can never sign in again. Bookings, payments and other financial records are retained."
      confirmLabel="Delete account"
      destructive
      loading={remove.isPending}
      onCancel={() => {
        setPassword('');
        setError(null);
        onClose();
      }}
      onConfirm={() => {
        if (!password) return setError('Enter your password to confirm.');
        setError(null);
        remove.mutate();
      }}
    >
      {error ? (
        <View className="mb-3 flex-row items-start">
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text className="ml-2 flex-1 text-sm text-danger-ink">{error}</Text>
        </View>
      ) : null}
      <TextField label="Your password" value={password} onChangeText={setPassword} password />
    </ConfirmDialog>
  );
}
