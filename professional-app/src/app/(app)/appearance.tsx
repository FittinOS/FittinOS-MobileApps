import { Text, View } from 'react-native';
import { AppearancePicker } from '@/components/AppearancePicker';
import { Badge, Button, Card, Header, Metric, ProgressBar, Screen, SectionTitle } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';

/**
 * Appearance: the theme preference (System / Light / Dark), saved on this
 * device. Font size, language and accent colour options shown in some design
 * explorations are not supported by the app, so they are not offered here.
 */
export default function AppearanceScreen() {
  const { preference, isDark } = useTheme();
  return (
    <>
      <Header title="Appearance" />
      <Screen>
        <SectionTitle title="Theme" subtitle="Saved on this device. System follows your phone's dark mode setting." />
        <AppearancePicker />
        <Text className="mt-3 text-xs text-text-body">
          {preference === 'system'
            ? `Following your phone — currently ${isDark ? 'dark' : 'light'}.`
            : `Always ${preference}, whatever your phone uses.`}
        </Text>

        <SectionTitle title="Preview" />
        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-bold text-text-heading">Sample card</Text>
            <Badge label="Active" tone="success" dot />
          </View>
          <View className="mt-3">
            <Metric value="12" caption="Body text and figures use the theme's text colours" />
          </View>
          <View className="mt-3">
            <ProgressBar value={0.6} label="Sample progress" />
          </View>
          <View className="mt-4 flex-row gap-2">
            <View className="flex-1">
              <Button title="Primary" size="sm" accessible={false} />
            </View>
            <View className="flex-1">
              <Button title="Secondary" size="sm" variant="outline" accessible={false} />
            </View>
          </View>
        </Card>
      </Screen>
    </>
  );
}
