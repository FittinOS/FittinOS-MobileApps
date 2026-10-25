import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Avatar } from '@/components/ui';
import { formatCallDuration } from '@/lib/format';
import { useCall } from './call-provider';
import { callNoun, liveStatusLabel } from './engine/call-status.ts';

type StreamWithUrl = MediaStream & { toURL?: () => string };

type RTCViewComponent = typeof import('react-native-webrtc').RTCView;
/** Loaded only while a call is on screen — which can only happen where calls are available. */
function rtcView(): RTCViewComponent {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('react-native-webrtc') as typeof import('react-native-webrtc')).RTCView;
}

function streamUrl(stream: MediaStream | null): string | null {
  const s = stream as StreamWithUrl | null;
  return s?.toURL ? s.toURL() : null;
}

function useElapsed(fromIso: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!fromIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [fromIso]);
  return fromIso ? Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000)) : null;
}

/**
 * Full-screen call surface, shown over any screen whenever a call is in any
 * phase but idle. Every state comes from the shared engine; this only renders it.
 */
export function CallOverlay() {
  const call = useCall();
  const { state } = call;
  const elapsed = useElapsed(state.phase === 'connected' ? state.call?.connectedAt ?? null : null);
  const visible = state.phase !== 'idle';
  if (!visible) return null;
  const RTCView = rtcView();

  const isVideo = state.type === 'VIDEO' && !state.cameraUnavailable;
  const remoteUrl = isVideo ? streamUrl(call.getRemoteStream()) : null;
  const localUrl = isVideo && !state.isCameraOff ? streamUrl(call.getLocalStream()) : null;
  const peerName = state.peer?.fullName ?? 'Client';

  let statusText = '';
  if (state.phase === 'preparing') statusText = 'Getting ready…';
  else if (state.phase === 'ended') statusText = state.outcome?.title ?? 'Call ended';
  else if (state.call && state.direction) statusText = liveStatusLabel(state.call, state.direction);
  if (state.phase === 'connected' && elapsed != null) statusText = formatCallDuration(elapsed);
  if (state.reconnecting) statusText = 'Reconnecting…';

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={() => (state.phase === 'ended' ? call.dismiss() : undefined)}>
      <View className="flex-1 bg-secondary">
        <StatusBar style="light" />
        {remoteUrl && state.phase === 'connected' ? (
          <RTCView streamURL={remoteUrl} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} objectFit="cover" />
        ) : null}
        <SafeAreaView className="flex-1 justify-between" edges={['top', 'bottom']}>
          <View className="items-center px-6 pt-10">
            {!(remoteUrl && state.phase === 'connected') ? <Avatar name={peerName} uri={state.peer?.avatarUrl} size={104} /> : null}
            <Text className="mt-5 text-2xl font-bold text-white" accessibilityRole="header">
              {peerName}
            </Text>
            <Text className="mt-1 text-base text-white/80" accessibilityLiveRegion="polite">
              {statusText}
            </Text>
            {state.type ? <Text className="mt-1 text-xs uppercase tracking-widest text-white/60">Free {callNoun(state.type)}</Text> : null}
            {state.cameraUnavailable ? <Text className="mt-3 text-center text-sm text-white/80">Camera unavailable — continuing as a voice call.</Text> : null}
            {state.notice ? (
              <View className="mt-5 rounded-xl bg-white/10 px-4 py-3">
                <Text className="text-center text-sm font-semibold text-white">{state.notice.message}</Text>
                {state.notice.hint ? <Text className="mt-1 text-center text-xs text-white/80">{state.notice.hint}</Text> : null}
              </View>
            ) : null}
            {state.phase === 'ended' && state.outcome?.detail ? (
              <Text className="mt-3 text-center text-sm text-white/80">{state.outcome.detail}</Text>
            ) : null}
          </View>

          {localUrl && (state.phase === 'connected' || state.phase === 'connecting' || state.phase === 'outgoing') ? (
            <View className="absolute right-4 top-28 h-44 w-28 overflow-hidden rounded-2xl border-2 border-white/40">
              <RTCView streamURL={localUrl} style={{ flex: 1 }} objectFit="cover" mirror zOrder={1} />
            </View>
          ) : null}

          <View className="px-8 pb-8">
            {state.phase === 'incoming' ? (
              <View className="flex-row justify-around">
                <RoundButton icon="close" label="Decline" color="bg-danger" onPress={call.reject} />
                <RoundButton icon={state.type === 'VIDEO' ? 'videocam' : 'call'} label="Accept" color="bg-success" onPress={call.accept} />
              </View>
            ) : state.phase === 'ended' ? (
              <View className="flex-row justify-around">
                {state.canRetry ? <RoundButton icon="refresh" label="Try again" color="bg-primary" onPress={call.retry} /> : null}
                <RoundButton icon="checkmark" label="Close" color="bg-white/20" onPress={call.dismiss} />
              </View>
            ) : (
              <>
                {state.phase === 'connected' || state.phase === 'connecting' ? (
                  <View className="mb-6 flex-row justify-around">
                    <RoundButton
                      icon={state.isMuted ? 'mic-off' : 'mic'}
                      label={state.isMuted ? 'Unmute' : 'Mute'}
                      color={state.isMuted ? 'bg-white' : 'bg-white/20'}
                      iconColor={state.isMuted ? '#26343F' : '#FFFFFF'}
                      onPress={call.toggleMute}
                      small
                    />
                    {state.type === 'VIDEO' ? (
                      <RoundButton
                        icon={state.isCameraOff ? 'videocam-off' : 'videocam'}
                        label={state.isCameraOff ? 'Camera on' : 'Camera off'}
                        color={state.isCameraOff ? 'bg-white' : 'bg-white/20'}
                        iconColor={state.isCameraOff ? '#26343F' : '#FFFFFF'}
                        onPress={call.toggleCamera}
                        small
                      />
                    ) : null}
                    <RoundButton
                      icon={call.speakerOn ? 'volume-high' : 'volume-medium'}
                      label={call.speakerOn ? 'Speaker on' : 'Speaker'}
                      color={call.speakerOn ? 'bg-white' : 'bg-white/20'}
                      iconColor={call.speakerOn ? '#26343F' : '#FFFFFF'}
                      onPress={call.toggleSpeaker}
                      small
                    />
                  </View>
                ) : null}
                <View className="items-center">
                  <RoundButton icon="call" rotate label={state.phase === 'outgoing' || state.phase === 'preparing' ? 'Cancel' : 'End call'} color="bg-danger" onPress={call.end} />
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function RoundButton({
  icon,
  label,
  color,
  onPress,
  iconColor = '#FFFFFF',
  small,
  rotate,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  iconColor?: string;
  small?: boolean;
  rotate?: boolean;
}) {
  const size = small ? 58 : 70;
  return (
    <View className="items-center">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={`items-center justify-center rounded-full active:opacity-80 ${color}`}
        style={{ width: size, height: size }}
      >
        <Ionicons name={icon} size={small ? 24 : 30} color={iconColor} style={rotate ? { transform: [{ rotate: '135deg' }] } : undefined} />
      </Pressable>
      <Text className="mt-2 text-xs text-white/90">{label}</Text>
    </View>
  );
}
