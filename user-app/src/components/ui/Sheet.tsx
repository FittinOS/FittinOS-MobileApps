import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAndroidKeyboardInset } from '@/lib/keyboard';
import { useTheme } from '@/theme/theme-provider';
import { Button } from './Button';

/** Bottom sheet for secondary forms (respond to a lead, report a no-show, …). */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const keyboard = useAndroidKeyboardInset();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="flex-1" style={{ backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Close" />
        <View className="max-h-[88%] rounded-t-[28px] border-t border-border bg-card" style={{ paddingBottom: keyboard > 0 ? keyboard + 12 : Math.max(insets.bottom, 12) }}>
          <View className="items-center pt-2.5">
            <View className="h-1 w-10 rounded-full bg-border" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
            <Text className="flex-1 text-lg font-bold tracking-tight text-text-heading" accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-9 w-9 items-center justify-center rounded-full bg-muted"
            >
              <Ionicons name="close" size={20} color={colors.heading} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="px-5 pt-3" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Confirmation dialog for destructive or money-moving actions. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading,
  onConfirm,
  onCancel,
  children,
  singleAction,
}: {
  /** Menu-style dialog: only one (neutral) button that closes it; actions live in `children`. */
  singleAction?: boolean;
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const keyboard = useAndroidKeyboardInset();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 items-center justify-center px-6 py-6" style={{ backgroundColor: colors.overlay, paddingBottom: keyboard + 24 }}>
          <View className="max-h-full w-full max-w-[420px] rounded-[28px] border border-border bg-card p-5" accessibilityViewIsModal>
            {/* Body scrolls when space is short (keyboard open, small phone); the buttons stay pinned. */}
            <ScrollView className="shrink" bounces={false} keyboardShouldPersistTaps="handled">
              <Text className="text-lg font-bold tracking-tight text-text-heading" accessibilityRole="header">
                {title}
              </Text>
              {message ? <Text className="mt-2 text-sm leading-5 text-text-body">{message}</Text> : null}
              {children ? <View className="mt-4">{children}</View> : null}
            </ScrollView>
            {singleAction ? (
              <View className="mt-5">
                <Button title={confirmLabel} variant="outline" onPress={onConfirm} />
              </View>
            ) : (
              <View className="mt-5 flex-row gap-3">
                <View className="flex-1">
                  <Button title={cancelLabel} variant="outline" onPress={onCancel} disabled={loading} />
                </View>
                <View className="flex-1">
                  <Button title={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} loading={loading} />
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
