/**
 * Parses `CORS_ORIGIN` into the shape `app.enableCors({ origin })` expects.
 *
 * The variable is a **comma-separated list** so one deployment can serve
 * several front ends (a CloudFront distribution and its custom domain, say)
 * without a code change. A single value keeps working unchanged.
 *
 * Returns an array even for one entry: `credentials: true` forbids the `*`
 * wildcard, so every allowed origin has to be named. An empty/unset value
 * falls back to the local Vite dev server rather than to `*`, because a
 * deployment that forgets this variable must not end up echoing whatever
 * `Origin` a caller sends back with `Access-Control-Allow-Credentials: true`.
 */
export function parseCorsOrigins(
  value: string | undefined,
  fallback = 'http://localhost:5173',
): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : [fallback];
}
