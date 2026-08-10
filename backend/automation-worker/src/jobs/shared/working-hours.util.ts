/**
 * Ports the legacy `intval(date('H')) < 9 || intval(date('Hi')) > 2330`
 * working-hours gate used throughout `CronSanctionController.php` (screener
 * and credit allocation methods) — those crons no-op outside 09:00-23:30.
 *
 * `hhmm` is hours*100+minutes (e.g. 09:00 -> 900, 23:30 -> 2330), matching
 * PHP's `date('Hi')` format so the threshold constants below are copied
 * verbatim from the legacy source rather than re-derived.
 *
 * Assumes the process runs in the `Asia/Kolkata` timezone (legacy explicitly
 * called `date_default_timezone_set('Asia/Kolkata')` in every cron
 * controller's constructor) — set `TZ=Asia/Kolkata` in this service's
 * environment/deployment, this code does not force it itself.
 */
export function isWithinHhmmWindow(
  now: Date,
  startHHMM: number,
  endHHMM: number,
): boolean {
  const hhmm = now.getHours() * 100 + now.getMinutes();
  return hhmm >= startHHMM && hhmm <= endHHMM;
}

/** The 09:00-23:30 window shared by every screener/credit allocation cron. */
export const ALLOCATION_WORKING_HOURS = {
  start: 900,
  end: 2330,
} as const;
