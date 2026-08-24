# Explicitly excluded from this migration

Everything on this page was looked at and deliberately **not** ported —
distinct from `docs/TODO.md`'s "Open items" (things still being tracked as
pending work). If it's not here and not in `TODO.md`, assume it was
ported. Each entry: legacy source, what it did, why it's excluded, and
whether it's worth revisiting.

## Out of scope by original project scope decision

The migration's scope (see `CLAUDE.md`) is the internal, staff-facing CRM
+ its automation — not the legacy app's separate customer-facing surface or
its marketing/content site.

- **`old-php-files/application/controllers/Api/*`, `Users.php`,
  `PayCustomerDetails.php`** — the customer-facing REST API consumed by the
  Android app, iOS app, and public website (`REST_Controller`-based, not
  session-auth CRM code). Out of scope by definition — this is a different
  product surface with its own release cadence and clients; porting it
  would mean also owning mobile-app compatibility. Not revisited unless
  the business decides to rebuild those client apps against this backend
  too.
- **`BlogController.php`, `NewsController.php`, `Front.php`** — the
  marketing site / blog / news CMS bundled into the same CodeIgniter
  install. No relation to loan origination/servicing. Not revisited.

## Dev/test scaffolding — no migration action needed

- **`TestController.php`, `CronJobs/Test.php`, `Welcome.php`,
  `MigrationController.php`** — CodeIgniter boilerplate, dev harnesses
  (VKYC/WhatsApp callback smoke tests), and one-time legacy DB migration
  scripts. Nothing here represents product behavior to preserve.
- **`PortalController.php`** — appears to be a dead duplicate of
  `LoginController.php`, low risk, not ported.

## Foreign sub-system — different auth/table pattern

- **`PromotionalSmsDndController.php`, `QuotationController.php`** — use
  `tbl_agent` and `$_SESSION['email']` auth, not this codebase's
  `isUserSession`/CRM user model. Looks like a separate insurance-quotation
  sub-system bundled into the same CodeIgniter install rather than core
  Finance CRM lending-CRM functionality. `QuotationController.php` itself is
  a 1-function dead/debug stub (`print_r($_POST); exit;`). Excluded on the
  assessment that it's unrelated code sharing a codebase, not a real gap.
  **Revisit if**: someone confirms this DND list or quotation flow is
  actually in active use for Finance CRM's own SMS compliance — in that case
  it needs modeling as real scope, not dead code.

## Partially ported — remainder needs its own scoping pass

- **`ApiCallBackController.php`**: only the two genuinely inbound-webhook
  pieces were ported this pass — eSign completion (`eSignSanctionLetterResponse`/
  `completeESign()`, now `POST /esign/callback` in `integrations-api`) and
  the Account Aggregator consent callback (`getConsentResponseCallback`/
  `consentRequestNodeJs()`, now `POST /account-aggregator/callback`).
  `digitapView`/`digitapResponse` (Digitap Digilocker create-url/get-details)
  and the `DIGITAP_EKYC_CREATE_OTP`/`DIGITAP_EKYC_SUCCESS` OTP flow were
  later ported as a pluggable alternate to Signzy's `ekyc` module (see
  `OCR_PROVIDER`-style `provider` switch on `EkycLog`). The remaining piece
  of this controller (`verifyEkycDigitap`/`ekyc_otp_verify`'s server-rendered
  HTML views, `employeeLiveLocation`) is server-rendered UI and a
  live-location capture endpoint with no backing entity in this schema —
  still not ported. `IciciCallbackController.php` was already fully ported
  (see `integrations-api/src/modules/upi/upi-callback.controller.ts`).
- **`CronJobs/CronReportController.php`**: only the two "approval hour"
  reports with no existing MIS-report equivalent were ported
  (`disbursal-reports/disbursal-executive-ta`, id 84;
  `collection-reports/collection-approval-hour`, id 85) — the credit-side
  one was already covered by `credit-reports/sanction-executive-ta` (id
  38). `lead_flow_report`, `conversion_report_report`, and
  `credit_head_approval_report` (distinct from `..._approval_hour_report`)
  were not ported — not confirmed to have no existing equivalent among
  `lead-reports`'s ~15 endpoints; needs a dedicated audit pass before
  building anything new here to avoid duplicating an existing report
  under a different name.

