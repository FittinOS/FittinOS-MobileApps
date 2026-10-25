import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Shown instead of the map whenever isMapsConfigured() is false — mirrors
 * apps/web/components/tracking/LiveTrackingMap.tsx's own "map unavailable"
 * placeholder. Deliberately kept in its own file with no dependency on
 * `react-native-maps`, so it can always be rendered safely even on a build
 * that hasn't linked the native map module yet (see
 * src/features/tracking/maps-config.ts and the tracking screen).
 */
export function MapUnavailablePlaceholder({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="map-outline" size={28} color="#9CA3AF" />
      <Text style={styles.text}>Interactive map isn&apos;t available right now.</Text>
      <Text style={styles.subtext}>Location details are still shown below.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(228,87,46,0.06)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(228,87,46,0.2)',
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  subtext: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
