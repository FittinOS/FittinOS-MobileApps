/**
 * JS mirror of the CSS theme variables in global.css, for places that take a
 * colour value instead of a className (icons, navigation options, Switch,
 * ActivityIndicator, RefreshControl, placeholderTextColor). Keep in sync.
 *
 * Identical to apps/professional-app/src/theme/tokens.ts — same brand, own copy.
 */
export type SchemeName = 'light' | 'dark';

export interface Palette {
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryInk: string;
  onPrimary: string;
  /** Fill for anything carrying white text (buttons, count badges): #FF5500 is too light for it. */
  action: string;
  actionPressed: string;
  secondary: string;
  background: string;
  card: string;
  muted: string;
  border: string;
  heading: string;
  body: string;
  textMuted: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  trackOff: string;
  thumbOff: string;
  overlay: string;
  header: string;
  hero: string;
}

export const palettes: Record<SchemeName, Palette> = {
  light: {
    primary: '#FF5500',
    primaryPressed: '#E04B00',
    primarySoft: '#FFEDE3',
    primaryInk: '#C2410C',
    onPrimary: '#FFFFFF',
    action: '#CC4400',
    actionPressed: '#B33B00',
    secondary: '#1F2933',
    background: '#F6F6F4',
    card: '#FFFFFF',
    muted: '#F1F1EE',
    border: '#E7E7E3',
    heading: '#1C252D',
    body: '#5B6873',
    textMuted: '#8A96A0',
    success: '#10B981',
    successSoft: '#E7F8F1',
    warning: '#F59E0B',
    warningSoft: '#FEF5E6',
    danger: '#DC2626',
    dangerSoft: '#FDECEC',
    info: '#3B82F6',
    infoSoft: '#EAF2FE',
    trackOff: '#D4D7DB',
    thumbOff: '#FFFFFF',
    overlay: 'rgba(15, 18, 22, 0.45)',
    header: '#141A22',
    hero: '#171D25',
  },
  dark: {
    primary: '#FF5500',
    primaryPressed: '#FF7026',
    primarySoft: '#2A1A10',
    primaryInk: '#FF8A4C',
    onPrimary: '#FFFFFF',
    action: '#CC4400',
    actionPressed: '#B33B00',
    secondary: '#2C333C',
    background: '#0E1013',
    card: '#171A1F',
    muted: '#1F232A',
    border: '#2A2F37',
    heading: '#F2F4F6',
    body: '#A3ADB8',
    textMuted: '#7C8792',
    success: '#10B981',
    successSoft: '#12261F',
    warning: '#F59E0B',
    warningSoft: '#2B2310',
    danger: '#DC2626',
    dangerSoft: '#2E1717',
    info: '#3B82F6',
    infoSoft: '#14213A',
    trackOff: '#3A414B',
    thumbOff: '#C9CED4',
    overlay: 'rgba(0, 0, 0, 0.6)',
    header: '#161A20',
    hero: '#1C222B',
  },
};

/** Spacing/radius scale used by the shared components (NativeWind classes mirror it). */
export const radius = { sm: 10, md: 14, lg: 20, xl: 24, pill: 999 } as const;
