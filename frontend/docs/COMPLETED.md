# Frontend Functionality — completed work history

> Full detail on everything that's been built, why, what backend contract
> it's wired against, and how it was verified. `docs/TODO.md` only tracks
> what's still open — this file is the durable record of everything else.
> Organized by the domain/section it belongs to, in build order.

## Backend/legacy-verified TODO sweep

Every previously-open `docs/TODO.md` item was researched against the
real backend (`../backend`) and the legacy reference app
(`../old-php-files`) before building — nothing here was guessed. Items
that turned out un-buildable (backend data/behavior gaps, or genuinely
out of scope) are recorded in `docs/BLOCKED.md` instead, not silently
dropped.

- **`user-role-locations` + role hierarchy UI**: built on the Users
  admin screen (`core-crm/src/routes/users.tsx`, `lib/users.ts`).
  Branch/state/city scoping per role assignment and supervisor/level
  editing, wired to backend endpoints (`PATCH .../users/:id/roles/:id`,
  `GET/POST/DELETE .../user-roles/:id/locations`) that existed on the
  backend but were previously unused by the frontend. Supervisor
  selection has no dedicated "list all role assignments" endpoint, so
  it's built as search-user → pick-their-role-assignment.
- **Multi-step lead intake wizard**: `core-crm/src/routes/index.tsx`'s
  `LeadIntakeWizard` replaces the flat `NewLeadForm` with 4 steps
  (lead → customer → employment → references), reusing the lead detail
  page's section editors (extracted to shared
  `core-crm/src/components/lead-sections.tsx`) so an abandoned wizard
  is always resumable from the lead detail page — matches the
  backend's separate-PUT/POST-per-section shape, no atomic transaction.
