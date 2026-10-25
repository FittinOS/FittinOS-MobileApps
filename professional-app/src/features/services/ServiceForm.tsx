import { Pressable, Text, View } from 'react-native';
import { TextField } from '@/components/ui';
import { MAX_DURATION_MINUTES, MAX_PRICE_PAISE, MIN_DURATION_MINUTES } from '@/lib/validation';
import { rupeesToPaise } from '@/lib/format';

export type ServiceMode = 'IN_PERSON' | 'ONLINE' | 'HYBRID';
export const MODES: Array<{ value: ServiceMode; label: string; hint: string }> = [
  { value: 'IN_PERSON', label: 'In person', hint: 'At your location or the client’s' },
  { value: 'ONLINE', label: 'Online', hint: 'Video session' },
  { value: 'HYBRID', label: 'Hybrid', hint: 'Either, agreed with the client' },
];

export interface ServiceFormValues {
  price: string;
  duration: string;
  mode: ServiceMode;
}

/** Validates against CreateServiceDto/UpdateServiceDto limits; returns paise + minutes when valid. */
export function validateServiceForm(values: ServiceFormValues): {
  errors: { price?: string; duration?: string };
  priceAmount?: number;
  durationMinutes?: number;
} {
  const priceAmount = rupeesToPaise(values.price);
  const durationMinutes = Number(values.duration);
  const errors: { price?: string; duration?: string } = {};
  if (priceAmount === null) errors.price = 'Enter a price in rupees.';
  else if (priceAmount > MAX_PRICE_PAISE) errors.price = `Price can be at most ₹${(MAX_PRICE_PAISE / 100).toLocaleString('en-IN')}.`;
  if (!Number.isInteger(durationMinutes) || durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
    errors.duration = `Duration must be ${MIN_DURATION_MINUTES}–${MAX_DURATION_MINUTES} minutes.`;
  }
  return { errors, priceAmount: priceAmount ?? undefined, durationMinutes: errors.duration ? undefined : durationMinutes };
}

export function ServiceFormFields({
  values,
  onChange,
  errors,
}: {
  values: ServiceFormValues;
  onChange: (next: ServiceFormValues) => void;
  errors: { price?: string; duration?: string };
}) {
  return (
    <View>
      <TextField
        label="Price per session"
        prefix="₹"
        value={values.price}
        onChangeText={(price) => onChange({ ...values, price })}
        error={errors.price}
        keyboardType="decimal-pad"
        hint="What the client pays. The platform fee is deducted from this."
      />
      <TextField
        label="Duration (minutes)"
        value={values.duration}
        onChangeText={(duration) => onChange({ ...values, duration: duration.replace(/[^0-9]/g, '') })}
        error={errors.duration}
        keyboardType="number-pad"
      />
      <Text className="mb-1.5 text-sm font-medium text-text-heading">Delivery mode</Text>
      <View className="mb-4 gap-2">
        {MODES.map((m) => {
          const selected = values.mode === m.value;
          return (
            <Pressable
              key={m.value}
              onPress={() => onChange({ ...values, mode: m.value })}
              className={`min-h-[52px] justify-center rounded-xl border px-4 py-2 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-card'}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text className={`text-sm font-semibold ${selected ? 'text-primary-ink' : 'text-text-heading'}`}>{m.label}</Text>
              <Text className="text-xs text-text-body">{m.hint}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
