import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useLocationSearch } from '@/api/queries';
import { locationsApi, type LocationSuggestion } from '@/api/endpoints';
import { Button, EmptyState, ErrorState, InfoBanner, Sheet, Spinner, TextField } from '@/components/ui';
import { getErrorPresentation } from '@/lib/errors';
import { validatePincode } from '@/lib/validation';
import { useTheme } from '@/theme/theme-provider';
import { locationFromCoordinates, locationFromGeocode, type SelectedLocation } from './location-state';

interface Props {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation | null) => void;
}

/**
 * The location bar at the top of Discover: shows the selected area, a
 * "Use current location" action (GPS, foreground permission only), and a
 * PIN-code search sheet backed by the existing /locations endpoints (the
 * same Google Places search + geocode already used server-side — no new
 * backend capability, no invented endpoint).
 */
export function LocationSelector({ value, onChange }: Props) {
  const { colors } = useTheme();
  const [requestingGps, setRequestingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | undefined>();
  const [sheetVisible, setSheetVisible] = useState(false);

  async function handleUseCurrentLocation() {
    if (requestingGps) return; // no duplicate submissions while one request is in flight
    setGpsError(undefined);
    setRequestingGps(true);
    try {
      // Check the current status first — a permanently-denied permission must
      // never be asked for again; requesting again would just silently no-op
      // on Android and needlessly interrupt the user on iOS.
      const current = await Location.getForegroundPermissionsAsync();
      let { status, canAskAgain } = current;
      if (status !== 'granted' && canAskAgain) {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
        canAskAgain = requested.canAskAgain;
      }
      if (status !== 'granted') {
        setGpsError(
          canAskAgain
            ? 'Location permission was not granted. You can try again, or search by PIN code instead.'
            : 'Location permission is blocked for FittinOS. Enable it in your device settings, or search by PIN code instead.',
        );
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setGpsError('Turn on device location (GPS) and try again, or search by PIN code instead.');
        return;
      }

      let position: Location.LocationObject;
      try {
        position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        // A genuine GPS-layer failure (no fix, timeout) — expo-location gives no
        // richer discriminated reason than this, so a focused message is honest here.
        setGpsError("We couldn't get a GPS fix. Please try again, or search by PIN code instead.");
        return;
      }

      try {
        const geocoded = await locationsApi.geocode({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        onChange(locationFromGeocode(geocoded));
      } catch (error) {
        // The GPS fix itself succeeded — only the backend's reverse-geocode call (the
        // area-name lookup) failed. The professional-search API accepts lat/lng entirely
        // independently of a resolved address (see location-state.ts), so the fix is
        // still useful: fall back to searching by raw coordinates under a truthful,
        // generic label rather than leaving the user with nothing. The banner explains
        // why the label just says "Current location" instead of a real area name.
        onChange(locationFromCoordinates(position.coords.latitude, position.coords.longitude));
        const { description } = getErrorPresentation(error);
        setGpsError(`${description} Showing results near your current location — you can also search by PIN code.`);
      }
    } finally {
      setRequestingGps(false);
    }
  }

  return (
    <View className="px-4 pt-3">
      <View className="flex-row items-center rounded-2xl border border-border bg-card p-3">
        <Ionicons name="location" size={18} color={colors.primary} />
        <View className="ml-2.5 flex-1">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Searching near</Text>
          <Text className="text-[15px] font-semibold text-text-heading" numberOfLines={1}>
            {value ? value.label : 'All locations'}
          </Text>
        </View>
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={10}
            className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-muted"
            accessibilityRole="button"
            accessibilityLabel="Clear selected location"
          >
            <Ionicons name="close" size={16} color={colors.heading} />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-2.5 flex-row gap-2.5">
        <Pressable
          onPress={() => void handleUseCurrentLocation()}
          disabled={requestingGps}
          className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card py-2.5"
          accessibilityRole="button"
          accessibilityLabel="Use current location"
          accessibilityState={{ disabled: requestingGps, busy: requestingGps }}
        >
          {requestingGps ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="navigate" size={15} color={colors.primary} />
          )}
          <Text className="ml-1.5 text-[13px] font-semibold text-text-heading">
            {requestingGps ? 'Locating…' : 'Use current location'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSheetVisible(true)}
          className="flex-1 flex-row items-center justify-center rounded-xl border border-border bg-card py-2.5"
          accessibilityRole="button"
          accessibilityLabel="Search by PIN code"
        >
          <Ionicons name="keypad-outline" size={15} color={colors.primary} />
          <Text className="ml-1.5 text-[13px] font-semibold text-text-heading">PIN code</Text>
        </Pressable>
      </View>

      {/* Explains why location is needed, visible before any permission is ever requested. */}
      <Text className="mt-1.5 text-[11px] leading-4 text-text-muted">
        We only use your location to show professionals near you — it is never shared or stored beyond this search.
      </Text>

      {gpsError ? (
        <View className="mt-2">
          <InfoBanner tone="warning" message={gpsError} icon="warning-outline" />
        </View>
      ) : null}

      <PincodeSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onResolved={(location) => {
          onChange(location);
          setSheetVisible(false);
        }}
      />
    </View>
  );
}

function PincodeSheet({
  visible,
  onClose,
  onResolved,
}: {
  visible: boolean;
  onClose: () => void;
  onResolved: (location: SelectedLocation) => void;
}) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | undefined>();
  const [appliedQuery, setAppliedQuery] = useState('');
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | undefined>();

  const suggestions = useLocationSearch(appliedQuery, visible && appliedQuery.length === 6);

  function handleApply() {
    const error = validatePincode(pin);
    setPinError(error);
    setResolveError(undefined);
    if (error) return; // never sent to the API until this passes
    setAppliedQuery(pin.trim());
  }

  async function handleSelect(suggestion: LocationSuggestion) {
    if (resolvingPlaceId) return; // one resolution in flight at a time
    setResolvingPlaceId(suggestion.placeId);
    setResolveError(undefined);
    try {
      const geocoded = await locationsApi.geocode({ placeId: suggestion.placeId });
      onResolved(locationFromGeocode(geocoded));
      setPin('');
      setAppliedQuery('');
    } catch {
      setResolveError("Couldn't resolve that location. Please try again.");
    } finally {
      setResolvingPlaceId(null);
    }
  }

  return (
    <Sheet visible={visible} title="Search by PIN code" onClose={onClose}>
      <TextField
        label="6-digit PIN code"
        value={pin}
        onChangeText={(v) => {
          setPin(v);
          setPinError(undefined);
        }}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="e.g. 560038"
        error={pinError}
        accessibilityLabel="PIN code"
      />
      <Button title="Search" onPress={handleApply} disabled={pin.trim().length === 0} />

      <View className="mt-4">
        {resolveError ? <InfoBanner tone="danger" message={resolveError} icon="alert-circle-outline" /> : null}

        {!appliedQuery ? null : suggestions.isPending ? (
          <View className="items-center py-6">
            <Spinner />
          </View>
        ) : suggestions.isError ? (
          <ErrorState compact error={suggestions.error} onRetry={() => void suggestions.refetch()} />
        ) : (suggestions.data?.length ?? 0) === 0 ? (
          <EmptyState compact icon="location-outline" title="No matching area" message="We couldn't find an area for this PIN code. Check the digits and try again." />
        ) : (
          <View className="gap-2">
            {suggestions.data!.map((item) => (
              <Pressable
                key={item.placeId}
                onPress={() => void handleSelect(item)}
                disabled={!!resolvingPlaceId}
                className="flex-row items-center rounded-2xl border border-border bg-card p-3.5 active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel={item.description}
              >
                <Ionicons name="location-outline" size={18} color="#FF5500" />
                <Text className="ml-2.5 flex-1 text-[14px] text-text-heading" numberOfLines={2}>
                  {item.description}
                </Text>
                {resolvingPlaceId === item.placeId ? <ActivityIndicator size="small" color="#FF5500" /> : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Sheet>
  );
}
