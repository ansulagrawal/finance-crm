/**
 * Derives the `platform` / `browser` strings that legacy wrote into
 * `user_activity_log.ual_platform` / `ual_browser`.
 *
 * Legacy used CodeIgniter's user-agent library
 * (`Admin_Model.php:201-202` — `$this->agent->platform()` and
 * `$this->agent->browser() . ' ' . $this->agent->version()`), so the values
 * already in that table look like `Windows 10` / `Chrome 148.0.0.0`. This
 * reproduces that vocabulary rather than inventing a new one, so rows written
 * by this backend sort and group alongside the legacy ones instead of forming
 * a second, incompatible set.
 *
 * The tables and their ORDER are copied from
 * `application/config/user_agents.php`; first match wins, which is what makes
 * `Edge` beat `Chrome` and `OPR` beat everything (both send a Chrome token in
 * their UA). Deliberately hand-rolled rather than pulling in a UA-parsing
 * dependency: a library would return its own vocabulary (`macOS`, `Microsoft
 * Edge`) and reintroduce exactly the mismatch this avoids.
 */

/** Ordered: the first substring found in the lower-cased UA wins. */
const PLATFORMS: ReadonlyArray<readonly [string, string]> = [
  ['windows nt 10.0', 'Windows 10'],
  ['windows nt 6.3', 'Windows 8.1'],
  ['windows nt 6.2', 'Windows 8'],
  ['windows nt 6.1', 'Windows 7'],
  ['windows nt 6.0', 'Windows Vista'],
  ['windows nt 5.2', 'Windows 2003'],
  ['windows nt 5.1', 'Windows XP'],
  ['windows nt 5.0', 'Windows 2000'],
  ['windows phone', 'Windows Phone'],
  ['windows', 'Unknown Windows OS'],
  ['android', 'Android'],
  ['blackberry', 'BlackBerry'],
  ['iphone', 'iOS'],
  ['ipad', 'iOS'],
  ['ipod', 'iOS'],
  ['os x', 'Mac OS X'],
  ['macintosh', 'Mac OS X'],
  ['freebsd', 'FreeBSD'],
  ['openbsd', 'OpenBSD'],
  ['netbsd', 'NetBSD'],
  ['debian', 'Debian'],
  ['sunos', 'Sun Solaris'],
  ['linux', 'Linux'],
];

/** Ordered, for the same reason: Edge/OPR must be tested before Chrome, and
 * Chrome before Safari, since each impersonates the ones below it. */
const BROWSERS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Opera', /\bOPR\/([\d.]+)/],
  ['Edge', /\bEdges?\/([\d.]+)/],
  ['Edge', /\bEdgA?\/([\d.]+)/],
  ['Opera', /\bOpera(?:.*?Version)?[/ ]([\d.]+)/],
  ['Chrome', /\bChrome\/([\d.]+)/],
  ['Internet Explorer', /\bMSIE ([\d.]+)/],
  ['Internet Explorer', /\bTrident\/.*?rv:([\d.]+)/],
  ['Firefox', /\bFirefox\/([\d.]+)/],
  ['Camino', /\bCamino\/([\d.]+)/],
  ['Netscape', /\bNetscape\/([\d.]+)/],
  ['OmniWeb', /\bOmniWeb\/([\d.]+)/],
  ['Safari', /\bVersion\/([\d.]+).*\bSafari\//],
  ['Safari', /\bSafari\/([\d.]+)/],
  ['Mozilla', /\bMozilla\/([\d.]+)/],
];

export interface UserAgentInfo {
  platform: string | null;
  browser: string | null;
}

export function parseUserAgent(
  userAgent: string | null | undefined,
): UserAgentInfo {
  if (!userAgent) {
    return { platform: null, browser: null };
  }

  const lower = userAgent.toLowerCase();
  const platform =
    PLATFORMS.find(([needle]) => lower.includes(needle))?.[1] ?? null;

  let browser: string | null = null;
  for (const [name, pattern] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (match) {
      // Legacy joins name and version with a space and stores the result as
      // one column, e.g. "Chrome 148.0.0.0".
      browser = `${name} ${match[1]}`;
      break;
    }
  }

  return { platform, browser };
}
