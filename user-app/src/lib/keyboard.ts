import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard that overlaps the app, Android only.
 *
 * This app runs edge-to-edge on Android (SDK 57 / `edgeToEdgeEnabled=true`),
 * so the window is NOT resized when the keyboard opens — `adjustResize` and
 * `KeyboardAvoidingView behavior="height"` no longer lift content. Containers
 * that must stay above the keyboard (bottom sheets, dialogs, chat composers,
 * forms with a pinned footer) add this as bottom padding instead. iOS keeps
 * using `KeyboardAvoidingView behavior="padding"`, so this returns 0 there.
 */
export function useAndroidKeyboardInset(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // Measure from the keyboard's top edge to the bottom of the screen: the reported
    // height alone leaves out the gesture/navigation strip the keyboard also covers.
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setHeight(Math.max(e.endCoordinates.height, Dimensions.get('screen').height - e.endCoordinates.screenY)),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
