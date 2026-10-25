import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { UserRole, type AuthResult, type UserDto } from '@/api/shared';
import { unregisterPushDevice } from '@/features/push/push-registration';
import { httpStatusOf } from '@/lib/errors';
import { clearTokens, loadTokens, saveTokens } from '@/lib/token-store';

/**
 * Session state for the user (client) app. Mirrors
 * apps/professional-app/src/providers/auth-provider.tsx exactly, except this
 * app enforces UserRole.CLIENT instead of PROFESSIONAL, and routes a
 * fresh signup to onboarding instead of kyc-intro (there is no KYC for clients).
 *
 * - restoring: reading the keystore + validating with GET /auth/me (splash stays up)
 * - signedOut: no session
 * - signedIn: a CLIENT session (email may still be unverified — see needsEmailVerification)
 * - offline: tokens exist but the backend couldn't be reached at launch; the
 *   session is kept (not thrown away for a network blip) and can be retried.
 */
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn' | 'offline';

export class NotAClientError extends Error {
  constructor() {
    super('This app is for FittinOS clients. Professional accounts can sign in on the FittinOS Professional app.');
    this.name = 'NotAClientError';
  }
}

interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /** Why the user was signed out, shown once on the sign-in screen. */
  signOutReason: string | null;
  needsEmailVerification: boolean;
  /**
   * True only for the one transition right after a brand-new signup
   * verifies its email in this session — never for a restored session or an
   * ordinary login, so an already-onboarded client is never routed through
   * this again. Mirrors the web app's /user-onboarding redirect target.
   */
  showOnboarding: boolean;
  login(email: string, password: string): Promise<UserDto>;
  register(input: { email: string; password: string; fullName: string; phone?: string }): Promise<{ emailDispatchFailed: boolean }>;
  verifyEmail(code: string): Promise<void>;
  resendVerificationCode(): Promise<void>;
  refreshUser(): Promise<UserDto | null>;
  setUser(user: UserDto): void;
  retryRestore(): void;
  logout(options?: { everywhere?: boolean; reason?: string }): Promise<void>;
  clearSignOutReason(): void;
  dismissOnboarding(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, queryClient }: { children: ReactNode; queryClient: QueryClient }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUserState] = useState<UserDto | null>(null);
  const [signOutReason, setSignOutReason] = useState<string | null>(null);
  const [justVerifiedEmail, setJustVerifiedEmail] = useState(false);
  const restoreAttempt = useRef(0);

  const endSession = useCallback(
    async (reason: string | null) => {
      await clearTokens();
      queryClient.clear();
      setUserState(null);
      setSignOutReason(reason);
      setJustVerifiedEmail(false);
      setStatus('signedOut');
    },
    [queryClient],
  );

  // A refresh failure anywhere in the app (expired/revoked/reused token) lands here.
  useEffect(
    () =>
      api.onSessionExpired(() => {
        queryClient.clear();
        setUserState(null);
        setSignOutReason('Your session expired. Please sign in again.');
        setJustVerifiedEmail(false);
        setStatus('signedOut');
      }),
    [queryClient],
  );

  const restore = useCallback(async () => {
    const attempt = ++restoreAttempt.current;
    setStatus('restoring');
    const tokens = await loadTokens();
    if (!tokens) {
      setStatus('signedOut');
      return;
    }
    try {
      const me = await authApi.me();
      if (attempt !== restoreAttempt.current) return;
      if (me.role !== UserRole.CLIENT) {
        await endSession(new NotAClientError().message);
        return;
      }
      setUserState(me);
      setStatus('signedIn');
    } catch (error) {
      if (attempt !== restoreAttempt.current) return;
      const statusCode = httpStatusOf(error);
      // 401 after a failed refresh already ended the session via onSessionExpired.
      if (statusCode === 401 || statusCode === 403) {
        await endSession('Your session expired. Please sign in again.');
      } else {
        setStatus('offline');
      }
    }
  }, [endSession]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const acceptSession = useCallback(
    async (result: AuthResult) => {
      if (result.user.role !== UserRole.CLIENT) {
        // Never keep a non-client session in this app; revoke it server-side too.
        await authApi.logout(result.refreshToken).catch(() => undefined);
        throw new NotAClientError();
      }
      queryClient.clear();
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      setUserState(result.user);
      setSignOutReason(null);
      setStatus('signedIn');
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email.trim().toLowerCase(), password);
      await acceptSession(result);
      return result.user;
    },
    [acceptSession],
  );

  const register = useCallback(
    async (input: { email: string; password: string; fullName: string; phone?: string }) => {
      const result = await authApi.register({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        fullName: input.fullName.trim(),
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      });
      await acceptSession(result);
      return { emailDispatchFailed: Boolean(result.emailDispatchFailed) };
    },
    [acceptSession],
  );

  const refreshUser = useCallback(async () => {
    const me = await authApi.me();
    setUserState(me);
    return me;
  }, []);

  const verifyEmail = useCallback(
    async (code: string) => {
      if (!user) throw new Error('Not signed in.');
      await authApi.verifyEmail(user.email, code.trim());
      await refreshUser();
      setJustVerifiedEmail(true);
    },
    [user, refreshUser],
  );

  const resendVerificationCode = useCallback(async () => {
    if (!user) throw new Error('Not signed in.');
    await authApi.sendVerificationCode(user.email);
  }, [user]);

  const logout = useCallback(
    async (options?: { everywhere?: boolean; reason?: string }) => {
      const tokens = await loadTokens();
      // Best-effort, same non-blocking contract as the calls below — a failed
      // unregister (offline, request error) must never prevent sign-out.
      await unregisterPushDevice();
      try {
        if (options?.everywhere) await authApi.logoutAll();
        else if (tokens?.refreshToken) await authApi.logout(tokens.refreshToken);
      } catch {
        // Signing out locally must never be blocked by the network.
      }
      await endSession(options?.reason ?? null);
    },
    [endSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signOutReason,
      needsEmailVerification: status === 'signedIn' && !!user && !user.emailVerified,
      showOnboarding: status === 'signedIn' && !!user && user.emailVerified && justVerifiedEmail,
      login,
      register,
      verifyEmail,
      resendVerificationCode,
      refreshUser,
      setUser: setUserState,
      retryRestore: () => void restore(),
      logout,
      clearSignOutReason: () => setSignOutReason(null),
      dismissOnboarding: () => setJustVerifiedEmail(false),
    }),
    [status, user, signOutReason, justVerifiedEmail, login, register, verifyEmail, resendVerificationCode, refreshUser, restore, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
