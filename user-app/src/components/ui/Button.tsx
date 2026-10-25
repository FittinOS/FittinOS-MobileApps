import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/theme-provider';
import type { Palette } from '@/theme/tokens';

/**
 * Button hierarchy: one `primary` per view for the main action, `outline` /
 * `soft` for secondary actions, `ghost` for tertiary, `danger` for
 * destructive confirmation.
 *
 * Contrast (WCAG AA, both themes): primary uses the `action` orange (#CC4400,
 * white 4.8:1; pressed #B33B00, 6.0:1) rather than the #FF5500 brand accent
 * (3.2:1). Disabled buttons switch to a neutral fill with body-colour text
 * (≥ 5.2:1) instead of fading the label, so they stay legible.
 */
type Variant = 'primary' | 'secondary' | 'outline' | 'soft' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

const container: Record<Variant, string> = {
  primary: 'bg-action active:bg-action-pressed',
  secondary: 'bg-secondary active:opacity-90',
  outline: 'bg-card border border-border active:bg-muted',
  soft: 'bg-primary-soft active:opacity-80',
  ghost: 'bg-transparent active:bg-muted',
  danger: 'bg-danger active:opacity-90',
};
const label: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-text-heading',
  soft: 'text-primary-ink',
  ghost: 'text-primary-ink',
  danger: 'text-white',
};
const disabledContainer: Record<Variant, string> = {
  primary: 'bg-muted',
  secondary: 'bg-muted',
  outline: 'bg-muted border border-border',
  soft: 'bg-muted',
  ghost: 'bg-transparent',
  danger: 'bg-muted',
};

function contentColor(variant: Variant, colors: Palette): string {
  switch (variant) {
    case 'outline':
      return colors.heading;
    case 'soft':
    case 'ghost':
      return colors.primaryInk;
    default:
      return colors.onPrimary;
  }
}

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  fullWidth = true,
  className = '',
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  // Loading keeps the variant's colours (with a spinner); only a real disabled state goes neutral.
  const inactive = !!disabled && !loading;
  const tint = inactive ? colors.body : contentColor(variant, colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      accessibilityLabel={title}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center rounded-2xl px-4 py-2 ${size === 'sm' ? 'min-h-[42px]' : 'min-h-[52px]'} ${
        fullWidth ? 'w-full' : 'self-start'
      } ${inactive ? disabledContainer[variant] : container[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={tint} />
      ) : (
        // Icon glyph inline in the label's Text: one text node is measured once, so the
        // label can't be clipped by a separately measured icon on dense/narrow screens.
        <Text
          className={`text-center font-bold ${size === 'sm' ? 'text-sm' : 'text-base'} ${inactive ? 'text-text-body' : label[variant]}`}
          numberOfLines={2}
        >
          {icon ? (
            <>
              <Ionicons name={icon} size={size === 'sm' ? 15 : 17} color={tint} />
              {'  '}
            </>
          ) : null}
          {title}
        </Text>
      )}
    </Pressable>
  );
}
