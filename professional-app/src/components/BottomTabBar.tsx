import { useEffect, useState, type ComponentProps } from 'react';
import { Keyboard, Platform, Pressable, Text, View } from 'react-native';
import type { Tabs } from 'expo-router';
import { useTheme } from '@/theme/theme-provider';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * The app's persistent bottom navigation: five equal tabs, active tab in the
 * brand orange on a soft pill, inactive tabs muted. Respects the bottom safe
 * area and hides while the keyboard is open so it never covers a form.
 */
export function BottomTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const { colors } = useTheme();
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;

  return (
    <View
      className="flex-row rounded-t-[28px] border-t border-border bg-card px-2 pt-2.5"
      style={{
        paddingBottom: Math.max(insets.bottom, 10),
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
        elevation: 12,
      }}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const color = focused ? colors.onPrimary : colors.body;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            testID={options.tabBarButtonTestID}
            className="min-h-[56px] flex-1 justify-center"
          >
            {/* Active tab: filled pill in the accessible action orange (white text 4.8:1).
                Drawn as its own rounded layer, created only while focused: Android ignored the
                corner radius when the background was toggled on a persistent view (square box). */}
            <View className="items-center justify-center" style={{ height: 54, marginHorizontal: 3 }}>
              {focused ? (
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 18, backgroundColor: colors.action }}
                />
              ) : null}
              {options.tabBarIcon?.({ focused, color, size: 21 })}
              <Text
                className={`mt-0.5 text-[11px] ${focused ? 'font-bold text-white' : 'font-medium text-text-body'}`}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Android resizes the window for the keyboard, which would lift the bar onto it.
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}
