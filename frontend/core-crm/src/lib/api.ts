import { clearStoredUser } from '@/lib/user-storage';

const REFRESH_PATH = '/api/v1/auth/refresh-token';

/**
 * Absolute origin of the API, e.g. `https://api.financecrm.com`.
 *
 * Empty by default, which leaves every request relative — that is what the
 * local Vite dev server needs, since it proxies `/api` itself (see
 * `vite.config.ts`) and same-origin requests avoid CORS entirely.
 *
 * A deployed build has no such proxy: the static host (Cloudflare Workers,
 * CloudFront, nginx, …) receives `POST /api/signin` against its own origin,
 * finds no route, and answers **405 Method Not Allowed** before the API is
 * ever contacted. Set `VITE_API_BASE_URL` at *build* time to point those
 * calls at the real API.
 *
 * Vite inlines `import.meta.env` at build time, so this is baked into the
 * bundle — changing it means rebuilding, not just redeploying.
 *
 * Cross-origin is safe here on two counts, both already verified: the API
 * allow-lists this origin (`CORS_ORIGIN`) and answers with
 * `Access-Control-Allow-Credentials: true`, and the auth cookies are
 * `SameSite=Lax`/`Strict` but the CRM and the API share one registrable
 * domain, so the browser treats them as same-site and sends them normally.
 * Hosting the CRM on a domain that does NOT share the API's registrable
 * domain would silently break the session — see docs/EC2-DEV-DEPLOYMENT.md.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Resolves an app-relative API path against `API_BASE_URL`. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** The backend rate-limits every route (`@nestjs/throttler`), with much
 * tighter per-handler budgets on the credential endpoints — signin,
 * forgot-password, verify-otp, reset and change-password. Nest's default 429
 * body says "ThrottlerException: Too Many Requests", which is not something
 * to show a person, so 429 gets its own message. */
const RATE_LIMITED_MESSAGE =
  'Too many attempts. Please wait for a minute and try again.';

async function toApiError(response: Response): Promise<ApiError> {
  if (response.status === 429) {
    return new ApiError(RATE_LIMITED_MESSAGE, 429);
  }
  const data = await response.json().catch(() => null);
  const message = Array.isArray(data?.message)
    ? data.message.join(', ')
    : (data?.message ?? 'Something went wrong. Please try again.');
  return new ApiError(message, response.status);
}

/** Clears the cached user and hard-navigates to /login. Used both when a
 * refresh attempt fails and when a request still 401s *after* a successful
 * refresh — the latter happens when the token is technically renewable but
 * the account behind it is no longer usable, and previously surfaced as a
 * bare 401 on every call instead of ending the session. */
function endSession(): never {
  clearStoredUser();
  window.location.assign('/login');
  throw new ApiError('Session expired', 401);
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  skipAuthRefresh?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = rawFetch(REFRESH_PATH, {
      method: 'POST',
      skipAuthRefresh: true,
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function rawFetch(
  path: string,
  options: ApiFetchOptions,
): Promise<Response> {
  const { body, headers, skipAuthRefresh, ...rest } = options;
  return fetch(apiUrl(path), {
    ...rest,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await rawFetch(path, options);

  if (response.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      endSession();
    }
    const retried = await rawFetch(path, { ...options, skipAuthRefresh: true });
    if (retried.status === 401) {
      endSession();
    }
    if (!retried.ok) {
      throw await toApiError(retried);
    }
    return (await retried.json().catch(() => null)) as T;
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return (await response.json().catch(() => null)) as T;
}

/** Like `apiFetch`, but for `multipart/form-data` uploads (e.g. bulk CSV
 * import) — takes a `FormData` body directly instead of JSON-encoding it,
 * and deliberately omits a `Content-Type` header so the browser sets the
 * multipart boundary itself. Shares the same 401-refresh-and-retry
 * behavior. */
export async function apiFetchMultipart<T>(
  path: string,
  formData: FormData,
  options: { skipAuthRefresh?: boolean } = {},
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (response.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      endSession();
    }
    return apiFetchMultipart<T>(path, formData, { skipAuthRefresh: true });
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return (await response.json().catch(() => null)) as T;
}

/** Like `apiFetch`, but for binary responses (e.g. zip/file downloads) that
 * can't be parsed as JSON. Shares the same 401-refresh-and-retry behavior. */
export async function apiFetchBlob(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Blob> {
  const response = await rawFetch(path, options);

  if (response.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      endSession();
    }
    return apiFetchBlob(path, { ...options, skipAuthRefresh: true });
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.blob();
}
