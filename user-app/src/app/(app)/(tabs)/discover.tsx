import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCategories, useProfessionals } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import { Chip, EmptyState, ErrorState, LoadingCards, ThemedRefreshControl } from '@/components/ui';
import { LocationSelector } from '@/features/discover/LocationSelector';
import { ProfessionalRow } from '@/features/discover/ProfessionalRow';
import { useSelectedLocation } from '@/providers/selected-location-provider';
import type { SelectedLocation } from '@/features/discover/location-state';
import { useTheme } from '@/theme/theme-provider';
import { categoryIconFor } from '@/lib/category-icons';

/** Keystrokes settle before a new search request fires — avoids one API call per character. */
const SEARCH_DEBOUNCE_MS = 350;

const PAGE_SIZE = 12;

type SortKey = 'rating' | 'experience' | 'price' | 'newest' | 'distance';

export default function DiscoverScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ category?: string }>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>(params.category);
  const [sortBy, setSortBy] = useState<SortKey>('rating');
  const [page, setPage] = useState(1);
  const { location, setLocation } = useSelectedLocation();

  // Applying a location switches to "Nearby" by default (the one sort the
  // backend can only compute once lat/lng is present); clearing it falls
  // back to the previous default rather than leaving an unusable sort key
  // selected. The user can still change the sort afterwards either way.
  function handleLocationChange(next: SelectedLocation | null) {
    setLocation(next);
    setSortBy(next ? 'distance' : 'rating');
    setPage(1);
  }

  // The input itself stays instantly responsive (controlled by `search`); only
  // the value handed to the query is debounced, so typing "yoga" fires one
  // request instead of four. The cleanup cancels a still-pending timer from a
  // previous keystroke, so an outdated value can never win a race and reach
  // the query after a newer one.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  // Discover is a tab, not a fresh screen: navigating here again from Home's
  // category cards re-renders this same instance with a new `category` param
  // rather than remounting it, so the filter must be re-applied explicitly —
  // the initial useState value alone only ever applies once.
  useEffect(() => {
    if (params.category !== undefined) {
      setCategory(params.category);
      setPage(1);
    }
  }, [params.category]);

  const categories = useCategories();
  const professionals = useProfessionals({
    search: debouncedSearch || undefined,
    category,
    sortBy,
    sortOrder: 'desc',
    page,
    limit: PAGE_SIZE,
    // Only ever sent once a real location was resolved (GPS or PIN code) —
    // the backend computes genuine Haversine distance from these, never guessed.
    lat: location?.latitude,
    lng: location?.longitude,
  });

  const items = professionals.data?.items ?? [];
  const totalPages = professionals.data ? Math.max(1, Math.ceil(professionals.data.total / PAGE_SIZE)) : 1;

  function resetAndSet<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  const sortOptions = useMemo<Array<{ key: SortKey; label: string }>>(
    () => [
      // "Nearby" only appears once a location is resolved — the backend can
      // only sort by distance when lat/lng is actually present on the request.
      ...(location ? [{ key: 'distance' as const, label: 'Nearby' }] : []),
      { key: 'rating', label: 'Top rated' },
      { key: 'experience', label: 'Experienced' },
      { key: 'price', label: 'Price' },
      { key: 'newest', label: 'Newest' },
    ],
    [location],
  );

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Discover" subtitle="Find a professional near you" />
      <LocationSelector value={location} onChange={handleLocationChange} />
      <View className="px-4 pt-3">
        <View className="flex-row items-center rounded-2xl border border-border bg-card px-3">
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={(v) => resetAndSet(setSearch, v)}
            placeholder="Search by name, specialization…"
            placeholderTextColor={colors.textMuted}
            className="ml-2 h-12 flex-1 text-[15px] text-text-heading"
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search professionals"
          />
        </View>

        {categories.data && categories.data.length > 0 ? (
          <FlatList
            data={categories.data}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c) => c.id}
            contentContainerClassName="py-3"
            renderItem={({ item }) => (
              <Chip
                label={item.name}
                icon={item.iconUrl ? undefined : categoryIconFor(item.slug)}
                selected={category === item.id}
                onPress={() => resetAndSet(setCategory, category === item.id ? undefined : item.id)}
              />
            )}
          />
        ) : null}

        <FlatList
          data={sortOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(o) => o.key}
          contentContainerClassName="pb-3"
          renderItem={({ item }) => <Chip label={item.label} selected={sortBy === item.key} onPress={() => resetAndSet(setSortBy, item.key)} />}
        />
      </View>

      {professionals.isPending ? (
        <View className="px-4">
          <LoadingCards count={4} />
        </View>
      ) : professionals.isError ? (
        <ErrorState error={professionals.error} onRetry={() => void professionals.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No professionals found"
          message={
            location
              ? `No professionals found near ${location.label}. Try a different location, search or filter.`
              : 'Try a different search, category or filter.'
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerClassName="px-4 pb-6"
          refreshControl={<ThemedRefreshControl refreshing={professionals.isRefetching} onRefresh={() => void professionals.refetch()} />}
          renderItem={({ item: p }) => <ProfessionalRow professional={p} className="mb-3" />}
          ListFooterComponent={
            professionals.data && totalPages > 1 ? (
              <View className="mt-2 flex-row items-center justify-center gap-4">
                <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)} className="p-2" accessibilityRole="button" accessibilityLabel="Previous page">
                  <Ionicons name="chevron-back-circle" size={28} color={page <= 1 ? colors.border : colors.primary} />
                </Pressable>
                <Text className="text-sm text-text-body">
                  Page {page} of {totalPages}
                </Text>
                <Pressable
                  disabled={page >= totalPages}
                  onPress={() => setPage((p) => p + 1)}
                  className="p-2"
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                >
                  <Ionicons name="chevron-forward-circle" size={28} color={page >= totalPages ? colors.border : colors.primary} />
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}