## Blocked on a missing vendor/adapter or business decision

These are real legacy functionality with no equivalent in the new
backend, but building them now would mean guessing at a vendor contract or
a business rule rather than porting a known one.

- **`CronJobs/CronCallController.php`** (7 functions — voice/IVR blast
  reminders for 5-2 day, 1-0 day, outstanding, and defaulter buckets) — no
  telephony/IVR vendor adapter exists anywhere in `integrations-api`.
  Needs a vendor selection before this can be built as anything other than
  a stub.
- **`CronJobs/CronMiscellaneousController.php`'s doc-rename functions**
  (most of its 15 functions) — no clean equivalent in this schema's file
  storage model. (`poi-father-name-sync`, the one piece of this
  controller that *was* portable without new infra, already exists in
  `automation-worker`.)
- **`CronSanctionController.php`** (43 functions, also
  `CronSanctionController_20260526.php` as a dated backup — largest single
  legacy controller) — Facebook lead ingestion plus bulk sanction
  workflow automation. Too large and too tied to specific external
  integrations/business rules to port without a scoping conversation with
  the business first. No automation-worker equivalent exists today. Named
  sub-methods worth a business decision individually before porting, each
  its own blocker:
  - `RepeatOnlineCustomersAllocation()` — **confirmed live** via the real
    production crontab (`*/2 * * * * ... CronSanctionController
    RepeatOnlineCustomersAllocation`). Needs a `lead_direct_disbursal`
    boolean this schema's `Lead` doesn't have, plus a hardcoded 3-user
    roster (same "hardcoded roster vs. live role" question already
    resolved for TAT-hold redistribution — same answer would likely
    apply, but this method's eligibility criteria weren't re-verified).
    Not yet built — tracked in `docs/TODO.md`.
  - `credeauAllocation()` — **confirmed live** via the real production
    crontab (`*/30 * * * * ... CronSanctionController credeauAllocation`
    — the sibling `credeauPTBAllocation` line is commented out, confirmed
    dead). A single hardcoded user, routing for a "digital co-lending
    channel." Not yet built — tracked in `docs/TODO.md`.
  - `notContactableLeadAllocation()` — needs a per-user-per-lead
    rejection-tracking table this schema doesn't have, plus the RUNO
    dialer integration (confirmed dead elsewhere in this file's "Dead
    code" section for a different RUNO use — this one wasn't separately
    re-checked for liveness).
  - `sanctionTargetUpdate()` — a nightly MIS target-vs-achievement
    recompute; conceptually belongs in `reporting-api`'s scope, not
    `automation-worker`'s.

## Client-confirmed not needed

- **`Automate::allocateLeadsAndApplicationReject`/`::actionOnUserActivity`**
  — both appear in the real crontab, but their function bodies don't exist
  anywhere in `old-php-files/` (exhaustively re-searched: camelCase/
  snake_case name variants, `git log --all -p`, every dated backup file
  — `Automate.php`, `Automate_30March.php`, `helpers/Automate.php` — and a
  filesystem-wide search for a second PHP export; the closest relative,
  `autoHoldToReject`, is a distinct, unrelated job). Client confirmed
  (2026-08-04) this functionality isn't needed going forward, so the
  missing-source gap is now moot — not revisited unless the client changes
  that decision and supplies the real source.

## Dead code — dispatcher never actually reaches it

Found while building the pluggable SMS/Digitap vendor-gap work. Distinct
from the sections above: this isn't unported functionality, it's legacy
code that looks live but a bug or a commented-out call means it never
actually runs — so there's nothing real to port.

