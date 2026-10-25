import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { profileApi, uploadFile, type UploadableFile } from '@/api/endpoints';
import { qk, useCertSubmissions, useInvalidate, useProfile, useWallet } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import {
  Avatar,
  Badge,
  BentoCard,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  EmptyState,
  ErrorState,
  InfoBanner,
  KeyValue,
  ListRow,
  ProgressBar,
  Screen,
  SectionTitle,
  Sheet,
  Spinner,
  TextField,
  type IconName,
  type Tone,
} from '@/components/ui';
import { CoinIcon } from '@/features/coins/CoinIcon';
import { useProfileSetup } from '@/features/profile/setup-steps';
import { shareCurrentLocation } from '@/features/profile/share-location';
import { useAvatarUpload } from '@/features/profile/useAvatarUpload';
import { extractErrorMessage } from '@/lib/errors';
import { formatCoins, formatDate } from '@/lib/format';
import { openWebPage } from '@/lib/links';
import { PickerError, pickDocument } from '@/lib/pickers';
import { verificationStatus } from '@/lib/status';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

type MenuItem = { title: string; subtitle?: string; icon: IconName; href: Href; tone?: Tone; coin?: boolean };

/**
 * Profile hub: the professional's public profile (photo, about, details,
 * certifications) plus every secondary workspace screen — the routes the old
 * "More" tab listed — so nothing needs a sixth tab.
 */
