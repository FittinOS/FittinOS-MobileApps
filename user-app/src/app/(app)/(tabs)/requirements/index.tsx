import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RequirementDto } from '@/api/shared';
import { useRequirements } from '@/api/queries';
import { AppHeader } from '@/components/AppHeader';
import { Badge, Button, EmptyState, ErrorState, LoadingCards } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import { requirementStatus } from '@/lib/status';
import { useTheme } from '@/theme/theme-provider';

export default function RequirementsListScreen() {
  const { colors } = useTheme();
  const requirements = useRequirements({ limit: 50 });

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Requirements" subtitle="Tell professionals what you need" />
      <View className="px-4 pt-3">
        <Button title="Post a requirement" icon="add" onPress={() => router.push('/(app)/(tabs)/requirements/create')} />
      </View>
      {requirements.isPending ? (
        <View className="px-4 pt-3">
          <LoadingCards count={3} />
        </View>
      ) : requirements.isError ? (
        <ErrorState error={requirements.error} onRetry={() => void requirements.refetch()} />
      ) : requirements.data.items.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No requirements yet"
          message="Post what you're looking for and professionals can respond with offers."
        />
      ) : (
        <FlatList
          data={requirements.data.items}
          keyExtractor={(r) => r.id}
          contentContainerClassName="px-4 pb-6 pt-3"
          renderItem={({ item: r }) => <RequirementRow requirement={r} />}
        />
      )}
    </View>
  );
}

function RequirementRow({ requirement }: { requirement: RequirementDto }) {
  const { colors } = useTheme();
  const s = requirementStatus(requirement.status);
  return (
    <Pressable
      onPress={() => router.push(`/(app)/(tabs)/requirements/${requirement.id}`)}
      className="mb-3 rounded-3xl border border-border bg-card p-4 active:bg-muted"
      accessibilityRole="button"
    >
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 text-[15px] font-bold text-text-heading" numberOfLines={1}>
          {requirement.title}
        </Text>
        <Badge label={s.label} tone={s.tone} />
      </View>
      <Text className="mt-1 text-xs text-text-body" numberOfLines={2}>
        {requirement.description}
      </Text>
      <View className="mt-2 flex-row items-center justify-between border-t border-border pt-2">
        <View className="flex-row items-center">
          <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
          <Text className="ml-1.5 text-xs text-text-body">{formatDate(requirement.createdAt)}</Text>
        </View>
        {requirement.budgetAmount ? <Text className="text-xs font-semibold text-text-heading">{formatMoney(requirement.budgetAmount)}</Text> : null}
      </View>
    </Pressable>
  );
}
