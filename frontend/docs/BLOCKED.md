# Blocked — frontend items that need a backend or data change first

> Items from `docs/TODO.md` that were researched against the backend
> (`../backend`) and the legacy reference app (`../old-php-files`) and
> could not be built on the frontend alone, plus why. Not a task list —
> if the underlying blocker (a backend gap, a missing data source, a
> product decision) gets resolved, move the item back to `docs/TODO.md`.

- **Adjust/AppsFlyer attribution — confirmed dead, not pursuing** — Adjust
  half: legacy never calls Adjust from any CRM controller; it's
  mobile-SDK-only (`InspectDeviceDto`'s own backend comment agrees), no
  CRM trigger point should exist. AppsFlyer half: legacy fires this
  automatically inside the disbursal flow (`DisbursalController.php`),
  and the backend's `POST /appsflyer/events` endpoint is real, but
  `PushAppsflyerEventDto` requires `appsflyerId`/`platform` and neither
  `Lead` nor `LeadCustomer` has a column to source them from (grepped the
  whole backend schema). The backend's own
  `automation-worker/src/jobs/appsflyer-disbursal-event-push/...` job is
  dead code by design — log-only, never calls the vendor endpoint, with a
  header comment explaining that fabricating `appsflyerId` would file
  bogus S2S events against AppsFlyer's real production API. No frontend
  code was ever added for this (nothing to remove) and none should be
  until a schema change persists a real device-attribution id on `Lead`.

- **Reverse geocode** — confirmed auxiliary-only. Backend endpoint exists
  (`POST /reverse-geocode`) but legacy shows this data originates from
  the customer mobile app's callback (`ApiCallBackController.php`), not
  staff input. No standalone screen needed; not a gap, just correctly
  out of scope.

- **Domain/email verification — auto-trigger timing, now confirmed** —
  backend endpoints (`POST /domain-verification`,
  `POST /email-verification`) are real and simple to call. Previously
  unconfirmed whether legacy auto-triggered this on lead save; confirmed
  the real flow is executive-driven — a CRM staff member (the executive)
  triggers email verification manually, not an automatic save-time call.
  Matches the existing explicit "Verify" button implementation as-is, no
  code change needed.
