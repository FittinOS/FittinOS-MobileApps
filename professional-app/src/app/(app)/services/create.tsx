import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { profileApi, servicesApi } from '@/api/endpoints';
import { qk, useCategories, useInvalidate, useProfile, useServices } from '@/api/queries';
import { Button, Card, EmptyState, ErrorState, Header, InfoBanner, Screen, SectionTitle, Spinner } from '@/components/ui';
import { LocationPicker } from '@/features/profile/LocationPicker';
import { ServiceFormFields, validateServiceForm, type ServiceFormValues } from '@/features/services/ServiceForm';
import { extractErrorMessage } from '@/lib/errors';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

export default function CreateServiceScreen() {
  const { colors } = useTheme();
  const profile = useProfile();
  const categories = useCategories();
  const existing = useServices();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [values, setValues] = useState<ServiceFormValues>({ price: '', duration: '60', mode: 'IN_PERSON' });
  const [errors, setErrors] = useState<{ price?: string; duration?: string; category?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const saveLocation = useMutation({
    mutationFn: profileApi.update,
    onSuccess: () => {
      void invalidate(qk.profile);
      toast.show('Business location saved.');
    },
    onError: (err) => setFormError(extractErrorMessage(err, 'Could not save your location.')),
  });

  const create = useMutation({
    mutationFn: servicesApi.create,
    onSuccess: () => {
      toast.show('Service added.');
      void invalidate(qk.services, qk.profile);
      router.back();
    },
    onError: (err) => setFormError(extractErrorMessage(err, 'Could not add the service.')),
  });

  if (profile.isPending || categories.isPending) {
    return (
      <>
        <Header title="Add service" />
        <Spinner />
      </>
    );
  }
  if (profile.isError) {
    return (
      <>
        <Header title="Add service" />
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </>
    );
  }
  if (categories.isError) {
    return (
      <>
        <Header title="Add service" />
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      </>
    );
  }

  // Creating a service needs an approved KYC server-side — say so up front, like the web.
  if (profile.data.kycStatus !== 'APPROVED') {
    return (
      <>
        <Header title="Add service" />
        <EmptyState
          icon="shield-outline"
          title="KYC verification required"
          message="Complete your KYC verification to start creating services clients can book."
          actionLabel="Go to verification"
          onAction={() => router.replace('/verification')}
        />
      </>
    );
  }

  const offered = new Set((existing.data?.items ?? []).filter((s) => s.status !== 'ARCHIVED').map((s) => s.categoryId));
  const active = categories.data.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const p = profile.data;
  const hasLocation = !!(p.city || p.formattedAddress);
  const needsLocation = values.mode !== 'ONLINE';

  function submit() {
    const v = validateServiceForm(values);
    const next = { ...v.errors, category: categoryId ? undefined : 'Choose a category.' };
    setErrors(next);
    if (next.category || next.price || next.duration) return;
    if (needsLocation && !hasLocation) {
      setFormError('Set your business location, or choose Online if this service has no physical location.');
      return;
    }
    setFormError(null);
    create.mutate({ categoryId: categoryId!, priceAmount: v.priceAmount!, durationMinutes: v.durationMinutes!, mode: values.mode });
  }

  return (
    <>
      <Header title="Add service" />
      <Screen footer={<Button title="Add service" onPress={submit} loading={create.isPending} />}>
        <Text className="mb-2 text-sm text-text-body">Choose a category from the catalog, then set your own price and duration.</Text>
        {formError ? (
          <View className="mb-3">
            <InfoBanner tone="danger" message={formError} icon="alert-circle" />
          </View>
        ) : null}

        <SectionTitle title="Category" />
        {errors.category ? <Text className="mb-2 text-xs text-danger-ink">{errors.category}</Text> : null}
        <View className="gap-2">
          {active.map((c) => {
            const taken = offered.has(c.id);
            const selected = categoryId === c.id;
            return (
              <Pressable
                key={c.id}
                disabled={taken}
                onPress={() => setCategoryId(c.id)}
                className={`min-h-[56px] flex-row items-center rounded-xl border px-4 py-2 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-card'} ${taken ? 'opacity-50' : ''}`}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: taken }}
              >
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-text-heading">{c.name}</Text>
                  {c.description ? (
                    <Text className="text-xs text-text-body" numberOfLines={2}>
                      {c.description}
                    </Text>
                  ) : null}
                  {taken ? <Text className="text-xs text-text-body">You already offer this</Text> : null}
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>

        <SectionTitle title="Pricing & delivery" />
        <Card>
          <ServiceFormFields values={values} onChange={setValues} errors={errors} />
        </Card>

        {needsLocation ? (
          <>
            <SectionTitle title="Business location" />
            <Card>
              <LocationPicker
                value={{ formattedAddress: p.formattedAddress, city: p.city, area: p.area }}
                onChange={(loc) =>
                  saveLocation.mutate({
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    placeId: loc.placeId ?? undefined,
                    formattedAddress: loc.formattedAddress,
                    city: loc.city ?? undefined,
                    area: loc.area ?? undefined,
                    postalCode: loc.postalCode ?? undefined,
                  })
                }
              />
            </Card>
          </>
        ) : null}
      </Screen>
    </>
  );
}
