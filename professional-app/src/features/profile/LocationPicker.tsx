import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { locationsApi } from '@/api/endpoints';
import type { GeocodedLocation } from '@/api/types';
import { TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { useTheme } from '@/theme/theme-provider';

/**
 * Business-location search. Every Google Maps call happens on the backend
 * (/locations/search + /locations/geocode) — the app never holds a Maps key.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: { formattedAddress?: string | null; city?: string | null; area?: string | null };
  onChange: (location: GeocodedLocation) => void;
}) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const suggestions = useQuery({
    queryKey: ['locations', 'search', debounced],
    queryFn: () => locationsApi.search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const geocode = useMutation({
    mutationFn: (placeId: string) => locationsApi.geocode({ placeId }),
    onSuccess: (location) => {
      setQuery('');
      setDebounced('');
      setError(null);
      onChange(location);
    },
    onError: (err) => setError(extractErrorMessage(err, "Couldn't look up that place. Try another.")),
  });

  const current = value.formattedAddress || [value.area, value.city].filter(Boolean).join(', ');

  return (
    <View className="mb-2">
      {current ? (
        <View className="mb-2 flex-row items-center rounded-xl bg-success-soft px-3 py-2">
          <Ionicons name="location" size={16} color={colors.success} />
          <Text className="ml-2 flex-1 text-sm text-text-heading">{current}</Text>
        </View>
      ) : null}
      <TextField
        label={current ? 'Change business location' : 'Business location'}
        value={query}
        onChangeText={setQuery}
        placeholder="Search your area, e.g. Indiranagar"
        autoCorrect={false}
        hint="Clients see only your area and city — never your exact address."
        containerClassName="mb-1"
      />
      {error ? <Text className="mb-2 text-xs text-danger-ink">{error}</Text> : null}
      {suggestions.isFetching || geocode.isPending ? <ActivityIndicator color={colors.primary} className="my-2" /> : null}
      {suggestions.isError ? (
        <Text className="mb-2 text-xs text-danger-ink">{extractErrorMessage(suggestions.error, 'Location search is unavailable right now.')}</Text>
      ) : null}
      {debounced.length >= 2 && suggestions.data?.length ? (
        <View className="mb-2 overflow-hidden rounded-xl border border-border bg-card">
          {suggestions.data.slice(0, 6).map((s, i) => (
            <Pressable
              key={s.placeId}
              onPress={() => geocode.mutate(s.placeId)}
              className={`min-h-[48px] flex-row items-center px-3 py-2 active:bg-muted ${i > 0 ? 'border-t border-border' : ''}`}
              accessibilityRole="button"
            >
              <Ionicons name="location-outline" size={16} color={colors.body} />
              <Text className="ml-2 flex-1 text-sm text-text-heading">{s.description}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
