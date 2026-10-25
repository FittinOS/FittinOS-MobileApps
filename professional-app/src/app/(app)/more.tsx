import { Redirect } from 'expo-router';

/**
 * The old "More" tab became the Profile hub (every row it listed is there).
 * Kept as a route so existing `/more` links and notification targets still land.
 */
export default function MoreRedirect() {
  return <Redirect href="/profile" />;
}