- **MSG91 (SMS)** — only legacy usage found is a WhatsApp send call in
  unrouted/test code, not a real SMS flow. Vapio is legacy's only live SMS
  provider (see `integrations-api`'s `SmsModule`).
- **DesignHost / staticking.org (SMS)** — both call sites read as
  leftover/unrelated demo boilerplate, not a real CRM SMS feature.
- **Digitap bank account verification** (`BANK_DIGITAP_ACCOUNT_VERIFICATION`)
  — `payday_bank_verification_api_helper.php`'s dispatcher:
  ```php
  $method_id = $opertion_array[$method_name];
  $method_id = (date('d') % 2) > 0 ? 1 : 1;   // both branches return 1 (Signzy)
  ```
  Both branches of the ternary evaluate to `1`. `method_id 2`
  (`digitap_bank_account_verification_api`) is defined but unreachable —
  a dispatcher bug, not a real A/B split (contrast with the PAN/Aadhaar OCR
  dispatcher's genuine `(date('d') % 2) > 0 ? 1 : 2` alternation, which *is*
  live and was ported — see `OCR_PROVIDER`).
- **Digitap eSign** (`UPLOAD_ESIGN_DOCUMENT_DIGITAP` /
  `DOWNLOAD_ESIGN_DOCUMENT_DIGITAP`) — `CommonComponent::call_esign_api`,
  the only code path that ever creates an `api_esign_logs` row, always
  calls Signzy's `UPLOAD_ESIGN_FILE`; the Digitap upload call is present
  but commented out:
  ```php
  $return_array = aadhaar_esign_api_call('UPLOAD_ESIGN_FILE', $lead_id, $request_array);
  // $return_array = aadhaar_esign_api_call('UPLOAD_ESIGN_FILE_DIGITAP', $lead_id, $request_array);
  ```
  Since no path ever writes an `esign_provider = 2` log row,
  `download_esign_document_api`'s `provider == 2` branch is also
  unreachable in practice, even though it's syntactically present.
- **Smartping click-to-call + bulk upload** (`SMARTPING_CALL_CRM`) —
  `integration_config.php` has no `case "SMARTPING_CALL_CRM":` at all; the
  lookup falls through to the function's `default:` case (`Status = 0`,
  `"INTERNAL : Invalid config value passed"`). Both `smartping_payday_call_api`
  (`ThirdPartyAPIController::Click_to_call`) and
  `smartping_payday_bulk_upload_api`
  (`ThirdPartyAPIController::dialer_data_upload`) are reached from live,
  uncommented controller actions, but the config lookup always throws
  before any HTTP call is attempted — the integration can never actually
  succeed as legacy stands today.
- **Aadhaar masking** (`CronMiscellaneousController::aadhaarMasked()`/
  `aadhaarMaskedAllCases()` → `CommonComponent::call_aadhaar_masked_api` →
  `aadhaar_mask_api_call` in `payday_poi_ocr_api.php`) — confirmed broken,
  not just unused. The function builds its Signzy request from
  `$aadhaar_front_doc_data['file']`/`$aadhaar_back_doc_data['file']`, but
  never fetches either variable within its own scope — the only document
  lookup it actually performs is for doc type 4 (PAN), assigned to
  `$docsDetails`/`$pan_document_id`. The front/back Aadhaar document
  lookups exist in the *sibling* `aadhaar_ocr_api_call`/
  `aadhaar_ocr_api_digitap_call` functions (same file), not this one — a
  copy-paste omission. Every real invocation sends Signzy a request with
  undefined (null) file URLs, guaranteeing failure. Also uses a
  hardcoded, non-configurable bearer token
  (`bTkqZ1zdC0ahvRuTKQdKyMeT068aJFMB`) baked directly into the cURL
  headers — a second sign this code path was never actually exercised
  successfully in practice. Not ported: reconstructing a "fixed" version
  would mean guessing which document-type ids/lookup calls the missing
  fetch should have used, not porting known-working behavior.
- **Bureau-vs-current/Aadhaar address match** (`VerificationController::
  address_match_verification_api_call()`) — calls
  `CommonComponent::call_address_match_api($lead_id, $verification_type)`,
  which doesn't exist anywhere in the codebase (grepped every PHP file,
  including dated backups) — a fatal "call to undefined method" every
  time this action fires. Never finished in legacy.
