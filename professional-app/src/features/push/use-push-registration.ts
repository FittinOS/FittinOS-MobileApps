import { useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { registerPushDevice, subscribeToNotificationOpen, subscribeToPushTokenRefresh } from './push-registration';

/** Registers this device for push whenever a session is active, and keeps the registration current if the OS rotates the token. */
export function usePushRegistration(): void {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'signedIn') return;
    void registerPushDevice();
    const tokenSub = subscribeToPushTokenRefresh();
    const openSub = subscribeToNotificationOpen();
    return () => {
      tokenSub.remove();
      openSub.remove();
    };
  }, [status]);
}
