import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

/**
 * One-time-code entry shown as separate digit boxes. Underneath it is a
 * single real TextInput (transparent, covering the boxes), so paste, SMS
 * autofill (`one-time-code`) and screen readers work as with a normal field.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  error,
  label = 'Verification code',
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: string;
  label?: string;
  onSubmit?: () => void;
}) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-text-heading">{label}</Text>
      <Pressable onPress={() => ref.current?.focus()} accessible={false}>
        <View className="flex-row justify-between gap-2">
          {Array.from({ length }, (_, i) => {
            const active = focused && (i === digits.length || (i === length - 1 && digits.length === length));
            return (
              <View
                key={i}
                className={`h-14 flex-1 items-center justify-center rounded-2xl border-2 bg-card ${
                  error ? 'border-danger' : active ? 'border-primary' : digits[i] ? 'border-text-muted' : 'border-border'
                }`}
              >
                <Text className="text-2xl font-bold text-text-heading">{digits[i] ?? ''}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^0-9]/g, '').slice(0, length))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={length}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          caretHidden
          className="absolute inset-0 text-transparent"
          style={{ opacity: 0.02 }}
        />
      </Pressable>
      {error ? (
        <Text className="mt-1.5 text-xs font-medium text-danger-ink" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
