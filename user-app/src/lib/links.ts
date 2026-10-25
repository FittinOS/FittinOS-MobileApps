import * as WebBrowser from 'expo-web-browser';
import { WEB_URL } from './config';

/** The legal pages are published on the web; the app shows the canonical copy rather than a stale duplicate. */
export const LEGAL_PAGES = [
  { key: 'terms', title: 'Terms of Service', path: '/terms' },
  { key: 'privacy', title: 'Privacy Policy', path: '/privacy' },
  { key: 'refund', title: 'Refund Policy', path: '/refund-policy' },
  { key: 'cookies', title: 'Cookie Policy', path: '/cookie-policy' },
] as const;

export function webUrl(path: string): string {
  return `${WEB_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function openWebPage(path: string): Promise<void> {
  await WebBrowser.openBrowserAsync(webUrl(path), {
    toolbarColor: '#FFFFFF',
    controlsColor: '#FF5500',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
