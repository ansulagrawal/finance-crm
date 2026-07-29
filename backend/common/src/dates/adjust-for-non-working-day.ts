export type WorkingDayDirection = 'previous' | 'next';

/**
 * Moves a date one day at a time (backward for `'previous'`, forward for
 * `'next'`) until it lands on neither a Sunday nor a date in
 * `holidayDates`. Business rule: a calculated repayment date that falls
 * on a Sunday or a company/festival holiday is not used as-is — it moves
 * to the nearest working day instead, direction configurable
 * (`REPAYMENT_DATE_WORKING_DAY_DIRECTION`, defaults to `'previous'`).
 *
 * Generalizes legacy's only holiday-adjustment algorithm
 * (`api/application/models/Instant_Model.php::checkLoanEligibility()`,
 * customer-facing app, out of scope for this backend but the only real
 * precedent for the adjustment logic itself) into a single loop instead
 * of legacy's two-phase check (a holiday-only `while` loop, then a single
 * un-looped Sunday check) — so a Sunday that also happens to be a
 * holiday, or a holiday-adjusted date that lands on another holiday, is
 * always handled correctly, unlike legacy's version.
 *
 * Takes/returns `YYYY-MM-DD` strings (matches `CompanyHoliday.holidayDate`'s
 * DB column shape) and does all arithmetic in UTC — a calendar date has no
 * timezone of its own, and computing in UTC avoids any DST/server-timezone
 * ambiguity entirely.
 */
export function adjustForNonWorkingDay(
  isoDate: string,
  holidayDates: ReadonlySet<string>,
  direction: WorkingDayDirection = 'previous',
): string {
  const stepMs = (direction === 'next' ? 1 : -1) * 24 * 60 * 60 * 1000;
  let date = new Date(`${isoDate}T00:00:00Z`);

  while (date.getUTCDay() === 0 || holidayDates.has(toIsoDate(date))) {
    date = new Date(date.getTime() + stepMs);
  }

  return toIsoDate(date);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
