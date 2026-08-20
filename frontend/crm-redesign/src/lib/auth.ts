import { useQuery } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/lib/api';
import {
  clearStoredUser,
  loadStoredUser,
  type SafeUser,
  storeUser,
} from '@/lib/user-storage';

export type { SafeUser };
export { clearStoredUser, loadStoredUser, storeUser };

/** `GET /auth/me` only echoes the current access token's JWT claims
 * (`sub`/`email`/`roles`) — it doesn't include `name` and isn't a fresh DB
 * read, so a role/deactivation change only actually lands once the access
 * token itself is reissued (on the existing 401 -> refresh-token flow in
 * `apiFetch`, which *does* re-read roles from the DB). Polling this here
 * still lets the UI notice a revoked session promptly, and picks up role
 * changes within one access-token lifetime. */
type AuthMeResponse = { sub: number; email: string; roles: string[] };

export const CURRENT_USER_QUERY_KEY = ['auth', 'me'] as const;

async function fetchCurrentUser(): Promise<SafeUser | null> {
  const stored = await loadStoredUser();
  if (!stored) return null;

  try {
    const me = await apiFetch<AuthMeResponse>('/api/v1/auth/me');
    const merged: SafeUser = {
      id: me.sub,
      name: stored.name,
      email: me.email,
      roles: me.roles,
    };
    await storeUser(merged);
    return merged;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // apiFetch already attempted a refresh and, on failure, cleared the
      // stored user and redirected to /login — nothing further to do here.
      return null;
    }
    // Transient/network error: keep showing the last-known session rather
    // than logging the user out on a blip.
    return stored;
  }
}

export function signIn(email: string, password: string) {
  // skipAuthRefresh: a 401 here means invalid credentials or a locked
  // account, not an expired session — without this, apiFetch's default
  // 401 handling tries a token refresh (which can't succeed, there's no
  // session yet), then discards the real error message and redirects to
  // /login, masking exactly the distinction (locked vs. wrong password)
  // the caller needs to show.
  return apiFetch<{ user: SafeUser }>('/api/signin', {
    method: 'POST',
    body: { email, password },
    skipAuthRefresh: true,
  });
}

export function requestPasswordResetOtp(email: string) {
  return apiFetch<{ message: string }>('/api/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export function verifyPasswordResetOtp(email: string, otp: string) {
  return apiFetch<{ resetToken: string }>('/api/forgot-password/verify-otp', {
    method: 'POST',
    body: { email, otp },
  });
}

export function resetPassword(resetToken: string, newPassword: string) {
  return apiFetch<{ message: string }>('/api/forgot-password/reset', {
    method: 'POST',
    body: { resetToken, newPassword },
  });
}

export async function logout(): Promise<void> {
  await apiFetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
  clearStoredUser();
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ message: string }>('/api/v1/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export function useCurrentUser(): SafeUser | null {
  const { data } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60_000,
    retry: false,
  });

  return data ?? null;
}
