import type { IconName } from '@/components/ui';

/**
 * A service category's real icon, when the backend hasn't set one.
 *
 * `CategoryDto.iconUrl` is the actual source of truth and always wins when
 * present (see CategoryCard in Home and the category chips in Discover) —
 * this is only the fallback glyph for the gap, keyed on the backend's own
 * stable `slug` (never guessed from the free-text `name`). Every slug below
 * is a real category from the project's seed data; unrecognised slugs (a
 * future category the backend adds before this map is updated) fall back to
 * a neutral, still-on-theme fitness glyph rather than a meaningless grid icon.
 */
const CATEGORY_ICONS: Record<string, IconName> = {
  'weight-loss': 'flame-outline',
  yoga: 'body-outline',
  'strength-training': 'barbell-outline',
  'general-fitness': 'fitness-outline',
  nutrition: 'nutrition-outline',
  'personal-training': 'person-outline',
  'prenatal-postnatal': 'woman-outline',
  rehabilitation: 'medkit-outline',
};

const DEFAULT_CATEGORY_ICON: IconName = 'fitness-outline';

export function categoryIconFor(slug: string): IconName {
  return CATEGORY_ICONS[slug] ?? DEFAULT_CATEGORY_ICON;
}