- **RUNO collection-team call allocation** (`COLLECTION_CALL`,
  `runo_collection_allocation_api` in `payday_runo_call_api_helper.php`) —
  no live caller found anywhere; the only reference
  (`CronSanctionController.php:2364`) is commented out. Only RUNO's
  sanction-team allocation (`LEAD_CAT_SANCTION`, dispatched from
  `TaskController.php`'s `CR1`+production-only path) is genuinely live —
  see `integrations-api`'s `CallManagementModule`.
- **Legal notice email** (`automation-worker`'s `legal-notice-email` job)
  — both candidate legacy sources are unusable, not just unwired:
  - `CronLegalEmailerController::legalNotice31To60DaysEmailer()` calls
    `legalNoticeEmailer(31, 60)`, but that method's signature is
    `legalNoticeEmailer($type, $from_days, $to_days, $debug)` and
    `$notice_type_list`'s values are `'lrn'`/`'dn'`/`'fn'` — `$type=31`
    never matches `in_array($type, $notice_type_list)`, so the entire
    function body is unreachable. Dead code, same pattern as the
    Aadhaar-masking/RUNO-collection findings above.
  - The *other*, differently-scoped `CronEmailerController::legalNoticeEmailer()`
    (no arguments) has real, live content — but it's a legal notice from
    a law firm ("Preach Law") on behalf of "M/S NAMAN FINLEASE PRIVATE
    LIMITED, operating under the brand name of Loanwalle.com" — a
    completely different, superseded legal entity, not Finance CRM/Acme
    Leasing Finance. Porting this would mean sending a notice that
    impersonates a defunct company and references a law firm with no
    relationship to the current business — actively wrong, not just a
    branding mismatch like the marketing emails above.
  Left log-only. Building a *correct* legal notice needs actual legal
  review with the current entity's real content — not something to guess
  from either legacy candidate.

## No in-scope write path exists

- **Device-advertising-id** (`lead_customer.customer_adjust_adid`/
  `customer_adjust_gps_adid`/`customer_adjust_idfa`) — grepped every
  writer of these three columns across the whole legacy codebase; every
  single one is under `old-php-files/api/` (the customer-facing mobile
  app/website journey controllers — explicitly out of scope per
  `CLAUDE.md`). The only in-scope references
  (`payday_adjust_api.php`/`payday_appsflyer_call_api.php`,
  `CronMMPTool_Model.php`) only *read* these columns to make outbound
  vendor calls or joins — none of them ever populate them. There is no
  internal-CRM action that could plausibly write a device advertising id;
  it's fundamentally captured at customer self-service sign-up, not by
  staff. `utm_medium`/`utm_term` (sibling columns on `leads` itself, not
  `lead_customer`) were a different story — the internal
  manually-create-a-lead flow already saves `utmSource`/`utmCampaign`, so
  their siblings were added for parity (see `CreateLeadDto`).
- **AppsFlyer conversion-postback ingestion** (`api_callback_appsflyer`,
  `acaf_appsflyer_id`/`acaf_lead_id`) — the inbound webhook that receives
  this postback (`AppsFlyerController.php`) lives entirely under
  `old-php-files/api/` (the customer-facing install), and no in-scope
  controller (`ApiCallBackController.php` or its `CronJobs` sibling —
  where the AA/eSign inbound webhooks that *were* ported live) references
  AppsFlyer at all. Building this would mean replicating an out-of-scope
  customer-facing webhook, not filling an internal-CRM gap. This is also
  *why* AppsFlyer's outbound conversion-event push
  (`appsflyer-disbursal-event-push` in `automation-worker`) is log-only —
  there's no in-scope way to populate the `appsflyerId` it would need to
  send.

## Legacy-data-migration exclusions

Distinct from the sections above (those are unported *functionality*; this
is a legacy *table* the one-time data migration — `database/src/migrate-legacy/`
— deliberately doesn't read from):

- **`lead_sms_logs`** — a slimmer, older SMS-log shape (`lsl_*` prefix: no
  `template_id`/`template_source`/`provider`/`provider_used`/
  `attempted_providers`/`api_response` columns that `api_sms_logs` has,
  and `lsl_lead_id` is NOT NULL where `api_sms_logs.sms_lead_id` is
  nullable) that looks like a predecessor/superseded table rather than a
  second live write path — `api_sms_logs` (migrated as `SmsLog`) is legacy's
  real, currently-active SMS log per `SmsLog`'s own doc comment. Not given
  its own entity; revisit if a real dump's data (row counts, date ranges)
  shows it's actually still being written to in parallel with
  `api_sms_logs`, not just historical.

## Vendor integrations removed from code (client-directed, 2026-08-07)

Removed on the client's explicit instruction after they supplied a
definitive keep-list of vendors. **DB tables and their rows are preserved in
every case** — only the code that reads or writes them is gone, so nothing
new is ever mapped from the CRM to these vendors. See `docs/COMPLETED.md`
Task #146 for the full removal detail and what was verified.

**Credeau was removed in this pass and then restored** at the client's
request the same day — see `docs/COMPLETED.md` Task #147. It was later
removed again for good (Task #158, 2026-08-07) once the client separately
confirmed the integration itself wasn't in use — see the dedicated entry
below.

Removed with real, working code deleted:

- **AppsFlyer** — the `appsflyer` module (was already unregistered),
  `automation-worker`'s `appsflyer-disbursal-event-push` job, and
  `AppsflyerPushEventLog`.
- **Adjust** — the `adjust` device-attribution module and `AdjustDeviceLog`.
  With AppsFlyer, this removes the whole attribution category.
- **Finbox** — the `finbox` module (device-connect, bureau-connect,
  bank-connect) and all three of its log entities.
- **TinyURL** — the `url-shortener` module and `UrlShortenerLog`. Nothing
  called it (see Task #132's own note), so this was a clean removal.
- **WhatsApp (whole category)** — the `whatsapp` module, its controller/
  service and `WhatsappLog`. The module was a single generic HTTP client
  pointed at `WHATSAPP_API_URL`; the candidate providers behind it
  (Pinbot.ai, Whistle, Aisensy, Yellow.ai) are all off the keep-list, which
  left no provider. Nothing called it either. `FOLLOWUP_TEMPLATE_TYPE.WHATSAPP = 3`
  stays in `CollectionService` — it is a legacy numeric type id the frontend
  already sends, and it already returned "No WhatsApp followup templates
  exist."

Never had code, and are now scrubbed from `.env.example`/comments too:
TransUnion/CIBIL direct, QuickChart, NuPay, RouteMobile, Whistle,
Sms24hours, Aisensy, Yellow.ai, Cube Software, Facebook Graph API, Exotel,
Mailgun. Two notes on these:

- **Provider *enum values* are deliberately kept** (e.g.
  `BankVerificationProvider`, `EnachProvider.WORLDLINE`). They map to numeric
  provider ids already stored on existing rows; deleting them would make
  historical data unreadable, which is exactly what "don't delete data"
  rules out.
- **`m1.sql` is deliberately untouched.** It creates several of these tables
  (`whatsapp_logs`, `api_appsflyer_push_events`, `api_finbox_*`,
  `api_url_shortener_logs`) and adds `api_adjust_logs`' primary key. It is an
  already-applied migration whose block count/ordering is contractually
  mirrored by `m1.down.sql`; editing it would both break that contract and
  risk dropping preserved tables.

Kept despite being absent from the keep-list (the client confirmed the
list wasn't exhaustive for these): **CartBI / Novel Pattern** (both the
`bank-analysis` and `account-aggregator` modules) and the **AWS SES** and
**generic SMTP** email senders.

## Credeau — removed for good (client-confirmed unused, 2026-08-07)

Credeau (see the section above for its removal-then-restoration history —
Tasks #146/#147) was removed a second time, client-confirmed this time as
genuinely unused, not just off a keep-list — see `docs/COMPLETED.md` Task
#158 for the full detail. Unlike the first removal, this pass also removed
the `credeau-application-allocation` cron band in `automation-worker`
(the `*/30 * * * *` STP lead-allocation job) on the client's explicit
instruction, even though it never called the Credeau vendor — Task #146
had deliberately kept that job for exactly that reason, so this is a
scope change from the earlier decision, not a repeat of it.

Removed: the `credeau` module (`integrations-api`), `CredeauLog`/
`CredeauDecision`/`CredeauMethod`, the two read call sites
(`CamService.eligibleLoanAmount()`'s STP override,
`AuditService.checkStraightThroughEligibility()`'s approved-amount cap),
and the `credeau-application-allocation` band in
`CreditApplicationAllocationService`. `api_credeau_log` (created by
`init.sql`, legacy) is untouched — table and rows preserved, nothing
writes to it. `lead.credeauStatus` and `cifCustomer.credeauApprovedCustomer`
stay, still written from `lead.creationMode` — never vendor data, same as
before.

## How to revisit any of these

Pick the item back up as a normal `TODO.md` "Open items" entry once the
blocking vendor/decision/confirmation is resolved — move it out of this
file and into `TODO.md` at that point so it's tracked as active work
again.
