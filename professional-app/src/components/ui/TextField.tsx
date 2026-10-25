import { forwardRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/theme-provider';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Shows a show/hide toggle and starts hidden. */
  password?: boolean;
  prefix?: string;
  containerClassName?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, password, prefix, containerClassName = '', multiline, editable = true, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const border = error ? 'border-danger' : focused ? 'border-primary' : 'border-border';
  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label ? <Text className="mb-1.5 text-sm font-semibold text-text-heading">{label}</Text> : null}
      <View
        className={`flex-row items-center rounded-2xl border px-3.5 ${multiline ? 'min-h-[112px] items-start py-2' : 'min-h-[52px]'} ${border} ${
          editable ? 'bg-card' : 'bg-muted'
        }`}
      >
        {prefix ? <Text className="mr-1 text-base text-text-body">{prefix}</Text> : null}
        <TextInput
          ref={ref}
          className="flex-1 py-2 text-base text-text-heading"
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          secureTextEntry={password ? hidden : undefined}
          autoCapitalize={password ? 'none' : rest.autoCapitalize}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          editable={editable}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {password ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            className="ml-2 p-1"
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.body} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View className="mt-1.5 flex-row items-start">
          <Ionicons name="alert-circle" size={14} color={colors.danger} style={{ marginRight: 4, marginTop: 1 }} />
          <Text className="flex-1 text-xs font-medium text-danger-ink" accessibilityLiveRegion="polite">
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text className="mt-1.5 text-xs text-text-body">{hint}</Text>
      ) : null}
    </View>
  );
});