- **Status-change transition validation**: confirmed neither legacy
  (`LeadsController.php`) nor the current backend
  (`leads.service.ts`'s `changeStatus()`) enforce any transition graph
  — so none was fabricated. Instead, the status picker
  (`leads.$leadId.tsx`'s `ChangeStatusAction`) now groups the 37
  statuses by stage (via seeded `sortOrder`/`stageCode`) and excludes
  the lead's current status from the options.
- **CAM FOIR cap enforcement**: confirmed a real cap in legacy
  (`config.php:265` `FOIR_PERCENTAGE = ['NEW' => 0.45, 'REPEAT' => 0.50]`,
  enforced both client-side in `Tasks/main_js.php` and server-side as
  BRE rule 38) with no backend-side equivalent yet to call. Ported as
  `getFoirCapPercent()` in `lib/cam.ts`; the Sanction button on
  `leads.$leadId.tsx` is disabled with an inline warning once
  `finalFoirPercentage` meets/exceeds the cap.
- **BRE override role-gating**: confirmed legacy never role-gated this
  action at all (any authenticated user could override), and the
  current backend deliberately leaves the override endpoint ungated
  too (unlike sibling `@Roles('SA','CA')`-gated BRE endpoints). Removed
  the invented client-side `CR2`/`CR3` gate to match.
- **Verification `LD1` role-gating**: confirmed `LD1` in legacy actually
  means "KYC-zip-download role" (`Admin/KycZipController.php`), unrelated
  to banking/documents editing — that gate rested on a false premise
  (inferred only from the seeded name "Loan Docs"). Removed `LD1` from
  the banking/documents-editing gate, leaving `CR1` alone (still
  unconfirmed but not contradicted). The correct `LD1` gate on the
  KYC-zip-download feature itself is untouched.
- **Audit trigger placement**: confirmed via legacy
  (`AuditController.php`, routed from `Tasks/main_js.php`) that
  send-to-pre/post-audit is triggered from the **Tasks/queue list**, not
  the lead detail page. Moved to role-gated (`AU`/`AM`/`AH`) row actions
  on `core-crm/src/routes/audit.tsx`; the lead detail page's
  `AuditSection` keeps its read-only history/hold/recommend/send-back
  controls and now links out to `/audit` instead.
- **`integrations-api` vendor flows** — researched and built per-flow:
  - **eKYC/Digilocker, eSign, Video KYC, Face match, POI
    verification/OCR** — all confirmed and built as a new "Vendor
    Verifications" section on the lead detail page
    (`leads.$leadId.tsx`, client functions in `lib/integrations.ts`).
    Digilocker is a 3-step manual sequence (create-url → details →
    e-Aadhaar); eSign initiates against a signer form + downloads the
    signed doc once ready (its `documentBase64` has no in-app PDF
    renderer yet — `pdf/` is still an unimplemented placeholder — so
    it's a manual paste-in field, not automated); Video KYC is a single
    send/resend action; Face match and POI OCR both consume
    already-uploaded document URLs (confirmed URL-based, not
    base64/multipart) via pickers over the lead's existing documents.
  - **Credeau** — confirmed automatic in legacy, firing right after a
    successful CIBIL/CRIF pull for NEW-type leads
    (`CibilController.php:42`). Built as a non-blocking side effect of
    the existing CRIF-fetch mutation (`CrifBureauCard` in
    `leads.$leadId.tsx`), plus a read-only `CredeauResultCard` decision
    display on the CAM section (legacy gates CAM's max-loan logic on
    this decision).
  - **Account Aggregator** — confirmed as a 6-endpoint flow
    (consent-request/status → fi-request/status → fi-data →
    analytics-report) under `integrations-api`'s account-aggregator
    module, and confirmed legacy UI placement
    (`VerificationController::get_Banking_Account_Aggregator`). Built as
    an `AccountAggregatorSection` on the lead detail page: consent
    request/poll, date-range FI request/poll, then a monthly-summary
    table + transactions `DataTable`, plus an on-demand raw
    analytics-report view.
  - **eNACH, domain/email verification, Finbox, UPI collection** — all
    confirmed against `integrations-api`'s `enach`/`domain-email-verification`/
    `finbox`/`upi` modules and built:
    - **eNACH**: `SendEnachMandateAction` on `DisbursalSection`
      (`POST .../enach/transactions`) — legacy sends the customer a
      "complete your mandate" email first, so the mandate registration
      number is customer-supplied out-of-band; this is a manual
      staff-entry form, not a poll.
    - **Domain/email verification**: `EmailVerificationRow` under
      `CustomerSection` (`lib/lead-sections.tsx`), one row each for the
      personal `email` and office `alternateEmail` fields
      (`POST .../domain-verification`, `POST .../email-verification`).
      Auto-trigger timing was unconfirmable in either backend or legacy,
      so these are manual buttons.
    - **Finbox**: new `FinboxSection` on the lead detail page
      (device-connect, bureau-connect, bank-connect cards, each showing
      its latest logged result). Bureau-connect needs a raw XML response
      per its DTO, but this codebase's CRIF log stores JSON, not raw
      XML — no confirmed source to auto-populate from, so `reportId`/
      `createdAt`/`bureauXmlResponse` are manual entry fields.
    - **UPI collection**: `UpiCollectionCard` on `CollectionSection`,
      disabled unless `loan.status === 'DISBURSED'` (matches backend's
      server-side enforcement); shows the vendor response, already
      decrypted server-side.
  - **Reverse geocode, Adjust attribution** — confirmed genuinely out of
    scope (customer-mobile-app-originated, no CRM trigger point). See
    `docs/BLOCKED.md`.
  - **AppsFlyer attribution** — confirmed a hard backend blocker (no
    `appsflyerId`/`platform` column exists anywhere in the schema to
    source a real event from; the backend's own
    `automation-worker/appsflyer-disbursal-event-push` job is
    deliberately log-only for the same reason). See `docs/BLOCKED.md`.
- **Two new MIS reports** (`disbursal-executive-ta`,
  `collection-approval-hour`): confirmed already wired into
  `lib/reporting.ts` in an earlier commit (`e653910`); only a stale
  `docs/TODO.md` bullet needed removing.
- **CAM send-back lead-status effect, Performance/target dashboard**:
  confirmed backend gaps, not frontend tasks. See `docs/BLOCKED.md`.

## Foundational decisions

Resolved early, before any domain screen was built — every later section
depends on these:

- **Data-fetching/caching layer**: `@tanstack/react-query`
  (`src/lib/query-client.ts`, `QueryClientProvider` in `main.tsx`).
- **Per-domain API client convention**: flat `src/lib/<domain>.ts` files
  (not a `src/lib/api/` directory — that would collide with the existing
  single-file `src/lib/api.ts`). One module per backend domain:
  `leads.ts`, `lookups.ts`, `cam.ts`, `bre.ts`, `disbursal.ts`,
  `collection.ts`, `verification.ts`, `feedback.ts`, `audit.ts`,
  `menu-permissions.ts`, `search.ts`, `users.ts`, `company-geography.ts`,
  `integrations.ts`. `integrations-api`'s separate gateway base path
  (`/api/v1/integrations/*`, confirmed via `gateway/nginx.conf`) was
  resolved when `lib/integrations.ts` was built — just a different path
  prefix on the same `apiFetch` wrapper, no separate client needed.
- **Role-based UI gating layer**: `src/lib/roles.ts`'s
  `useHasRole(...codes)` / `<RequireRole roles={[...]}>`, implementing
  "has any of these roles" (a user can hold multiple). First real call
  site was CAM's edit-vs-read-only gating (`useHasRole('CR2', 'CR3')`);
  used the same way in every domain section since. Leads' "My queue"
  toggle does an equivalent inline check against a specific role list
  rather than the shared hook, since it needed a different call shape.
  Real production role codes (from `backend/database/src/seed.ts`): `SA`
  Super Admin, `CA` Client Admin, `CR1` Screener, `CR2` Credit Manager,
  `CR3` Credit Head, `DS1` Disbursal Manager, `DS2` Disbursal Head, `CO1`
  Collection Executive, `CO2` State Collection Manager, `CO3` Collection
  Head, `CO4` Pre Collection Executive, `CFE1` Collection Field
  Executive, `AC1` Account Manager, `AC2` Account Head, `MR` Marketing,
  `OL` Other, `AU` Audit, `AM` Audit Manager, `AH` Audit Head, `CC`
  Customer Care, `LD1` Loan Docs, `ST` Support Tech, `AF` Affiliates.
- **Lead lifecycle status model**: `GET /master-statuses` added to
  `core-api` (didn't exist before, confirmed by grepping every
  controller), wrapped by `lib/lookups.ts`'s `listMasterStatuses()` —
  status filters/badges are driven live, no hardcoded status enum.
- **Sidebar nav: hardcoded vs. data-driven — asked the user, decided
  hardcoded**, with client-side role gating per item when needed (not
  data-driven from `GET /menu-items/grouped`). Simpler, ships faster;
  accepted trade-off that nav changes need a frontend deploy.

## Auth (partial — see `docs/TODO.md` for the remaining gaps)

Login, forgot-password (OTP), logout, session persistence, and the
401 → refresh-token → retry-once flow are all real and working against
`/api/signin`, `/api/v1/auth/logout`, `/api/forgot-password*`.

## Leads — core workflow

Replaced the original fake local `Lead` type/data in `index.tsx` with
real `lib/leads.ts` API client calls end to end.

**Role-based queue filtering** — previously the single most important
missing piece of logic. New `GET /leads/queue` (`core-api`) ports
`TaskController.php`'s role→stage table (`CR1`/`CR2`/`CO1`/`CO3`/`DS1`;
`AM`/`AH`'s audit-stage queue already lived separately at
`/audit/queue`) — falls back to the unrestricted list for `SA`/`CA`/any
unmapped role. The Leads list has a "My queue"/"All leads" toggle shown
only for roles with a defined queue, defaulting to "My queue". Verified
live: assigned a second role (`CR1`) to the seeded super admin, confirmed
`/leads/queue` narrowed to that role's stage+assignee scope while
`/leads` stayed unrestricted.

**Status-change, assignment, rejection actions** — `ChangeStatusAction`/
`AssignAction`/`RejectAction` on the lead detail page, each a modal wired
to the real `PATCH .../status`, `PATCH .../assign`, `POST .../reject`
endpoints. Assignment uses a new `GET /users/by-role` lookup (open to any
authenticated user, not `SA`/`CA`-gated like the rest of
`UsersController` — an assigning `CR2` can't call the admin-gated
`GET /users`) to scope the user picker to the right role per stage.
Rejection surfaces the `notifyBySms`/`notifyByEmail` flags from the
picked reason so the agent knows a notification will fire. All three
verified live with real DB writes, each confirmed to leave a
`LeadFollowup` audit-trail entry.

**Customer/employment/references sub-resource screens** — two new
backend read endpoints were added (`GET /leads/:id/customer`,
`GET /leads/:id/employment` — only the `PUT` upserts existed before, so
there was no way to display existing KYC/employment data at all). Both
404-when-absent, matched by `getCustomer`/`getEmployment` in
`lib/leads.ts` that catch the 404 and return `null`, same convention as
`getCam`/`getLoan`. Built `CustomerSection` (name/DOB/gender/mobile/
email/PAN/Aadhaar/address/state-city/marital status/qualification/
religion), `EmploymentSection` (income type/monthly income/employer/
designation/address), `ReferencesSection` (add/list/remove) on the lead
detail page. Editable by any authenticated user, matching the backend's
own lack of role-gating on these endpoints.

**Duplicate-lead detection + blacklist check at intake** — both built as
**non-blocking warnings** on `NewLeadForm`: the mobile field runs the
existing `/search` endpoint once 10 digits are entered and shows a count
of existing leads sharing that number; the pincode field checks against
the full blacklisted-pincodes list (small, fetched once) and warns on a
match. Neither blocks submission — no legacy confirmation was found
either way, so warning was the safer default.

**Backend bug found and fixed**: `blacklisted-pincodes` `GET` was
`@Roles('SA','CA')`-gated with no override, so the new intake-time
blacklist check (run by whichever role is creating the lead) couldn't
read the list. Fixed with the standard method-level `@Roles()` override.

Verified live end-to-end: `GET .../customer` (404 before any `PUT`, full
record after one), same for `.../employment`, added/removed a reference,
confirmed marital-status/qualification/religion lookups return real
seeded rows, blacklisted a pincode and confirmed a non-admin-shaped
request to `GET /blacklisted-pincodes` succeeds, confirmed
`GET /search?q=<mobile>` returns the expected match count.

## CAM — Credit Analysis Memo

`lib/cam.ts` (typed client, 404-when-no-CAM treated as a normal `null`
state) + `CamSection` on the lead detail page — a `CR2`/`CR3`-gated
editable form for the full `UpsertCamDto` field set (recommended amount,
ROI, penal ROI, tenure, processing fee %, admin fee, net disbursal
amount, repayment amount, disbursal/repayment dates, eligible/final
FOIR %, appraised income/obligations, risk profile/score, remarks),
read-only display for everyone else, Sanction/Send-back actions, and a
"View sanction letter" link once status is `SANCTION`.

Confirmed **`GET /leads/:leadId/sanction-letter` is wired and generates a
real PDF**. Verified end-to-end: created a CAM, sanctioned it, downloaded
and confirmed a real 8-page PDF; created a second CAM and sent it back,
confirmed the status/remarks persisted.

## BRE — Business Rule Engine

`lib/bre.ts` (typed client) + `routes/bre.tsx` (`SA`/`CA`-gated admin
screen — categories + rules, each with inline add/delete; plain lists,
not `DataTable`, since there are only 7 categories/39 rules) + a
`BreResultsSection` on the lead detail page (read-only per-rule
system/manual decision badges, `CR2`/`CR3`-gated override action — same
frontend-only role convention as CAM, since the backend doesn't
role-gate this endpoint either).

**Backend bug found and fixed**: `BreService.listCategories()`/
`listRules()` had no `isActive` filter — a soft-deleted category kept
appearing in the list. Fixed, verified live (created, deleted, confirmed
gone from the list post-fix). This was the first instance of what turned
out to be a recurring bug class across the backend — see "Backend bugs
found and fixed, catalog" below.

## Disbursal

`lib/disbursal.ts` (full typed client: `getLoan` 404-as-null,
`createLoan`, `disburseLoan`, `settleLoan`, `closeLoan`, `writeOffLoan`,
`listTransactions`, `createTransaction`) + a `DisbursalSection` on the
lead detail page — loan status badge, financial fields, a bank-picker
disburse modal, settle/close/write-off buttons, an inline transaction
list/add form. Gated client-side to `DS1` (`DS2` exists in the seeded
role table but has no distinct backend permission anywhere to gate on).

**Backend bug found and fixed**: `disbursement-banks.controller.ts` was
`SA`/`CA`-gated with no override on `GET`, so the only role that actually
disburses loans (`DS1`) couldn't list banks to populate the picker.
Fixed with a method-level `@Roles()` override.

Verified live: granted `DS1`, created a disbursement bank, created a
loan, disbursed it (bank + IMPS/ONLINE), recorded two transactions, then
settled and closed the loan.

## Collection

`lib/collection.ts` (typed client for followups, visits + assign/status,
payments + verify, blacklist, plus the four lookup lists) + a
`CollectionSection` on the lead detail page with four cards —
`CollectionFollowupsCard`, `CollectionVisitsCard` (create + per-visit
assign-to-`CFE1` picker + status dropdown), `PaymentsCard` (record +
per-payment verify dropdown when `PENDING`), `BlacklistCard`. Gated
client-side to `CO1`-`CO4`/`CFE1`.

**Deliberately not built**: a separate top-level Collection queue/
dashboard route with role-scoped pools — no legacy reference was
consulted to confirm the exact scoping rules, and Leads' existing
`QUEUE_ROLE_SCOPES` pattern has no collection-stage entries to mirror.
Inventing a pool-visibility scheme without a real backend contract
risked getting it wrong; a dedicated queue view is a backend-first task.

Verified live: granted `CO1`, hit every lookup, created a followup,
created+assigned+completed a field visit, recorded and verified a cash
payment, blacklisted the lead and confirmed `Lead.isBlacklisted` flips
to `true` on a fresh `GET /leads/:id`.

## Verification

`lib/verification.ts` + a `VerificationSection` on the lead detail page
with two cards — `BankingCard` (add account + per-account manual
"Verify" flag flip) and `DocumentsCard` (record-by-path + per-document
download-log + remove). Gated client-side to `CR1`/`LD1`.

Resolved by reading the actual implementation rather than guessing:
document upload is metadata-only (`{filePath, documentTypeId?}`, no
`StorageAdapter` call, no multipart) — built as a plain file-path/URL
text input, not a file picker. Document download only writes an audit
log row (IP + user agent), doesn't stream/sign anything — built as a
"log download" button. The banking "Verify" action takes no body and
calls nothing in `integrations-api` — a plain manual flag flip, distinct
from the real Signzy penny-drop call built later in the integrations-api
section.

**Backend bug found and fixed**: `document-types.controller.ts` had the
same `SA`/`CA`-with-no-`GET`-override bug as disbursement-banks. Fixed
the same way.

Verified live: confirmed `GET /document-types` now works for a
non-`SA`/`CA` user, created a document type, added+verified a bank
account, recorded a document + logged a download, and hit a real,
*correct* 403 on document removal (`assertLeadEditableBySupport` forbids
mutating a lead with no `leadStatus` set — confirmed this is expected
legacy-derived business logic, not a bug).

## Feedback

`lib/feedback.ts` + a new `/feedback` admin route (`SA`/`CA`-gated,
`QuestionsCard`/`AnswersCard`) + a read-only `FeedbackSection` on the
lead detail page listing submissions with their question/answer
responses inline (no role gate needed — the backend doesn't restrict
these `GET`s, and `listResponses` already embeds full question/answer
text via relations).

One route-path correction made while building: `listResponses` lives
under `CustomerFeedbackController` (`@Controller('leads/:leadId/feedback')`),
so its real path is `leads/:leadId/feedback/:feedbackId/responses`, not
a top-level path a first read of the method decorator alone might
suggest.

Verified live: created a question and an answer option, submitted a
public feedback response (unauthenticated `POST`, confirming `@Public()`
still works), confirmed the staff `GET`/responses endpoints return it
with full text embedded.

## Audit

`lib/audit.ts` (queue list, history, send-to-pre/post-audit, allocate,
hold, recommend, send-back, approval-reason) + a new `/audit` route
(queue table with stage tabs, row-click to lead detail, checkbox
multi-select + bulk allocate for `AM`/`AH`) + an `AuditSection` on the
lead detail page (history list + all seven per-lead actions, each gated
to match the backend's own `AU`/`AM`/`AH` vs. `AM`/`AH`-only split).

Note: `LeadAudit`/history is documented in the entity as a
*supplementary* trail (only written on pre/post-audit handoff +
approval-reason, not every action) — the existing `LeadFollowup` trail
shown elsewhere remains the primary record; `AuditSection`'s history
list is additive.

Verified live: granted `AH`, sent a lead to pre-audit, confirmed it
appeared in the queue and its `AUDIT-NEW` filter, allocated it to self,
held it with a scheduled date, recorded an approval reason, confirmed
history returned both entries, recommended it, sent it to post-audit,
then sent it back — confirmed the lead disappeared from the queue once
`isAuditSendBack` flipped it to `APPLICATION-SEND-BACK`.

## Menu/Permissions admin

`lib/menu-permissions.ts` + a new `/menu-permissions` admin route
(`SA`/`CA`-gated) with three cards — `MenuItemsCard` (role picker +
section/name/route inline add, grouped-by-section listing, delete),
`ExportPermissionsCard`/`MisPermissionsCard` (numeric-id grant/revoke
shell — no picker, since no export/report catalog endpoint exists to
populate one from).

**Backend bug found and fixed**: `MenuPermissionsService.list()`,
`listExportPermissions()`, `listMisPermissions()` all had no `isActive`
filter — same class of bug as BRE/disbursement-banks/document-types.
Fixed all three, re-verified live.

## Search

`lib/search.ts` + a header-level search bar (`routes/__root.tsx`,
right-aligned above `<Outlet>`, visible on every non-bare route) that
navigates to a new `/search?q=...` results route on submit.

Corrected an assumption while building: read `search.service.ts`
directly and confirmed the response is a **single flat, deduped list**
(`{leads: Lead[]}`), not results grouped by entity type — all matched
fields resolve back to one `Lead` row since loans/customers are 1:1
children of a lead. Built against the real shape instead of the guess.

Verified live: mobile-number and name-prefix searches both correctly
matched the same lead, a 1-character query correctly 400s
(`MinLength(2)`).

## Users / Roles / Activity logs

`lib/users.ts` (users CRUD, activate/deactivate/unlock, role
assign/list/remove, activity logs, role-type CRUD) + three new
`SA`/`CA`-gated routes — `/users` (list + create modal + per-row
Roles/Activate/Deactivate/Unlock actions, a role-assign modal per user),
`/roles` (flat role-type CRUD), `/activity-logs` (global viewer,
filterable by activity type).

**Backend bugs found and fixed**: `RolesService.list()` had no
`isActive` filter (matters especially here since `GET /roles` feeds
every role picker built this whole session); `UsersService.listRoles()`
had the same gap for user-role assignments. Both fixed.

Verified live: created a user, assigned then removed a role (confirmed
removal actually disappears post-fix), deactivated/reactivated/unlocked,
created then deleted a role type (confirmed deletion disappears
post-fix), confirmed `GET /activity-logs` returns real login events.

## Company / Geography admin

`lib/company-geography.ts` + a consolidated `SA`/`CA`-gated
`/company-geography` route: a companies card (expand-to-show-products),
a states/cities card (select a state, manage its cities in a side
panel), a pincodes card (state → city cascading picker, only then
loads/creates pincodes for that city — never fetches the ~7,900 seeded
rows unfiltered), and three simple list cards (branches, data sources,
blacklisted pincodes).

**Backend bugs found and fixed** — the widest sweep of the recurring
bug this whole pass: `CompanyService.list()`, `listProducts()`, and
every single `list*()` method in `GeographyService` (states, cities,
pincodes, blacklisted pincodes, branches, data sources) had no
`isActive` filter — seven methods at once. Found by deliberately
creating and deleting one row of each type live and confirming the
deleted row kept appearing. Fixed all seven, updated the four Jest
assertions that checked the old `where` shapes.

Verified live: 8 full create+list+delete+list round trips (company,
product, state, city, pincode, branch, data source, blacklisted
pincode), all correct post-fix.

## integrations-api — vendor-flow consumption (partial)

`lib/integrations.ts` + four vendor-flow UI cards — the only
`integrations-api` flows that are plain synchronous request/response
with no capture UI or async poll-elsewhere pattern needed:

- **CRIF/bureau report** — `CrifBureauCard` on the lead detail page's
  "Bureau & Verification" section, pulls name/mobile/PAN from the lead
  (only last name needs typing), shows `cibilScore`/status inline.
- **Bank verification (Signzy penny-drop)** — `BankVerificationCard`,
  clearly labeled as the real vendor check, distinct from the manual
  "Verify" flag built earlier in the Verification section.
- **UAN verification** — `UanVerificationCard`, shows found/not-found +
  employer name.
- **Razorpay payment link** — `RazorpayPaymentLinkCard` on the
  Collection section. The log entity only stores the raw vendor response
  as text (no parsed link column), so `extractRazorpayShortUrl` parses
  the standard, well-documented `short_url` field out of it.

Verified live: called all four through the actual gateway routing
(`/api/v1/integrations/*` → `integrations-api`, a different service from
everything else built this session, confirmed via `gateway/nginx.conf`).
All four authenticated correctly and failed only on the expected "vendor
credentials not configured in dev" error (`SUREPASS_API_TOKEN`/
`SIGNZY_TOKEN` missing, Razorpay's own business-rule 400 for a loan with
no outstanding balance) — confirming the request contracts are correct.
Everything else in this backend service remains open — see
`docs/TODO.md`.

## Backend bugs found and fixed, catalog

One recurring bug class was found and fixed across nine different
backend services/controllers while building and live-verifying frontend
screens this session — every one of these was `Repository.find()` /
`findAndCount()` calls with **no `isActive: true` filter**, so
soft-deleted rows kept appearing in list endpoints. Found the same way
every time: create a row via the new UI, delete it, confirm it still
shows up in the list, fix the `where` clause, rebuild, re-verify it's
gone.

- `BreService.listCategories()`/`listRules()`
- `disbursement-banks.controller.ts` — `GET` was `SA`/`CA`-gated with no
  override (a related but distinct bug: role-gating, not soft-delete)
- `document-types.controller.ts` — same role-gating bug as above
- `blacklisted-pincodes.controller.ts` — same role-gating bug as above
- `MenuPermissionsService.list()`/`listExportPermissions()`/
  `listMisPermissions()`
- `RolesService.list()`
- `UsersService.listRoles()`
- `CompanyService.list()`/`listProducts()`
- `GeographyService.listStates()`/`listCities()`/`listPincodes()`/
  `listBlacklistedPincodes()`/`listBranches()`/`listDataSources()`

Also added, not a bug fix: `GET /leads/:id/customer` and
`GET /leads/:id/employment` — genuinely didn't exist before (only the
`PUT` upserts did), needed to display existing KYC/employment data.

Every fix followed the same discipline: found live against a real
`docker compose` backend, fixed in the backend repo, existing Jest
assertions updated where they checked the old `where` shape, full
affected test suite re-run, Docker image rebuilt, fix re-verified live
before moving on — never just patched and assumed correct.

## Sanctions/Loans/Collections queue pages

`routes/loans.tsx` and `routes/collections.tsx` replaced their
client-fake/empty stubs with real queues over `GET /leads`, filtered
client-side to their domain's stage codes and role scope (mirroring
`QUEUE_ROLE_SCOPES` in `backend/core-api/src/modules/leads/leads.service.ts`),
with a My-queue/All toggle and routing into the existing per-lead
`DisbursalSection`/`CollectionSection` on `leads.$leadId.tsx`. Found and
fixed a real bug in `listLeadsQueue` (`lib/leads.ts`): "My queue" mode
unioned stage scopes across *every* role a user holds, not just the
role relevant to the current page, so a multi-role user's queue leaked
leads from unrelated pipelines — fixed with a client-side filter to the
page's own stage-code set.

