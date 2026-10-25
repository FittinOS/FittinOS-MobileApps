/**
 * FittinOS design tokens. Every colour is a CSS variable defined in
 * global.css for light (`:root`) and dark (`.dark:root`), so a class such as
 * `bg-card` or `text-text-heading` follows the active theme without per-screen
 * `dark:` variants. The JS mirror (icons, navigation, native props) lives in
 * src/theme/tokens.ts — change both together.
 *
 * Mirrors apps/professional-app/tailwind.config.js exactly — same design
 * language, independent files (each app owns its own copy).
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v('primary'), dark: v('primary-pressed'), soft: v('primary-soft'), ink: v('primary-ink') },
        action: { DEFAULT: v('action'), pressed: v('action-pressed') },
        secondary: { DEFAULT: v('secondary'), soft: v('secondary-soft') },
        background: v('background'),
        card: v('card'),
        muted: v('muted'),
        border: v('border'),
        'text-body': v('text-body'),
        'text-heading': v('text-heading'),
        'text-muted': v('text-muted'),
        success: { DEFAULT: v('success'), soft: v('success-soft'), ink: v('success-ink') },
        warning: { DEFAULT: v('warning'), soft: v('warning-soft'), ink: v('warning-ink') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft'), ink: v('danger-ink') },
        info: { DEFAULT: v('info'), soft: v('info-soft'), ink: v('info-ink') },
      },
    },
  },
  plugins: [],
};
