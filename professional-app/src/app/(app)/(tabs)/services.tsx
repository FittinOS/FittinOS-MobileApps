import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { ServiceDto } from '@/api/shared';
import { servicesApi } from '@/api/endpoints';
import { qk, useInvalidate, useServices } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, LoadingCards, StatTile, ThemedRefreshControl } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { formatDate, formatDuration, formatMoney, humanize } from '@/lib/format';
import { serviceStatus } from '@/lib/status';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

export default function ServicesScreen() {
  const services = useServices();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [toDelete, setToDelete] = useState<ServiceDto | null>(null);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'PAUSED' }) => servicesApi.update(id, { status }),
    onSuccess: (_d, v) => {
      toast.show(v.status === 'ACTIVE' ? 'Service is active.' : 'Service paused.');
      void invalidate(qk.services, qk.profile);
    },
    onError: (err) => toast.show(extractErrorMessage(err, 'Could not update the service.'), 'error'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: () => {
      setToDelete(null);
      toast.show('Service removed.');
      void invalidate(qk.services, qk.profile);
    },
    onError: (err) => {
      setToDelete(null);
      toast.show(extractErrorMessage(err, 'Could not remove the service.'), 'error');
    },
  });

  const items = services.data?.items ?? [];
  const active = items.filter((s) => s.status === 'ACTIVE').length;
  const paused = items.filter((s) => s.status !== 'ACTIVE').length;

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Services" subtitle="What clients can book, and at what price" />
      {services.isPending ? (
        <View className="px-4 pt-4">
          <LoadingCards count={3} label="Loading services" />
        </View>
      ) : services.isError ? (
        <ErrorState error={services.error} onRetry={() => void services.refetch()} />
      ) : (
        <FlatList
          className="flex-1"
          data={items}
          keyExtractor={(s) => s.id}
          contentContainerClassName="px-4 pb-8 pt-4"
          ItemSeparatorComponent={() => <View className="h-3" />}
          refreshControl={<ThemedRefreshControl refreshing={services.isRefetching} onRefresh={() => void services.refetch()} />}
          ListHeaderComponent={
            items.length > 0 ? (
              <View className="mb-4">
                <View className="flex-row gap-3">
                  <StatTile label="Active" value={String(active)} icon="checkmark-circle-outline" tone="success" />
                  <StatTile label="Paused / other" value={String(paused)} icon="pause-circle-outline" tone="neutral" />
                  <StatTile label="Total" value={String(services.data.total)} icon="briefcase-outline" tone="primary" />
                </View>
                <View className="mt-3">
                  <Button title="Add a service" icon="add" onPress={() => router.push('/services/create')} />
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="briefcase-outline"
              title="No services yet"
              message="Add a service from the catalog and set your own price and duration."
              actionLabel="Add a service"
              onAction={() => router.push('/services/create')}
            />
          }
          renderItem={({ item }) => (
            <ServiceCard
              service={item}
              busy={setStatus.isPending && setStatus.variables?.id === item.id}
              onToggle={() => setStatus.mutate({ id: item.id, status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
              onRemove={() => setToDelete(item)}
            />
          )}
        />
      )}
      <ConfirmDialog
        visible={!!toDelete}
        title="Remove this service?"
        message={`"${toDelete?.title ?? ''}" will be archived and no longer bookable. Existing bookings are not affected.`}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </View>
  );
}

function ServiceCard({ service, busy, onToggle, onRemove }: { service: ServiceDto; busy: boolean; onToggle: () => void; onRemove: () => void }) {
  const { colors } = useTheme();
  const s = serviceStatus(service.status);
  const isActive = service.status === 'ACTIVE';
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-card">
      <Pressable
        onPress={() => router.push(`/services/${service.id}`)}
        className="p-4 active:bg-muted"
        accessibilityRole="button"
        accessibilityLabel={`${service.title}, ${formatMoney(service.priceAmount)}, ${s.label}. Edit service`}
      >
        <View className="flex-row items-start justify-between">
          <Text className="mr-2 flex-1 text-base font-bold text-text-heading">{service.title}</Text>
          <Badge label={s.label} tone={s.tone} dot />
        </View>
        {service.description ? (
          <Text className="mt-1 text-sm leading-5 text-text-body" numberOfLines={2}>
            {service.description}
          </Text>
        ) : null}
        <View className="mt-3 flex-row items-end justify-between">
          <View>
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-body">Price</Text>
            <Text className="text-xl font-bold tracking-tight text-text-heading">{formatMoney(service.priceAmount)}</Text>
          </View>
          <View className="flex-row gap-2">
            <Meta icon="time-outline" text={formatDuration(service.durationMinutes)} color={colors.body} />
            <Meta icon="laptop-outline" text={humanize(service.mode)} color={colors.body} />
          </View>
        </View>
        {service.isFeatured && service.featuredUntil ? (
          <View className="mt-3">
            <Badge label={`Featured until ${formatDate(service.featuredUntil)}`} tone="primary" />
          </View>
        ) : null}
      </Pressable>
      <View className="flex-row items-center gap-2 border-t border-border px-3 py-2.5">
        <View className="flex-1">
          <Button title={isActive ? 'Pause' : 'Activate'} size="sm" variant={isActive ? 'outline' : 'soft'} loading={busy} onPress={onToggle} />
        </View>
        <View className="flex-1">
          <Button title="Edit" size="sm" variant="outline" icon="create-outline" onPress={() => router.push(`/services/${service.id}`)} />
        </View>
        <Pressable
          onPress={onRemove}
          className="h-[42px] w-[42px] items-center justify-center rounded-2xl bg-danger-soft active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={`Remove ${service.title}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

function Meta({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string }) {
  return (
    <View className="flex-row items-center rounded-full bg-muted px-2.5 py-1">
      <Ionicons name={icon} size={13} color={color} />
      <Text className="ml-1 text-xs font-medium text-text-heading">{text}</Text>
    </View>
  );
}
