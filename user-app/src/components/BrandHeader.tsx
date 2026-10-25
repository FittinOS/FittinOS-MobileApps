import { Image, Text, View } from 'react-native';

const brandMark = require('../../assets/brand-mark.png');

/** "FittinOS" lockup for the signed-out screens. */
export function BrandHeader({ align = 'start' }: { align?: 'start' | 'center' }) {
  return (
    <View className={`flex-row items-center ${align === 'center' ? 'justify-center' : ''}`} accessibilityRole="header" accessibilityLabel="FittinOS">
      <View className="h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white">
        <Image source={brandMark} style={{ width: 30, height: 30 }} />
      </View>
      <View className="ml-2.5">
        <Text className="text-xl font-bold leading-6 tracking-tight text-text-heading">FittinOS</Text>
      </View>
    </View>
  );
}
