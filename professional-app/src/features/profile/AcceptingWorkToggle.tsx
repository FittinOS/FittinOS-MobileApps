import { Switch, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { profileApi } from '@/api/endpoints';
import { qk, useInvalidate, useProfile } from '@/api/queries';
import { extractErrorMessage } from '@/lib/errors';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/theme/theme-provider';

/** "Accepting bookings" switch — PATCH /professionals/me { acceptingWork }, same as the web header toggle. */
export function AcceptingWorkToggle({ variant = 'card' }: { variant?: 'card' | 'pill' }) {
  const profile = useProfile();
  const invalidate = useInvalidate();
  const toast = useToast();
  const { colors } = useTheme();
  const mutation = useMutation({
    mutationFn: (acceptingWork: boolean) => profileApi.update({ acceptingWork }),
    onSuccess: (_d, acceptingWork) => {
      void invalidate(qk.profile);
      toast.show(acceptingWork ? "You're accepting new bookings." : 'New bookings paused.', 'info');
    },
    onError: (error) => toast.show(extractErrorMessage(error, "Couldn't update your availability."), 'error'),
  });
  const accepting = mutation.isPending ? !!mutation.variables : profile.data?.acceptingWork ?? false;
  const toggle = (
    <Switch
      value={accepting}
      disabled={!profile.data || mutation.isPending}
      onValueChange={(v) => mutation.mutate(v)}
      trackColor={{ true: colors.primary, false: colors.trackOff }}
      thumbColor={accepting ? colors.onPrimary : colors.thumbOff}
      accessibilityLabel="Accepting bookings"
    />
  );
  if (variant === 'pill') {
    return (
      <View className="flex-row items-center rounded-full border border-border bg-card py-1 pl-3 pr-1">
        <View className={`mr-2 h-2 w-2 rounded-full ${accepting ? 'bg-success' : 'bg-text-muted'}`} />
        <Text className="text-[13px] font-semibold text-text-heading">{accepting ? 'Accepting' : 'Paused'}</Text>
        {toggle}
      </View>
    );
  }
  return (
    <View className="flex-row items-center rounded-3xl border border-border bg-card px-4 py-3.5">
      <View className={`mr-3 h-10 w-10 items-center justify-center rounded-xl ${accepting ? 'bg-success-soft' : 'bg-muted'}`}>
        <Ionicons name={accepting ? 'radio-button-on' : 'pause-circle-outline'} size={20} color={accepting ? colors.success : colors.body} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-bold text-text-heading">{accepting ? 'Accepting bookings' : 'Not accepting bookings'}</Text>
        <Text className="text-xs text-text-body">Pause anytime — it doesn&apos;t affect your verification.</Text>
      </View>
      {toggle}
    </View>
  );
}
