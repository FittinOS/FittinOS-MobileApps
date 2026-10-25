import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { servicesApi } from '@/api/endpoints';
import { qk, useInvalidate, useService } from '@/api/queries';
import { Badge, Button, Card, ErrorState, Header, InfoBanner, KeyValue, Screen, SectionTitle, Spinner } from '@/components/ui';
import { ServiceFormFields, validateServiceForm, type ServiceFormValues } from '@/features/services/ServiceForm';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate, paiseToRupeesInput } from '@/lib/format';
import { serviceStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const service = useService(id);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [values, setValues] = useState<ServiceFormValues | null>(null);
  const [errors, setErrors] = useState<{ price?: string; duration?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (service.data && !values) {
      setValues({
        price: paiseToRupeesInput(service.data.priceAmount),
        duration: String(service.data.durationMinutes),
        mode: service.data.mode,
      });
    }
  }, [service.data, values]);

  const save = useMutation({
    mutationFn: (input: { priceAmount: number; durationMinutes: number; mode: string }) => servicesApi.update(id, input),
    onSuccess: () => {
      toast.show('Service updated.');
      void invalidate(qk.services);
      router.back();
    },
    onError: (err) => setFormError(extractErrorMessage(err, 'Could not save the service.')),
  });

  if (service.isPending || service.isError || !values) {
    return (
      <>
        <Header title="Edit service" />
        {service.isError ? <ErrorState error={service.error} onRetry={() => void service.refetch()} /> : <Spinner />}
      </>
    );
  }
  const s = service.data;
  const st = serviceStatus(s.status);

  return (
    <>
      <Header title="Edit service" />
      <Screen
        footer={
          <Button
            title="Save changes"
            loading={save.isPending}
            onPress={() => {
              const v = validateServiceForm(values);
              setErrors(v.errors);
              if (v.errors.price || v.errors.duration) return;
              setFormError(null);
              save.mutate({ priceAmount: v.priceAmount!, durationMinutes: v.durationMinutes!, mode: values.mode });
            }}
          />
        }
      >
        <Card>
          <View className="flex-row items-start justify-between">
            <Text className="mr-2 flex-1 text-lg font-semibold text-text-heading">{s.title}</Text>
            <Badge label={st.label} tone={st.tone} />
          </View>
          <Text className="mt-1 text-sm text-text-body">{s.description}</Text>
          <View className="mt-2">
            <KeyValue label="Added" value={formatDate(s.createdAt)} />
            {s.isFeatured && s.featuredUntil ? <KeyValue label="Featured until" value={formatDate(s.featuredUntil)} /> : null}
          </View>
          <Text className="mt-2 text-xs text-text-body">The title and description come from the FittinOS catalog and can&apos;t be edited.</Text>
        </Card>
        {formError ? (
          <View className="mt-3">
            <InfoBanner tone="danger" message={formError} icon="alert-circle" />
          </View>
        ) : null}
        <SectionTitle title="Pricing & delivery" />
        <Card>
          <ServiceFormFields values={values} onChange={setValues} errors={errors} />
        </Card>
      </Screen>
    </>
  );
}