export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const profile = useProfile();
  const certs = useCertSubmissions();
  const wallet = useWallet();
  const setup = useProfileSetup();
  const avatar = useAvatarUpload();
  const toast = useToast();
  const { colors } = useTheme();
  const [sharing, setSharing] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (profile.isPending) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Profile" />
        <Spinner label="Loading profile" />
      </View>
    );
  }
  if (profile.isError) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader title="Profile" />
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </View>
    );
  }
  const p = profile.data;
  const kyc = verificationStatus(p.kycStatus);
  const cert = verificationStatus(p.certificationStatus);

  async function share() {
    setSharing(true);
    const result = await shareCurrentLocation();
    setSharing(false);
    toast.show(result.ok ? 'Current location shared.' : result.message, result.ok ? 'success' : 'error');
  }

  const menus: Array<{ title: string; items: MenuItem[] }> = [
    {
      title: 'Your work',
      items: [
        { title: 'Bookings', subtitle: 'Upcoming, today and past sessions', icon: 'calendar-outline', href: '/bookings', tone: 'info' },
        { title: 'Leads', subtitle: 'Client requirements matching your services', icon: 'flash-outline', href: '/leads', tone: 'primary' },
        { title: 'Messages', subtitle: 'Chat and calls with clients', icon: 'chatbubbles-outline', href: '/messages', tone: 'info' },
        { title: 'Reviews', icon: 'star-outline', href: '/reviews', tone: 'warning' },
      ],
    },
    {
      title: 'Money',
      items: [
        {
          title: 'Coin wallet',
          subtitle: wallet.data ? formatCoins(wallet.data.coinBalance) : undefined,
          icon: 'wallet-outline',
          href: '/wallet',
          tone: 'primary',
          coin: true,
        },
        { title: 'Payout account', subtitle: 'Bank or UPI for payouts', icon: 'card-outline', href: '/payout-account', tone: 'success' },
        { title: 'Payment history', subtitle: 'Receipts and refunds', icon: 'receipt-outline', href: '/payments' },
      ],
    },
    {
      title: 'Grow',
      items: [
        { title: 'Subscription plans', subtitle: 'Plans, offers and your current plan', icon: 'ribbon-outline', href: '/plans', tone: 'primary' },
        { title: 'Featured listings', subtitle: 'Boost a service with coins', icon: 'rocket-outline', href: '/featured-listings', tone: 'primary' },
        { title: 'Promotions', subtitle: 'Offers running on your services', icon: 'pricetag-outline', href: '/promotions', tone: 'primary' },
      ],
    },
    {
      title: 'Account',
      items: [
        { title: 'Notifications', icon: 'notifications-outline', href: '/notifications', tone: 'info' },
        { title: 'Appearance', subtitle: 'Light, dark or follow your phone', icon: 'contrast-outline', href: '/appearance' },
        { title: 'Settings', subtitle: 'Account, password, privacy', icon: 'settings-outline', href: '/settings' },
        { title: 'Help & support', icon: 'help-buoy-outline', href: '/help', tone: 'info' },
        { title: 'Legal', subtitle: 'Terms, privacy, refunds', icon: 'document-text-outline', href: '/legal' },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Profile" subtitle={user?.email} />
      <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()} edges={[]}>
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
          <Text className="mt-0.5 text-center text-sm text-text-body">{p.headline || 'No headline yet'}</Text>
          <View className="mt-3 flex-row flex-wrap justify-center gap-2">
            {p.isLive ? <Badge label="Verified & live" tone="success" dot /> : <Badge label="Not live yet" tone="neutral" dot />}
            {p.ratingAverage != null ? <Badge label={`★ ${p.ratingAverage.toFixed(1)} (${p.ratingCount})`} tone="warning" /> : null}
          </View>
          <View className="mt-4 w-full flex-row gap-2">
            <View className="flex-1">
              <Button title="Edit profile" size="sm" variant="soft" icon="create-outline" onPress={() => router.push('/profile/edit')} />
            </View>
            <View className="flex-1">
              <Button title="Public profile" size="sm" variant="outline" icon="open-outline" onPress={() => void openWebPage(`/professional/${p.id}`)} />
            </View>
          </View>
        </Card>

        <View className="mt-3 flex-row gap-3">
          <BentoCard icon="shield-checkmark" tone={kyc.tone} title="KYC" onPress={() => router.push('/verification')} accessibilityLabel={`KYC: ${kyc.label}`}>
            <Badge label={kyc.label} tone={kyc.tone} />
          </BentoCard>
          <BentoCard icon="ribbon" tone={cert.tone} title="Certification" onPress={() => router.push('/verification')} accessibilityLabel={`Certification: ${cert.label}`}>
            <Badge label={cert.label} tone={cert.tone} />
          </BentoCard>
        </View>

        {setup.ready ? (
          <View className="mt-3">
            <BentoCard
              layout="block"
              icon={setup.next ? 'rocket-outline' : 'checkmark-done'}
              tone={setup.next ? 'primary' : 'success'}
              title={`Profile setup · ${Math.round((setup.done / setup.total) * 100)}%`}
              onPress={() => router.push('/profile-setup')}
              accessibilityLabel={`Profile setup, ${setup.done} of ${setup.total} steps complete`}
            >
              <ProgressBar value={setup.done / setup.total} tone={setup.next ? 'primary' : 'success'} label="Profile setup progress" />
              <Text className="mt-2 text-xs text-text-body">
                {setup.next ? `Next: ${setup.next.label}` : 'All steps complete — clients can find and book you.'}
              </Text>
            </BentoCard>
          </View>
        ) : null}

        <SectionTitle title="About" />
        <Card>
          <Text className="text-sm leading-5 text-text-heading">{p.bio || 'Tell clients about yourself — tap Edit profile.'}</Text>
        </Card>

        <SectionTitle title="Details" />
        <Card className="py-2">
          <KeyValue label="Experience" value={p.experienceYears != null ? `${p.experienceYears} years` : '—'} />
          <KeyValue label="Specializations" value={p.specializations.join(', ') || '—'} />
          <KeyValue label="Languages" value={p.languages.join(', ') || '—'} />
          <KeyValue label="Business location" value={[p.area, p.city].filter(Boolean).join(', ') || '—'} />
          <KeyValue label="Service radius" value={p.serviceRadiusKm != null ? `${p.serviceRadiusKm} km` : '—'} />
          <KeyValue label="Phone" value={user?.phone || '—'} />
          <KeyValue label="Email" value={user?.email ?? '—'} />
        </Card>
        <View className="mt-3">
          <Button title="Share my current location" variant="outline" icon="locate" loading={sharing} onPress={share} />
          <Text className="mt-1.5 text-center text-xs text-text-body">Sent once to the FittinOS team only. It never changes your business location.</Text>
        </View>

        <SectionTitle title="Certifications" action={<Badge label={cert.label} tone={cert.tone} />} />
        {certs.isPending ? (
          <Spinner />
        ) : certs.isError ? (
          <ErrorState compact error={certs.error} onRetry={() => void certs.refetch()} />
        ) : (
          <Card className="p-0">
            {certs.data.length === 0 ? (
              <EmptyState compact icon="ribbon-outline" title="No certifications yet" message="Add one below to boost client trust." />
            ) : (
              certs.data.map((c, i) => {
                const s = verificationStatus(c.status === 'PENDING' ? 'PENDING' : c.status);
                return (
                  <View key={c.id} className={`px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                    <View className="flex-row items-center justify-between">
                      <Text className="mr-2 flex-1 text-sm font-bold text-text-heading">{c.title}</Text>
                      <Badge label={s.label} tone={s.tone} />
                    </View>
                    <Text className="text-xs text-text-body">
                      {c.issuingOrganization} · issued {formatDate(c.issueDate)}
                      {c.expiryDate ? ` · expires ${formatDate(c.expiryDate)}` : ''}
                    </Text>
                    {c.rejectionReason ? <Text className="mt-1 text-xs text-danger-ink">{c.rejectionReason}</Text> : null}
                  </View>
                );
              })
            )}
          </Card>
        )}
        <View className="mt-3">
          <Button title="Add a certification" icon="add" variant="outline" onPress={() => setCertOpen(true)} />
        </View>

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
        <Text className="mt-4 text-center text-xs text-text-body">FittinOS Pro · v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </Screen>

      <CertificationSheet visible={certOpen} onClose={() => setCertOpen(false)} />
      <ConfirmDialog
        visible={confirmLogout}
        title="Sign out?"
        message="You'll need to sign in again to manage your bookings and messages."
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

function CertificationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const invalidate = useInvalidate();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [org, setOrg] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [issueDate, setIssueDate] = useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [picker, setPicker] = useState<'issue' | 'expiry' | null>(null);
  const [file, setFile] = useState<UploadableFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const uploaded = await uploadFile(file!, 'CERTIFICATION_DOCUMENT');
      return profileApi.submitCertification({
        title: title.trim(),
        issuingOrganization: org.trim(),
        issueDate: issueDate!.toISOString(),
        ...(expiryDate ? { expiryDate: expiryDate.toISOString() } : {}),
        ...(credentialId.trim() ? { credentialId: credentialId.trim() } : {}),
        documentFileIds: [uploaded.id],
      });
    },
    onSuccess: () => {
      toast.show('Certification submitted for review.');
      void invalidate(qk.certSubmissions, qk.profile);
      setTitle('');
      setOrg('');
      setCredentialId('');
      setIssueDate(null);
      setExpiryDate(null);
      setFile(null);
      onClose();
    },
    onError: (err) => setError(extractErrorMessage(err, 'Failed to submit certification.')),
  });

  return (
    <Sheet visible={visible} title="Add certification" onClose={onClose}>
      {error ? (
        <View className="mb-3">
          <InfoBanner tone="danger" message={error} icon="alert-circle" />
        </View>
      ) : null}
      <TextField label="Certification title" value={title} onChangeText={setTitle} maxLength={200} />
      <TextField label="Issuing organization" value={org} onChangeText={setOrg} maxLength={200} />
      <TextField label="Credential ID (optional)" value={credentialId} onChangeText={setCredentialId} maxLength={100} autoCapitalize="characters" />
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Button title={issueDate ? `Issued ${formatDate(issueDate)}` : 'Issue date'} variant="outline" size="sm" icon="calendar-outline" onPress={() => setPicker('issue')} />
        </View>
        <View className="flex-1">
          <Button title={expiryDate ? `Expires ${formatDate(expiryDate)}` : 'Expiry (optional)'} variant="outline" size="sm" onPress={() => setPicker('expiry')} />
        </View>
      </View>
      {picker ? (
        <DateTimePicker
          value={(picker === 'issue' ? issueDate : expiryDate) ?? new Date()}
          mode="date"
          maximumDate={picker === 'issue' ? new Date() : undefined}
          onChange={(event, date) => {
            setPicker(null);
            if (event.type === 'set' && date) (picker === 'issue' ? setIssueDate : setExpiryDate)(date);
          }}
        />
      ) : null}
      <Button
        title={file ? `Document: ${file.name}` : 'Attach certificate (PDF or image)'}
        variant="outline"
        icon="attach"
        onPress={async () => {
          try {
            const picked = await pickDocument();
            if (picked) setFile(picked);
          } catch (e) {
            setError(e instanceof PickerError ? e.message : 'Could not open that file.');
          }
        }}
      />
      <View className="mt-4">
        <Button
          title="Submit for review"
          loading={submit.isPending}
          onPress={() => {
            if (!title.trim() || !org.trim() || !issueDate) return setError('Title, issuing organization and issue date are required.');
            if (!file) return setError('Attach the certificate document.');
            setError(null);
            submit.mutate();
          }}
        />
      </View>
      <View className="h-4" />
    </Sheet>
  );
}
