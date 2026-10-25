import * as ImagePicker from 'expo-image-picker';
import type { UploadableFile } from '@/api/endpoints';

/** The backend accepts only these (FilesService.ALLOWED_MIME_TYPES), up to 10 MB. */
export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class PickerError extends Error {}

function check(file: { mimeType?: string | null; size?: number | null }): void {
  if (file.mimeType && !ALLOWED_UPLOAD_TYPES.includes(file.mimeType)) {
    throw new PickerError('Choose a JPG, PNG, WebP or PDF file.');
  }
  if (file.size && file.size > MAX_UPLOAD_BYTES) throw new PickerError('That file is larger than 10 MB.');
}

/** Square photo from the gallery (permission is requested by the picker only when used). */
export async function pickProfilePhoto(source: 'library' | 'camera'): Promise<UploadableFile | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PickerError('Camera access was denied. Allow it in your phone settings to take a photo.');
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  check({ mimeType, size: asset.fileSize });
  return { uri: asset.uri, name: asset.fileName ?? `photo.${mimeType.split('/')[1] ?? 'jpg'}`, mimeType };
}
