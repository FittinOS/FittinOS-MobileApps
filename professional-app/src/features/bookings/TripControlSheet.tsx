import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { bookingsApi } from '@/api/endpoints';
import { qk, useInvalidate } from '@/api/queries';
import type { TripVehicleInput } from '@/api/types';
import { Badge, Button, InfoBanner, Sheet, Spinner, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

/** Matches the web: a real GPS fix every 10 s while this sheet is open and the trip is live. */
const LOCATION_UPDATE_INTERVAL_MS = 10_000;

const VEHICLES: Array<{ type: TripVehicleInput['vehicleType']; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { type: 'CAR', label: 'Car', icon: 'car-outline' },
  { type: 'BIKE', label: 'Bike', icon: 'bicycle-outline' },
  { type: 'SCOOTER', label: 'Scooter', icon: 'bicycle-outline' },
  { type: 'AUTO', label: 'Auto', icon: 'car-sport-outline' },
  { type: 'OTHER', label: 'Other', icon: 'bus-outline' },
];

const emptyVehicle: TripVehicleInput = { vehicleType: 'CAR', vehicleModel: '', vehicleColor: '' };

async function currentFix(): Promise<Location.LocationObject> {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}

/**
 * Booking-day live tracking (professional side). Location permission is
 * requested only when the professional starts a trip; fixes are sent only
 * while this sheet is open — the same foreground-only model as the web.
 */
export function TripControlSheet({
  visible,
  onClose,
  bookingId,
  clientName,
  startTime,
}: {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  clientName: string;
  startTime: string;
}) {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const tracking = useQuery({
    queryKey: qk.tracking(bookingId),
    queryFn: () => bookingsApi.tracking(bookingId),
    enabled: visible,
    refetchInterval: visible ? 8000 : false,
  });
  const [step, setStep] = useState<'summary' | 'vehicle' | 'updateVehicle'>('summary');
  const [vehicle, setVehicle] = useState<TripVehicleInput>(emptyVehicle);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const eligibility = tracking.data?.eligibility;
  const isLive = eligibility === 'LIVE' || eligibility === 'STALE';

  const sendLocation = useMutation({
    mutationFn: (fix: Location.LocationObject) =>
      bookingsApi.updateTripLocation(bookingId, {
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracyMeters: fix.coords.accuracy ?? undefined,
      }),
  });

  useEffect(() => {
    if (!visible || !isLive) return;
    let cancelled = false;
    const tick = async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted || cancelled) return;
      try {
        sendLocation.mutate(await currentFix());
      } catch {
        // A single missed fix isn't fatal — the next tick retries.
      }
    };
    void tick();
    timer.current = setInterval(() => void tick(), LOCATION_UPDATE_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isLive, bookingId]);

  useEffect(() => {
    if (!visible) {
      setStep('summary');
      setVehicle(emptyVehicle);
      setError(null);
      setPermissionDenied(false);
    }
  }, [visible]);

  const refresh = () => invalidate(qk.tracking(bookingId), qk.booking(bookingId));

  const start = useMutation({
    mutationFn: async () => {
      setError(null);
      setPermissionDenied(false);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setPermissionDenied(true);
        throw new Error('Location permission is needed to share your trip with the client.');
      }
      setLocating(true);
      try {
        const fix = await currentFix();
        return await bookingsApi.startTrip(bookingId, {
          ...cleanVehicle(vehicle),
          latitude: fix.coords.latitude,
          longitude: fix.coords.longitude,
          accuracyMeters: fix.coords.accuracy ?? undefined,
        });
      } finally {
        setLocating(false);
      }
    },
    onSuccess: () => {
      setStep('summary');
      void refresh();
    },
    onError: (err) => setError(extractErrorMessage(err, 'Could not start the trip.')),
  });

  const updateVehicle = useMutation({
    mutationFn: () => bookingsApi.updateTripVehicle(bookingId, cleanVehicle(vehicle)),
    onSuccess: () => {
      setStep('summary');
      void refresh();
    },
    onError: (err) => setError(extractErrorMessage(err, 'Could not update the vehicle.')),
  });

  const stop = useMutation({
    mutationFn: () => bookingsApi.stopTrip(bookingId),
    onSuccess: () => void refresh(),
    onError: (err) => setError(extractErrorMessage(err, 'Could not stop sharing your location.')),
  });

  const vehicleForm = (
    <View>
      <Text className="mb-3 text-sm text-text-body">Select the vehicle you&apos;re actually using for this trip right now.</Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {VEHICLES.map((option) => {
          const selected = vehicle.vehicleType === option.type;
          return (
            <Pressable
              key={option.type}
              onPress={() => setVehicle((v) => ({ ...v, vehicleType: option.type }))}
              className={`min-h-[64px] w-[30%] grow items-center justify-center rounded-xl border ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
            >
              <Ionicons name={option.icon} size={22} color={selected ? colors.primary : colors.body} />
              <Text className={`mt-1 text-xs font-medium ${selected ? 'text-primary-ink' : 'text-text-body'}`}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextField label="Model (optional)" value={vehicle.vehicleModel ?? ''} onChangeText={(t) => setVehicle((v) => ({ ...v, vehicleModel: t }))} maxLength={60} />
      <TextField label="Colour (optional)" value={vehicle.vehicleColor ?? ''} onChangeText={(t) => setVehicle((v) => ({ ...v, vehicleColor: t }))} maxLength={30} />
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Booking-day tracking">
      <View className="mb-4 rounded-xl bg-background p-3">
        <Text className="font-semibold text-text-heading">{clientName}</Text>
        <Text className="text-sm text-text-body">{formatDateTime(startTime)}</Text>
      </View>
      {error ? (
        <View className="mb-3">
          <InfoBanner tone="danger" message={error} icon="alert-circle" />
        </View>
      ) : null}
      {permissionDenied ? (
        <View className="mb-3">
          <InfoBanner
            tone="warning"
            message="Location access was denied. Allow location for FittinOS Pro in your phone settings to share your trip."
          />
        </View>
      ) : null}

      {step === 'vehicle' ? (
        <>
          {vehicleForm}
          <Button title={locating ? 'Getting your location…' : 'Start live tracking'} onPress={() => start.mutate()} loading={start.isPending} icon="navigate" />
          <View className="mt-2">
            <Button title="Back" variant="ghost" onPress={() => setStep('summary')} />
          </View>
        </>
      ) : step === 'updateVehicle' ? (
        <>
          {vehicleForm}
          <Button title="Save vehicle" onPress={() => updateVehicle.mutate()} loading={updateVehicle.isPending} />
          <View className="mt-2">
            <Button title="Back" variant="ghost" onPress={() => setStep('summary')} />
          </View>
        </>
      ) : tracking.isPending ? (
        <Spinner />
      ) : tracking.isError ? (
        <InfoBanner tone="danger" message={extractErrorMessage(tracking.error, 'Could not load tracking.')} />
      ) : eligibility === 'NOT_YET_AVAILABLE' ? (
        <View className="items-center py-4">
          <Text className="text-sm font-medium text-text-heading">Live tracking isn&apos;t available yet.</Text>
          <Text className="mt-1 text-xs text-text-body">
            {tracking.data.trackingWindowOpensAt ? `Opens ${formatDateTime(tracking.data.trackingWindowOpensAt)}.` : 'Available closer to your appointment.'}
          </Text>
        </View>
      ) : eligibility === 'COMPLETED' || eligibility === 'NO_DATA' ? (
        <View className="items-center py-4">
          <Text className="text-sm font-medium text-text-heading">Live tracking has ended for this booking.</Text>
        </View>
      ) : isLive ? (
        <View>
          <View className="mb-3 flex-row items-center justify-between">
            <Badge label={eligibility === 'STALE' ? 'Live · waiting for GPS' : 'Live tracking active'} tone={eligibility === 'STALE' ? 'warning' : 'success'} />
            <Pressable onPress={() => setStep('updateVehicle')} hitSlop={10} accessibilityRole="button">
              <Text className="text-sm font-semibold text-primary-ink">Update vehicle</Text>
            </Pressable>
          </View>
          <Text className="text-sm text-text-body">
            Vehicle: {VEHICLES.find((v) => v.type === tracking.data.vehicleType)?.label ?? 'Vehicle'}
            {tracking.data.vehicleModel ? ` · ${tracking.data.vehicleModel}` : ''}
            {tracking.data.vehicleColor ? ` · ${tracking.data.vehicleColor}` : ''}
          </Text>
          <Text className="mt-1 text-sm text-text-body">
            Last location sent: {tracking.data.locationUpdatedAt ? formatRelative(tracking.data.locationUpdatedAt) : '—'}
          </Text>
          <Text className="mt-2 text-xs text-text-body">Keep this screen open while travelling — your location is shared only while it&apos;s open.</Text>
          <View className="mt-4">
            <Button title="Stop sharing location" variant="danger" onPress={() => stop.mutate()} loading={stop.isPending} />
          </View>
        </View>
      ) : (
        <View className="py-2">
          <Text className="mb-3 text-sm text-text-body">
            {eligibility === 'STOPPED'
              ? 'Location sharing is stopped. The client can no longer see your location.'
              : 'Let your client follow your trip to the session. Your location is shared only for this booking and only while tracking is on.'}
          </Text>
          <Button
            title={eligibility === 'STOPPED' ? 'Start trip again' : 'Start trip'}
            icon="navigate"
            onPress={() => {
              setError(null);
              setVehicle(emptyVehicle);
              setStep('vehicle');
            }}
          />
        </View>
      )}
      <View className="h-4" />
    </Sheet>
  );
}

function cleanVehicle(v: TripVehicleInput): TripVehicleInput {
  return {
    vehicleType: v.vehicleType,
    ...(v.vehicleMake?.trim() ? { vehicleMake: v.vehicleMake.trim() } : {}),
    ...(v.vehicleModel?.trim() ? { vehicleModel: v.vehicleModel.trim() } : {}),
    ...(v.vehicleColor?.trim() ? { vehicleColor: v.vehicleColor.trim() } : {}),
  };
}
