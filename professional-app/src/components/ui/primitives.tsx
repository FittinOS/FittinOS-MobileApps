import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View, useWindowDimensions, type ViewProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { initials } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import type { Palette } from '@/theme/tokens';

export type IconName = keyof typeof Ionicons.glyphMap;
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const toneClass: Record<Tone, { bg: string; text: string; dot: string }> = {
  neutral: { bg: 'bg-muted', text: 'text-text-heading', dot: 'bg-text-muted' },
  primary: { bg: 'bg-primary-soft', text: 'text-primary-ink', dot: 'bg-primary' },
  success: { bg: 'bg-success-soft', text: 'text-success-ink', dot: 'bg-success' },
  warning: { bg: 'bg-warning-soft', text: 'text-warning-ink', dot: 'bg-warning' },
  danger: { bg: 'bg-danger-soft', text: 'text-danger-ink', dot: 'bg-danger' },
  info: { bg: 'bg-info-soft', text: 'text-info-ink', dot: 'bg-info' },
};

export function toneColor(colors: Palette, tone: Tone): string {
  switch (tone) {
    case 'primary':
      return colors.primary;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'info':
      return colors.info;
    default:
      return colors.heading;
  }
}

/** Icon colour for a tone in the active theme. */
export function useToneColor(tone: Tone): string {
  return toneColor(useTheme().colors, tone);
}

export function Card({ children, className = '', ...rest }: ViewProps & { className?: string }) {
  return (
    <View className={`rounded-3xl border border-border bg-card p-4 ${className}`} {...rest}>
      {children}
    </View>
  );
}

/**
 * Bento grid tile: a card with an optional icon + label row, body and footer,
 * that becomes a button when `onPress` is given. `emphasis="brand"` is the one
 * prominent tile of a grid: a deep surface with the orange accent (white text
 * directly on #FF5500 is only 3.2:1, too low for small labels).
 */
