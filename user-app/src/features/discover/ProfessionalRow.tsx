import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ProfessionalProfileDto } from '@/api/shared';
import { Avatar, BentoCard } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';

/**
 * One professional, full-width: avatar, name, headline/specialization, rating,
 * city/area and — only when the backend actually computed it (a location was
 * applied to the request) — real distance. Shared between Discover's results
 * list and Home's "Nearby professionals" section so both ever show the exact
 * same real fields, never a second, slightly different rendering of the same data.
 */
export function ProfessionalRow({ professional: p, className = '' }: { professional: ProfessionalProfileDto; className?: string }) {
  const { colors } = useTheme();
  return (
    <BentoCard
      layout="block"
      className={className}
      onPress={() => router.push(`/(app)/professional/${p.id}`)}
      accessibilityLabel={p.user.fullName}
    >
      <View className="flex-row items-center">
        <Avatar name={p.user.fullName} uri={p.user.avatarUrl} size={52} />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Text className="flex-1 text-[15px] font-bold text-text-heading" numberOfLines={1}>
              {p.user.fullName}
            </Text>
            {p.kycStatus === 'APPROVED' ? <Ionicons name="checkmark-circle" size={15} color={colors.success} /> : null}
          </View>
          <Text className="text-xs text-text-body" numberOfLines={1}>
            {p.headline || p.specializations.slice(0, 2).join(', ') || 'Professional'}
          </Text>
          <View className="mt-1 flex-row items-center">
            <Ionicons name="star" size={12} color={colors.warning} />
            <Text className="ml-1 text-xs font-semibold text-text-heading">
              {p.ratingAverage != null ? p.ratingAverage.toFixed(1) : 'New'}
            </Text>
            {p.ratingCount ? <Text className="ml-1 text-xs text-text-muted">({p.ratingCount})</Text> : null}
            {p.city ? (
              <>
                <Text className="mx-1.5 text-xs text-text-muted">·</Text>
                <Text className="text-xs text-text-body" numberOfLines={1}>
                  {p.area ? `${p.area}, ${p.city}` : p.city}
                </Text>
              </>
            ) : null}
            {/* Only shown when the backend actually computed it (a location was applied) — never estimated client-side. */}
            {p.distanceKm != null ? (
              <>
                <Text className="mx-1.5 text-xs text-text-muted">·</Text>
                <Text className="text-xs text-text-body">{p.distanceKm < 1 ? '<1 km' : `${p.distanceKm.toFixed(1)} km`}</Text>
              </>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </BentoCard>
  );
}
