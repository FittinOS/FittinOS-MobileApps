import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/api/endpoints';
import { Button, Card, Header, InfoBanner, Screen, SectionTitle, TextField } from '@/components/ui';
import { extractErrorMessage } from '@/lib/errors';
import { validateFullName, validatePhone } from '@/lib/validation';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

export default function EditProfileScreen() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const next = { fullName: validateFullName(fullName), phone: validatePhone(phone) };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setFormError(null);
    setSaving(true);
    try {
      const updated = await authApi.updateMe({ fullName: fullName.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) });
      setUser(updated);
      toast.show('Profile updated.');
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Failed to save your profile.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Edit profile" />
      <Screen footer={<Button title="Save changes" onPress={submit} loading={saving} />}>
        {formError ? (
          <View className="mb-3">
            <InfoBanner tone="danger" message={formError} icon="alert-circle" />
          </View>
        ) : null}
        <SectionTitle title="Personal" />
        <Card>
          <TextField label="Full name" value={fullName} onChangeText={setFullName} error={errors.fullName} autoCapitalize="words" />
          <TextField label="Phone" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" placeholder="+919876543210" />
          <Text className="text-xs text-text-body">Email: {user?.email} (can&apos;t be changed here)</Text>
        </Card>
      </Screen>
    </>
  );
}
