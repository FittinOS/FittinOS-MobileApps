import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LeadDto } from '@/api/shared';
import { formatMoney, humanize } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

/** The requirement facts a professional sees for a lead (no client contact details — those unlock later). */
export function LeadMeta({ lead, compact }: { lead: LeadDto; compact?: boolean }) {
  const items: Array<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = [
    { icon: 'cash-outline', text: lead.budgetAmount != null ? `Budget ${formatMoney(lead.budgetAmount)} / session` : 'No budget given' },
    { icon: 'laptop-outline', text: humanize(lead.mode) },
    ...(lead.location ? [{ icon: 'location-outline' as const, text: lead.location }] : []),
    ...(lead.preferredTime ? [{ icon: 'time-outline' as const, text: lead.preferredTime }] : []),
    { icon: 'people-outline', text: `${lead.responseCount} ${lead.responseCount === 1 ? 'response' : 'responses'} so far` },
  ];
  return (
    <View className={compact ? 'flex-row flex-wrap gap-2' : 'gap-2.5'}>
      {items.map((m) => (
        <Meta key={m.icon} icon={m.icon} text={m.text} chip={compact} />
      ))}
    </View>
  );
}

function Meta({ icon, text, chip }: { icon: keyof typeof Ionicons.glyphMap; text: string; chip?: boolean }) {
  const { colors } = useTheme();
  if (chip) {
    return (
      <View className="flex-row items-center rounded-full bg-muted px-2.5 py-1">
        <Ionicons name={icon} size={13} color={colors.body} />
        <Text className="ml-1 text-xs font-medium text-text-heading">{text}</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-muted">
        <Ionicons name={icon} size={17} color={colors.body} />
      </View>
      <Text className="flex-1 text-sm text-text-heading">{text}</Text>
    </View>
  );
}
