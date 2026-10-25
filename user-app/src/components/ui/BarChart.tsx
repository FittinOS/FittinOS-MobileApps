import { Text, View } from 'react-native';

/**
 * Minimal vertical bar chart drawn with Views (no native charting module, so
 * it works in Expo Go). The last bar is highlighted. Values are relative, and
 * every bar carries an accessible label with its real value.
 */
export function BarChart({
  data,
  formatValue,
  height = 120,
  label,
}: {
  data: Array<{ key: string; label: string; value: number }>;
  formatValue: (value: number) => string;
  height?: number;
  label?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  return (
    <View accessibilityLabel={label}>
      <View className="flex-row items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const last = i === data.length - 1;
          const h = max > 0 ? Math.max(4, Math.round((d.value / max) * height)) : 4;
          return (
            <View
              key={d.key}
              className="flex-1 items-center justify-end"
              accessible
              accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
              style={{ height }}
            >
              <View className={`w-full rounded-t-lg ${last ? 'bg-primary' : d.value > 0 ? 'bg-text-muted' : 'bg-muted'}`} style={{ height: h }} />
            </View>
          );
        })}
      </View>
      <View className="mt-2 flex-row gap-2">
        {data.map((d, i) => (
          <Text key={d.key} className={`flex-1 text-center text-[11px] ${i === data.length - 1 ? 'font-bold text-text-heading' : 'text-text-body'}`}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
