import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authApi, profileApi } from '@/api/endpoints';
import { qk, useInvalidate, useProfile } from '@/api/queries';
import type { GeocodedLocation } from '@/api/types';
import { Button, Card, ErrorState, Header, InfoBanner, Screen, SectionTitle, Spinner, TextField } from '@/components/ui';
import { LocationPicker } from '@/features/profile/LocationPicker';
import { extractErrorMessage } from '@/lib/errors';
import { validateFullName, validatePhone } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

const splitList = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export default function EditProfileScreen() {
  const { user, setUser } = useAuth();
  const profile = useProfile();
  const invalidate = useInvalidate();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [languages, setLanguages] = useState('');
  const [radius, setRadius] = useState('');
  const [location, setLocation] = useState<GeocodedLocation | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile.data || loaded) return;
    const p = profile.data;
    setHeadline(p.headline ?? '');
    setBio(p.bio ?? '');
    setExperience(p.experienceYears != null ? String(p.experienceYears) : '');
    setSpecializations(p.specializations.join(', '));
    setLanguages(p.languages.join(', '));
    setRadius(p.serviceRadiusKm != null ? String(p.serviceRadiusKm) : '');
    setLoaded(true);
  }, [profile.data, loaded]);

  const save = useMutation({
    mutationFn: async () => {
      const updatedUser = await authApi.updateMe({ fullName: fullName.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) });
      setUser(updatedUser);
      await profileApi.update({
        headline: headline.trim() || undefined,
        bio: bio.trim() || undefined,
        experienceYears: experience.trim() ? Number(experience) : undefined,
        specializations: splitList(specializations),
        languages: splitList(languages),
        serviceRadiusKm: radius.trim() ? Number(radius) : undefined,
        ...(location
          ? {
              latitude: location.latitude,
              longitude: location.longitude,
              placeId: location.placeId ?? undefined,
              formattedAddress: location.formattedAddress,
              city: location.city ?? undefined,
              area: location.area ?? undefined,
              postalCode: location.postalCode ?? undefined,
            }
          : {}),
      });
    },
    onSuccess: () => {
      void invalidate(qk.profile);
      toast.show('Profile updated.');
      router.back();
    },
    onError: (err) => setFormError(extractErrorMessage(err, 'Failed to save your profile.')),
  });

  function submit() {
    const exp = experience.trim() ? Number(experience) : null;
    const rad = radius.trim() ? Number(radius) : null;
    const next = {
      fullName: validateFullName(fullName),
      phone: validatePhone(phone),
      headline: headline.length > 140 ? 'Headline must be at most 140 characters.' : undefined,
      experience: exp !== null && (!Number.isInteger(exp) || exp < 0 || exp > 70) ? 'Enter whole years between 0 and 70.' : undefined,
      radius: rad !== null && (!Number.isInteger(rad) || rad < 1 || rad > 100) ? 'Enter a radius between 1 and 100 km.' : undefined,
      specializations:
        splitList(specializations).length > 20
          ? 'Up to 20 specializations.'
          : splitList(specializations).some((x) => x.length > 60)
            ? 'Each specialization must be at most 60 characters.'
            : undefined,
      languages:
        splitList(languages).length > 20
          ? 'Up to 20 languages.'
          : splitList(languages).some((x) => x.length > 60)
            ? 'Each language must be at most 60 characters.'
            : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setFormError(null);
    save.mutate();
  }

  if (profile.isPending) {
    return (
      <>
        <Header title="Edit profile" />
        <Spinner />
      </>
    );
  }
  if (profile.isError) {
    return (
      <>
        <Header title="Edit profile" />
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </>
    );
  }

  return (
    <>
      <Header title="Edit profile" />
      <Screen footer={<Button title="Save changes" onPress={submit} loading={save.isPending} />}>
        {formError ? (
          <View className="mb-3">
            <InfoBanner tone="danger" message={formError} icon="alert-circle" />
          </View>
        ) : null}
        <SectionTitle title="Personal" />
        <Card>
          <TextField label="Full name" value={fullName} onChangeText={setFullName} error={errors.fullName} autoCapitalize="words" />
          <TextField label="Phone" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" placeholder="+919876543210" />
          <Text className="text-xs text-text-body">Email: {user?.email} (can&apos;t be changed here)</Text>
        </Card>

        <SectionTitle title="Professional" />
        <Card>
          <TextField label="Headline" value={headline} onChangeText={setHeadline} error={errors.headline} maxLength={140} placeholder="e.g. Certified yoga & mobility coach" />
          <TextField label="About you" value={bio} onChangeText={setBio} multiline maxLength={2000} />
          <TextField label="Years of experience" value={experience} onChangeText={setExperience} error={errors.experience} keyboardType="number-pad" />
          <TextField
            label="Specializations"
            value={specializations}
            onChangeText={setSpecializations}
            error={errors.specializations}
            hint="Separate with commas, e.g. Hatha yoga, Mobility"
          />
          <TextField label="Languages" value={languages} onChangeText={setLanguages} error={errors.languages} hint="Separate with commas" />
        </Card>

        <SectionTitle title="Business location" />
        <Card>
          <LocationPicker
            value={
              location
                ? { formattedAddress: location.formattedAddress, city: location.city, area: location.area }
                : { formattedAddress: profile.data.formattedAddress, city: profile.data.city, area: profile.data.area }
            }
            onChange={setLocation}
          />
          <TextField
            label="Service radius (km)"
            value={radius}
            onChangeText={setRadius}
            error={errors.radius}
            keyboardType="number-pad"
            hint="How far from this location clients can discover you (1–100 km)."
          />
        </Card>
      </Screen>
    </>
  );
}
