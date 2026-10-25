import { useState } from 'react';
import { authApi, fileDownloadUrl, uploadFile } from '@/api/endpoints';
import { extractErrorMessage } from '@/lib/errors';
import { PickerError, pickProfilePhoto } from '@/lib/pickers';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

/** Same flow as the web: upload (PROFILE_IMAGE) → PATCH /auth/me { avatarUrl: <file download URL> }. */
export function useAvatarUpload() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function change(source: 'library' | 'camera') {
    try {
      const file = await pickProfilePhoto(source);
      if (!file) return;
      setUploading(true);
      const uploaded = await uploadFile(file, 'PROFILE_IMAGE');
      const updated = await authApi.updateMe({ avatarUrl: fileDownloadUrl(uploaded.id) });
      setUser(updated);
      toast.show('Profile photo updated.');
    } catch (error) {
      toast.show(error instanceof PickerError ? error.message : extractErrorMessage(error, 'Failed to upload photo.'), 'error');
    } finally {
      setUploading(false);
    }
  }

  return { uploading, change };
}