`routes/sanctions.tsx` — the fictional OFAC-watchlist stub was replaced
by confirming the backend has no sanctions-screening module at all;
this repo's only real "sanction" concept is CAM loan-sanctioning + BRE
rule evaluation. Rebuilt as a BRE/CAM decision queue
(`CAM_STAGE_CODES = ['S5','S6','S9','S10','S11','S12']`, `CR2` scope),
routing into the already-built `CamSection`/`BreResultsSection` on the
lead detail page — those sections and their backing `lib/bre.ts`/
`lib/cam.ts` modules were already complete, only the queue page itself
was missing.

## Auth: change-password UI + session re-validation + lockout feedback

- **Change-password**: `POST /api/v1/auth/change-password` (guarded,
  revokes all refresh tokens on success) wired via a new
  `ChangePasswordModal`, mounted in the sidebar's user footer. Success
  forces a re-login (toast + `logout()` + redirect), since the backend
  invalidates the session server-side.
- **Session re-validation**: `useCurrentUser()` (`lib/auth.ts`) rebuilt
  on `@tanstack/react-query` polling `GET /auth/me` (5min refetch +
  refocus) instead of a one-shot `localStorage` read, so every
  `useHasRole()` gate app-wide now reflects server-truth role/session
  state instead of going stale for the life of the tab. Caveat found,
  not fixed (backend gap): `/auth/me` doesn't hit the DB — `JwtStrategy`
  just echoes the JWT payload — so it only detects a *revoked* session
  promptly; a live role/`isActive` change still waits for the access
  token's natural 15-minute expiry and the subsequent
  `/auth/refresh-token` call, which does re-read the DB.