export function BentoCard({
  title,
  icon,
  tone = 'primary',
  onPress,
  children,
  footer,
  emphasis = 'default',
  className = '',
  bodyClassName = '',
  accessibilityLabel,
  layout = 'cell',
}: {
  layout?: 'cell' | 'block';
  title?: string;
  icon?: IconName;
  tone?: Tone;
  onPress?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  emphasis?: 'default' | 'brand';
  className?: string;
  /** Appended after the body's own `p-4`, so a caller can override one side (e.g. `pb-1`) without losing the rest. */
  bodyClassName?: string;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  // On very narrow phones the title needs the arrow's room (the whole tile is the button).
  const { width } = useWindowDimensions();
  const showArrow = !!onPress && (layout === 'block' || width >= 360);
  const brand = emphasis === 'brand';
  const body = (
    <View className={`grow rounded-3xl p-4 ${bodyClassName} ${brand ? 'bg-secondary' : 'border border-border bg-card'}`}>
      {title || icon ? (
        <View className="mb-3 flex-row items-center">
          {icon ? (
            <View className={`mr-2.5 h-9 w-9 items-center justify-center rounded-xl ${brand ? 'bg-primary' : toneClass[tone].bg}`}>
              <Ionicons name={icon} size={18} color={brand ? colors.onPrimary : toneColor(colors, tone)} />
            </View>
          ) : null}
          {title ? (
            <Text className={`flex-1 text-[13px] font-semibold leading-4 ${brand ? 'text-white/80' : 'text-text-body'}`} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {showArrow ? <Ionicons name="arrow-forward" size={16} color={brand ? colors.onPrimary : colors.textMuted} /> : null}
        </View>
      ) : null}
      <View className="grow">{children}</View>
      {footer ? <View className="mt-3">{footer}</View> : null}
    </View>
  );
  // "cell" shares a row's width with its siblings; "block" is a full-width tile in a column.
  const sizing = layout === 'cell' ? 'flex-1' : '';
  if (!onPress) return <View className={`${sizing} ${className}`}>{body}</View>;
  return (
    <Pressable className={`${sizing} active:opacity-80 ${className}`} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}>
      {body}
    </Pressable>
  );
}

/** Six concentric low-opacity circles — the brand-glow decoration behind a GlowHeroCard. */
const GLOW_CIRCLES = [560, 460, 370, 290, 220, 160].map((size, i) => ({ size, opacity: 0.035 + i * 0.008 }));

/**
 * The dark "hero" panel used for the wallet-balance card on Home and the
 * Wallet screen — `colors.hero` background, optional six-circle brand glow,
 * optional leading icon tile (solid brand color, matching BentoCard's
 * `emphasis="brand"` icon treatment). Content is fully caller-supplied via
 * `children` — this component knows nothing about wallets, coins or any
 * other specific feature.
 */
export function GlowHeroCard({
  onPress,
  accessibilityLabel,
  icon,
  children,
  footer,
  glow = true,
  className = '',
}: {
  onPress?: () => void;
  accessibilityLabel?: string;
  icon?: IconName;
  children: ReactNode;
  /** Renders full-width below the icon row (not indented under it) — for a figures row, not more prose. */
  footer?: ReactNode;
  glow?: boolean;
  className?: string;
}) {
  const { colors } = useTheme();
  const body = (
    <>
      {glow
        ? GLOW_CIRCLES.map((g) => (
            <View
              key={g.size}
              pointerEvents="none"
              className="absolute rounded-full"
              style={{
                width: g.size,
                height: g.size,
                left: -g.size / 2 + 30,
                top: -g.size / 2 + 20,
                backgroundColor: colors.primary,
                opacity: g.opacity,
              }}
            />
          ))
        : null}
      <View className="p-5">
        <View className={icon ? 'flex-row items-start' : ''}>
          {icon ? (
            <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primary }}>
              <Ionicons name={icon} size={24} color={colors.onPrimary} />
            </View>
          ) : null}
          <View className={icon ? 'ml-3 flex-1' : ''}>{children}</View>
        </View>
        {footer ? <View className="mt-5">{footer}</View> : null}
      </View>
    </>
  );
  if (!onPress) {
    return (
      <View className={`overflow-hidden rounded-[28px] ${className}`} style={{ backgroundColor: colors.hero }}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      className={`overflow-hidden rounded-[28px] active:opacity-90 ${className}`}
      style={{ backgroundColor: colors.hero }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </Pressable>
  );
}

/** Large figure for Bento tiles. */
export function Metric({ value, caption, inverse, size = 'lg' }: { value: string; caption?: string; inverse?: boolean; size?: 'lg' | 'xl' }) {
  return (
    <View>
      <Text
        className={`${size === 'xl' ? 'text-[32px] leading-[38px]' : 'text-2xl'} font-bold tracking-tight ${inverse ? 'text-white' : 'text-text-heading'}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {caption ? (
        <Text className={`mt-0.5 text-xs ${inverse ? 'text-white/80' : 'text-text-body'}`} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View className="mb-2.5 mt-6 flex-row items-end justify-between">
      <View className="mr-3 flex-1">
        <Text className="text-[17px] font-bold tracking-tight text-text-heading" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text className="mt-0.5 text-xs text-text-body">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/** Small text action for section headers ("See all"). */
export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="link" className="min-h-[32px] justify-center">
      <Text className="text-sm font-semibold text-primary-ink">{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral', dot }: { label: string; tone?: Tone; dot?: boolean }) {
  const t = toneClass[tone];
  return (
    <View className={`flex-row items-center self-start rounded-full px-2.5 py-1 ${t.bg}`}>
      {dot ? <View className={`mr-1.5 h-1.5 w-1.5 rounded-full ${t.dot}`} /> : null}
      <Text className={`text-xs font-semibold ${t.text}`}>{label}</Text>
    </View>
  );
}

/** Rounded square holding a tone-tinted icon. */
export function IconBadge({ icon, tone = 'neutral', size = 36 }: { icon: IconName; tone?: Tone; size?: number }) {
  const color = useToneColor(tone);
  return (
    <View style={{ width: size, height: size }} className={`items-center justify-center rounded-xl ${toneClass[tone].bg}`}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

export function Avatar({ name, uri, size = 44 }: { name?: string | null; uri?: string | null; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2 }} className="items-center justify-center bg-primary-soft">
      <Text className="font-bold text-primary-ink" style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function Divider({ className = '' }: { className?: string }) {
  return <View className={`h-px bg-border ${className}`} />;
}

export function KeyValue({ label, value, emphasize }: { label: string; value: ReactNode; emphasize?: boolean }) {
  return (
    <View className="flex-row items-start justify-between py-2">
      <Text className="mr-3 text-sm text-text-body">{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text className={`flex-1 text-right text-sm ${emphasize ? 'font-bold' : 'font-medium'} text-text-heading`}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function StatTile({ label, value, icon, tone = 'primary', onPress, hint }: {
  label: string;
  value: string;
  icon: IconName;
  tone?: Tone;
  onPress?: () => void;
  /** Secondary caption under the label (e.g. "12 reviews"). */
  hint?: string;
}) {
  const { colors } = useTheme();
  const body = (
    <View className="min-h-[104px] grow rounded-3xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className={`h-8 w-8 items-center justify-center rounded-lg ${toneClass[tone].bg}`}>
          <Ionicons name={icon} size={17} color={toneColor(colors, tone)} />
        </View>
        {onPress ? <Ionicons name="arrow-forward" size={15} color={colors.textMuted} /> : null}
      </View>
      <Text className="text-xl font-bold tracking-tight text-text-heading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="mt-0.5 text-xs text-text-body" numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text className="mt-0.5 text-[11px] text-text-muted" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return <View className="flex-1">{body}</View>;
  return (
    <Pressable
      className="flex-1 active:opacity-80"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
    >
      {body}
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
  tone = 'neutral',
  destructive,
  leading,
}: {
  /** Custom visual in the icon tile (e.g. the coin badge) instead of an Ionicon. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  tone?: Tone;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const t: Tone = destructive ? 'danger' : tone;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      className="min-h-[60px] flex-row items-center px-4 py-3 active:bg-muted"
    >
      {leading || icon ? (
        <View className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${toneClass[t].bg}`}>
          {leading ?? (icon ? <Ionicons name={icon} size={19} color={toneColor(colors, t)} /> : null)}
        </View>
      ) : null}
      <View className="flex-1">
        <Text className={`text-[15px] font-medium ${destructive ? 'text-danger-ink' : 'text-text-heading'}`}>{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-xs text-text-body">{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View className="items-center justify-center py-10" accessibilityLabel={label ?? 'Loading'} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text className="mt-3 text-sm text-text-body">{label}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, count, icon }: { label: string; selected?: boolean; onPress: () => void; count?: number; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      className={`mr-2 min-h-[38px] flex-row items-center justify-center rounded-full border px-4 ${
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-card active:bg-muted'
      }`}
    >
      {icon ? <Ionicons name={icon} size={15} style={{ marginRight: 6 }} color={selected ? colors.primaryInk : colors.heading} /> : null}
      <Text className={`text-sm font-semibold ${selected ? 'text-primary-ink' : 'text-text-heading'}`}>{label}</Text>
      {count != null ? (
        <View className={`ml-1.5 min-w-[20px] items-center rounded-full px-1.5 ${selected ? 'bg-action' : 'bg-muted'}`}>
          <Text className={`text-[11px] font-bold ${selected ? 'text-white' : 'text-text-body'}`}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Segmented control for switching views inside one screen. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="flex-row rounded-2xl bg-muted p-1" accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            className="min-h-[40px] flex-1 items-center justify-center"
          >
            {/* Active fill as its own layer (Android drops the radius on a toggled background). */}
            {active ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              />
            ) : null}
            <Text className={`text-sm font-semibold ${active ? 'text-text-heading' : 'text-text-body'}`}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InfoBanner({ tone = 'info', title, message, icon, action }: {
  tone?: Tone;
  title?: string;
  message: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  const t = toneClass[tone];
  const color = useToneColor(tone);
  return (
    <View className={`rounded-2xl p-3.5 ${t.bg}`} accessibilityRole="alert">
      <View className="flex-row">
        <Ionicons name={icon ?? 'information-circle'} size={20} color={color} style={{ marginRight: 10, marginTop: 1 }} />
        <View className="flex-1">
          {title ? <Text className={`mb-0.5 text-sm font-bold ${t.text}`}>{title}</Text> : null}
          <Text className="text-sm leading-5 text-text-heading">{message}</Text>
        </View>
      </View>
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}

/** Horizontal progress bar; `value` is 0–1. */
export function ProgressBar({ value, tone = 'primary', label, inverse }: { value: number; tone?: Tone; label?: string; inverse?: boolean }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      className={`h-2 overflow-hidden rounded-full ${inverse ? 'bg-white/25' : 'bg-muted'}`}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
    >
      <View className={`h-full rounded-full ${inverse ? 'bg-white' : toneClass[tone].dot}`} style={{ width: `${pct * 100}%` }} />
    </View>
  );
}

/**
 * Proportional bar for the parts of a real total (e.g. available / pending /
 * paid out). Zero-value segments are not drawn but stay in the legend.
 */
export function StackedBar({ segments, label }: { segments: Array<{ value: number; tone: Tone; label: string }>; label?: string }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  return (
    <View accessible accessibilityLabel={label}>
      <View className="h-3 flex-row overflow-hidden rounded-full bg-muted">
        {total > 0
          ? segments
              .filter((s) => s.value > 0)
              .map((s) => <View key={s.label} className={`h-full ${toneClass[s.tone].dot}`} style={{ flex: s.value / total }} />)
          : null}
      </View>
      <View className="mt-2.5 flex-row flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <View key={s.label} className="flex-row items-center">
            <View className={`mr-1.5 h-2 w-2 rounded-full ${toneClass[s.tone].dot}`} />
            <Text className="text-xs text-text-body">{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
