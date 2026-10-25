import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IconName } from '@/components/ui';
import { useTheme, type ThemePreference } from '@/theme/theme-provider';

const APPEARANCE: Array<{ key: ThemePreference; label: string; icon: IconName }> = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

/** Light / dark / follow-the-phone choice (the header toggle flips light ↔ dark). */
export function AppearancePicker() {
  const { preference, setPreference, colors } = useTheme();
  return (
    <View className="flex-row gap-2" accessibilityRole="radiogroup">
      {APPEARANCE.map((o) => {
        const active = preference === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => setPreference(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${o.label} theme`}
            className={`min-h-[72px] flex-1 items-center justify-center rounded-2xl border ${active ? 'border-primary bg-primary-soft' : 'border-border bg-card active:bg-muted'}`}
          >
            <Ionicons name={o.icon} size={20} color={active ? colors.primaryInk : colors.body} />
            <Text className={`mt-1 text-sm font-semibold ${active ? 'text-primary-ink' : 'text-text-heading'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

