import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { profileApi } from '@/api/endpoints';
import { qk, useCertSubmissions, useInvalidate, useKycSubmissions, useProfile } from '@/api/queries';
import { Badge, Button, Card, EmptyState, ErrorState, Header, InfoBanner, Screen, SectionTitle, Spinner } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { verificationStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

const HOW_IT_WORKS: Array<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = [
  { icon: 'hand-left-outline', text: 'Tap "Continue with DigiLocker" below' },
  { icon: 'open-outline', text: "DigiLocker, UIDAI's official portal, opens in a secure browser" },
  { icon: 'lock-closed-outline', text: 'Enter your Aadhaar number and OTP there — FittinOS never sees either' },
  { icon: 'checkmark-circle-outline', text: 'Give consent, then come back to this app and tap "I\'ve finished"' },
  { icon: 'time-outline', text: 'Your verified submission goes to our team for a quick review' },
];

/**
 * KYC: Aadhaar through API Sathi's DigiLocker flow. The app keeps the
 * backend's own `sessionId` and fetches the result with it, so it does not
 * depend on DigiLocker's redirect (which targets the web page) reaching the app.
 */
export default function VerificationScreen() {
  const { colors } = useTheme();
  const profile = useProfile();
  const kyc = useKycSubmissions();
  const certs = useCertSubmissions();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [session, setSession] = useState<{ sessionId: string; kycUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifiedMessage, setVerifiedMessage] = useState(false);

  const openDigiLocker = (url: string) =>
    WebBrowser.openBrowserAsync(url, { toolbarColor: '#FFFFFF', controlsColor: '#FF5500', showTitle: true });

  const start = useMutation({
    mutationFn: profileApi.startAadhaar,
    onSuccess: async (res) => {
      setError(null);
      setSession({ sessionId: res.sessionId, kycUrl: res.kycUrl });
      await openDigiLocker(res.kycUrl);
    },
    onError: (err) => setError(extractErrorMessage(err, 'Could not start Aadhaar verification. Please try again.')),
  });

  const fetchResult = useMutation({
    mutationFn: () => profileApi.fetchAadhaar({ sessionId: session!.sessionId }),
    onSuccess: () => {
      setError(null);
      setSession(null);
      setVerifiedMessage(true);
      toast.show('Aadhaar verified. Awaiting admin approval.');
      void invalidate(qk.profile, qk.kycSubmissions);
    },
    onError: (err) => setError(extractErrorMessage(err, 'Verification is still pending or could not be completed.')),
  });

  if (profile.isPending) {
    return (
      <>
        <Header title="Verification" />
        <Spinner label="Loading verification" />
      </>
    );
  }
  if (profile.isError) {
    return (
      <>
        <Header title="Verification" />
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </>
    );
  }
  const p = profile.data;
  const kycS = verificationStatus(p.kycStatus);
  const certS = verificationStatus(p.certificationStatus);
  const latestKyc = kyc.data?.[0];
  const canStart = p.kycStatus === 'NOT_SUBMITTED' || p.kycStatus === 'REJECTED';

  return (
    <>
      <Header title="Verification" />
      <Screen
        refreshing={profile.isRefetching}
        onRefresh={() => {
          void profile.refetch();
          void kyc.refetch();
          void certs.refetch();
        }}
      >
        <Card>
          <View className="flex-row items-center">
            <View className={`h-11 w-11 items-center justify-center rounded-xl ${p.isLive ? 'bg-success-soft' : 'bg-secondary-soft'}`}>
              <Ionicons name={p.isLive ? 'checkmark-done' : 'hourglass-outline'} size={22} color={p.isLive ? colors.success : colors.heading} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-text-heading">{p.isLive ? "You're live" : 'Not live yet'}</Text>
              <Text className="text-sm text-text-body">
                {p.isLive
                  ? 'Clients can discover and book you.'
                  : 'Going live needs both your KYC and a certification approved — it happens automatically.'}
              </Text>
            </View>
          </View>
        </Card>

        <SectionTitle title="Identity (KYC)" action={<Badge label={kycS.label} tone={kycS.tone} />} />
        {p.kycStatus === 'PENDING' ? (
          <InfoBanner
            tone="warning"
            title="KYC pending approval"
            message="Your KYC is under review. You'll get full access — services, availability and bookings — as soon as it's approved."
          />
        ) : null}
        {p.kycStatus === 'APPROVED' ? <InfoBanner tone="success" message="Your identity is verified." icon="shield-checkmark" /> : null}
        {p.kycStatus === 'REJECTED' && latestKyc?.rejectionReason ? (
          <InfoBanner tone="danger" title="Verification not approved" message={latestKyc.rejectionReason} />
        ) : null}
        {verifiedMessage ? (
          <View className="mt-2">
            <InfoBanner tone="success" title="Your Aadhaar was verified." message="Your submission is now awaiting admin approval." />
          </View>
        ) : null}

        {canStart ? (
          <Card className="mt-3">
            <Text className="mb-3 text-base font-semibold text-text-heading">Verify your identity</Text>
            {HOW_IT_WORKS.map((step, i) => (
              <View key={step.text} className="mb-2 flex-row items-start">
                <View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-primary-soft">
                  <Text className="text-xs font-bold text-primary-ink">{i + 1}</Text>
                </View>
                <Text className="flex-1 text-sm text-text-heading">{step.text}</Text>
              </View>
            ))}
            {error ? (
              <View className="mb-3 mt-1">
                <InfoBanner tone="danger" message={error} icon="alert-circle" />
              </View>
            ) : null}
            {session ? (
              <View className="mt-2 gap-3">
                <Button title="I've finished on DigiLocker" icon="checkmark" loading={fetchResult.isPending} onPress={() => fetchResult.mutate()} />
                <Button title="Reopen DigiLocker" variant="outline" onPress={() => void openDigiLocker(session.kycUrl)} />
                <Text className="text-center text-xs text-text-body">Complete DigiLocker first, then load your result here.</Text>
              </View>
            ) : (
              <View className="mt-2">
                <Button title="Continue with DigiLocker" icon="open-outline" loading={start.isPending} onPress={() => start.mutate()} />
              </View>
            )}
          </Card>
        ) : null}

        {kyc.isError ? (
          <>
            <SectionTitle title="KYC history" />
            <ErrorState compact error={kyc.error} onRetry={() => void kyc.refetch()} />
          </>
        ) : kyc.isPending ? null : kyc.data && kyc.data.length > 0 ? (
          <>
            <SectionTitle title="KYC history" />
            <Card className="p-0">
              {kyc.data.map((k, i) => {
                const s = verificationStatus(k.status);
                return (
                  <View key={k.id} className={`px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-text-heading">Aadhaar {k.documentNumberMasked ?? ''}</Text>
                      <Badge label={s.label} tone={s.tone} />
                    </View>
                    <Text className="text-xs text-text-body">Submitted {formatDate(k.createdAt)}</Text>
                    {k.rejectionReason ? <Text className="mt-1 text-xs text-danger-ink">{k.rejectionReason}</Text> : null}
                  </View>
                );
              })}
            </Card>
          </>
        ) : (
          <>
            <SectionTitle title="KYC history" />
            <EmptyState compact icon="document-text-outline" title="No KYC submissions yet" message="Start verification above to get approved and go live." />
          </>
        )}

        <SectionTitle title="Certifications" action={<Badge label={certS.label} tone={certS.tone} />} />
        {certs.isError ? (
          <ErrorState compact error={certs.error} onRetry={() => void certs.refetch()} />
        ) : certs.isPending ? null : certs.data && certs.data.length > 0 ? (
          <Card>
            <Text className="text-sm text-text-body">{certs.data.length} submitted.</Text>
            <View className="mt-3">
              <Button title="Manage certifications" variant="outline" size="sm" onPress={() => router.push('/profile')} />
            </View>
          </Card>
        ) : (
          <Card>
            <EmptyState
              compact
              icon="ribbon-outline"
              title="No certifications yet"
              message="Add your fitness certifications to build trust with clients."
              actionLabel="Add a certification"
              onAction={() => router.push('/profile')}
            />
          </Card>
        )}
      </Screen>
    </>
  );
}
