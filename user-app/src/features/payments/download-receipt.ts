import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from '@/api/client';
import { paymentsApi } from '@/api/endpoints';
import { API_URL } from '@/lib/config';

/**
 * Downloads the backend-generated PDF receipt with the Bearer token (the
 * route is ownership-checked server-side and only succeeds for the caller's
 * own captured payments), saves it to the app cache and opens the share
 * sheet so the professional can save or send it.
 */
export async function downloadReceipt(paymentId: string, reference: string): Promise<void> {
  const token = await api.getFreshAccessToken();
  if (!token) throw new Error('Please sign in again to download receipts.');
  const target = new File(Paths.cache, `Fittin-Receipt-${reference.replace(/[^A-Za-z0-9_-]/g, '')}.pdf`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(`${API_URL}${paymentsApi.receiptPath(paymentId)}`, target, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Payment receipt', UTI: 'com.adobe.pdf' });
  }
}