- **Account-lockout UI feedback**: found and fixed a real bug —
  `signIn()` wasn't passing `skipAuthRefresh: true` to `apiFetch`, so
  *every* login failure (locked account or just wrong password) was
  being intercepted by `apiFetch`'s generic 401-refresh-then-redirect
  handling before the real backend error message ever reached the
  caller, surfacing a useless "Session expired" instead. Fixed, and
  `login.tsx` now matches the backend's locked-account message
  (`/locked/i`) to show a distinct "Account locked" toast instead of
  the generic sign-in-failed one. Backend distinguishes lockout from
  wrong-password only by `message` text, not a separate error code
  (`MAX_FAILED_LOGIN_ATTEMPTS = 3`, `auth.service.ts`) — live-verified
  against the real (already-locked, from this session's own testing)
  `admin@financecrm.com` account.

## Company holiday calendar admin

New `/company-holidays` route, `SA`/`CA`-gated, against
`GET`/`POST`/`DELETE /api/v1/company-holidays` (soft-delete). No edit
action built — the backend only supports add and remove, there's no
update endpoint.

## KYC document zip download

`GET /leads/:leadId/documents/kyc-zip` already existed
(`archiver`-built, unrestricted role guard beyond auth) — added a
"Download all as ZIP" button to the lead detail page's Documents card.
Needed a new `apiFetchBlob()` helper in `lib/api.ts` (sharing the
existing 401-refresh-retry logic but returning a `Blob`) since no
binary-download pattern existed anywhere in the codebase before this.

## Rejected-leads filter view

New `/rejected-leads` route filtering `S8` (SYSTEM-REJECT, automated)
and `S9` (REJECT, manual) over plain `GET /leads` — not a role-scoped
queue like Loans/Collections/Sanctions, since `S8` belongs to no
`QUEUE_ROLE_SCOPES` entry and `S9` spans both `CR1` and `CR2`. Uses the
`rejectionReasonId` query param on `GET /leads` that existed on the
backend but had no frontend consumer yet.

## `reporting-api` frontend consumption

`reporting-api` turned out to be ~103 endpoints across 10 modules
(`credit-reports`, `disbursal-reports`, `lead-reports`,
`collection-reports`, `field-visit-reports` for JSON MIS data;
`credit-exports`, `disbursal-exports`, `lead-exports`,
`collection-exports`, `financial-exports` for CSV), routed via the
gateway at `/api/v1/reporting/*`. Access is **not** role-based like the
rest of the app — it's the legacy `master_mis_report`/`master_export`
numeric-permission model (`SA`/`CA` bypass, everyone else needs an
explicit per-report grant) already manageable through the
`/menu-permissions` grant/revoke shell built earlier — this *is* the
catalog that shell was missing.

Built a static `REPORT_CATALOG` in `lib/reporting.ts` (no catalog/list
endpoint exists on the backend to fetch this dynamically) plus a
generic `/reports` picker/runner page: filter inputs adapt per report's
query shape (date range, month, financial year, or none), results
render in a `DataTable` with columns derived from the first response
row (no static per-report response type was practical at ~103
endpoints, every one a distinct raw-SQL read), CSV exports trigger a
blob download. Not yet resolved: whether a couple of report ids with
legacy ambiguity noted in backend controller comments (e.g. "also
serves legacy report_id 54") need reconciling — mirrored the
decorator's `permissionId` values as-is, didn't re-litigate.

## Live-verification gap, this batch

Every item above passed `bun run typecheck` + `bun check` and was
confirmed against the real backend via direct `curl` through the
gateway (correct 401/404 shapes, correct routing). None of it got a
full logged-in browser click-through: the shared dev account
(`admin@financecrm.com`) has no documented working password (the seed
default in `database/src/seed.ts` doesn't match live), and repeated
attempts across these sessions eventually locked it out entirely. No
agent reset the password hash or lockout counter directly in the DB —
that was tried once in an earlier session, turned out to be
irreversible, and every agent since has been explicitly told to report
it as a blocker instead. Getting a working, documented dev credential
(or an unlock path) is a prerequisite for closing the verification gap
on all of this.

## Support/ops toolkit — stuck-lead fix panel

Backend Task #64's ops-support toolkit
(`/support/leads/:leadId/*`, `SA`/`CA`) has 8 endpoints: one-click
eKYC/eSign/account-aggregator resets, allocation override
(`PATCH .../allocation`, also clears rejection metadata), and
personal/employment/bank/CAM detail overrides. All except the
eKYC/eSign resets are gated server-side by `assertLeadEditableBySupport`
(`core-api/src/common/lead-editable.util.ts`) — active,
not-yet-disbursed leads only — whose `ForbiddenException` message
(`Lead X is in status 'Y' — support overrides are only allowed while
the lead is active and not yet disbursed`) is already surfaced as-is
through the existing `ApiError` toast pattern, no translation needed.

Built as a `SupportSection` on the lead detail page (`SA`/`CA`-gated),
per `docs/TODO.md`'s own suggestion since there's no "list stuck
leads" backend endpoint — only per-lead actions, so no standalone
route/nav entry makes sense. Personal/employment override modals
expose a curated subset of fields (identity/contact, income) rather
than full parity with the existing `CustomerSection`/
`EmploymentSection` forms; bank/CAM overrides use their complete DTOs
since those are small (5 and ~13 fields).

## Bulk lead CSV import

`POST /api/v1/leads/import` (multipart, `SA`/`CA`-gated, 3000-row cap,
per-row `{row, status, leadId?, error?}` results) and
`GET /api/v1/leads/import/sample-csv` already existed. Added an
`ImportLeadsModal` on the Leads page: sample-CSV download, file input,
and a results view rendering success/fail counts plus a per-row error
table — partial failure is the realistic case, not all-or-nothing.
Needed a new `apiFetchMultipart()` helper in `lib/api.ts` (parallel to
`apiFetchBlob`, built the same session for KYC zip download).

## Performance dashboard

Previously logged in `docs/BLOCKED.md` as un-buildable — no monthly
per-user target data existed anywhere in the backend schema. Backend's
Task #72 (`backend/docs/COMPLETED.md`) closed that gap: a new
`UserTargetAllocation` entity/table plus `core-api`'s `performance`
module (`POST /performance/targets`, `SA`/`CA`-gated upsert;
`GET /performance/:userId?month=`, open to any authenticated user —
"achieved" is computed live from `CreditAnalysisMemo`, matching legacy,
which never persists it either). Moved back out of `BLOCKED.md` and built:

`lib/performance.ts` (typed client) + a new `/performance` route (no
role gate at the route level, matching the backend's open `GET`) — a
"My performance" card (target vs. achieved amount/cases as a progress
meter, for a selectable month) visible to every authenticated user,
plus an `SA`/`CA`-only "Set a user's target" form (search-user picker,
reusing the same search-then-`Select` pattern as `users.tsx`'s
`SupervisorPicker`, since there's no dedicated user-typeahead
component) that upserts a target and shows that user's resulting
performance card inline.

Not yet live-verified against a running backend (see the existing
"Live-verification gap" note above — same blocked shared dev account);
verified via `bun run typecheck`/`bun lint`/`bun run build`, all clean.

## Backend-drift sweep — 5 real gaps found, 4 built, 1 confirmed un-buildable

Backend kept committing after the previous TODO sweep closed `TODO.md`
to empty (BRE evaluation engine, CartBI, address-distance, generic
SMS/email-send endpoints, more automation-worker cron jobs). Re-audited
every backend controller against frontend `lib/*.ts` consumption rather
than trusting `backend/docs/TODO.md`'s own framing of what's left
frontend-side, which turned out stale on two points: reporting-api
consumption is complete (`reports.tsx`/`lib/reporting.ts`, ~100
report/export endpoints) and no top-level nav route uses demo data —
both already done, contrary to that file's wording.

- **RUN BRE button** — `POST /leads/:leadId/bre-results/run`
  (`BreEvaluationService.evaluate()`) had no frontend caller. Added
  `runBre()` to `lib/bre.ts` and a "Run BRE" button on
  `BreResultsSection`'s header (`leads.$leadId.tsx`), invalidating the
  results query on success. Matches legacy's literal `id="run_bre"`
  button (`Bre/bre.php`).
- **CartBI ("Novel Pattern") bank-statement upload** — `POST
  /bank-analysis/upload` had no caller. Added `uploadBankAnalysis()` to
  `lib/integrations.ts` and a `BankAnalysisCard` in Vendor
  Verifications, same document-picker pattern as Face match/POI
  (filtered to `documentType.name === 'BANK STATEMENT'`). Viewing
  results later is a backend gap (no GET-results endpoint, CartBI only
  calls back via its own webhook) — logged in `docs/BLOCKED.md`.
- **Collection followups now actually send SMS/Email** —
  `CollectionFollowupsCard` previously only wrote a `CollectionFollowup`
  row regardless of type. Confirmed against legacy
  (`CollectionController::insert_loan_collection_followup()`,
  `Collection_Model::send_collection_followup_sms/_email()`) that for
  SMS/Email types legacy sends first and only logs the followup if the
  send succeeds — and that legacy's WhatsApp branch is empty/dead code
  (never sends anything), which matches `FollowupType`'s seeded
  `Whatsapp` row already being `isActive: false` — `listFollowupTypes()`
  already excludes it, so no WhatsApp send path was built, deliberately
  diverging from a blanket "wire all three" reading. Added
  `sendGenericSms`/`sendGenericEmail` to `lib/integrations.ts`
  (`POST /sms/send`, `POST /email/send` — both designed as
  free-form/no-template endpoints for exactly this kind of caller); the
  card now shows message/template-ID fields for Sms and
  subject/body/CC fields for Email, sends first, and only calls
  `createCollectionFollowup` on a `SUCCESS` `apiStatus`. No
  template-picker endpoint exists backend-side (legacy's
  `get_followup_template_lists()` never got ported) — content here is
  free text, not templated; noted in `docs/BLOCKED.md`. `CollectionSection`
  and `CollectionFollowupsCard` now take the full `Lead` (for
  `mobile`/`email`) instead of just `leadId`.
- **Residence distance check** — `POST /address-lat-long` and `POST
  /address-distance` had no caller, despite `audit.service.ts`'s
  straight-through eligibility gate already requiring
  `LeadCustomer.residenceDistanceKm` to be set and <=25km. Confirmed
  against legacy (`VerificationController::
  calculateAadhaartoLiveLocationDistance()`) that the real UX is a
  single staff click with no manual address entry — legacy derives the
  Aadhaar address server-side; this backend's port splits that into two
  endpoints and expects the caller to supply the address text, so
  `ResidenceDistanceCard` (new, in `VerificationSection`) composes it
  from the customer's already-stored `currentAddressLine1/2`/landmark/
  city/state/pincode fields (never staff-typed) and chains
  `calculateAddressLatLong` (addressType 2) → `calculateAddressDistance`
  on one button. Added both functions to `lib/integrations.ts`, plus
  `residenceDistanceKm` to `lib/leads.ts`'s `LeadCustomer` type (decimal
  column, typed `string | null` per this codebase's existing convention
  for TypeORM decimals). The live-location half (`ReverseGeocodeLog`) is
  mobile-app-only per the existing `docs/BLOCKED.md` entry, unchanged.
- **RUNO sanction call-allocation — confirmed un-buildable, not built**
  — see `docs/BLOCKED.md`. Real endpoint exists
  (`POST /call-management/runo/sanction-allocation`) but its only
  confirmed legacy trigger is a self-service bulk lead-pickup action
  (`TaskController::allocateLeads()`) that the backend never ported
  (`changeStatus()`/`assign()` don't perform "acting user claims this
  lead" the way that function does) — attaching the RUNO call to either
  existing action would fabricate a trigger condition, so this was
  logged instead of guessed.

Verified via `bun run typecheck` and `bun check` (biome lint+format),
both clean. Not live-verified against a running backend.

## Backend closed 3 of the above gaps — built the RUNO/CartBI halves

Backend landed real fixes for 3 of this sweep's flagged gaps within
hours: `POST /leads/self-allocate` (self-service bulk lead claim,
mirroring `TaskController::allocateLeads()`, firing RUNO sanction-call
allocation server-side as a CR1-only side effect — no separate frontend
call needed for that part), `GET /bank-analysis/leads/:leadId/result`
(parsed CartBI result), and a `cam.service.ts` `sendBack()` fix that now
also transitions the lead's own status (pure backend change, no frontend
action needed — the frontend already called the real endpoint).

- **Self-allocate / "Claim leads"** — new bulk-claim UI on the Leads page
  (`index.tsx`): a checkbox column and "Claim N leads" button appear only
  in "My queue" view, only for roles with a real `SELF_ALLOCATE_RULES`
  entry (`CR1`→SCREENER, `CR2`→CREDIT, `DS1`/`DS2`→DISBURSAL — `CO1`/`CO3`
  have a queue view but no self-allocate rule, so they don't get the
  button). Calls the new `selfAllocateLeads()` (`lib/leads.ts`), which
  reports `{allocated, skipped}` — surfaced as a toast, since partial
  success (some leads no longer eligible by the time of the claim) is the
  realistic case. Closes the RUNO BLOCKED.md item: RUNO now fires
  automatically server-side, no frontend RUNO call was ever needed once
  the real self-allocate action existed.
- **CartBI parsed-results view** — `BankAnalysisCard` now also fetches
  `getBankAnalysisResult()` and renders a "Parsed result" panel
  (bank/account/fraud score/average balances) below the upload form,
  treating a 404 (`ApiError.status === 404`) as "not ready yet" rather
  than an error toast, since CartBI's callback is asynchronous.
- **CAM send-back** — no frontend change; the existing `sendBackCam()`
  call already hit the real endpoint, which now does the right thing
  server-side.

Verified via `bun run typecheck` and `bun check`, both clean. Not
live-verified against a running backend.

## Full `lib/*.ts` vs. backend entity/DTO drift sweep

Closed `docs/TODO.md`'s standing item: re-diffed every `lib/*.ts` type
against the real backend entity/DTO/controller it's fetched from
(`../backend/database/src/entities/**`, `../backend/core-api/src/
modules/**`), reading each controller's actual return shape rather than
guessing from entity naming. Skipped `reporting.ts` (deliberately
untyped, ~103 raw-SQL endpoints), `utils.ts`/`query-client.ts`/
`user-storage.ts`/`crypto.ts` (no backend-shaped types), and `verification.ts`/
`collection.ts` (fixed earlier this same session — bank-verification
`isVerified`→`accountStatusId`, collection-followup template picker).

Files checked clean, no drift: `feedback.ts`, `company-geography.ts`,
`company-holidays.ts`, `search.ts`, `auth.ts`, `roles.ts`.

Real drift found and fixed (backend's Task #105-111 rewrite silently
changed these response shapes — every one below was a live bug, not a
style nit, since `core-api`'s `ValidationPipe` runs with
`forbidNonWhitelisted: true`, so a wrong request-body field name 400s
outright rather than being ignored):

- **`audit.ts`**: `LeadAuditCaseType` was a string union, backend is a
  numeric enum (`1=>PRE_AUDIT, 2=>POST_AUDIT`); `LeadAuditHistoryEntry`
  had a `stage` field that doesn't exist (real field is `status`) and
  claimed `createdAt`/`caseType` were non-null when both are nullable.
- **`bre.ts`**: `BreDecision` was a string union with a fabricated
  `NOT_APPLICABLE` member; backend's numeric enum is `1=>APPROVE,
  2=>REFER, 3=>REJECT` with no "not applicable" value — `systemDecision`/
  `manualDecision` default to `0` instead. `BreRuleResult`'s
  `cutoffValue`/`actualValue`/`relevantInputs` were typed nullable but
  are NOT NULL columns.
- **`cam.ts`**: `CamStatus` was a string union with a fabricated
  `SEND_BACK` member (legacy has no such status — send-back reverts to
  `DRAFT`); backend enum is `0=>DRAFT, 1=>SANCTION`. Most of `Cam`'s
  numeric fields (`roi`, `recommendedLoanAmount`, `riskScore`, etc.) were
  typed as strings; backend has no string-transformer on these `double`/
  `float` columns, so they're real numbers. `sanctionedAt` doesn't exist
  on the entity at all.
- **`disbursal.ts`**: `LoanStatus` was a closed 5-value string union;
  legacy's real `Loan.status` is a free-string lifecycle label with far
  more values than this app alone sets (`SANCTION`/`DISBURSAL-*`/...) —
  narrowed to `string` with a `LOAN_STATUS` map of only the values this
  app's own actions can set. `LoanPaymentMode`/`LoanPaymentType`/
  `DisbursementTransactionStatus` were string unions; all three are
  numeric enums on the backend. `DisbursementTransaction` was missing the
  required `bank`/`disbursementBankId` field entirely (its create
  endpoint 400s without one) and had a `rawResponse` field that doesn't
  exist on the entity.
- **`leads.ts`**: `LeadUserType`'s repeat-customer value was
  `'UNPAID_REPEAT'`; the real enum stores `'UNPAID-REPEAT'` (hyphen,
  legacy's exact string). `Lead.loanAmount` was typed as a string; the
  entity's `double` column has no string transformer, so it's a real
  number (fixed here plus every `formatCurrency`/`getValue` call site in
  `audit.tsx`, `collections.tsx`, `index.tsx`, `search.tsx`).
- **`users.ts`**: `UserActivityType` was a 2-value string union missing
  `ROLE_CHANGE`; backend is a numeric enum (`1=>LOGIN, 2=>ROLE_CHANGE,
  3=>LOGOUT`) — `activity-logs.tsx`'s filter dropdown was sending the
  string literal as a query param, which the backend's `@IsEnum` rejects
  outright. `UserActivityLog.roleType` doesn't exist as a field or shape;
  the real relation is `userRole` and it's only shallow-loaded (no nested
  `roleType`). `UserRoleAssignment.level` was typed as a number; the real
  column is a string hierarchy code (`'L1'`..`'L4'`) — `users.tsx`'s
  `RoleEditForm`/`UserRolesModal` were sending a `NumberInput` value to
  an endpoint that only accepts those 4 strings, so setting a role level
  always 400'd; replaced both `NumberInput`s with an `L1`-`L4` `Select`.
  `UserRoleLocationType` was a 3-value string union; backend is numeric
  (`1=>CITY, 2=>STATE, 3=>BRANCH`) — `RoleLocationsPanel`'s "Add scope"
  action always 400'd for the same reason.
- **`menu-permissions.ts`**: `PermissionUserRole` claimed a fully-loaded
  `roleType: RoleType`, but both `listExportPermissions`/
  `listMisPermissions` only shallow-load the `userRole` relation
  (`roleType` itself is never populated) — narrowed to the fields
  actually present (`id`, `roleTypeId`, `level`). Not currently rendered
  anywhere, so no UI change needed, just the type.
- **`performance.ts`** (largest find): the entire feature was built
  against a monthly-target shape that never existed on the real backend.
  Legacy (and this rewrite) stores one *rolling* row per
  `(user, SANCTION|COLLECTION type)` with no month dimension at all —
  there is no `targetMonth` column anywhere, the real query param on
  `GET /performance/:userId` is `type` (not `month`), and `POST
  /performance/targets` requires a `type` field the frontend never sent.
  Net effect: "Set a user's target" 400'd on every submission (missing
  required field) and "My/that user's performance" silently ignored the
  month picker (an `undefined` `type` param matches whichever row TypeORM
  finds first). Rewrote `lib/performance.ts` and `routes/performance.tsx`
  around the real `type` (`SANCTION`/`COLLECTION`) axis instead of a
  month — the DatePicker/month picker is gone, replaced by a target-type
  `Select`.

Verified via `bun run typecheck` and `bun check`, both clean. Not
live-verified against a running backend (same "Live-verification gap"
blocker as earlier entries — no working shared dev credential).

## CAM form required-field marking + client-side loan-amount caps (2026-08-05)

Closed both open `docs/TODO.md` items that didn't need anything from the
client:

- **CAM form**: `appraisedMonthlyIncome` now has a real validator
  (`value > 0`, matching the backend's `@IsPositive()`) with an inline
  error, same pattern as `routes/index.tsx`'s `companyId`/`productId`
  required-field fix. `appraisedObligations` turned out not to need one
  — the backend only requires `@Min(0)` there (0 is legitimately valid,
  e.g. no debts), and the `NumberInput`'s own `min={0}` already prevents
  a value that would violate it.
- **`recommendedLoanAmount`** now validates against both caps
  client-side, mirroring `CamService.assertWithinLoanLimits()`:
  applied-amount (`lead.loanAmount`, threaded through as a new
  `CamSection`/`CamForm` prop) and eligible-amount (the flat-FOIR
  calculation, reusing the same `FOIR_CAP_PERCENT` constant the existing
  FOIR-cap check already uses via `onChangeListenTo` on the appraised
  income/obligations fields). Deliberately does **not** replicate the
  backend's Credeau-STP override (an eligible amount sourced from a
  Credeau-approved figure instead of the flat-FOIR formula, for
  straight-through-processing leads) — that needs a server-side lookup;
  the backend's own check remains authoritative for that edge case, this
  is early UX feedback for the common case only.
- Save CAM's submit button is now gated on `form.canSubmit` (previously
  only checked `saveMutation.isPending`) — same pattern already used for
  the lead-creation form.

## Curated Collection repayment-type dropdown (2026-08-05)

Closed the other open `docs/TODO.md` item. Traced legacy's real dropdown
source (`old-php-files/application/views/Collection/repayment.php`,
populated from `CollectionController::paymentHistory()`) instead of
guessing at a hardcoded status-name list: legacy filters
`master_status` by `status_stage = 'S16'`, a stage-code filter — backend
now exposes this as `GET /master-statuses?stage=S16`
(`backend/docs/COMPLETED.md` Task #136). `lib/lookups.ts`'s
`listMasterStatuses()` takes an optional `stage` param;
`PaymentsCard`'s repayment-type `Select` (`routes/leads.$leadId.tsx`)
calls `listMasterStatuses('S16')` instead of the unfiltered list. The
other 6 call sites across the app were updated to `() =>
listMasterStatuses()` only because the function signature gained a
parameter (TanStack Query was otherwise passing its query context as
that argument) — no behavior change for those.

Verified via `bun run typecheck`/`bun check`, both clean. Not
live-verified in a browser against a running backend — no local MySQL
instance available in this environment (same constraint as the backend
session that built the `?stage=` endpoint this depends on).

## `useHasRole()` SA/CA admin-override parity fix (2026-08-05)

Backend session (`backend/docs/COMPLETED.md` Task #137) cross-checked
the client's role-permission document against the backend and found
`RolesGuard` had no `SA`/`CA` bypass — an admin would get a real 403
from any `@Roles(...)`-gated endpoint they weren't literally listed on,
contradicting the client's own documentation ("Client Admin... can
perform all actions available to every other role"). Fixed there at the
guard level. `lib/roles.ts`'s `useHasRole()` had the exact same gap on
this side: even after the backend fix, an `SA`/`CA` user would still
have forms/buttons hidden from them in the UI purely because their
literal role wasn't in that feature's specific allowlist (e.g. the CAM
section's `useHasRole('CR2', 'CR3')`), despite the backend now correctly
permitting the action. Same fix mirrored here — `SA`/`CA` now always
pass `useHasRole(...)`, on top of whatever roles were actually listed.

Verified via `bun run typecheck`, clean. No test suite exists for this
frontend (typecheck + lint only, same as every other entry in this
file).

## Backend security-review + vendor-removal catch-up, and a frontend security pass (2026-08-07)

Pairs with `../backend/docs/COMPLETED.md` Tasks #142-#147. Two halves:
reacting to backend changes that were visible from here, and a security
review of this repo.

### Reacting to the backend changes

**Finbox is gone from the UI.** The backend deleted its `finbox` module
(backend Task #146, client-directed), so all five endpoints this repo
called now 404. Removed `FinboxLog`, `FINBOX_BANK_CONNECT_FETCH_METHODS`,
`FinboxBankConnectFetchMethod` and the five call wrappers from
`lib/integrations.ts` (83 lines), and the whole `FinboxSection` block from
`routes/leads.$leadId.tsx` — `FinboxCardShell` plus the device-connect,
bureau-connect, bank-connect-upload and bank-connect-fetch cards (315
lines) and the section's render site. Zero Finbox references remain.
Checked the other five removed vendors too (AppsFlyer, Adjust, TinyURL,
WhatsApp, and Credeau before it was restored): none was ever called from
this repo, so nothing else needed unwiring. **Credeau needs no change** —
it was removed and then restored the same day (backend Task #147), and
this repo never called it directly anyway.

**429 is now a real response.** The backend added `@nestjs/throttler`
globally plus tight per-handler budgets on every credential route. Nest's
default 429 body is `"ThrottlerException: Too Many Requests"`, which is not
showable copy, so `lib/api.ts` now maps 429 to "Too many attempts. Please
wait a minute and try again." That lands automatically in every existing
`error.message` toast. The three duplicated error-extraction blocks in
`apiFetch`/`apiFetchMultipart`/`apiFetchBlob` are now one `toApiError()`.

**A 401 *after* a successful refresh now ends the session.** Previously
`apiFetch` refreshed, retried once with `skipAuthRefresh: true`, and if
that retry also 401'd it fell through and threw a bare `ApiError(401)` —
so the user sat on a screen erroring on every call instead of being logged
out. Now a `endSession()` helper handles both that case and a failed
refresh. The root cause was in the backend and was fixed there too:
`AuthService.refreshTokens()` never checked the account was still usable,
so a deactivated user's refresh token kept minting access tokens that
`JwtStrategy` then rejected — the session neither worked nor ended. It now
applies the same `isUsableAccount` check `signIn` always had, and revokes
the family.

**Lockout copy was wrong.** Login told a locked-out user to "Contact your
administrator", which had been the only way out. A password reset now
clears `failedLoginCount` server-side, so the toast points at that and
routes to `/forgot-password`.

**OTP failure copy.** The backend burns a reset request after 5 wrong OTP
guesses and deliberately returns the same generic `Invalid or expired OTP`
either way — a burned request must not be distinguishable from a wrong
guess. Copy therefore can't say which happened, so it points at the action
that always works: request a new OTP.

Also checked and found **not** to need changes: the public feedback
endpoint's response narrowed to `{ id }`, but this repo only calls the
staff-facing list/responses endpoints, never submit. And the refresh cookie
moved to `sameSite: 'strict'` — harmless here, since dev goes through
Vite's `/api` proxy (same origin) and production serves both through the
gateway.

### Frontend security review

**Fixed: `javascript:` URL XSS via server-supplied hrefs.** Five links on
the lead detail page rendered a URL that originated in a third-party vendor
response and was stored verbatim: an Account Aggregator consent URL, two
eSign URLs (`initiateResult.returnUrl`, `downloadResult.returnUrl`), a
video-KYC session link, and a Razorpay payment link parsed out of stored
vendor JSON by `extractRazorpayShortUrl()`. React does not block a
`javascript:` href — it warns in dev and renders it anyway — so one
poisoned vendor response or bad row plus one staff click meant script
execution inside an authenticated CRM session. New
`lib/safe-url.ts`'s `safeExternalUrl()` returns the URL only if it parses
and is http/https, and all five sites now use it as their render condition
too, so an unsafe value renders as plain text with no link at all. This
complements the backend's fix, which validated only the eSign field
(backend Task #143) — the guard here covers every such field, present and
future.

**Fixed: `bun audit` finding.** `vite` pinned `postcss` 8.5.22, carrying
GHSA-fxqj-rqcc-2cmp (attacker-controlled `sourceMappingURL` reads arbitrary
`.map` files when `from` is unset). Build-time only, so hygiene rather than
live exposure, but a one-line root `overrides: { postcss: "^8.5.26" }`
clears it. Deliberately an override, not a direct dependency — postcss is a
vite/tailwind build tool this app never imports, and `bun update postcss`
had wrongly added it to `core-crm`'s runtime `dependencies`.

**Checked, clean:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
`new Function`, `srcdoc` or `document.write` anywhere; every `target=
'_blank'` already carries `rel='noreferrer'`; no secrets or API keys in
source; no `import.meta.env`/`process.env` reads at all, so nothing can be
leaked through the bundle; no `.env` file is tracked and `.gitignore`
covers them; the only `window.location.assign` calls are the three
hardcoded `/login` redirects, so there is no open-redirect sink.

**Noted, not changed:**

- `lib/crypto.ts` AES-GCM-encrypts the cached user in `localStorage` using
  a key derived from a constant that ships in the bundle. Its own comment
  is honest that this is obfuscation, not security, and it is — the value
  is genuinely zero against anyone who can run JS on the page. It stores
  only `{id, name, email, roles}`, no token (the session lives in httpOnly
  cookies), so the exposure it is guarding is small either way. Left alone
  because the comment prevents anyone mistaking it for a control, but it is
  ~70 lines and 100k PBKDF2 iterations buying nothing.
- `useHasRole`/`RequireRole` are UX only — the backend's `RolesGuard` is
  the real gate, and it now also refuses self-verification of payments and
  validates secrets at boot. Worth stating explicitly since role checks
  that *look* like authorization invite the assumption that they are.
- No CSP. A CSP set at the gateway would be genuine defence-in-depth for
  the XSS class fixed above; it belongs in nginx config rather than here,
  so it is flagged in `docs/TODO.md` instead.
- The per-lead authorization gap is a backend issue (backend
  `docs/TODO.md`) — no amount of frontend gating changes it, since every
  endpoint is reachable directly.

Verified: `bun run check` clean, `bun run typecheck` clean, `bun run build`
succeeds, `bun audit` reports no vulnerabilities.

### CSP closed (2026-08-07)

The Content-Security-Policy item raised in this repo's `docs/TODO.md` is
done — implemented where it belongs, in `backend/gateway/nginx.conf` rather
than here, since that proxy fronts every service. Along with
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` and
`Permissions-Policy`, all with `always` so they survive 4xx/5xx responses.
Scoped to what this app actually loads: `script-src 'self'` with no
`'unsafe-inline'` (Vite's production build emits external module scripts
only), `style-src` with `'unsafe-inline'` because Tailwind v4 and the Radix
primitives set inline styles at runtime, and `img-src`/`font-src` including
`data:` for the logo the PDF/email templates embed. See
`backend/docs/COMPLETED.md` Task #149.

### Credeau removed for good (2026-08-07)

Unwired the Credeau UI this repo built earlier (this file, "Backend/legacy-
verified TODO sweep") now that the backend has removed the integration for
real — `backend/docs/COMPLETED.md` Task #158. Unlike the Finbox-removal
check noted above ("Credeau needs no change... this repo never called it
directly anyway"), that earlier note only held because Credeau's first
backend removal was reverted the same day (backend Task #147) before this
repo ever hit a broken endpoint — this time the removal is final, so the
frontend genuinely has dead code to remove.

Removed from `lib/integrations.ts`: `CredeauDecision`, `CredeauLog`,
`runCredeauCheck`, `getLatestCredeauResult`, and `extractCrifCreditReport`
(the CRIF-report-shape helper existed solely to build Credeau's request
payload — no other caller). Removed from `leads.$leadId.tsx`:
`CREDEAU_DECISION_VARIANT`/`CredeauResultCard` and its render site on the
CAM section, the `credeauMutation` fired as a side effect of a successful
CRIF fetch inside `CrifBureauCard` (along with the now-unused
`useQueryClient()` call there), and the CAM-form comment explaining why the
client-side eligible-amount preview didn't replicate the (now nonexistent)
Credeau-STP override.

### Account controls moved from the sidebar footer to a header dropdown (2026-08-12)

At the client's request. The account name, "Change password", and
"Logout" used to sit pinned at the bottom of `Sidebar` in `__root.tsx`.
Replaced with a new `AccountMenu` component (`@radix-ui/react-popover`,
already a dependency — no new package added) rendered in the header row
next to `GlobalSearchBar`, showing a small user-icon badge, the account
name, and a chevron; opening it reveals `ChangePasswordModal` and a
Logout button. `ChangePasswordModal`'s trigger button styling was
simplified to fit a light dropdown menu instead of the dark sidebar it
used to live in exclusively (it's no longer rendered anywhere else).

The client also asked for the sidebar itself to become a hover-to-expand
icon rail; that was built and then explicitly reverted the same session
("don't make sidebar colabsable") — `Sidebar`/`SidebarItem` in
`components/ui/sidebar.tsx` are unchanged from before this task.

Also fixed, same session: the global search box (`GlobalSearchBar`) lives
in the root layout and never unmounts across navigations, so a typed
query used to sit in the box after leaving `/search` for an unrelated
page. It now watches the current pathname and clears itself whenever the
user isn't on `/search`.

Verified live against a local dev server pointed at the EC2 API: the
header dropdown opens/closes correctly and both actions work, the
sidebar renders at its original fixed width with no hover behavior, and
the search box clears after navigating from a search results page back
to Leads. `bunx biome check`, `tsc -b --force`, and `vitest run` all
clean.

Verified: `bun run check` clean, `bun run typecheck` clean.
