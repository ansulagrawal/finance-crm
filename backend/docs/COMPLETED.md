# Backend Migration — Completed Work Archive

> This is the detailed, task-by-task historical record of the NestJS
> microservices migration (tasks #36–#63, Phases 1–7). Everything in this
> file is **done** — read it when you need to know *why* something was
> built a certain way, what a specific task actually verified, or what
> judgment call was made porting a piece of legacy behavior. For what's
> still open/pending, current architecture rules, workflow conventions, and
> known gotchas, see `docs/TODO.md` instead — that file is kept small on
> purpose and this one absorbs everything once it's finished.
>
> Note: this file was split out of a single growing `TODO.md` once the
> migration reached "everything checked off" — some paths mentioned below
> still reflect the pre-flatten `apps/*`/`packages/*` layout (e.g.
> `apps/core-api`, `packages/database`) since that was the real layout at
> the time each entry was written. The repo was later flattened (see the
> `refactor: flatten apps/packages into repo root` commit) — today's real
> paths are `core-api/`, `database/`, `common/`, etc., one level shallower.
> Left as-is here since this is a historical record, not living
> documentation — don't "fix" these paths, they're describing what was true
> when written.

## What was fully built, by the end of the migration


### `packages/database` (`@finance-crm/database`)
- `src/entities/<domain>/*.entity.ts` for domains: `auth`, `bre`, `cam`,
  `collection`, `company`, `disbursal`, `feedback`, `geography`, `leads`,
  `users`, `verification`, plus `base.entity.ts` and
  `master-status.entity.ts` at the entities root. (`audit/` domain folder
  exists but is empty — Phase 3 fills it in.)
- `src/index.ts` — barrel export of every entity.
- `src/data-source.ts` — exports `buildDataSourceOptions()` (used by NestJS's
  `TypeOrmModule.forRootAsync` in each app) and `AppDataSource` (a `DataSource`
  instance used by the TypeORM CLI for migrations). Loads env vars via
  `dotenv` from both `packages/database/.env` (no-op today) and the repo-root
  `.env` (real values) — calling `dotenv.config()` twice is safe since it
  never overrides already-set vars.
- `src/migrations/1784987324272-InitialSchema.ts` — baseline migration,
  generated from a live-diffed schema (49 tables, ~80 FK constraints).
  Verified via full apply → revert → re-apply cycle against local MySQL.
  **`synchronize: false` is now set everywhere** — schema changes from here
  on must go through new migrations (`bun run migration:generate` from
  `packages/database`), never by editing entities and relying on
  auto-sync.
- Scripts (run from `packages/database/`): `bun run migration:generate`,
  `bun run migration:run`, `bun run migration:revert`.

### `packages/common` (`@finance-crm/common`)
- `src/typeorm/find-or-fail.ts` — `findOrFail<T>(repo, id, label)` helper,
  the standard FK-or-404 lookup pattern. Use this, don't reinvent per-entity
  helpers.
- `src/dto/{pagination-query.dto,paginated-result}.ts` — every list endpoint
  in every service should take a `ListXQueryDto extends PaginationQueryDto`
  and return `PaginatedResult<T>`.
- `src/auth/` — `jwt.strategy.ts`, `shared-auth.module.ts` (JWT
  *verification*-only module — no login/refresh/logout endpoints; those stay
  in `core-api`, the sole token issuer, since JWT verification is stateless
  and every other service just needs to validate, not issue), `guards/{jwt-auth,roles}.guard.ts`,
  `decorators/{current-user,public,roles}.decorator.ts`,
  `auth-cookie.constants.ts`, `auth.types.ts`. Every new service must import
  `SharedAuthModule` to get the same global `JwtAuthGuard`+`RolesGuard`+
  `@Public()`/`@Roles()` behavior `core-api` already has.
- **Not yet built** (Phase 3): `src/storage/` (file storage adapter),
  `src/pdf/` (PDF generation), `src/jobs/` (pluggable job-runner interface).

### `apps/core-api`
Fully working NestJS app, migrated into the monorepo with zero functional
regression (verified: typecheck/build/lint clean, live-booted against the
migrated MySQL DB, live-curled two endpoints and got correct 401 responses).
Existing modules (`src/modules/<name>/`): `auth` (JWT access+refresh via
httpOnly cookies, OTP forgot-password), `users` (incl. roles), `company`,
`geography`, `leads` (incl. status/assignment/rejection workflow + audit
trail via `LeadFollowup`), `cam` (credit analysis memo), `bre` (rule/category
CRUD + result recording), `disbursal`, `collection`, `verification`,
`feedback`. Conventions used throughout (continue these in every new module,
every service): thin controllers/fat services, `UpdateXDto extends
PartialType(CreateXDto)`, global guards with `@Public()`/`@Roles()` opt-outs,
audit-trail-on-mutation where an entity has one.

### `apps/gateway`
`nginx.conf` + `Dockerfile`. Currently routes everything to `core-api` (the
only populated backend so far). **Needs updating** once `reporting-api` /
`integrations-api` get path-based routes added (part of Phases 4–5, not yet
done) — don't forget this when scaffolding those services, or their routes
will be unreachable through the gateway.

### Root tooling
- Husky pre-commit hook: `bun run lint && bun run format && bun run
  typecheck`. Commit-msg hook enforces Conventional Commits
  (`<type>(<scope>): <subject>`).
- Biome (not eslint/prettier) for lint/format. `biome.json` needs
  `unsafeParameterDecoratorsEnabled: true` for Nest's constructor-injection
  decorators to parse — if that setting ever goes missing, every service's
  DI constructors will throw parse errors; that's a config regression to fix,
  not a code problem.
- The 2 long-standing `lint/complexity/useOptionalChain` warnings in
  `apps/core-api/src/modules/auth/auth.service.ts` are fixed (no longer
  present as of this note). They were left as-is for a long time because
  biome's own "unsafe fix" (`!user?.isActive || user.isDeleted`) doesn't
  type-check cleanly against `user: User | null` in this codebase's
  strict TS config. Fixed properly instead with a private `isUsableAccount(user):
  user is User` type-predicate method used at both call sites — resolves
  the lint warning via real type narrowing rather than the suggested
  optional-chain rewrite. `bun run lint` now reports zero warnings
  repo-wide.
- `bun run typecheck` / `build` / `test` at the repo root loop over
  `apps/*/` and only run in directories that have a `package.json` (guarded
  with `[ -f "$d/package.json" ] &&`) — this is why empty `reporting-api`
  etc. directories don't currently break the root scripts.
- `nest build` is kept only as a CI-verification step. Actual dev/prod
  run commands use `bun src/main.ts` directly (bypasses a tsc rootDir
  quirk that nests build output as `dist/apps/<name>/src/main.js` instead
  of a flat `dist/main.js` when the monorepo's TS inputs span multiple
  sibling directories).


## Phase-by-phase status

### Phase 1 — Monorepo foundation ✅ DONE (tasks #36–39)
- [x] Create `apps/{core-api,reporting-api,integrations-api,automation-worker,gateway}` + `packages/{database,common}` skeleton
- [x] Move `src/` → `apps/core-api/src/`, `test/` → `apps/core-api/test/`
- [x] Extract all `*.entity.ts` into `packages/database/src/entities/<domain>/`, add barrel export + shared `DataSource` config
- [x] Extract `find-or-fail`, pagination DTOs, auth guards/decorators + a `SharedAuthModule` into `packages/common/src/`
- [x] Rewrite all entity/common imports in `core-api` to `@finance-crm/database` / `@finance-crm/common`
- [x] Root `package.json` workspaces + per-app/package `package.json`s
- [x] `docker-compose.yml` (mysql + core-api + gateway) + `apps/gateway/nginx.conf`
- [x] Verified: typecheck/build/lint clean, `docker compose config` validates, live boot + live curl smoke test passed

### Phase 2 — Migrations & seed data (tasks #40–41) ✅ DONE
- [x] **Task #40 — Baseline TypeORM migration.** `synchronize: true` removed
      everywhere (`apps/core-api/src/app.module.ts` and
      `packages/database/src/data-source.ts` both now have
      `synchronize: false`). Migration file:
      `packages/database/src/migrations/1784987324272-InitialSchema.ts`.
      Verified via `migration:run` → `migration:revert` → `migration:run`
      cycle against the local `finance_crm_backend` database — all 49 tables + ~80 FK
      constraints created/dropped/recreated cleanly. `bun run
      format/lint/typecheck/build` all clean.
- [x] **Task #41a — Role types + initial Super Admin user.** DONE.
      `packages/database/src/seed.ts`, run via `bun run seed` from
      `packages/database/` (script added to its `package.json`). Seeds:
      - All 23 real production role types (`RoleType` entity/`role_types`
        table), hardcoded verbatim from an actual export of the legacy
        production `master_role_type` table
        (`/Users/ansul/Downloads/master_role_type.json`, a phpMyAdmin
        JSON export the user supplied directly — this is real prod data,
        not a guess): `CA` Client Admin, `CR1` Screener, `CR2` Credit
        Manager, `CR3` Credit Head, `DS1` Disbursal Manager, `DS2`
        Disbursal Head, `CO1` Collection Executive, `CO2` State Collection
        Manager, `CO3` Collection Head, `AC1` Account Manager, `AC2`
        Account Head, `SA` Super Admin, `CFE1` Collection Field Executive,
        `MR` Marketing, `OL` Other, `AU` Audit, `CC` Customer Care, `LD1`
        Loan Docs, `CO4` Pre Collection Executive, `ST` Support Tech, `AM`
        Audit Manager, `AH` Audit Head, `AF` Affiliates.
      - One initial Super Admin user (email/password overridable via
        `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` env vars, defaults in
        `.env.example`), password bcrypt-hashed respecting
        `BCRYPT_SALT_ROUNDS`, assigned the `SA` role via `UserRole`.
      - Idempotent — safe to re-run; skips rows that already exist by
        `code`/`email` lookup, doesn't duplicate.
      - Verified end-to-end: ran against the local `finance_crm_backend` DB twice
        (second run correctly no-opped), spot-checked via direct `mysql`
        queries that all 23 `role_types` rows and the `SA`-linked admin
        user landed correctly.
- [x] **Task #41b — Master/reference lookup data.** DONE — sourced from a
      real legacy UAT database dump the user supplied
      (`/tmp/old_data.sql`, ~90 tables, 16MB). Restored
      locally into its own MySQL database, `finance_crm_legacy_uat` (separate from
      `finance_crm_backend`, kept around for future comparison whenever a question
      comes up about legacy behavior/data shape — restore command:
      `mysql -u <user> -p<password> -e "CREATE DATABASE IF NOT EXISTS
      finance_crm_legacy_uat CHARACTER SET utf8mb4;" && mysql -u <user> -p<password>
      finance_crm_legacy_uat < /tmp/old_data.sql`). Extracted 19
      lookup tables to versioned JSON snapshots in
      `packages/database/src/seed-data/*.json` (committed to the repo —
      total ~930KB, largest is `pincodes.json` at ~790KB/7,922 rows), each
      filtered to non-deleted legacy rows and sorted by the legacy table's
      own primary key. A new module,
      `packages/database/src/seed-reference-data.ts`, loads these and
      bulk-inserts via parameterized raw SQL (fast enough for the ~8k-row
      pincode table; still fully parameterized — no string-concatenated
      SQL), wired into `bun run seed` after role types/admin user. Table
      → source mapping:
      - `states`/`cities`/`pincodes` ← `master_state`/`master_city`/
        `master_pincode` (35 / 631 / 7,922 rows). FK chains (`city.stateId`,
        `pincode.cityId`) resolved via a legacy-id → new-id map built by
        inserting in legacy-primary-key order and re-selecting
        `ORDER BY id ASC` (see the module's file-level comment for the
        exact assumption this relies on — only holds if nothing else
        writes to these tables between/before seed runs, true for a fresh
        bootstrap). **Known source data quirk, not a bug in the ETL**: 8
        cities and 21 pincodes reference a legacy state/city (Mizoram's
        state row, id 24) that is itself soft-deleted in the source even
        though the child rows aren't — those 8 cities/21 pincodes land
        with a `NULL` parent FK (both columns are nullable) rather than
        being dropped or guessed at.
      - `occupations`/`qualifications`/`religions`/`marital_statuses`/
        `blacklist_reasons`/`followup_statuses`/`followup_types`/
        `payment_modes` ← the equivalent `master_*` tables (6/4/7/5/9/18/
        4/14 rows).
      - `master_statuses` (lead/loan lifecycle stages) ← `master_status`
        (37 rows) — this is the **real** production table, superseding
        the partial/uncertain code-reconstruction from the earlier
        `old-php-files/`-only research pass; confirms that reconstruction
        was directionally correct (`1=LEAD-NEW/S1` etc. both agree) but is
        now backed by actual data instead of inference.
      - `bre_categories`/`bre_rules` ← `master_bre_category`/
        `master_bre_rule` (7/39 rows), FK-resolved the same way as
        cities/pincodes.
      - `branches` ← `master_branch` (21 rows). `lead_data_sources` ←
        `master_data_source` (4 rows). `feedback_questions`/
        `feedback_answers` ← `master_feedback_questions`/
        `master_feedback_answers` (5/3 rows).
      - `companies`/`products`: the legacy schema has no `companies`-style
        lookup table at all — it's single-tenant. Seeded one hardcoded
        `Company` ("Finance CRM") and one `Product` ("Payday Loan", code
        `PD`), based on `tbl_product`'s single row and corroborating
        evidence in the dump (S3 bucket name `finance-crm`, `it@financecrm.com`
        in API credential configs).
      - `rejection_reasons` ← `tbl_rejection_master` (67 rows), linked to
        the single seeded company/product.
      - **`document_types` still has no source** — confirmed again in this
        pass: the legacy schema has no `docs_master`/document-type lookup
        table at all, only scattered string-literal comparisons in code
        (`'VIDEO_KYC'`, `'DIGILOCKER'`, etc). Stays unseeded; not a
        regression, matches the earlier `old-php-files/`-only finding.
      - **Explicitly excluded from extraction — do not revisit this
        without a real secrets-handling plan**: `master_credentials`
        contains live, plaintext third-party API credentials (AWS
        access/secret keys, Signzy auth tokens, an SMS API key). This is
        Phase 4 integration-credential territory, not lookup/reference
        data, and must only ever be handled via `.env`/a secrets manager —
        never a seed file, never committed to git. Likewise skipped:
        `master_providers`/`master_api_provider`/`master_services`/
        `master_sms_template`/`master_templates` (vendor/template config,
        also Phase 4), `master_lms_menu` (Phase 3 Task #43, Menu/
        Permissions), `master_mis_report`/`master_export` (Phase 5).
      - Verified end-to-end: ran against local `finance_crm_backend` fresh, then
        re-ran to confirm idempotency (every table logged "already has N
        rows, skipping insert"); spot-checked FK integrity and join
        correctness directly via `mysql` (e.g. `cities JOIN states`,
        `pincodes JOIN cities`, `bre_rules JOIN bre_categories`,
        `products JOIN companies` — all returned sensible real place
        names/category names, not just non-null IDs).

### Phase 3 — Round out core-api (tasks #42–46) ✅ DONE
- [x] **Task #42 — Audit module.** DONE. New `LeadAudit` entity
      (`packages/database/src/entities/audit/lead-audit.entity.ts`,
      `lead_audits` table) + `apps/core-api/src/modules/audit/` (module,
      service, controller, 7 DTOs), migration
      `packages/database/src/migrations/1784990114995-AddLeadAudit.ts`
      (adds `lead_audits` table + `leads.auditAssignedTo`/`auditAssignedAt`/
      `isAuditSendBack` + `loans.isPostAudit`), wired into `app.module.ts`.
      A dedicated research pass over `old-php-files/AuditController.php` +
      `TaskController.php` (full findings in this conversation's history)
      found:
      - **No dedicated `Audit_Model.php`** — the legacy controller writes
        directly via `$this->db`.
      - **`lead_followup` (→ our `LeadFollowup`) is the real source of
        truth for every audit transition**; the legacy `lead_audit` table
        is written only at 3 specific points (pre/post-audit hand-off,
        approval-reason notes) — NOT on every allocate/hold/recommend/
        send-back action. This module intentionally keeps that same split
        rather than inventing a second parallel trail.
      - **Legacy role gating was weak/inconsistent** (session-only auth;
        list-query role filters existed but the write endpoints had none)
        — deliberately NOT replicated. This module enforces
        `@Roles('AU','AM','AH')` at the controller level, with
        `@Roles('AM','AH')` on the higher-privilege actions (allocate,
        recommend, send-back), and role-based queue-visibility filtering
        in `AuditService.list()` (AH sees everything; AU/AM see the shared
        unassigned AUDIT-NEW pool plus only their own assigned leads
        elsewhere) — a clean, consistent replacement, not a port.
      - **Legacy referenced a `PRE-AUDIT-NEW`/`lead_status_id 43` that does
        not exist in the real production `master_statuses` data** (see
        Task #41b's extraction — only AUDIT-NEW/INPROCESS/HOLD/RECOMMENDED
        are real rows). Legacy's `leads` table never enforced a real FK on
        status, so code could reference an id with no matching row; this
        schema does enforce that FK. `sendToPreAudit` therefore lands
        directly on AUDIT-NEW instead of a fabricated intermediate status
        — documented in a code comment in `audit.service.ts`, not silently
        changed behavior.
      - The legacy `auditNew()` eligibility checks (face-match/live-location/
        Credeau-approved-amount/residence-proof-distance business rules for
        online-application leads) reference fields/tables not yet modeled
        in this schema — **not implemented, flagged here as a follow-up
        gap**, not fabricated.
      - **Found and fixed two unrelated but significant pre-existing bugs**
        while smoke-testing this module end-to-end: `ConfigService.get<number>()`
        does not actually cast env-var strings to numbers (the generic is
        a type hint only). This broke (a) JWT access-token expiry — the
        token was issued already expired (`iat === exp`) because
        `expiresIn: "900"` (a string) was misparsed by the `ms` package as
        ~0.9 seconds instead of 900 — fixed in
        `packages/common/src/auth/shared-auth.module.ts` with an explicit
        `Number(...)` cast; and (b) bcrypt salt rounds in both
        `auth.service.ts`'s `getSaltRounds()` and `users.service.ts`'s
        `hashPassword()` — a string `saltOrRounds` is treated by bcrypt as
        a literal salt, not a cost factor, and throws — fixed the same way
        in both places. These bugs blocked literally all authenticated API
        access; without the fix nothing past login could ever be tested.
      - Verified end-to-end via live `curl` against the running service and
        local MySQL (not just typecheck/build): logged in, sent a test lead
        through send-to-pre-audit (→ AUDIT-NEW) → allocate (self-assign →
        AUDIT-INPROCESS) → hold (→ AUDIT-HOLD with scheduled date) →
        recommend (→ AUDIT-RECOMMENDED), confirmed `LeadAudit` history
        recorded correctly, and confirmed role gating actually blocks a
        user with only the `AU` role from `POST /audit/allocate` (403) while
        still allowing them to see the (correctly role-filtered) queue
        (200). All test data (lead, extra test user, temporary role grant)
        was cleaned up from the local DB afterward — nothing left behind.
      - **Not done in this task** (still open, tracked separately):
        `resonForApprovalLoan`'s equivalent is implemented
        (`recordApprovalReason`/`POST /audit/leads/:leadId/approval-reason`)
        but not wired to any specific rejection-flow trigger the way
        legacy's `RejectionController` did — revisit once the rejection
        workflow is touched again.
- [x] **Task #43 — Menu/Permissions admin module.** DONE. New entities
      under `packages/database/src/entities/menu-permissions/`
      (`MenuItem`/`menu_items`, `UserExportPermission`/
      `user_export_permissions`, `UserMisPermission`/
      `user_mis_permissions`) + `apps/core-api/src/modules/menu-permissions/`
      (3 controllers in one module — `MenuItemsController`
      `/menu-items`, `ExportPermissionsController` `/export-permissions`,
      `MisPermissionsController` `/mis-permissions` — service, 5 DTOs),
      migration `packages/database/src/migrations/1784991356298-AddMenuPermissions.ts`,
      wired into `app.module.ts`. All gated `@Roles('SA','CA')` (admin-only,
      matching the existing convention on other lookup/config CRUD
      controllers like `bre-categories.controller.ts`).
      - **Real legacy structure, confirmed against `finance_crm_legacy_uat`** (the
        local restore of the UAT dump — queried directly, not guessed from
        PHP source alone): `master_lms_menu` (82 rows) is a **flat list,
        not a self-referencing tree** — there is no parent/child column at
        all. Grouping happens via a `role_id` int (→ `MenuItem.sectionId`,
        an arbitrary numeric grouping key with no lookup table of its own)
        plus an optional `role` sub-heading (→ `sectionLabel`, only some
        rows set it). Per-item visibility is gated by `user_labels` (→
        `MenuItem.roleType`, the same code as `RoleType.code`). A `stage`
        column free-strings the workflow stage the item's list view
        queries (usually matches `MasterStatus.stageCode`, e.g. `"S31"`,
        but a few legacy rows have inconsistent values like `"1"` for
        support tickets — kept as a plain nullable string, not an FK, so
        those rows stay representable rather than forcing a fabricated
        stage mapping).
      - `user_export_permission` (43 rows) and `user_mis_permission` (54
        rows) grant a specific user access to a specific export/MIS report
        by numeric id (`exportId`/`misId`). **These stay plain ints, not
        FKs** — the catalog tables they'd reference (legacy
        `master_export`/`master_mis_report`) aren't modeled yet; that's
        Phase 5's `reporting-api`. Add real FKs to those catalog entities
        once they exist, don't do it speculatively now.
      - Migration generated (not hand-written) via `bun run
        migration:generate`, applied cleanly against local `finance_crm_backend`.
      - **Interrupted mid-verification by a session/API limit** partway
        through (the implementing agent got as far as logging in and was
        about to exercise the endpoints when it was cut off) — no commit
        had been made yet, so the work was picked up from the worktree's
        uncommitted state, reviewed, and finished/verified directly rather
        than resumed as a subagent. Verified end-to-end via live curl
        against local MySQL: created a menu item (assigned to the `CR1`
        role type) → listed it via both flat and `/grouped` endpoints →
        granted an export permission and a MIS permission to the seeded
        admin user → listed both → deleted/revoked all three (soft-delete
        via `isActive`/`isDeleted`, confirmed `204 No Content`). Confirmed
        role gating: a user with only the `CR1` role gets `403` from
        `GET /menu-items`. All test data (the menu item, both permission
        grants, a temporary `CR1`-only test user) removed from the
        database afterward — nothing left behind.
- [x] **Task #44 — Search module.** DONE. `apps/core-api/src/modules/search/`
      (module, service, controller, `SearchQueryDto`), wired into
      `app.module.ts`. Ported from the real legacy
      `old-php-files/application/controllers/SearchController.php::filter()`
      — confirmed the exact SQL-injection bug firsthand: every search field
      was concatenated straight into a raw SQL string
      (`$querySearch .= " AND LD.loan_no ='" . $loan_no . "'";` etc., no
      escaping/binding at all). Exact legacy field list confirmed from that
      file: `lead_id`, `lead_reference_no`, `loan_no`, `pancard`, `name`
      (prefix match), `mobile`, `application_no`, `aadhar`, `cif`, `email`.
      No role restriction existed on this legacy endpoint (only a
      session-login check) — matched here: the new `GET /search` route
      relies on the global JWT guard only, no `@Roles()` added.
      - New implementation: a single free-text `q` query param
        (`SearchQueryDto`, min length 2) matched with TypeORM
        `QueryBuilder` against `Lead` (leadReferenceNo/applicationNo/mobile/
        email/pancard exact, firstName prefix `ILIKE`-style, plus `id`
        exact match when `q` is purely numeric) `.leftJoin`'d to
        `LeadCustomer` (pancard/aadhaarNumber/mobile/email — the more
        authoritative KYC-level copies) and `Loan` (loanNumber) — every
        condition is a bound parameter (`:exact`, `:likeValue`, `:id`),
        zero string concatenation anywhere. Since loans/customers are 1:1
        children of a lead in this schema, every match resolves back to a
        single deduped `Lead[]` list (`{ leads: [...] }`) rather than a
        grouped-by-type response — there's no case here where a match
        exists that *isn't* ultimately "this lead".
      - **Schema gap found, not fabricated**: legacy's `cif` field
        (`LD.customer_id`, backed by a `cif_customer` table) has **no
        equivalent anywhere in the current schema** — that table was never
        ported in earlier phases. CIF is therefore not searchable yet. Not
        fixed here (out of scope for this task — would need its own
        entity + migration); flagged for whoever picks up customer/CIF
        modeling next.
      - Verified end-to-end via live `curl` against a running instance and
        local MySQL: inserted a throwaway test lead
        (name/mobile/PAN/application-no/reference-no all distinctive test
        values), confirmed matches on partial name, exact PAN, exact
        mobile, and numeric lead ID (including a leading-zero numeric
        string, to confirm the numeric-match branch works, since the
        `MinLength(2)` validator on `q` means a single-digit lead ID like
        `"2"` alone would be rejected by validation before it ever reaches
        the query — a known, minor edge case, not fixed here). **Actually
        proved the injection-safety claim, not just asserted it**: sent
        `q` values containing `' OR '1'='1` and `'; DROP TABLE leads; --`
        — both came back as an empty, harmless `{"leads":[]}` (200 OK, no
        error, no behavior change), and confirmed via a direct `SELECT
        COUNT(*) FROM leads` afterward that the table was untouched. All
        test data removed afterward.
- [x] **Task #45 — PDF generation library.** DONE.
      `packages/common/src/pdf/` — `PdfRenderer` interface +
      `PuppeteerPdfRenderer` (legacy used mPDF against plain HTML/CSS
      table markup — Puppeteer's print-to-PDF is a drop-in equivalent and
      handles modern CSS far better). `puppeteer` added as a dependency of
      `packages/common`. Exported from `@finance-crm/common`. **Now wired into a
      real core-api controller — see Task #63 below** (the "download
      sanction letter" endpoint this note originally deferred).
      - **Sanction letter + loan agreement** (`templates/sanction-letter.template.ts`,
        `renderSanctionLetterAndLoanAgreementHtml`, aliased as
        `renderLoanAgreementHtml`): ported **verbatim legal content**
        (markup modernized, text preserved) from
        `components/includes/emailer/sanction_latter.php`
        (`prepare_kfs_latter_call`) — this legacy function produces ONE
        combined PDF containing the RBI Key Fact Statement + the full
        26-clause Loan Agreement; there is no separate loan-agreement-only
        legacy document, hence the alias. Real values ported: lender
        entity "Acme Leasing Finance Private Limited" (CIN
        U74899DL1993PTC053939, registered office New Delhi), the 3-tier
        grievance escalation contacts (Customer Care / Grievance Officer
        Vicky Gupta / Nodal Officer Swati) with real phone/email. **Note**:
        a separate legacy file, `application/views/Disbursal/loanAgreementLetter.php`,
        was found but is NOT usable — it's a different company's
        (loanagainstcard.com / Naman Finlease Pvt. Ltd.) loan agreement,
        reused boilerplate in the same shared codebase; deliberately not
        ported since porting another company's legal identity into B4
        Salary's documents would be actively wrong.
      - **AA (Account Aggregator) consent form** (`templates/consent-form.template.ts`,
        `renderAccountAggregatorConsentHtml`): **naming gap flagged** — the
        legacy codebase has no distinct AA-consent document at all; the
        only AA-named legacy view is an internal ops screen for inspecting
        AA connection logs, not a consent PDF. Ported the real KFS/e-sign
        consent screen (`application/views/CAM/esign-consent-form.php`)
        instead, as the closest legacy equivalent. **If a true RBI
        Account-Aggregator-flow consent document is required, it needs to
        be authored fresh with legal input — there is no legacy source for
        it.**
      - **CIBIL report** (`templates/cibil-report.template.ts`,
        `renderCibilReportHtml`): the legacy `application/views/cibil_pdf.php`
        (titled "Consumer Base Report") is actually a **CRIF High Mark**
        bureau report ("PERFORM CONSUMER 2.0" score model), not literally
        CIBIL/TransUnion — legacy naming is historical/inaccurate to the
        vendor. **Data-handling concern found and NOT carried over**: this
        5,354-line legacy view file appears to contain a real individual's
        actual bureau data hardcoded directly into the file (a name, DOB,
        phone numbers, a voter ID) rather than templated placeholders —
        this looks like genuine PII sitting in the legacy codebase and is
        worth a separate security/data-handling review. None of those
        values were used; this template only reproduces the generic report
        *structure* (score box, account summary, per-account table,
        enquiries table), fully parameterized.
      - **Legal notice** (`templates/legal-notice.template.ts`,
        `renderLegalNoticeHtml`): **no legacy source exists at all** — a
        repo-wide search of `old-php-files/` found no legal-notice
        document, generic or otherwise. This is a clearly-labeled,
        watermarked placeholder ("PLACEHOLDER TEMPLATE — NOT REVIEWED BY
        LEGAL COUNSEL. DO NOT SEND AS-IS.") — **must not be used in
        production before legal review**.
      - Verified: rendered all four templates end-to-end with
        `PuppeteerPdfRenderer` against sample data (a throwaway script,
        removed before commit) — all produced valid, correctly-sized PDFs
        (sanction letter/loan agreement: 8 pages, matching the real
        26-clause content's actual length). Puppeteer's Chromium download
        needed a manual `bunx puppeteer browsers install chrome` on this
        machine (an initial cached download was corrupted); not a code
        issue, just a local-environment note for whoever runs this next.
- [x] **Task #46 — File storage adapter.** DONE.
      `packages/common/src/storage/`: a `StorageAdapter` interface
      (`upload`/`download`/`delete`/`getUrl`) with `LocalDiskStorageAdapter`
      (writes under `STORAGE_LOCAL_PATH`, rejects path-traversal keys) and
      `S3StorageAdapter` (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`,
      private-ACL uploads + signed-URL reads, mirroring the legacy
      `application/libraries/S3_upload.php` — same "folder prefix" concept
      via `AWS_S3_KEY_PREFIX`, default `upload` to match the legacy
      `folder_name` default). `StorageModule` picks the implementation via
      `STORAGE_DRIVER=local|s3` (mirrors legacy `LMS_DOC_S3_FLAG`), not
      wired into any core-api controller yet (that's for the
      verification/disbursal document endpoints, separate future work).
      Verified: a throwaway smoke script exercised
      upload→download→delete→path-traversal-rejection on the local adapter
      (all passed), then removed before commit — no permanent test harness
      exists yet for `packages/common` (no jest config there), so this
      isn't a committed automated test, just a one-time correctness check;
      the S3 adapter is typecheck-verified only (no real AWS credentials
      available to test against). New env vars, documented in
      `.env.example`: `STORAGE_DRIVER` (default `local`),
      `STORAGE_LOCAL_PATH`, `STORAGE_LOCAL_PUBLIC_URL`, `AWS_S3_BUCKET`,
      `AWS_REGION`, `AWS_S3_KEY_PREFIX`.

### Phase 4 — integrations-api (tasks #47–52) ✅ DONE
- [x] **#47 Scaffold service.** DONE. `apps/integrations-api/` built from
      the same template as `core-api` (`package.json`, `tsconfig.json`,
      `tsconfig.build.json`, `nest-cli.json`, `Dockerfile`, `test/jest-e2e.json`
      — no `.e2e-spec.ts` file yet, real tests are Task #60). Differences
      from `core-api`'s package.json: adds `@nestjs/axios` + `axios` (every
      vendor adapter in #48–52 will need outbound HTTP), drops
      `cookie-parser`/`bcrypt`/`passport-jwt`'s cookie-signing pieces that
      only `core-api` (the token issuer) needs — but still imports
      `SharedAuthModule` for the same global `JwtAuthGuard`+`RolesGuard`
      (cookie-based, same as every other service; no separate
      service-to-service auth mechanism introduced — if vendor calls end up
      needing one, that's a deliberate future decision, not something to
      invent speculatively here).
      - `src/main.ts` sets a distinct global prefix,
        `api/v1/integrations` (not just `api/v1` — every service shares one
        gateway and `core-api` already owns plain `/api/v1/*`, so this
        service's routes need their own namespace to be distinguishable at
        the gateway).
      - `src/app.controller.ts` exposes `GET /api/v1/integrations/health`
        (`@Public()`, for container orchestration liveness probes).
      - `docker-compose.yml`: added an `integrations-api` service (same
        shape as `core-api`'s entry, `PORT=3001`, exposes `3001`); `gateway`
        now depends on it too.
      - `apps/gateway/nginx.conf`: added an `integrations_api` upstream +
        a `location /api/v1/integrations/` block routing there, everything
        else still falls through to `core_api`.
      - Verified: `bun run format/lint/typecheck/build` clean across the
        whole monorepo (both `core-api` and `integrations-api` now
        typecheck/build independently), then live-booted `integrations-api`
        directly (`bun src/main.ts`, `PORT=3001`) against local
        `finance_crm_backend` — `TypeOrmModule`/`SharedAuthModule` initialized,
        route mapped correctly (`/api/v1/integrations/health`), and
        `curl`ed it for a real `200 ok` response.
- [x] **#49 Credeau + Finbox** adapters. DONE.
      `apps/integrations-api/src/modules/{credeau,finbox}/` + a new
      `src/common/common.module.ts` in `integrations-api` (see gotcha
      below). New entities `packages/database/src/entities/integrations/
      {credeau-log,finbox-log}.entity.ts` (`credeau_logs`/`finbox_logs`
      tables), migration
      `packages/database/src/migrations/1784999285299-AddCredeauFinboxLogs.ts`.
      - **Credeau** — a bureau/BRE decisioning vendor. Real endpoint and
        request/response shape ported verbatim from legacy
        `credeau_api_call()`
        (`components/includes/integration/payday_credeau_api.php:59-230`,
        confirmed against real rows in `finance_crm_legacy_uat`'s `api_credeau_log`
        table): `POST https://credforge.credeau.com/api/execute/finance-crm/
        bureau_mobile_bre`, headers `x-client-id`/`x-auth-token`
        (`CREDEAU_CLIENT_ID`/`CREDEAU_AUTH_TOKEN`), body
        `{user_id: "#"+PAN, reference_id, input_data: {lead_id,
        app_user_id: "", declared_income, external: {bureau_type:
        "crif_json_v2", bureau_raw_json: base64(wrapped CRIF report)}}}`.
        Response's `output_data.rules_output.final_decision.Decision` maps
        to `Approve`/`Proceed to Bank`/`Reject` (legacy's numeric
        `credeau_status_id` 1/2/3, kept as a string enum here). **Legacy
        quirk kept intentionally, not silently fixed**: the `declared_income`
        field is actually populated with the loan amount, not declared
        income — noted in a code comment, not corrected, since it's the
        real (if oddly-named) vendor contract.
      - **Finbox** — confirmed real via `components/includes/integration/
        payday_finbox_api.php` (964 lines, actually read in full), covering
        3 distinct flows unified into one `finbox_logs` table via
        `flowType`: `DEVICE_CONNECT` (POST `{customer_id, version, salt,
        metadata}`, salt = legacy's real `create_salt()` construction —
        `base64(sha256(uppercase(md5(customerId)) + serverHash))`, ported
        verbatim and independently re-verified in a unit test), 
        `BUREAU_CONNECT` (POST forwarding the lead's CRIF/CIBIL XML report,
        base64-encoded fields), `BANK_CONNECT` (GET against a
        `<entity_id>`-templated URL, `x-api-key`+`server-hash` headers, no
        body). **No matching rows found in `finance_crm_legacy_uat`** for any of
        the three `api_finbox_*_logs` tables (checked, genuinely empty/
        absent) — this is a real-code port with no live data to
        cross-check against, unlike Credeau; flagged explicitly rather than
        presented as equally verified.
      - **Real, non-obvious bug found and fixed while wiring this up**:
        `integrations-api` had no shared entity-registration module. Once
        `CredeauModule`/`FinboxModule` each registered `Lead`+`User` via
        their own `TypeOrmModule.forFeature`, booting the service threw
        `Entity metadata for User#company was not found` — TypeORM's
        `autoLoadEntities` only picks up entities *some* module registers
        via `forFeature`, and `Lead`/`User` both relate to `Company`/
        `Product`/`DataSource`/`State`/`City`/`Branch`/`MasterStatus`/
        `RejectionReason`, none of which anything in this service had
        registered. Fixed by adding
        `apps/integrations-api/src/common/common.module.ts` (mirrors
        `core-api`'s own `CommonModule` pattern) registering that full
        transitively-referenced set once; every vendor module imports it
        instead of registering `Lead`/`User` piecemeal — merged with a
        second, independently-written version of the same file from the
        UPI/Razorpay work (below), union of both entity lists, since two
        parallel agents hit this exact same boot crash independently and
        each fixed it the same way. **Any future `integrations-api` module
        that touches `Lead` or `User` must import this `CommonModule`, not
        re-register those entities itself** — otherwise the same crash
        recurs.
      - Verified: 7 real unit tests (`credeau.service.spec.ts`,
        `finbox.service.spec.ts`, using `@nestjs/testing` + a mocked
        `HttpService`, not throwaway scripts) asserting exact request
        URLs/headers/bodies against the real vendor shapes above, including
        independently re-deriving the Finbox salt via Node's `crypto` and
        asserting equality (not just re-running the same code) — plus a
        live boot (`bun src/main.ts`, port 3001) confirming both modules
        initialize and all 6 routes map correctly under
        `/api/v1/integrations/{credeau,finbox}/*`.
- [x] **#50 UPI + Razorpay payment adapters.** DONE. New entities under
      `packages/database/src/entities/integrations/`
      (`RepaymentLog`/`repayment_logs`, `UpiCollectionLog`/
      `upi_collection_logs`, `UpiCallbackLog`/`upi_callback_logs`),
      migration `packages/database/src/migrations/1784999231518-AddUpiRazorpayLogs.ts`,
      `apps/integrations-api/src/modules/{razorpay,upi}/` (2 services, 4
      controllers, 2 DTOs, 2 crypto util files + their tests), plus a new
      `apps/integrations-api/src/common/common.module.ts` registering
      `Company`/`Product`/`DataSource`/`State`/`City`/`Branch`/
      `MasterStatus`/`RejectionReason`/`User`/`DisbursementBank` — TypeORM's
      metadata builder needs every entity a registered entity relates to
      (not just the ones a module directly queries), or it throws "Entity
      metadata for Lead#company was not found" at boot. Any future
      integrations-api module that touches `Lead`/`Loan` needs this same
      `CommonModule` import, not a re-registration of the same entities.
      - **Razorpay = collection only, confirmed** — real code found at
        `old-php-files/components/includes/integration/payday_razorpay_api.php`
        (`call_razorpay_link_api()`): creates a Razorpay **Payment Link**
        (`POST https://api.razorpay.com/v1/payment_links/`, Basic Auth
        `key:secret`) for loan-repayment collection, logged to legacy
        `api_repayment_logs`. Exact payload ported: `amount` (paise),
        `currency`, `accept_partial`, `first_min_partial_amount`,
        `expire_by` (unix ts), `reference_id`, `description`,
        `customer{name,contact,email}`, `notify{sms,email}`,
        `reminder_enable`, `notes{loan_id}`, `callback_url`,
        `callback_method`. Razorpay does **not** touch disbursal payout in
        the legacy app — that stays on the existing direct-bank-transfer
        flow (`DisbursementBank`/`DisbursementTransactionLog`), confirmed
        by reading the disbursal code and finding no Razorpay reference
        there at all.
      - **Found a LIVE Razorpay key/secret hardcoded in the legacy
        codebase** (`old-php-files/components/includes/integration/integration_config.php`,
        `RAZORPAY` case: a live-mode key id and its secret) —
        **not copied anywhere in this port**; `.env.example` has placeholder
        values only. This key should be rotated by whoever owns the
        Razorpay account — it's sitting in plaintext in a legacy PHP file.
      - **Legacy has NO Razorpay webhook/reconciliation at all** — it only
        creates payment links, never confirms whether they were paid
        (confirmed by an exhaustive search of `old-php-files/` for
        `razorpay`/webhook-related code — nothing found). This is a real
        completeness gap, not something to silently replicate. Built a
        proper `RazorpayWebhookController` (`POST
        /api/v1/integrations/razorpay/webhook`, `@Public()`) verifying
        Razorpay's real documented webhook scheme: HMAC-SHA256 of the raw
        request body using a separate `RAZORPAY_WEBHOOK_SECRET`, checked
        against the `X-Razorpay-Signature` header with `timingSafeEqual`.
        `main.ts` now boots with `{ rawBody: true }` so the exact raw bytes
        (not a re-serialized JSON object) are available for the HMAC —
        using the parsed/re-stringified body would break verification.
      - **UPI = ICICI Bank's EazyPay QR/collect-pay API, confirmed — not a
        generic UPI gateway.** Real code found at
        `old-php-files/components/includes/integration/call_upi_api.php`
        + `integration_config.php`'s `UPI_API` case: endpoint
        `https://apibankingone.icici.bank.in/api/MerchantAPI/UPI/v0/QR3/{merchantId}`.
        **Both the request AND the response bodies are RSA-PKCS1-encrypted**
        (request encrypted with ICICI's public key by us, response
        encrypted by ICICI and readable only with our private key) —
        base64-encoded, POSTed as `content-type: text/plain` with an
        `apikey` header, not JSON over HTTPS with a bearer token like most
        modern APIs. Exact request shape ported: `{amount, merchantId,
        terminalId, merchantTranId, billNumber}`. Logged to legacy
        `api_upi_logs` (→ `UpiCollectionLog`).
      - **The deposit callback (`IciciCallbackController::deposit_callback()`)
        has NO signature header at all** — decrypting the raw callback
        body with our RSA private key (PKCS1 padding) IS the trust
        boundary in this design; there's no separate authenticity check to
        add on top. Ported faithfully as `UpiCallbackController` (`POST
        /api/v1/integrations/upi/callback`, `@Public()`, raw `text/plain`
        body via an `express.text()` middleware registered only on that
        path in `main.ts` since it isn't JSON). Logged to legacy
        `api_callback_upi` (→ `UpiCallbackLog`).
      - **Found a live RSA private key file physically present in the
        legacy tree**: `old-php-files/application/prod_private.key` (plus
        the paired public key `prod_public_key_collection_icici.pem`).
        **Never read, copied, or referenced its contents anywhere in this
        port** — `ICICI_UPI_PUBLIC_KEY_PATH`/`ICICI_UPI_PRIVATE_KEY_PATH`
        in `.env.example` are placeholder local file paths, and `.gitignore`
        now excludes `/keys/`, `*.pem`, `*.key` repo-wide so a real keypair
        dropped in locally can never be accidentally committed. This
        private key file should be rotated/removed from the legacy repo by
        whoever owns it — a real production decryption key sitting in
        plaintext in version control is a serious exposure.
      - Verified without live vendor credentials (none available, expected —
        see architecture decision #5): (a) `razorpay-webhook.util.spec.ts` —
        a real HMAC-SHA256 test proving the signature check accepts a
        correctly-signed payload and rejects a tampered payload, a
        wrong-secret signature, and a missing signature header; (b)
        `icici-rsa.util.spec.ts` — a real RSA keypair generated at test time
        proving encrypt→decrypt round-trips to the exact original
        plaintext and that decryption with the wrong private key never
        recovers it; (c) `upi.service.spec.ts` — mocks `HttpService`,
        captures the outgoing request, decrypts it with the test private
        key, and asserts the decrypted JSON matches ICICI's real field
        shape (`merchantId`/`terminalId`/`merchantTranId`/`billNumber`)
        and that the `content-type`/`apikey` headers are correct; also
        confirms a non-disbursed loan is rejected before any network call.
        All 3 new spec files pass (8 tests total). Then live-booted
        `integrations-api` (`bun src/main.ts`) and confirmed `UpiModule`/
        `RazorpayModule` initialize cleanly and all 4 new routes
        (`POST upi/qr-requests`, `POST upi/callback`, `POST
        razorpay/payment-links`, `POST razorpay/webhook`) map correctly
        alongside the existing health endpoint.
      - New env vars documented in `.env.example`: `RAZORPAY_KEY_ID`,
        `RAZORPAY_KEY_SECRET`, `RAZORPAY_API_URL`, `RAZORPAY_CALLBACK_URL`,
        `RAZORPAY_WEBHOOK_SECRET`, `ICICI_UPI_MERCHANT_ID`,
        `ICICI_UPI_TERMINAL_ID`, `ICICI_UPI_API_KEY`,
        `ICICI_UPI_QR_API_URL`, `ICICI_UPI_PUBLIC_KEY_PATH`,
        `ICICI_UPI_PRIVATE_KEY_PATH`.
- [x] **#48 CRIF/bureau + Payday suite.** DONE. 11 modules under
      `apps/integrations-api/src/modules/` (`crif-bureau`, `ekyc`, `esign`,
      `bank-verification`, `enach`, `face-match`, `poi-verification`,
      `uan-verification`, `domain-email-verification`, `video-kyc`,
      `reverse-geocode`, plus a shared `signzy/signzy-client.service.ts`
      HTTP client every Signzy-backed module injects instead of
      duplicating auth/base-URL/error-handling logic). 12 new log entities
      under `packages/database/src/entities/integrations/` (one per
      capability, sharing a common `ApiCallStatus` enum
      `PENDING`/`SUCCESS`/`API_ERROR`/`NETWORK_ERROR`/`VALIDATION_ERROR`
      mirroring the legacy `api_status_id` convention), migration
      `packages/database/src/migrations/1784999656478-AddIntegrationLogs.ts`.
      **Two real vendors identified, not one** — this task's title groups
      them together but the code doesn't:
      - **Signzy** — the real vendor behind eKYC/Digilocker, eSign, bank
        account verification (penny-drop), face match, PAN/Aadhaar OCR +
        PAN fetch, UAN/EPFO employment verification, domain/email
        verification, ConsenzAI video KYC, and reverse geocoding. Every
        endpoint ported verbatim from its corresponding legacy
        `payday_*_api.php` file (`payday_aadhaar_digilocker_api.php`,
        `payday_aadhaar_esign_api.php`, `payday_bank_verification_api_helper.php`,
        `payday_face_match_verification_api.php`,
        `payday_poi_verification_api.php` + `payday_poi_ocr_api.php`,
        `payday_uan_verification_api.php`, `payday_domain_verification_api.php`
        + `payday_email_verification_api.php`, `payday_video_kyc_api.php`,
        `payday_reverse_geo_code.php`), with legacy's numeric method ids
        kept identical where a log table distinguishes sub-flows by id
        (e.g. eKYC 1=create URL/2=get details/4=get e-aadhaar; POI
        1=PAN fetch/2=PAN OCR/3=Aadhaar OCR).
      - **Surepass** — the real, *currently-live* CRIF bureau report
        vendor (`crif-bureau` module), confirmed by reading
        `CibilController::index()`: legacy's own Signzy CRIF passthrough
        (`integration_config.php` case `"CRIF_CALL"`) exists in config but
        is commented out of the live code path, so it was deliberately
        NOT ported — Surepass (`payday_surepass_crif_api.php`,
        `POST kyc-api.surepass.app/api/v1/credit-report-crif/fetch-report-pdf`,
        Bearer auth) is what's actually called today.
      - **Legacy quirks handled deliberately, not silently**:
        `enach` (ICICI mandate transaction scheduling) — legacy currently
        ships this **hardcoded** (`$hardcoded = true` in
        `payday_enach_api.php`, returns a canned response, never calls the
        live ICICI endpoint). Per the "real adapters, not mocks" rule,
        this port makes the actual HTTP call instead of reproducing that
        stub — won't function until real ICICI eNACH credentials are
        supplied, same as everything else here. `domain-email-verification`
        — the legacy email-verification code builds a request body but
        never actually assigns the email address into it before sending
        (looks like a genuine legacy bug, an empty body being sent); this
        port sends the real `{ email }` body matching Signzy's documented
        contract instead of reproducing the apparent bug.
      - **A third instance of live credentials found sitting in the legacy
        codebase** (in addition to the Razorpay key/secret and RSA private
        key found during Task #50): multiple live Signzy tokens hardcoded
        directly in `old-php-files/components/includes/integration/
        integration_config.php` and `payday_aadhaar_esign_api.php`. None
        copied anywhere in this port — `SIGNZY_TOKEN` in `.env.example` is
        a placeholder. **Given three separate live-credential exposures
        found across this one legacy `integration/` directory alone
        (Razorpay, an RSA private key file, and now Signzy), a broader
        credential audit/rotation across the whole legacy codebase — not
        just the ones stumbled onto during this migration — is worth
        raising with whoever owns those systems.**
      - **Interrupted mid-task by a session/API limit** (the implementing
        agent had finished all 11 modules, entities, the migration, and a
        clean format/lint/typecheck/build pass, but had not yet written
        unit tests or this TODO.md entry when it was cut off) — picked up
        from the worktree's uncommitted state, reviewed file-by-file
        (all 11 services substantial, no stubs — verified via `wc -l`),
        and finished directly rather than resumed as a subagent.
      - Verified: migration applied cleanly against local `finance_crm_backend`;
        live-booted `integrations-api` and confirmed all 11 new modules
        initialize with every route correctly mapped under
        `/api/v1/integrations/*`; added 2 real unit tests
        (`crif-bureau.service.spec.ts`, `ekyc.service.spec.ts` — the two
        most central adapters per the original task scope) using
        `@nestjs/testing` + a mocked `HttpService`/`SignzyClientService`,
        asserting the exact real request shape/URL/auth header and
        covering the success/API-error/network-error branches (6 tests,
        all passing). The remaining 9 modules are code-verified (careful
        line-by-line comparison against their legacy source, cited in
        each file's doc comment) but not yet unit-tested — a reasonable
        gap to close incrementally in Task #60 (cross-service test pass),
        not a blocker for this task.
- [x] **#52 Adjust/AppsFlyer attribution adapter.** DONE. **Both vendors
      are real and distinct** — confirmed by reading the actual legacy
      code (`components/includes/integration/payday_adjust_api.php` and
      `payday_appsflyer_call_api.php`, both invoked from live code paths:
      `DisbursalController.php` and
      `application/controllers/CronJobs/CronMMPToolController.php`), not
      just one aspirational vendor in a task title:
      - **Adjust** (`apps/integrations-api/src/modules/adjust/`) — a
        device-attribution *lookup*, not an event push. Ports
        `adjust_inspect_device_api_call()`: `GET
        https://api.adjust.com/device_service/api/v1/inspect_device?advertising_id=<id>&app_token=<token>`,
        `Authorization: Bearer <access_token>` (confirmed against the real
        `integration_config.php` `"ADJUST"` case). Response's
        `TrackerName` field is `"<utm_source>::<utm_campaign>"`, split on
        `::` exactly as legacy does. New entity
        `AdjustDeviceLog`/`adjust_device_logs` mirrors legacy
        `api_adjust_logs` (`ad_` prefix).
      - **AppsFlyer** (`apps/integrations-api/src/modules/appsflyer/`) — a
        server-to-server conversion *event push*, a separate real
        integration. Ports `appsflyer_push_event_api()`: `POST
        https://api3.appsflyer.com/inappevent/<app_id>`, header
        `authentication: <api_key>` (lowercase key, no `Bearer` prefix,
        kept identical to legacy), body
        `{appsflyer_id, eventName, eventValue, ip, customer_user_id}`.
        Events: `eligibility_success`/`eligibility_failed`/
        `application_submit`/`loan_disbursed`. New entity
        `AppsflyerPushEventLog`/`appsflyer_push_event_logs` mirrors legacy
        `api_appsflyer_push_events` (`aape_` prefix) — this exact table
        doesn't exist in the local `finance_crm_legacy_uat` restore (likely added
        to the legacy app after that snapshot was taken), so its column
        list is taken directly from the PHP insert array in
        `payday_appsflyer_call_api.php`, not cross-checked against live
        rows the way Adjust's table was — still a real, verbatim port,
        just without a second independent data source to confirm it.
      - Migration:
        `packages/database/src/migrations/1785002707021-AddAttributionLogs.ts`.
      - **Deliberate simplifications, not silent deviations**: legacy
        resolves the AppsFlyer `app_id` (Android vs iOS app-store id) from
        the lead's `data_source_id`, with a fallback lookup by platform
        name in an `api_callback_appsflyer` table for other sources — this
        port instead takes an explicit `platform: 'android' | 'ios'` field
        on the request, since the caller (the mobile SDK integration
        itself) already knows its own platform; no equivalent of
        `api_callback_appsflyer` was ported. Legacy also gates each
        AppsFlyer event type against a specific `lead_status_id` (e.g.
        `eligibility_success` only for status ids 41/42) before allowing
        the push — those ids don't correspond to any real row in the
        actual `master_statuses` export (the same gap already flagged in
        Task #42's audit work), so that cross-check is NOT reproduced;
        the caller specifies which event fired directly via
        `AppsflyerEventType` instead.
      - **Schema gap flagged, not fabricated**: neither `Lead` nor
        `LeadCustomer` has a persisted field for device advertising
        identifiers (legacy's `customer_adjust_adid`/
        `customer_adjust_gps_adid`/`customer_adjust_idfa`, oddly named
        with "adjust" even though the AppsFlyer flow also reads from the
        same `customer_adjust_adid` column — an artifact of the legacy
        app's own vendor-history naming, not a typo introduced here) or
        for `utm_medium`/`utm_term` (only `utmSource`/`utmCampaign` exist
        on `Lead`). Both new DTOs accept these as direct request fields
        from the caller rather than reading them off `Lead`/`LeadCustomer`
        — adding persisted columns for them is a follow-up decision for
        whoever owns the mobile-app/analytics-pipeline integration, not
        something to add speculatively here.
      - **A fourth and fifth instance of live credentials found sitting in
        the legacy codebase** (on top of the Razorpay key/secret + RSA
        private key from Task #50, and the Signzy tokens from Task #48):
        a live Adjust access token + app token, and a separate live
        AppsFlyer API key (a long JWT-looking bearer credential), both
        hardcoded directly in `old-php-files/components/includes/
        integration/integration_config.php` (cases `"ADJUST"` and
        `"APPS_FLYER"`). Neither value was copied anywhere in this port —
        `.env.example` only has placeholders. **This is now five separate
        live-credential exposures found across this one legacy
        `integration_config.php`/`integration/` directory during this
        migration** — the broader credential-audit recommendation already
        raised in Tasks #48/#50 applies even more strongly now.
      - Verified: migration applied cleanly against local `finance_crm_backend`;
        live-booted `integrations-api` and confirmed both new modules
        initialize with their routes (`POST adjust/inspect-device`,
        `POST appsflyer/events`) mapped correctly alongside all
        previously-merged vendor modules; added 3 real unit tests
        (`adjust.service.spec.ts` — the adapter with the clearest,
        data-cross-checked legacy precedent) using `@nestjs/testing` + a
        mocked `HttpService`, asserting the exact request URL/Bearer
        header and covering success (with `TrackerName` parsing)/
        API-error/network-error branches (24 tests total across the
        service now, all passing).
- [x] **#51 SMS + Email + WhatsApp adapters.** DONE. New entities under
      `packages/database/src/entities/integrations/`
      (`SmsLog`/`sms_logs`, `SmsTemplate`/`sms_templates`,
      `EmailLog`/`email_logs`, `WhatsappLog`/`whatsapp_logs`), migration
      `packages/database/src/migrations/1785002679194-AddSmsEmailWhatsappLogs.ts`,
      `apps/integrations-api/src/modules/{sms,email,whatsapp}/`, wired into
      `app.module.ts`. **The task title says "SMS (RML Connect)" — that's
      inaccurate/outdated**; the real, currently-active vendor is
      different for each channel:
      - **SMS: Vapio**, not RML Connect — `components/includes/integration/
        payday_sms_sent_api.php`'s function is literally named
        `routemobile_sms_sent_api_call()`, but the live, uncommented code
        path (`$api_sub_type = "SMS_VAPIO"`) posts to Vapio's real API
        (`https://vapio.in/api.php?`, form-urlencoded
        `username`/`apikey`/`senderid`/`route`/`mobile`/`text`/`TID`/`PEID`/`format`) —
        a Whistle-provider branch exists but is entirely commented out.
        Only `sms_type_id = 1` (OTP) is a live template — confirmed
        against `master_sms_template`'s real UAT rows (2 rows, both the
        same OTP template, DLT id `1107176535879044251`, sender `acme`).
        Other type ids referenced in the legacy file are commented-out
        dead code with no corresponding live template row — not ported.
      - **Email: plain SMTP** (Mailgun relay), not a vendor HTTP API like
        every other integration in this codebase — CodeIgniter's built-in
        email library, `common_send_email()` in
        `components/includes/functions.inc.php`. `nodemailer`'s SMTP
        transport is the direct equivalent. Ported the real, verbatim
        "Thank You" application-received email
        (`common_lead_thank_you_email()`) as the one live template — legacy
        has **no email-template database table at all** (unlike SMS);
        email content is ad-hoc inline HTML in PHP functions, so this port
        keeps that same shape (a small set of template-rendering
        functions in code, not DB-driven). **Found and fixed a real XSS
        gap while porting this template**: legacy concatenates the
        customer's name and application reference number directly into
        the HTML with zero escaping; this port HTML-escapes both — a
        deliberate improvement, not a silent behavior change (documented
        in the template file's comment).
      - **WhatsApp: Pinbot.ai**, branded internally as "Whistle" (not the
        `Aisensy` branch also present in legacy config, which is dead
        code) — `payday_whatsapp_api.php`, `$api_sub_type =
        "WHATSAPP_API_WHISTLE"` uncommented/live. Request body is the
        standard Meta WhatsApp Business Cloud API template-message
        contract. Ported the `repayment_reminder` template's real
        component structure; three other legacy template names
        (`new_incomplete_file`, `complete_journey_ks3`, `reloan_approch`)
        reference legacy marketing image assets not migrated as part of
        this task — flagged, not fabricated. **No `api_whatsapp_logs`
        table exists in the local UAT restore at all** (unlike SMS/email,
        which both have real rows) — the legacy `insertTable(...)` call
        is real, active code, so the table is real in production, just
        absent from this particular snapshot; `WhatsappLog` is therefore
        code-verified, not data-verified.
      - **A fourth and fifth instance of live credentials found hardcoded
        directly in legacy PHP source**, on top of the three found in
        Tasks #48/#50: a live Vapio username/API key/PE_ID in
        `payday_sms_sent_api.php`, and — in `integration_config.php`
        alone — live credentials for Whistle SMS, Vapio SMS, Sms24hours
        SMS, a live Aisensy WhatsApp JWT-style API key, and a live
        "YELLOW AI" API key. None copied anywhere in this port. **This is
        now five separate live-credential exposures found across this one
        legacy `integration/` directory during this migration** (Razorpay,
        an RSA private key file, Signzy tokens, and now this SMS/WhatsApp
        batch) — reinforces the standing recommendation to a broader
        credential audit/rotation across the whole legacy codebase, not
        just the ones stumbled onto here.
      - Verified: migration applied cleanly against local `finance_crm_backend`;
        27 tests pass across the whole `integrations-api` service (this
        task added 2 new spec files, 6 tests: real Vapio request-shape
        assertion + status-branch coverage for SMS, a real SMTP
        `sendMail` shape assertion + the XSS-escaping fix proven for
        email). **WhatsApp has no unit test yet** — code-verified against
        its legacy source (cited in the service's doc comment) but not
        test-covered, a gap to close in Task #60, not a blocker here.
        Live-booted `integrations-api` and confirmed
        `SmsModule`/`EmailModule`/`WhatsappModule` initialize with all 3
        new routes mapped correctly alongside the 15 already-merged
        vendor modules. **Found and fixed a real boot
        crash along the way**: `EmailModule`'s transporter factory used
        `ConfigService.getOrThrow()` for `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`
        — since Nest instantiates every provider eagerly at boot, this
        crashed the *entire application* on startup whenever SMTP
        credentials weren't configured, unlike every other adapter (whose
        `getOrThrow` calls run lazily inside a request handler, only
        failing when that specific vendor call is actually made). Fixed
        by switching to `.get()` with fallback defaults in the module
        factory — an unconfigured transporter now correctly fails only at
        actual send time, matching the "won't function until real keys
        are supplied" rule instead of blocking every other adapter's boot
        too.
      - New env vars documented in `.env.example`: `VAPIO_SMS_API_URL`,
        `VAPIO_USERNAME`, `VAPIO_API_KEY`, `VAPIO_SENDER_ID`,
        `VAPIO_PE_ID`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
        `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `WHATSAPP_API_URL`,
        `WHATSAPP_API_KEY`.

### Phase 5 — reporting-api (tasks #53–55) — DONE
- [x] **#53 Scaffold service.** DONE. `apps/reporting-api/` built from the
      same template as `core-api`/`integrations-api`. Global prefix
      `api/v1/reporting`, port 3002, `docker-compose.yml` +
      `apps/gateway/nginx.conf` updated (new `reporting_api` upstream +
      `location /api/v1/reporting/` block).
      **New shared pattern, not just a per-service copy**: added
      `packages/database/src/all-entities.ts` (`ALL_ENTITIES`, exported as
      `@finance-crm/database/all-entities`) — every entity class from the barrel
      export, filtered programmatically (same logic `data-source.ts`
      already used internally for migrations, now extracted and shared).
      `reporting-api/src/common/common.module.ts` registers this full set
      via one `TypeOrmModule.forFeature(ALL_ENTITIES)`, since MIS
      reports/CSV exports legitimately cut across nearly every domain
      (a single report can join leads, CAM, BRE, disbursal, collection,
      verification, users, geography in one query) — curating a
      hand-picked entity list here would just reproduce the "Entity
      metadata for X was not found" boot crash `integrations-api` hit
      twice during Phase 4 (Tasks #49/#50) before a shared `CommonModule`
      existed there too. `data-source.ts` itself was refactored to import
      `ALL_ENTITIES` instead of duplicating the filter logic inline — pure
      mechanical extraction, verified via `migration:generate` reporting
      "No changes in database schema were found" (i.e. zero schema drift
      from the refactor).
      Verified: `bun run format/lint/typecheck/build` clean across all 3
      services (`core-api`, `integrations-api`, `reporting-api`); live-booted
      `reporting-api` (`bun src/main.ts`, port 3002) and confirmed it boots
      cleanly with all ~50 entities registered at once (the real test of
      the `ALL_ENTITIES` approach) and the health endpoint returns a real
      `200 ok`; `docker compose config` validates.
- [x] **#54/#55 MIS reports + CSV exports — real count confirmed, scope
      locked in with the user.** A dedicated research pass over
      `old-php-files/` (`ReportsController.php`/`Report_Model.php` —
      11,675 lines/82 functions — and `ExportController.php`/
      `Export_Model.php` — 3,961/1,733 lines/54 functions —
      cross-checked against real rows in `finance_crm_legacy_uat`'s
      `master_mis_report`/`master_export` tables) replaced the "~70"/"~55"
      estimates with real numbers:
      - **66 working MIS reports** + **48 working CSV exports** = **114
        genuinely portable endpoints** (not the ~125 originally guessed).
        Both legacy controllers are single-dispatcher anti-patterns (one
        route, `report_id`/`export_id` picks the behavior via a giant
        if/elseif) — **the new backend gives each report/export its own
        proper endpoint instead**, not a port of that dispatcher shape.
      - **Real, currently-unenforced security gap found**: both legacy
        dispatchers have their permission checks commented out — in
        production today, any logged-in user can invoke any report/export
        regardless of role. The data model for real enforcement already
        exists (`user_mis_permission`/`user_export_permission` — real,
        populated tables) and this schema already has it
        (`UserMisPermission`/`UserExportPermission` from Task #43). **The
        new backend must actually enforce this** — a genuine security fix
        being made during this port, not scope creep.
      - **5 name/behavior "drift" cases found** — the DB label and the
        code's actual behavior disagree for MIS ids 54/55/57/72/73 (numeric
        IDs were repurposed after old features were retired, without
        renaming the row). **Go by the code's real behavior when porting
        these, not the stale DB label** — flag the corrected name in the
        new system.
      - **Scope decisions locked in with the user** (full detail —
        including every specific report name — written up for the
        business in `REPORTING-QUESTIONS-FOR-CLIENT.md` at the repo
        root, kept in sync as work proceeds):
        1. **Skip the retired "BOB" partner loan program** (3 export
           reports, all DB rows marked deleted) — not built. Also skip
           ~10 other hidden-but-still-code-wired reports (marked
           inactive in the DB) — full list in the client file, Section 1.
        2. **Skip 5 reports/exports with no legacy code at all** for now
           (1 MIS "FLP Leasing Payment Receivable" + 4 exports — "System
           Lead Reject", "Unpaid Repeat Summary", "Total Leads Summary",
           "Loan Disbursed Pending") — real DB rows/permission keys exist
           but there's no logic anywhere to port from. Documented as open
           items in the client file, Section 2, pending real requirements
           from the business — **do not build a guessed version of
           these**, unlike the rebuild cases below.
        3. **Rebuild (not skip) 4 broken/stub reports**: MIS id 2
           (Sanction TAT — calls a deleted method, would crash if
           invoked), MIS id 48 (Hourly Collection — literal
           "Working On It." placeholder, never implemented), export id
           10 (Pending Recovery — stub, always "No Records Found"),
           export id 15 (Tally — stub, same). Since there's no working
           legacy version, these are being reconstructed from the report
           name + the pattern of similar *working* reports (e.g. Sanction
           TAT rebuilt from the working Process TAT report's pattern,
           scoped to the sanction stage) — flagged in code comments as
           reconstructed, not ported, and the client file's Section 3
           documents exactly what was broken and what judgment call was
           made for each, so the business can review and correct.
      - **Net endpoint count to actually build**: 66 MIS (including the 2
        rebuilds) + 45 exports (48 minus the 3 skipped BOB ones, including
        the 2 rebuilds) = **111 endpoints**. **Superseded below**: this was
        a pre-implementation estimate. Three additional BOB-partner MIS
        skips (report_ids 33, 37, 46) were only discovered mid-implementation
        and aren't reflected in this count, and lead report_id 54 was
        dropped as a legacy dispatcher-duplicate of id 53. The real,
        fully-reconciled total actually built is **60 MIS + 41 exports =
        101 endpoints** — verified by cross-checking every report_id/
        export_id named in every domain batch below against the real
        controller routes, one-for-one, with no unaccounted gap.
      - Full per-report/export enumeration (every single report/export
        name, its route, description, and DB/code confidence level) is
        preserved in this conversation's history for whoever picks up
        implementation — re-run the same research pass
        (`ReportsController.php`/`Report_Model.php`/
        `ExportController.php`/`Export_Model.php` + the two `master_*`
        tables) if resuming without that context.
      - **Financial/Audit/TAT + Dashboard exports batch - DONE.**
        `apps/reporting-api/src/modules/financial-exports/` (module,
        controller, service, 6 unit tests). 7 export routes under
        `financial-exports/`, each `@RequireExportPermission(<legacyId>)`:
        `ac-report`(13), `tally`(15), `audit-tat`(47), `reloan-tat`(49),
        `low-conversion-tat`(50), `high-conversion-tat`(51),
        `dashboard-data`(6). Ported directly from
        `ExportController.php`/`Export_Model.php` (`ExportACReport:530`,
        `ExportDashboardDataModel:1269`, `ExportAuditTatModel:1490`,
        `exportCSVReloanTatModel:1555`, low/high conversion TAT
        `:1602`/`:1636`). Notable decisions: GST home-state split looked
        up by `State` name ('Delhi') rather than assuming the legacy
        hardcoded numeric state id still lines up in this schema; Low/High
        Conversion TAT share one service method since the differentiating
        `user_allocation_type_id` filter is commented out in both legacy
        queries today (documented in code, not silently merged); `tally`
        is the rebuilt stub (Task #55 rebuild case) - reuses `acReport()`'s
        rows mapped to Tally's conventional voucher-import columns
        (date/ledger/debit/credit/narration), flagged for accounts-team
        review in `REPORTING-QUESTIONS-FOR-CLIENT.md`.
        Verified: `bun run format/lint/typecheck/build` clean; 6/6 unit
        tests pass (`financial-exports.service.spec.ts` - GST split
        home/non-home state, Tally row shape, reloan TAT status filter,
        conversion TAT percentage incl. divide-by-zero guard); live-booted
        `reporting-api` and confirmed all 7 routes wire with no DI errors
        (blocked only on no local MySQL instance in this sandbox, not a
        code issue - `SharedAuthModule`/`TypeOrmModule`/all providers
        resolved cleanly up to the DB connection attempt).
      - Remaining Task #54/#55 work: the other 5 parallel domain batches
        (Lead/Application, Credit/Sanction, Disbursal, Collection MIS,
        Collection exports + Field/Visit) are in progress in separate
        worktrees - merge all 6 into `feature/microservices-migration`,
        resolve `app.module.ts`/`TODO.md`/`REPORTING-QUESTIONS-FOR-CLIENT.md`
        conflicts, then re-verify the full `reporting-api` build/boot
        before marking #54/#55 complete.

  - [x] **Credit/Underwriting/Sanction slice of #54/#55 — DONE.**
        `apps/reporting-api/src/modules/credit-reports/` (14 MIS endpoints,
        `@RequireMisPermission`-gated) and `credit-exports/` (6 CSV export
        endpoints, `@RequireExportPermission`-gated), both wired into
        `AppModule` via their own module importing `CommonModule`.
        - **MIS report_ids covered**: 3 (TotalSanctionModel), 4
          (SanctionKPIModel), 9 (OutstandingReportCasesModel), 11
          (UserTypeOutstandingReport), 25/26/71 (LeadStatusSanctionWise
          New/Repeat/RepeatNEW), 29 (OutstandingReportAmountModel), 36
          (OutstandingReportCasesDateRangeModel), 38
          (SanctionExecutiveTAModel), 45 (SanctionExecutiveachievementModel
          — no "target" concept exists anywhere in this schema, so this
          returns actuals only, not actual-vs-target), 76
          (SanctionStatusWiseDetailedModel — **legacy bug fixed**: the
          legacy model takes zero params and silently ignores the date
          range the controller passes it; this port actually applies the
          filter against `creditAssignedAt`), 83
          (Bucket_Wise_Sanction_Executive_Report — this schema has no
          DPD/bucket column, so bucket is approximated from
          days-since-disbursal; flagged as an approximation, not an exact
          port), 80/code-only (exportProcessTATModel, ported as a MySQL 8
          `ROW_NUMBER()`/`LAG()` window-function CTE), and **2
          (SanctionTATReport) — rebuilt from scratch**: the legacy model
          method this report calls does not exist in `Report_Model.php` at
          all (would fatal-error if ever invoked in production); rebuilt
          using the same turnaround-time pattern as the working Process
          TAT report, scoped to credit-assignment-to-credit-approval time.
          See `REPORTING-QUESTIONS-FOR-CLIENT.md` Section 3 for the
          client-facing note.
        - **Export ids covered**: 5 (ExportSanction), 40
          (ExportApprovedSanction), 41 (ExportBRERulesResultModel), 16
          (ExportCibilReport — legacy's `loan_bureau_report_flag != 2`
          exclusion has no equivalent field in this schema, so it's not
          applied; documented as a gap, not fabricated), 20
          (ExportBlackListed), 27 (ExportLoanWaived — **schema-mismatch bug
          caught and fixed during implementation**: legacy's
          `loan_status_id = 40` concept doesn't map to `Loan.status` in
          this schema, which has no WAIVED value at all; it maps to the
          lead's lifecycle stage instead, so this filters on
          `master_statuses.name = 'DISBURSED-WAIVED'` via `Lead.leadStatusId`).
        - **Verification**: `bun run format/lint/typecheck/build` all clean
          in `apps/reporting-api` (2 pre-existing unrelated warnings in
          `core-api/auth.service.ts`, not touched here); live-booted the
          service against the local `finance_crm_backend` DB — all 20 new routes
          mapped with no DI/entity-metadata errors; confirmed
          `MisPermissionGuard`/`ExportPermissionGuard` reject unauthenticated
          requests with 401; 16 new Jest unit tests added
          (`credit-reports.service.spec.ts`, `credit-exports.service.spec.ts`)
          covering the two bug fixes (sanctionStatusWiseDetailed's date
          filter, loanWaived's status-source correction), the from-scratch
          Sanction TAT rebuild, and the ProcessTAT window-function CTE —
          27/27 tests pass repo-wide.
      - **Disbursal-domain slice DONE** —
        `apps/reporting-api/src/modules/disbursal-reports/` (7 MIS
        reports: `disbursal-summary`→6, `monthly-disbursal`→14,
        `hourly-disbursal`→15, `fy-disbursement-collection`→34,
        `hourly-loan-disbursal-by-executive`→57, `disbursal-date-wise`→70,
        `disbursal-executive-wise`→72; report_id 33
        `EMIPorfolioReportDisbursalReport` skipped per the BOB decision
        above) and `disbursal-exports/` (9 CSV exports: ids 7, 8, 18, 19,
        37, 39, 45, 46, 48), both wired into `app.module.ts`, gated with
        `@RequireMisPermission`/`@RequireExportPermission` per legacy
        report/export id.
        - **Critical finding beyond the original drift list**: our new
          `master_statuses` table's auto-incremented ids do **not** match
          legacy's `lead_status_id` numbering past the first ~19 rows
          (only aligned by coincidence of empty-table insertion order) —
          confirmed directly against the DB (e.g. legacy
          DISBURSAL-HOLD=35/DISBURSAL-SEND-BACK=37 vs. our schema's real
          ids 27/28 for those same names). Every status filter in this
          slice resolves `MasterStatus` by `.name` string, never by
          assuming a legacy numeric id carries over — **this same risk
          applies to every other domain's status-filtered reports/exports
          still to be ported**, not just disbursal.
        - **report_id 57 name-drift case, worse than flagged**: the task
          list flagged this only as a DB-label mismatch (row says "FLP
          Month Wise Collection Report"). Reading the actual legacy code
          (`HourlyLoanDisbursalReportModel`) found it isn't a real report
          at all — it's hardcoded mock HTML with fake data (a literal
          "MEENA JOSHI", a fixed date "19-Oct-2023", static numbers).
          There was nothing to port. Rebuilt as a real report matching
          the intended purpose instead: hour-band disbursal bucketing
          (same bands as report 15) additionally split by disbursal
          executive. Documented in the service method's doc comment.
        - **report_id 72 has an additional undocumented bug on top of its
          known DB-label drift** ("Leads Affiliate Report"): legacy's
          `DisbursalExecutiveWiseReport`, despite its name, actually
          groups by `lead_credit_assign_user_id` (the CREDIT executive),
          not the disbursal executive. Implemented what the name/task
          actually calls for — grouped by `Lead.disbursalAssignedTo` —
          rather than reproducing that join bug; noted in the code.
        - **export_id 8 (`exportCSVLoanPending`) dead-params fix**: legacy
          accepts `fromDate`/`toDate` but never applies them in its WHERE
          clause. This port applies them for real against
          `lead.disbursalApprovedAt`.
        - **export_id 39 (`exportCSVLoanDumpReport`) is a best-effort
          port, not 1:1**: legacy's ~150+ column dump includes many
          fields with no equivalent in the current simplified schema
          (OCR verification sub-statuses, AA-specific address fields,
          individual salary-credit instances, geo-coordinates, IP
          tracking) — these are omitted rather than faked; gap flagged
          in `REPORTING-QUESTIONS-FOR-CLIENT.md`.
        - **GST split (export_ids 45/46) home-state assumption flagged
          for confirmation**: legacy hardcodes the intra-/inter-state GST
          split by `state_id = 10`. Since state ids are exposed to the
          same renumbering risk as `master_statuses`, this port resolves
          the home state by name (`COMPANY_HOME_STATE_NAME` env var,
          defaulting to `'Rajasthan'`) instead of assuming id 10 carries
          over — needs explicit business confirmation, added to
          `REPORTING-QUESTIONS-FOR-CLIENT.md`.
        - Verified: `bun run format/lint/typecheck/build` clean; 11 unit
          tests (`disbursal-reports.service.spec.ts`,
          `disbursal-exports.service.spec.ts`) covering the two drift
          cases, the NEFT-file export, the GST split, and the closed-loan
          DPD calc all pass. Live-booting `reporting-api` against a local
          `finance_crm_backend` was not possible from this isolated worktree (no
          reachable DB credentials here) — flagged so whoever merges this
          branch re-verifies boot before considering the slice fully
          closed. **Merge-time verification did catch a real bug**: both
          `disbursal-reports.module.ts` and `disbursal-exports.module.ts`
          were missing `imports: [CommonModule]`, so `Lead`/`MasterStatus`
          repositories weren't available and the app crashed at boot with
          `UnknownDependenciesException` the moment this branch merged —
          fixed by adding the import (same pattern every other
          reporting-api module already uses). This is exactly the kind of
          bug isolated-worktree agents can't self-catch when they have no
          DB access to boot-test against; always re-verify boot after
          merging any batch that reported it couldn't.
      - **Lead/Application domain slice — DONE.** Built in
        `apps/reporting-api/src/modules/lead-reports/` and
        `.../lead-exports/`:
        - 17 MIS reports (report ids 1, 8, 18, 19, 27, 28, 31, 32, 49, 50,
          51, 52, 53, 74, 75, 81 — id 54 intentionally not built, it's the
          legacy dispatcher-bug duplicate of id 53, see the controller
          comment) plus one code-only report with no `master_mis_report`
          row (`ProcessTATReport`) — left ungated by
          `@RequireMisPermission` since there's no legacy id to gate it
          against.
        - 5 CSV exports (export ids 1, 3, 4, 43, 52).
        - **Rebuilt from dead/broken legacy code, not ported**:
          `LeadConversionReport` (id 75) — legacy's
          `LeadConversionModel()` starts with a literal `print_r(1);die;`
          debug statement, so the real query below it never executes in
          production today; reconstructed from that unreachable code's
          evident intent (income-bracket conversion funnel, capped to a
          30-day range like the original).
        - **Simplifications/schema gaps flagged in code comments** (all
          deliberate, not fabricated data): `SanctionProductivity`
          (ids 18/19) drops legacy's hardcoded 2-office team split (a
          literal array of legacy user ids, no schema equivalent);
          `LeadSourcingCityWiseStatus` (id 31) can't filter to
          "sourcing" cities (`City` has no `isSourcing`-equivalent flag);
          `RejectionAnalysis`/`ExportLeadRejected` (id 49 / export id 4)
          report by rejection reason + `BreRuleResult` REJECT-decision
          rows instead of legacy's granular `lead_eligibility_rules_result`
          flags (no equivalent entity); `LeadAssignmentSummary` (id 51)
          reports raw current assignment counts, no
          `user_lead_allocation_log`-equivalent daily-activation flag;
          `Lead_Digital_Summary_Report` (id 81) is a simplified
          per-utm_source funnel rather than legacy's full multi-CTE
          Organic/channel classification.
        - Verified: `bun run lint`/`format`/`typecheck` clean, 23 unit
          tests passing (`lead-reports.service.spec.ts`,
          `lead-exports.service.spec.ts`) covering the zero-count-status
          merge, the `systemRejectedStatus` join fix, the 30-day
          `leadConversion` guard, `processTat`'s hour-diff math, and the
          `leadRejected` BRE rule-name aggregation. **Not yet live-booted
          against a real DB in this worktree** (no local MySQL access
          available in this sandbox) — every entity/field/relation name
          used was cross-checked directly against
          `packages/database/src/entities/**` source, not guessed.
        - Other domain slices (Credit/Underwriting/Sanction, Disbursal,
          Collection ×2, Financial/Audit/TAT + Dashboard) are separate,
          independent work — see their own commits for what's covered.
      - **Collection MIS reports slice — DONE.** Built in
        `apps/reporting-api/src/modules/collection-reports/` — 18 report
        endpoints covering report ids 5, 7, 10, 12, 13, 21, 22, 23, 24, 30,
        35, 39, 41, 43, 47, 48, 55, 73 (ids 37/46 — the BOB-partner EMI
        portfolio/collection-and-outstanding reports — intentionally not
        built per the BOB skip decision in `REPORTING-QUESTIONS-FOR-CLIENT.md`).
        - Every status/role filter resolves by name via
          `master_statuses`/`role_types.code`, never a hardcoded legacy
          numeric id — the new schema's auto-increment ids don't carry
          over from legacy past the first ~19 rows (same finding as the
          disbursal batch).
        - **Design simplification, not a 1:1 port**: legacy's paired
          "type 1 / type 2" report ids (39/40, 41/42, 43/44 — same
          controller method, a `type_id` param picks payment-date vs.
          due-date filtering) are unified into one endpoint each here,
          taking `typeId` as a query param, rather than 4 separate routes.
          **Side effect worth flagging**: the permission gate on each
          unified endpoint only checks the lower legacy id (39/41/43) —
          a user granted access to only the "type 2" id (40/42/44) in the
          legacy permission table would be blocked here regardless of
          which `typeId` they request. Legacy's own permission checks are
          commented out today so this has no live behavioral precedent to
          match either way; noted here rather than silently decided.
        - **Rebuilt from a legacy stub, not ported**: `hourly-collection`
          (report id 48) — legacy always returns "Working On It.", no real
          query. Rebuilt as a real hour-of-day collection bucketing query
          against `collections.receivedDate`, matching the pattern of the
          working hourly reports in other domains. Flagged in
          `REPORTING-QUESTIONS-FOR-CLIENT.md` for business review.
        - **Two name-drift cases resolved by real behavior, not the stale
          DB label** (same pattern as the disbursal batch's drift cases):
          `sanction-wise-lead-conversion` (id 55, DB says "Collection
          Report SCM Wise") and `current-bucket-status` (id 73, DB says
          "Leads Affiliate Money Report") — both gated by their real
          legacy id, both named/implemented per their actual code
          behavior.
        - Verified: `bun run format/lint/typecheck/build` clean, 18 unit
          tests pass (`collection-reports.service.spec.ts`). Live-boot
          verification deferred to merge time (this worktree's `.env` is
          gitignored and wasn't present in the isolated checkout) — see
          the merge commit for the actual boot confirmation against the
          shared local `finance_crm_backend`.
      - **Collection-exports + Field/Visit slice DONE** (one of 6 parallel
        implementation batches). Built in
        `apps/reporting-api/src/modules/collection-exports/` (14 CSV
        exports: `export_id` 9, 10, 11, 12, 21, 22, 23, 29, 30, 31, 32, 35,
        38, 44) and `apps/reporting-api/src/modules/field-visit-reports/`
        (3 MIS reports: `report_id` 16, 17, 20). Both wired into
        `app.module.ts`. Notable deviations from a straight port, each
        documented in code comments:
        - **export_id 10 (Pending Recovery) is a genuine rebuild**, not a
          port — legacy's `exportCSVPendingRecovery` is a stub that always
          returns "No Records Found" (never queries anything). Rebuilt
          using `totalRecovery`'s (export_id 12) column structure, scoped
          to `Collection` rows with `verificationStatus = PENDING` — the
          closest real proxy for "pending recovery" in this schema.
        - **export_id 11 (Collection) role-gating fixed, not ported
          as-is** — legacy gates its extra PII columns (mobile/email)
          behind a hardcoded `user_id` plus a role check; this port drops
          the hardcoded user-id allowlist entirely and gates purely by
          role (`SA`/`CA`), enforced in the controller from the JWT's
          roles, not trusted from the query string.
        - **export_id 44 (Legal Notice Sent Log) has a real schema gap**:
          legacy's source table `loan_legal_notice_logs` has no
          corresponding entity anywhere in this schema. Implemented as a
          best-effort proxy (leads whose rejection reason mentions
          "legal") — not equivalent to a real notice-send log. Flagged in
          `REPORTING-QUESTIONS-FOR-CLIENT.md` — a proper `LegalNoticeLog`
          entity should be added once this is confirmed still needed.
        - **report_id 20 (RM Conveyance) has a real schema gap**: legacy
          computes this entirely from distance/conveyance-approval
          columns on `loan_collection_visit`
          (`col_fe_visit_total_distance_covered`, etc.) that were never
          ported onto `LoanCollectionVisit` — that entity has no
          distance/conveyance/approval fields at all. Implemented as a
          visit-count-only proxy (completed visits per RM in range), with
          all distance/conveyance-amount fields explicitly `null`, not
          fabricated. Flagged in `REPORTING-QUESTIONS-FOR-CLIENT.md`.
        - **export_id 30 (Loan Pool)** simplifies legacy's 3-way
          correlated-subquery collection-history split (as-of a fixed
          historical cutover date / after it / as-of `toDate`) down to the
          loan's current cumulative `totalReceived`, since this schema
          doesn't track a payment-date-bucketed collection history the
          same way — an intentional simplification, documented in code,
          not a silently dropped feature.
        - All three MIS reports (16/17/20) scope to leads with a
          `DISBURSED` loan as a proxy for legacy's
          `lead_status_id IN (14,16,17,18,19)` filter — this schema
          collapsed those numeric lead-status IDs into `MasterStatus`
          rows and there's no direct 1:1 mapping back to the legacy IDs.
        Verified: `bun run format/lint/typecheck/build` clean; 20 unit
        tests added (`collection-exports.service.spec.ts`,
        `collection-exports.controller.spec.ts` — covers the Pending
        Recovery rebuild and the role-gating fix in detail,
        `field-visit-reports.service.spec.ts` — covers the
        branchwise percent math and the RM-conveyance gap proxy), all
        passing; at merge time, live-booted `reporting-api` against the
        shared local `finance_crm_backend` database and confirmed all 17 new
        routes (14 collection-exports + 3 field-visit-reports) map
        correctly with clean DI wiring and no "Entity metadata not
        found" errors — `Nest application successfully started`.
      - **All 6 Phase 5 domain batches now merged.** Tasks #54/#55
        (MIS reports + CSV exports in `reporting-api`) are complete.
      - **Scope correction on report_id 16/17/20**: this batch's three
        field-visit-reports (Branch-wise Visit, RM-wise Visit, RM
        Conveyance) are hidden/inactive in the legacy DB — they were
        already on the "skip pending client confirmation" list in
        `REPORTING-QUESTIONS-FOR-CLIENT.md` Section 1b before this batch
        was assigned, which the implementing agent didn't have visibility
        into. Decision after catching this: **keep the finished
        implementation and wire it in live** rather than discard it —
        moved to a new Section 1c in the client file asking the business
        to confirm these three are actually wanted (or should be hidden
        again), same as the rest of the retired-report list.

### Phase 6 — automation-worker (tasks #56–59) — DONE
- [x] **#56 Scaffold service + pluggable job runner — DONE.** Built
      `packages/common/src/jobs/`: `JobRunner` interface (`schedule(name,
      cronExpression, handler)`), `InProcessJobRunner` (wraps
      `@nestjs/schedule`'s `SchedulerRegistry` + `CronJob` from `cron`,
      skips a run if the previous invocation of the same named job is
      still in flight rather than overlapping it), `BullMqJobRunner`
      (Redis-backed, `Queue`/`Worker` per job name, `repeat.pattern` cron
      scheduling, `removeOnComplete`/`removeOnFail` cleanup), and
      `JobRunnerModule` — a dynamic module that picks the implementation
      via a factory provider keyed on the `REDIS_URL` config value
      (unset → `InProcessJobRunner`, set → `BullMqJobRunner`), mirroring
      `StorageModule`'s existing local/S3 toggle pattern exactly. Exported
      via the `JOB_RUNNER` DI token from `@finance-crm/common`'s barrel.
      Versions verified against the npm registry rather than guessed:
      `@nestjs/schedule@6.1.3`, `bullmq@5.81.2`, `cron@4.4.0`,
      `ioredis@5.11.1`.
      Scaffolded `apps/automation-worker/` (package.json/tsconfig/
      nest-cli/Dockerfile, port 3003, global prefix `api/v1/automation`)
      mirroring `reporting-api`'s/`integrations-api`'s structure: a
      `CommonModule` registering `ALL_ENTITIES` (cron jobs cut across
      every domain, same rationale as `reporting-api`), an
      `IntegrationsApiClient` thin HTTP wrapper (via `@nestjs/axios`,
      base URL from `INTEGRATIONS_API_URL`) for calling vendor adapters
      (SMS/email/WhatsApp/attribution), and `JobRunnerModule` wired into
      `AppModule`. No `SharedAuthModule`/JWT deps — this service has no
      public HTTP surface beyond an unauthenticated `GET
      /api/v1/automation/health` (container-orchestration liveness probe
      only, not gateway-routed — `docker-compose.yml`'s `gateway` service
      does not depend on or proxy to it, matching every other service
      that has no public routes). Added `CORE_API_URL`,
      `INTEGRATIONS_API_URL`, `REDIS_URL` to `.env.example` and an
      `automation-worker` entry to `docker-compose.yml` (port 3003).
      Verified: `bun run format/lint/typecheck/build` clean across all 4
      apps; live-booted against the shared local `finance_crm_backend` — clean DI
      wiring, `JobRunnerModule` initializes in in-process mode (no
      `REDIS_URL` set locally), `Nest application successfully started`.
      BullMQ path compiles clean but wasn't live-verified (no local Redis
      instance available in this environment) — verify it against a real
      `REDIS_URL` before relying on it in production.
      **Open design question for whoever implements #57–59**: the plan
      says cron jobs call `core-api` "over HTTP using env-var service
      URLs" for data, same as `integrations-api`. But `core-api`'s routes
      are all JWT-guarded per-user — there's no service-to-service auth
      mechanism yet (a machine/service JWT, an internal-only bypass
      header, mTLS, etc.). Rather than guess this, `automation-worker`
      was scaffolded with **direct TypeORM read/write access** to the
      shared database (via `CommonModule`/`ALL_ENTITIES`, same pattern as
      `reporting-api`) as the pragmatic default — matches how the legacy
      PHP cron scripts actually worked (direct DB access, no internal API
      hop). `IntegrationsApiClient` (real HTTP, real env-var URL) is
      still the right call for vendor actions in `integrations-api`,
      since those adapters are the actual point. If a cron job needs to
      go through `core-api`'s business logic specifically (e.g. to get
      audit-trail writes for free), that's the point where the
      service-to-service auth question needs a real answer — flag it
      rather than deciding unilaterally per job.
- [x] **#57 CronSanction + CronCollection** jobs — DONE. Ported from
      `old-php-files/application/controllers/CronJobs/{CronSanctionController.php
      (2769 lines),CronCollectionController.php (438 lines)}`, using direct
      TypeORM access per the open design question above (not HTTP to
      `core-api` — that question is still open, this batch just follows the
      #56 default).

      **Routing/liveness reality check first.** `routes.php` only wires 2
      pretty aliases to `CronSanctionController` (`screenerLeadAllocation` —
      which doesn't even match a real method anymore, i.e. that alias is
      dead — and `userLeadList`), and *zero* to `CronCollectionController`.
      Under CodeIgniter 3 default routing a subdirectory controller like
      `CronJobs/CronCollectionController` is only reachable via the full
      `/CronJobs/CronCollectionController/<method>` URL, not a bare
      shortcut, so routes.php isn't a reliable liveness signal here — two
      research subagents read both controllers method-by-method instead,
      checking each one for dead branches, hardcoded/latent-broken logic,
      and dedup-window comments as a cadence proxy (documented per job
      below and in code comments).

      **Built (4 job services, 11 scheduled jobs, all under
      `apps/automation-worker/src/jobs/`):**
      - `screener-allocation/` — ports `screenerLeadAllocationG50K()` /
        `screenerLeadAllocationB50K()`. Assigns NEW leads at stage S1 to
        active `RoleType.code='CR1'` users, load-balanced round robin,
        banded by `monthlySalaryAmount` (>=50000, and 26000-50000).
        `*/5 * * * *`, gated to 09:00-23:30 (ported verbatim from legacy's
        `intval(date('H'))<9 || intval(date('Hi'))>2330` check).
      - `credit-application-allocation/` — ports
        `creditApllicationAllocationG50K()` / `...B50K()` /
        `...REPEATNEWLOGICS()`. Moves stage-S4 applications (S1+S4 for the
        REPEAT band, matching legacy's `lead_status_id IN(4,41,42,1)`) to
        active `RoleType.code='CR2'` users; backfills `screenerAssignedTo`
        if empty, same as legacy. Same `*/5 * * * *` + working-hours gate.
      - `lead-rejection/` — ports `reject_lead()` (48h screener-TAT),
        `reject_lead_new_bucket()` (72h stale-bucket TAT), and
        `reject_application()` (36h credit-TAT). `*/15 * * * *`, no
        working-hours gate (matches legacy). All three reuse the single
        seeded `rejection_reasons` row `"TAT 90 HOURS COMPLETED"` (legacy
        `lead_rejected_reason_id=63`, the only auto-TAT-reject reason row in
        `seed-data/rejection-reasons.json`) as the FK, since legacy itself
        reused that one id everywhere — but this port's `LeadFollowup`
        remark states the *real* threshold used (legacy's remark text said
        "90 HOURS" / "120 HOURS" in two of the three methods regardless of
        the actual 36h/48h/72h check — a copy-paste bug, fixed here rather
        than replicated).
      - `collection-defaulter-escalation/` — ports
        `loanDefaulterat1Dayto30Day()` / `...31Dayto60Day()` /
        `...60PlusDay()` from `CronCollectionController.php`. Finds
        disbursed loans (`MasterStatus.name IN ('DISBURSED','PART-PAYMENT')`)
        whose CAM `repaymentDate` falls in each DPD bucket. **Log-only** —
        see schema gap below. Scheduled once daily at `0 6 * * *` (legacy
        has no cron-log dedup guard on these 3 methods, unlike the
        30-minute-guarded `calculationOpenCaseLoans()`, which the research
        agent read as "typical of a daily batch sweep, not a frequent
        poll").
      - `jobs/shared/` — `round-robin.util.ts` (`allocateRoundRobin`, a
        pure/tested generalization of legacy's `usort`-then-assign
        pattern used by every allocation method) and
        `working-hours.util.ts` (`isWithinHhmmWindow`, ports the
        `date('Hi')`-based gate). Full jest coverage for both plus every
        job service (repository calls mocked, no real DB in unit tests).

      **Judgment calls / deliberate deviations (all documented in the
      corresponding service's doc comment too):**
      1. Legacy segmented screener/credit teams by
         `user_roles.user_allocation_type_id` (separate "above 50k" vs
         "below 50k" specialist rosters). This schema's `UserRole` has no
         such column — **schema gap**. Both salary bands now draw from the
         same active-CR1/CR2 pool; only the *lead's* salary still gates
         which band it falls into. Recommend adding a
         `specialization`/`allocationType` column to `UserRole` if the
         legacy team split needs to be restored.
      2. Legacy tracked each user's "today's allocation count" via a
         `user_lead_allocation_log` table this schema doesn't have —
         **schema gap**. This port's workload signal is each user's current
         count of LEAD-INPROCESS / APPLICATION-INPROCESS leads, a
         reasonable but not identical proxy for "today's load."
      3. `master_statuses` seed data (`packages/database/src/seed-data/
         master-statuses.json`) has no row for legacy `lead_status_id=42`
         — **seed-data gap**. Queries that would have used
         `lead_status_id IN(1,41,42)` etc. now match on
         `MasterStatus.stageCode='S1'` instead, which is unaffected by the
         missing id.
      4. `lead_data_sources` seed data has no row for legacy id 21 (used by
         the defaulter methods' `lead_data_source_id != 21` exclusion) —
         **seed-data gap**, filter omitted, noted in code. Id 17
         ("AffiliatesApp"/`AFFAPP`) *does* exist and its exclusion (used by
         the screener allocation methods) is ported.
      5. **Schema gap, `Loan` has no recovery-stage column.** Legacy wrote
         `loan.loan_recovery_status_id` (1/2/3) in the three defaulter
         methods. This schema's `Loan` entity has no equivalent. Considered
         and rejected: writing a `LoanCollectionFollowup` row instead — its
         `FollowupType`/`FollowupStatus` lookups are human-agent
         call-outcome categories ("Call", "No Answered", "Committed but not
         Paid", ...), not escalation stages, so reusing them would
         misrepresent an automated system action as manual agent activity.
         Chosen proxy: **the job is currently log-only** (finds the loans,
         logs a structured summary via `Logger`, does not write). This
         actually matches legacy's *real* production behavior today: its
         `middlewareEmail()` helper's `lw_send_email()` call is commented
         out, so the "CTO summary email" never sent either — only a DB log
         row. Recommend a migration adding a `recoveryStage` enum column to
         `Loan` before wiring a real write here.
      6. `loanDefaulterat60PlusDay()`'s name/email-subject say "60 PLUS
         DAYS" but its actual legacy SQL window was capped at 90 days
         (`repayment_date > today-91 AND <= today-61`) — a legacy bug
         silently excluding anything past 90 days overdue. This port
         implements the 60+ bucket as genuinely open-ended. Also
         normalized the DPD-bucket date math to be inclusive on both ends
         (legacy's lower bound was exclusive, an off-by-one) — "DPD 1 to 30
         inclusive" is the actually-intended bucket.
      7. `reject_application()` originally scoped itself to a hardcoded
         list of 8 `lead_credit_assign_user_id`s. Hardcoding specific
         (possibly ex-)employee ids into this codebase would be
         unmaintainable and meaningless without a live HR/roster feed, so
         this port applies the TAT rule to every application in stage
         S5/S6 org-wide — **a genuine scope-widening, flagged for business
         confirmation**, not an engineering-only call.
      8. **No `integrations-api` endpoint matches any notification these
         jobs need to send.** `integrations-api` today only exposes OTP SMS
         (`/sms/otp`), a thank-you email (`/email/thank-you`), and a
         repayment-reminder WhatsApp template (`/whatsapp/template`) — none
         of which match "your case handler is X" (customer-facing,
         `lead_allocation_email_notification`) or the CTO ops-summary email
         (`middlewareEmail`). Calling one of those endpoints with the wrong
         content would be worse than not sending, so every job logs its
         notification intent via `Logger` instead of a fabricated vendor
         call. `IntegrationsApiClient` is still injected/available in
         `AppModule` for #58/#59, just unused by this batch. Recommend
         adding a generic "operational notification email" endpoint and a
         "case handler assigned" customer template to `integrations-api`
         before wiring real sends here.

      **Skipped (not ported), with reasons:**
      - `getFacebookCampaignData()` / `process_facebook_lead_data()` —
        marketing-attribution FB lead ingestion, out of scope for a
        sanction/collection cron batch (likely #59/MMPTool territory).
      - `index()` (both controllers) — empty stubs.
      - `userLeadList()` — not a cron job at all: a synchronous HTML
        dashboard (hardcoded 10-user allowlist) rendered on GET, no side
        effects. `automation-worker` has no public routes by design; this
        kind of on-demand report belongs in `reporting-api` if still
        needed.
      - `RepeatOnlineCustomersAllocation()` — depends on a
        `lead_direct_disbursal` boolean this schema's `Lead` entity doesn't
        have (**schema gap**), plus a hardcoded 3-user roster. Flagged, not
        silently dropped.
      - `credeauAllocation()` — single hardcoded user id, narrow digital
        co-lending channel routing with no schema support. Flagged for
        business confirmation (still active / vestigial?) rather than
        guessed at.
      - `move_lead_hold_to_screener()`, `move_application_hold_to_credit_G50K()`,
        `move_application_hold_to_credit_B50K()` — all three hardcode a
        6-person employee roster inline (with commented-out *older*
        hardcoded rosters still in the file, i.e. visible personnel churn)
        instead of querying active users by role. Porting specific legacy
        employee ids into this codebase would be meaningless/stale
        immediately. Flagged for a business decision on whether TAT-hold
        redistribution should be rebuilt against the live active-CR1/CR2
        roster (a reasonable follow-up, not done in this batch to avoid
        scope creep beyond what was asked).
      - `notContactableLeadAllocation()` — re-routes previously-rejected
        "not contactable" leads for a second contact attempt, with
        per-user exclusion based on which staff already rejected that
        specific lead. Legacy tracked this via a `lead_rejection_reasons`
        table this schema has no equivalent for (**schema gap** — closest
        candidate, `LeadFollowup`, doesn't index by
        rejecting-user-per-lead the same way). Also references a "Runo"
        call-center dialer API integration not built in `integrations-api`.
        Complex enough that a half-faithful port risked introducing a real
        production bug in an already-nuanced flow; skipped and flagged
        rather than guessed at.
      - `sanctionTargetUpdate()` — nightly MIS/target-vs-achievement
        recompute (`user_target_allocation_log` aggregation), not a lead
        allocation job. Belongs in `reporting-api`'s or a later MIS task's
        scope, not this one.
      - `collectionLoanAllocation()` — confirmed broken/incomplete by the
        research agent (undefined-variable bugs, dead `$_GET`-param
        handling, unreachable `$tempDetails['data']` access, no real email
        ever sent). Also depends on multi-tier
        `lead_{pre_}collection_executive_assign_user_id{1,2}` columns this
        schema's `Lead` doesn't have (**schema gap** — collection
        assignment here is a single `Collection.collectionExecutive` FK,
        not a 4-tier per-lead set). Not portable as a "spec," treated as
        abandoned/half-finished legacy work per the task's dead-code
        exemption.
      - `calculationAllLoans()` / `calculationOpenCaseLoans()` — both
        depend on `CommonComponent::get_loan_repayment_details($lead_id)`,
        a substantial repayment-recalculation routine that lives outside
        `CronSanctionController.php`/`CronCollectionController.php` (out of
        this task's named source files) and wasn't reverse-engineered here.
        `calculationAllLoans()` additionally has a hardcoded absolute
        server path and a hardcoded personal email recipient, reading as
        dev/debug scaffolding rather than a clean production job. Porting
        just the detection query without the actual recalculation would be
        incomplete/misleading; flagged as a dependency for a future task
        once the repayment-recalc logic itself is ported (likely alongside
        core-api's collection module).

      **Verified:** `bun install`, `bun run format && bun run lint &&
      bun run typecheck && bun run build` all clean across all 4 apps
      (only the 2 pre-existing `auth.service.ts` warnings, untouched);
      `cd apps/automation-worker && bun run test` — 6 suites / 30 tests,
      all green. Live-booted against the real local `finance_crm_backend` MySQL
      (copied the repo-root `.env` into `apps/automation-worker/.env`,
      confirmed real in this environment unlike prior worktree batches):
      `Nest application successfully started`, no `Entity metadata not
      found` errors, all 11 jobs registered
      (`InProcessJobRunner` logs confirm each cron expression), and the
      `*/5 * * * *` jobs actually fired against the real DB within the
      30-second observation window (`"no eligible leads"` / `"no eligible
      applications"` — real queries executing cleanly against the live
      schema, not just compiling).
- [x] **#58 CronEmailer + CronSMS** jobs — DONE. Ported from
      `old-php-files/application/controllers/CronJobs/{CronEmailerController.php
      (3911 lines, 31 methods),CronSMSController.php (330 lines, 4 methods)}`,
      same direct-TypeORM-access default as #57 (open design question still
      unresolved).

      **Routing/liveness reality check.** `routes.php` has exactly one alias
      across both controllers: `$route['cronEmailer'] =
      'CronJobs/CronEmailerController/birthdayemailer'` — nothing for
      `CronSMSController` at all. A fork research agent read
      `CronEmailerController.php`/`CronEmailer_Model.php` method-by-method
      (same technique as #57: dedup-guard cadence proxy, hardcoded
      rosters/dates, `die()` stubs, commented-out sends); I read
      `CronSMSController.php`/`CronSMS_Model.php` and the vendor dependency
      chain (`CommonComponent::payday_sms_api` →
      `payday_sms_sent_api.php`) directly.

      **Built (8 job services, 13 scheduled jobs, all under
      `apps/automation-worker/src/jobs/`):**
      - `birthday-email/` — ports `birthdayemailer()`, the **only** method in
        either controller with a real `routes.php` alias, confirming it's
        genuinely live. Leads whose `lead_customer.dob` matches today's
        month/day. `0 9 * * *`.
      - `not-contactable-lead-email/` / `not-contactable-lead-sms/` — port
        `freshNotContactableCustomerEmailer()` /
        `freshNotContactableCustomerSMS()` — the same "rejected for NOT
        CONTACTABLE" segment, two channels (email: 30-day lookback; SMS:
        5-day lookback, matching each one's own model method). `0 10 * * *`.
      - `repayment-reminder-email/` — ports the 6 near-identical
        `repaymentReminder5Day()` .. `repaymentReminder0Day()` methods as one
        parameterized bucket job (day offset 5..0), mirroring #57's DPD-bucket
        pattern. `0 9 * * *` for all 6.
      - `repayment-reminder-sms/` — ports `repaymentReminder0DaySMS()` (the
        SMS controller's only repayment-reminder method, 0-day/due-today
        only). `0 8 * * *`.
      - `reloan-pitch-email/` — ports `notificationSendMailAndWhatsapp()`: a
        "you're eligible for another loan" pitch to customers whose loan just
        closed, with no other non-terminal lead under the same PAN and not
        blacklisted. `0 11 * * *`.
      - `outstanding-loan-digest-email/` — ports
        `loanOutstandingCustomer1To60DaysEmailer()`: per-loan overdue digest,
        1-60 DPD, computing a late-penal-interest surcharge. `0 7 * * *`.
      - `closed-loan-feedback-email/` — ports
        `feedbackForCloseLoanEmailer()`: feedback-survey nudge to every
        closed-loan customer with an email. `0 10 * * *`.

      **Scheduling normalization (applies across every job above).** Every
      method in both controllers shares the exact same copy-pasted 30-minute
      `cron_scheduler_logs` dedup-guard boilerplate — unlike #57's batch, this
      is uniform across live and dead methods alike, so it's not a per-job
      cadence signal here. Since none of these queries track "already
      notified this recipient," running any of them every 30 minutes would
      resend the same notification to the same people all day. Every job
      above is scheduled **once daily** instead (morning, staggered by job to
      avoid a single-instant DB spike), which is the closest reasonable
      cadence given the absence of both a working per-recipient dedup and a
      reliable original-frequency signal.

      **Judgment calls / deliberate deviations (documented in each service's
      doc comment too):**
      1. `repayment-reminder-email`'s legacy SQL window is `repayment_date >=
         today AND <= today+N` — a *cumulative* range, not an exact day. If
         all 6 buckets ran the same day (their shared boilerplate guard
         implies they could), a borrower due in 3 days would get up to 3
         overlapping reminders (from the 3/4/5-day buckets alike). This port
         normalizes each bucket to an **exact** day offset
         (`repayment_date = today + N`), matching the evident one-reminder-
         per-milestone intent — same kind of normalization #57 applied to the
         DPD off-by-one.
      2. `repayment-reminder-sms` is a **channel substitution**, not a
         log-only stub: `integrations-api` has no SMS endpoint for this
         content (only `POST /sms/otp`), but its WhatsApp module already
         ships a real, live `repayment_reminder` template (`POST
         /whatsapp/template`) taking exactly this notification's fields. This
         port calls that real endpoint instead of fabricating an SMS call or
         giving up and logging — the notification actually gets delivered,
         over a channel with a working adapter. Flagged as a deliberate
         judgment call, not silently assumed.
      3. `reloan-pitch-email`'s "customer blacklist" exclusion maps cleanly
         to this schema's `CustomerBlacklist` entity (`Lead` FK,
         `isActive`/`isDeleted`) — no gap here, unlike most #57/#58 schema
         mismatches; legacy's PAN-keyed `customer_black_list` table has a
         genuine equivalent. The "no other non-terminal lead under the same
         PAN" check ports legacy's exact terminal set
         (`lead_status_id NOT IN(8,9,16)` → `SYSTEM-REJECT`/`REJECT`/
         `CLOSED`).
      4. `outstanding-loan-digest-email` faithfully preserves a real legacy
         production bug rather than "fixing" it: legacy's own code comments
         out `$customer_email = $customer_data['email']` and hardcodes
         `$customer_email = CTO_EMAIL` — every "customer" email in this job
         (and its run summary) actually goes to the CTO in production today.
         Documented in the doc comment; doesn't change behavior here since
         the job is log-only anyway.
      5. `outstanding-loan-digest-email`'s due-amount formula (`dpd =
         clamp(today-repaymentDate, 0, 60)`, `lateInterest =
         recommendedLoanAmount * (roi*2) * dpd / 100`, `totalDue =
         lateInterest + repaymentAmount`, netted against verified
         `Collection.receivedAmount`) is ported verbatim from the
         *controller* (the model only fetches rows) — but does NOT
         reimplement legacy's separate `CommonComponent::get_loan_repayment_
         details()` recompute engine, matching #57's precedent of not
         reverse-engineering that out-of-scope dependency.
      6. `closed-loan-feedback-email` replaces legacy's `if (time_close >
         1441) die;` same-day wall-clock cutoff with a fixed once-daily
         morning `JobRunner` schedule — functionally equivalent (guarantees
         at most one run/day, always before the cutoff would have mattered)
         without needing to replicate a wall-clock guard. It also
         **faithfully preserves** legacy's lack of persistent anti-resend
         tracking (every closed-loan customer is re-emailed every run) since
         that's genuine long-standing production behavior, not a bug
         introduced by this port.

      **Schema/seed gaps** (same as #57's, re-flagged since these jobs hit
      the same tables): `lead_data_source_id NOT IN(21,27)` omitted
      everywhere it appeared in legacy SQL (neither legacy id exists in
      `seed-data/data-sources.json`).

      **No `integrations-api` endpoint matches** any of the remaining 6 jobs'
      content (only `POST /sms/otp`, `POST /email/thank-you`, `POST
      /whatsapp/template` exist — none match birthday greetings, marketing
      re-engagement, bucketed repayment reminders, reloan pitches, or
      overdue digests). Each logs its notification intent via `Logger`
      instead of a fabricated vendor call, consistent with #57's precedent.
      Recommend adding: a birthday-greeting email template, a generic/
      marketing SMS template (Vapio), a repayment-reminder **email**
      template (mirroring the WhatsApp module's existing one), and a
      generic reloan/re-engagement email template.

      **Skipped (not ported), with reasons — 19 methods across both
      controllers, plus `CronLegalEmailerController.php` treated as a
      separate concern entirely:**
      - `CronLegalEmailerController.php` (1320 lines) — **not folded into
        this task.** Its `legalNoticeEmailer($type, $from_days, $to_days,
        $debug)` is a real, actively-maintained, distinct legal/NPA-notice
        system (recent authored docblock, `@date 2025-08-27`), with its own
        per-loan anti-resend tracking (`legal_email_logs`) and a genuinely
        different compliance-sensitive audience (Demand/Final/Loan-Recall
        notices). Recommend its own future task rather than bundling
        legal-notice logic into a generic transactional-email port.
      - `legalNoticeEmailer()` **inside** `CronEmailerController.php` — a
        broken, incomplete stub calling
        `getAllLegaNoticeEmails()` with zero arguments against a method
        requiring `$ntc_cases` interpolated straight into `WHERE loan_no
        IN($ntc_cases)` — produces `IN()`, a SQL syntax error. Superseded by
        the real system in `CronLegalEmailerController.php` above.
      - `festiveOfferForCloseLoanEmailer()` /
        `festiveOfferForOldCloseLoanEmailer()` — both explicit dead stubs
        (`echo "Rohit : Not allowed at this time"; die;` as the first line).
      - `festiveOfferForNewCustomerEmailer()` — mechanically reachable (its
        `die;` is commented out) but has no dedup guard at all (unique among
        the "live" jobs) and its query is a near-duplicate of
        `freshNotContactableCustomerEmailer()`'s segment minus that method's
        exclusion filters — redundant, not a distinct job.
      - `loanOutstandingFY2122CustomerEmailer()` — hardcoded FY21-22 date
        window, permanently in the past.
      - `freshLoanLohariJan22RejectEmailer()` / `freshLoan26Jan22NewCustEmailer()`
        — both explicit dead `die;` stubs targeting the same redundant
        `getAllNewCustomerEmails()` audience as
        `festiveOfferForNewCustomerEmailer()`.
      - `repayLoanEmailerOffer()` — hardcoded Jan 29 - Feb 5 2022 campaign
        window, permanently in the past.
      - `valentineWeekCustomerEmailer()` — hardcoded Jan 2021 - Jan 2022
        window plus an explicit one-off `utm_source='ALLCUSTVALENTINE2022'`
        marker.
      - `happyHoliCustomerEmailer()` — no hardcoded date, but its query is
        "every lead with an email, no filter at all" and there's no
        anti-resend guard of any kind — running this on any cadence would
        re-blast the entire customer base every time; unsafe to schedule as
        written.
      - `rakshabandhanEmailer()` / `independanceDayEmailer()` /
        `krishanjanmaastmiEmailer()` / `repeatHighTicketSizeCustomerEmailer()`
        — mechanically live (real queries, no hardcoded past dates, working
        dedup guards) but each is a single-festival-per-year (or evergreen
        repeat-business) marketing blast with **no anti-resend tracking**
        against prior sends — no clean fixed annual cron expression makes
        sense without a business-calendar trigger, and re-running near the
        festival date would resend. Flagged as needing a real scheduling
        mechanism (business-calendar-driven, not cron-driven) rather than
        guessed at.
      - `diwaliCustomerEmailer()` — the one seasonal method with a genuine
        anti-resend guard (`email NOT IN (SELECT ... WHERE
        email_type_id=27)`), but still tied to a variable lunar-calendar
        festival date each year — same "needs a business-calendar trigger,
        not a fixed cron" reasoning as the four above.
      - `repaymentReminderToCustomerEmail()` — same audience as the
        `repayment-reminder-email` bucket job, but its own dedup guard is
        commented out (`//die;`) — reads as an earlier draft left in the file
        before the 6 explicit day-bucket methods were added; superseded.
      - `repaymentReminderDay()` — a newer, unfinished generalization
        attempt: depends on `CommonComponent::call_qrcode_api()` (an
        out-of-scope UPI integration file, not in these two controller/model
        files), and has its own bug where the sent/failed counter reads the
        QR-code call's status instead of the actual email send's. Not
        portable as a clean spec.
      - `getFacebookCampaignData()`-style attribution methods: none found in
        these two controllers (that's `CronSanctionController.php`'s
        territory per #57, already flagged there) — noted here only to
        confirm this batch didn't miss any.
      - `freshNotContactableCustomerSMS()`'s sibling
        `repeatCustomerCloseLoanSMS()` — hardcoded `loan_closure_date >=
        '2021-12-01' AND <= '2022-09-30'` one-time historical campaign
        window; running it recurringly would resend the same stale
        promotional SMS to the same already-contacted historical cohort
        forever.
      - `sendNotificationEvery15Min()` — has a real query and a real 5-minute
        dedup guard, but its actual send (`CommonComponent::payday_sms_api(3,
        ...)` → `payday_sms_sent_api.php`'s `routemobile_sms_sent_api_call()`)
        hits `sms_type_id == 3`, a branch that is **entirely commented out**
        in the vendor call — every invocation falls through to `else { throw
        new Exception("Invalid SMS type."); }`. Genuinely dead in production
        today, not a judgment call.
      - `index()` (both controllers) — empty stubs.

      **Verified:** `bun install` (`PUPPETEER_SKIP_DOWNLOAD=1`, an
      environment-only puppeteer postinstall issue unrelated to this task),
      `bun run format && bun run lint && bun run typecheck && bun run build`
      all clean across all 4 apps (zero new warnings); `cd
      apps/automation-worker && bun run test` — 14 suites / 67 tests, all
      green. Live-booted against the real local `finance_crm_backend` MySQL (copied
      the repo-root `.env` into `apps/automation-worker/.env`, removed it
      afterward): `Nest application successfully started`, no `Entity
      metadata not found` errors, all 13 new jobs registered alongside #57's
      11 (`InProcessJobRunner` logs confirm every cron expression).
- [x] **#59 CronMiscellaneous + CronMMPTool** jobs — DONE. Ported from
      `old-php-files/application/controllers/CronJobs/{CronMiscellaneousController.php
      (1109 lines, 9 public methods + a private `prepareFile()` helper),
      CronMMPToolController.php (301 lines, 2 public methods + a
      `middlewareEmail()` helper, one live implementation and one
      commented-out-then-superseded older implementation)}`, same
      direct-TypeORM-access default as #57/#58.

      **This batch's work was interrupted mid-task by an accidental user
      interrupt (not an error) and resumed by a second agent instance.** The
      first instance had already built 2 complete, non-stub job modules
      before being killed; this write-up covers both that prior work and
      the rest of the port done on resumption.

      **Built (2 job services, 2 scheduled jobs, both under
      `apps/automation-worker/src/jobs/`):**
      - `poi-father-name-sync/` — ports `updateFatherName()`
        (`CronMiscellaneousController.php`): backfills `lead_customer
        .father_name` from the father's name Signzy already returned in a
        successful PAN-fetch response (`PoiVerificationLog`,
        `methodId=1`), for customers whose profile doesn't have it yet.
        Legacy also wrote the value back onto the log row itself
        (`poi_veri_father_name`) — this port's `PoiVerificationLog` already
        captures `fatherName` directly at write time, so only the
        profile-backfill half applies. **Deliberate deviation**: legacy
        unconditionally re-updates every matching customer every run (no
        "already set" guard); this port only backfills customers whose
        `fatherName` is currently `NULL`, avoiding silently clobbering a
        manually-corrected value while still fully covering the stated
        "backfill a missing field" intent. When a lead has more than one
        successful PAN-fetch log, the most recently-created one wins
        (matches legacy's implicit last-write-wins iteration order).
        **Scheduling**: legacy gates on a daily wall-clock cutoff
        (`intval(date("Hi")) > 1355`) rather than the 30-minute
        `cron_scheduler_logs` dedup guard used elsewhere in this
        controller — same "single daily window" signal #58 used. Runs
        once daily, `0 12 * * *`, safely before that cutoff.
      - `appsflyer-disbursal-event-push/` — ports
        `pushAppflyerDisbursalEventForLoan()` (`CronMMPToolController
        .php`): pushes an AppsFlyer `loan_disbursed` server-to-server
        conversion event for every affiliate-attributed loan that just
        disbursed. **Log-only despite `integrations-api` having an exact
        matching endpoint** (`POST /appsflyer/events`,
        `AppsflyerEventType.LOAN_DISBURSED`, built in Task #52) — that
        endpoint requires a caller-supplied `appsflyerId`, and neither
        `Lead` nor `LeadCustomer` has a persisted device-attribution id
        column (legacy's `lead_customer.customer_adjust_adid`) —
        **schema gap**, re-confirming what Task #52 already flagged.
        Fabricating an id (or sending an empty one) would file a bogus
        event against AppsFlyer's real API, so this job finds and logs
        the exact set of loans that *would* be pushed the moment that
        column exists. Further schema gaps, proxied rather than skipped:
        legacy's affiliate-eligibility join
        (`master_marketing_channel MMC ON LD.utm_source=MMC.mmc_name
        WHERE MMC.mmc_affiliate_flag=1`) has no roster-table equivalent in
        this schema — proxied as "`Lead.utmSource` present and not
        `'ORGANIC'`", the same signal `screener-allocation` (#57) already
        uses absent that roster; legacy's dedup column
        (`loan.loan_mmp_event_push_flag`) doesn't exist on this schema's
        `Loan` — dedupes instead against `AppsflyerPushEventLog` (a lead
        with an existing `LOAN_DISBURSED` row is skipped), the more
        natural source of truth once real pushes start; legacy's hardcoded
        `lead_final_disbursed_date >= "2024-07-13"` go-live cutoff is
        replaced with a rolling 30-day lookback window (same
        "hardcoded-past-date to rolling-window" normalization #57/#58
        applied elsewhere). **Scheduling**: legacy's 30-minute
        `cron_scheduler_logs` dedup guard reads as a frequent-poll cadence
        (unlike `CronMiscellaneousController`'s wall-clock-gated jobs) —
        runs `*/30 * * * *`.

      **Everything else in both controllers was skipped — every remaining
      method hits a genuine schema, missing-integration, or dead-code gap,
      not a job-design judgment call:**
      - `kycLoanDocs()`, `renameDocs()`, `renameCollectionDocs()`,
        `getCollectionDocs()` — all four hardcode absolute filesystem
        paths to the legacy server's own disk layout (e.g.
        `/home/fintechcloud/public_html/upload/`,
        `.../advlms/upload/`) and copy files between local directories on
        that one decommissioned box. `kycLoanDocs()` additionally targets
        `test_kyc_loan`, a table with no equivalent entity in this schema
        (a distinct advance-salary product concept, not modeled here).
        This codebase's document handling is `@finance-crm/common`'s
        env-var-driven local/S3 storage abstraction, not raw filesystem
        paths — porting the path logic verbatim would be actively wrong,
        and these read as one-off historical data-migration scripts (an
        "advlms" → current-server doc migration) rather than recurring
        automation. Not ported.
      - `aadhaarMasked()` — hardcoded permanently-past date window
        (`disbursal_start_date = "2022-05-25"`, `..._end_date =
        "2022-06-15"`) — dead, same pattern as #58's date-window skips.
      - `aadhaarMaskedAllCases()` — its own `cron_scheduler_logs` dedup
        guard is entirely commented out (no anti-overlap protection at
        all, unique among the "live" candidates in this batch), it depends
        on `CommonComponent::call_aadhaar_masked_api` — an Aadhaar-masking
        vendor call with **no equivalent adapter anywhere in
        `integrations-api`** (checked every module under
        `apps/integrations-api/src/modules/`; nothing matches) — and it
        writes to `docs.docs_aadhaar_masked`, a per-document masking-state
        column this schema's `Document` entity doesn't have (**schema
        gap** — `Document` only has `filePath`/`documentType`/
        `uploadedBy`). Three independent blockers, not one judgment call;
        flagged for a future task once an Aadhaar-masking adapter exists.
      - `cibilLogToS3Bucket()`, `apiCibilLogToS3Bucket()`,
        `apiEsignLogsToS3Bucket()`, `apiEycLogsToS3Bucket()`,
        `apiPoiOCRLogsToS3Bucket()`, `apiBankingCartLogToS3Bucket()` — six
        near-identical jobs whose entire purpose is DB-housekeeping:
        externalize a large inline `request`/`response` text/JSON blob to
        S3 and flip a legacy `s3_flag` column so it's never re-processed.
        This schema's equivalent log entities (`EsignLog`, `EkycLog`,
        `PoiVerificationLog`) store `request`/`response` as plain
        `text`/`longtext` columns with **no archival-tracking column at
        all** (no `s3Flag`/`fileKey` equivalent) — **schema gap**. This is
        unlike `CrifBureauLog` (the `tbl_cibil_log` equivalent), which
        already has a dedicated `reportFileKey` column — but that column
        is populated by the *service that creates the row* storing the
        vendor's generated PDF report directly via the storage adapter, a
        different, already-solved problem (never storing the file inline
        to begin with), not a retroactive archival pass. Without an
        archival-tracking column, a "housekeeping" job here would either
        require a real schema migration (adding `s3Flag`/`fileKey` to
        three entities) — out of scope for a cron-job port, consistent
        with #57/#58 not doing schema migrations unilaterally — or
        re-archive the same rows forever with no way to tell what's
        already done, the same "no anti-resend tracking" reasoning #58
        used to skip several marketing-email methods.
        `apiBankingCartLogToS3Bucket()` has an even deeper gap on top: no
        entity for legacy's `api_banking_cart_log` (an account-aggregator/
        bank-statement-cart integration) exists in this schema at all —
        checked `apps/integrations-api/src/modules/bank-verification`
        (bank-account/IFSC verification, a different concern) and the
        `entities/verification/` folder (`CustomerBanking`, itself just
        verified bank-account details, no cart/AA log). Recommend a future
        DB-housekeeping task that (a) adds `s3Flag`/`fileKey` columns to
        `EsignLog`/`EkycLog`/`PoiVerificationLog` and (b) adds an
        `AccountAggregatorLog`/`BankingCartLog` entity if that Payday/AA
        integration itself gets ported, before wiring any archival job.
      - `updateAppflyerOrganicTagLeads()` (`CronMMPToolController.php`) —
        re-tags a lead's `utm_source`/`utm_medium`/`utm_campaign` from a
        raw AppsFlyer conversion postback (`acaf_response`) once an
        `appsflyer_id` becomes available, using the same
        `master_marketing_channel` affiliate roster gap already flagged
        above, plus FACEBOOK/GOOGLE/ORGANIC substring heuristics on the
        raw payload. Deeper blocker: legacy reads this raw postback from
        an inbound AppsFlyer-webhook capture table
        (`acaf_response`/`acaf_id`) that **this schema has no entity for
        at all** — checked `packages/database/src/entities/integrations/`
        (only `AppsflyerPushEventLog`, an *outbound* event-push log built
        for #59's own `appsflyer-disbursal-event-push`) and
        `apps/integrations-api/src/modules/appsflyer/` (only `POST
        /appsflyer/events`, outbound push — no inbound webhook controller
        exists). There is nothing in this codebase to iterate over, even
        for a log-only version — this is a missing prerequisite
        integration (an AppsFlyer conversion-postback ingestion endpoint),
        not a job-level judgment call. Flagged for whoever builds that
        ingestion path.
      - `middlewareEmail()` (both its live and commented-out-superseded
        forms, `CronMMPToolController.php`) and `prepareFile()`
        (`CronMiscellaneousController.php`) — private helpers, not
        schedulable jobs.

      **Verified:** `PUPPETEER_SKIP_DOWNLOAD=1 bun install`; `bun run
      format && bun run lint && bun run typecheck && bun run build` all
      clean across all 4 apps (zero new warnings); `cd
      apps/automation-worker && bun run test` — 16 suites / 81 tests, all
      green. Live-booted against the real local `finance_crm_backend` MySQL
      (copied the repo-root `.env` into `apps/automation-worker/.env`,
      removed it afterward): `Nest application successfully started`, no
      `Entity metadata not found` errors, all 24 jobs registered across
      Phase 6's 4 batches (`InProcessJobRunner` logs confirm every cron
      expression, including this batch's `poi-father-name-sync` at
      `0 12 * * *` and `appsflyer-disbursal-event-push` at
      `*/30 * * * *`).

      **Phase 6 is now fully done (#56–59).** Every job built across the
      4 batches is direct-TypeORM (per #56's open design question, still
      unresolved — flag it before any job needs `core-api`'s business
      logic specifically, e.g. for audit-trail writes it doesn't already
      get from a direct `LeadFollowup`/similar write). Every vendor
      notification across all 4 batches is either a real
      `IntegrationsApiClient` call against a confirmed-matching
      `integrations-api` endpoint, or an explicitly logged gap recommending
      the specific endpoint/template `integrations-api` is missing — never
      a fabricated vendor call.

### Phase 7 — Polish (tasks #60–63) ✅ DONE
- [x] **#60 Unit/e2e tests across all services — DONE.** Thorough coverage on core
      business logic (leads workflow, CAM, BRE, disbursal, collection —
      i.e. everything already in `core-api`), smoke-level coverage on
      reports/exports (too many endpoints to deeply test each one). Being
      done in 3 batches for `core-api` — **all 3 batches done** (these
      entries): batch 1 (leads/cam/bre/disbursal/collection), batch 2
      (auth/users/audit/menu-permissions), batch 3
      (company/geography/feedback/verification/search). `core-api`'s
      portion of this task is complete, but `integrations-api`'s known
      test-coverage gaps (Task #48) and e2e tests across all services are
      still outstanding — see batch 3's write-up below for specifics. Do
      not check this item off until those land too.

      **Batch 1 (leads, cam, bre, disbursal, collection) — DONE.** Added 6
      new spec files under `apps/core-api/src/modules/{leads,cam,bre,disbursal,collection}/`
      (`leads.service.spec.ts`, `lead-lookups.service.spec.ts`,
      `cam.service.spec.ts`, `bre.service.spec.ts`,
      `disbursal.service.spec.ts`, `collection.service.spec.ts`) — 105
      tests total (core-api went from 1 spec file / a handful of
      smoke-tests to 7 spec files, all green: `cd apps/core-api && bun run
      test`). Mocking style: `@nestjs/testing`'s `Test.createTestingModule`
      + `getRepositoryToken(Entity)` with plain `jest.fn()`-based repo
      mocks (matches `apps/integrations-api/src/modules/*/*.spec.ts`'s
      pattern, chosen over `automation-worker`'s direct-instantiation-with-`as
      never` style since core-api's services are proper DI-guarded API
      services like integrations-api's, not cron job classes).

      Coverage per service: every public method's happy path, the
      `findOrFail`-driven FK-or-404 path for every FK argument, the
      `LeadFollowup` audit-trail write on every workflow-changing lead
      action (`changeStatus`/`assign`/`reject`/`addFollowup` — asserted
      against real `create`/`save` calls and the actual `remarks`/`status`
      values written, not just "was called"), BRE's manual-decision-does-
      not-overwrite-system-decision behavior, collection's
      blacklist-flips-`lead.isBlacklisted` side effect, and disbursal's
      loan lifecycle (`createLoan`→`disburse`→`settle`/`close`/`writeOff`).

      **Real bug found and fixed**: `DisbursalService.disburse()`
      (`apps/core-api/src/modules/disbursal/disbursal.service.ts`) had no
      guard on the loan's current status before disbursing — it would
      happily re-disburse (and write a second COMPLETE transaction log
      for) a loan that was already `DISBURSED`, `SETTLED`, `CLOSED`, or
      `WRITTEN_OFF`. Added a check that throws `ConflictException` unless
      `loan.status === LoanStatus.PENDING`, covered by an
      `it.each` test over all 4 non-PENDING statuses.

      **Flagged, not fixed (bigger judgment calls, left for product/dev
      discussion)**:
      - No status-transition state machine exists anywhere in these 5
        modules beyond the one `disburse()` guard just added — `Lead
        .changeStatus`, `CamService.sanction`/`sendBack`, and
        `DisbursalService.settle`/`close`/`writeOff` all accept any
        target state from any current state (e.g. you can `settle()` a
        loan that was never `disburse()`d, or `sanction()` a CAM that's
        already `SANCTION`). Whether that's intentional flexibility
        (matching the legacy PHP, which also had no such guard) or a gap
        needs a product call, not a unilateral fix — tests document the
        current (permissive) behavior rather than assert a stricter one
        that isn't actually implemented.
      - `CollectionService.verifyPayment` allows re-verifying an
        already-`APPROVED`/`REJECTED` payment with no idempotency check —
        same category of judgment call as above.

      **Deliberately left for batch 2/3**: controller-layer tests (all 5
      modules' controllers are thin pass-throughs per the established
      convention, and no controller spec files exist anywhere else in the
      codebase either — `integrations-api` has 36 controllers and 0
      controller specs — so this batch matches that precedent rather than
      introducing a new one unilaterally); e2e tests (no `.e2e-spec.ts`
      exists yet in any service, tracked as a cross-cutting gap for
      whichever batch does the final e2e pass, not specific to these 5
      modules).

      Verification run from `backend/`: `bun install`, `bun run format &&
      bun run lint && bun run typecheck && bun run build` all clean across
      all 4 apps (zero new warnings); `cd apps/core-api && bun run test` —
      7 suites / 105 tests, all green.

      **Batch 2 (auth, users, audit, menu-permissions) — DONE.** These are
      the highest-security-sensitivity modules in `core-api` (login,
      password reset, role assignment, the pre/post-audit lead-review
      workflow with role-based queue visibility, and MIS/export permission
      grants), so coverage deliberately goes beyond happy-path CRUD. Added 4
      new spec files under
      `apps/core-api/src/modules/{auth,users,audit,menu-permissions}/`
      (`auth.service.spec.ts`, `users.service.spec.ts`,
      `audit.service.spec.ts`, `menu-permissions.service.spec.ts`) — 69 new
      tests (core-api now at 11 spec files / 174 tests total, all green:
      `cd apps/core-api && bun run test`). Same mocking style as batch 1
      (`@nestjs/testing` + `getRepositoryToken(Entity)` + plain
      `jest.fn()` repo mocks); `AuditService.list()`'s TypeORM
      `createQueryBuilder` chain is mocked as a chainable jest-mock object
      (`leftJoinAndSelect`/`where`/`andWhere`/`orderBy`/`skip`/`take` each
      returning the same mock, `getManyAndCount` resolving the fixture
      data) since it's the one method in this batch not expressible as a
      plain `find`/`findOne` call.

      Coverage:
      - **`auth`**: sign-in with a wrong password (rejects, increments
        `failedLoginCount`, no activity-log write); sign-in against a
        deactivated (`isActive: false`) and a soft-deleted (`isDeleted:
        true`) account (both rejected via the `isUsableAccount` predicate,
        password never checked); the failed-login lockout boundary
        (`failedLoginCount > 3` locks and skips the bcrypt compare entirely
        — asserted `save()` is never called for a locked attempt — while
        exactly-3 still succeeds, proving the off-by-one boundary is where
        the code actually put it); refresh-token rotation (valid token
        issues a new pair and revokes the old row; unknown and
        already-revoked tokens are both rejected); logout revokes the
        matching token and is a silent no-op for an unknown one;
        `changePassword` rejects on a wrong current password (hash
        untouched, no refresh-token revocation) and, on success, revokes
        *every* refresh token for that user and asserts the new hash
        actually verifies against the new plaintext (not just "save was
        called"); the full forgot-password OTP lifecycle — OTP generated
        and emailed only for a usable account (silently no-ops for an
        unknown *or* deactivated email, so the endpoint can't be used to
        enumerate accounts), OTP verification accepts the right code,
        rejects a wrong code, and rejects when no live (unexpired,
        unconsumed) OTP request exists; `resetPassword` rejects an unknown/
        expired reset token and, on success, both hashes the new password
        and revokes all refresh tokens.
      - **`users`**: role assignment (rejects a duplicate active
        assignment of the same role type, an unknown `roleTypeId`, and an
        unknown `supervisorRoleId`), role removal (soft-delete, 404 for a
        role assignment that doesn't belong to the given user), `setActive`
        both directions, `unlock` resetting `failedLoginCount`, `create`'s
        password hashing and duplicate-email rejection.
      - **`audit`** — the role-based queue-visibility filter was the
        specific regression risk called out for this batch, so it gets
        its own describe block: asserts AH's query builder never calls
        `andWhere` (unrestricted), while AU/AM's query calls `andWhere`
        with the *exact* filter fragment and bound parameters
        (`lead.auditAssignedToId = :actingUserId`, `actingUserId: 42`) —
        not just "was called" — plus an explicit assertion that the same
        call is never made with another user's id, and that a role array
        containing `AH` alongside other roles still takes the bypass path.
        Also covers `allocate` (only claims leads currently in `AUDIT-NEW`,
        skips missing lead ids, 404s an unknown acting user),
        `hold`/`recommend`/`sendBack`/`sendToPreAudit`/`sendToPostAudit`
        each asserted against the real `LeadFollowup`/`LeadAudit` rows
        written (status, `caseType`, remarks — including the
        send-back-with-existing-assignee branch of `sendToPreAudit` that
        skips straight to `AUDIT-INPROCESS`), `sendToPostAudit`'s
        no-loan-yet rejection, and `recordApprovalReason` carrying forward
        the previous audit entry's assignment/status/caseType.
      - **`menu-permissions`**: menu-item CRUD including the 404 path for
        an unknown `roleTypeId`, `listGrouped`'s section-bucketing, and
        both export- and MIS-permission grant/revoke (revoke sets
        `isActive: false`/`isDeleted: true`, 404 on an unknown grant id).
        **Checked first, per the task brief, whether the actual MIS/export
        access-*check* (allow-if-a-grant-exists, deny-if-not) lives in this
        module** — it does not: `core-api`'s `menu-permissions` module is
        grant CRUD only (confirmed by reading
        `menu-permissions.service.ts` in full — no method reads a grant to
        gate anything). The real check is
        `apps/reporting-api/src/common/guards/{export,mis}-permission.guard.ts`,
        which already has its own spec
        (`mis-permission.guard.spec.ts`) predating this batch and is out of
        this batch's `core-api`-only scope — noted here so it isn't
        mistaken for an uncovered gap.

      **No security-relevant bug found in this batch** (unlike batch 1's
      `DisbursalService.disburse()` re-disbursement guard) — read all four
      services end-to-end looking specifically for a missing/backwards/
      non-filtering role check, and the one place that looked most likely
      to regress (`AuditService.list()`'s AH-vs-AU/AM branch) is correct:
      the `andWhere` clause is genuinely gated behind
      `!roles.includes('AH')`, and it ORs in the shared `AUDIT-NEW` pool
      correctly rather than accidentally excluding it.

      **Batch 3 (company, geography, feedback, verification, search) —
      DONE. This is the last core-api batch.** Added 5 new spec files
      under `apps/core-api/src/modules/{company,geography,feedback,
      verification,search}/` (`company.service.spec.ts`,
      `geography.service.spec.ts`, `feedback.service.spec.ts`,
      `verification.service.spec.ts`, `search.service.spec.ts`) — 84 new
      tests (core-api now at 16 spec files / 258 tests total, all green:
      `cd apps/core-api && bun run test`). Same mocking style as batches 1
      and 2 (`@nestjs/testing` + `getRepositoryToken(Entity)` + plain
      `jest.fn()` repo mocks); `SearchService.search()`'s
      `createQueryBuilder` chain is mocked the same chainable-jest-mock
      way as `AuditService.list()` in batch 2
      (`leftJoinAndSelect`/`leftJoin`/`where`/`orWhere`/`orderBy`/
      `distinct`/`take` each returning the same mock, `getMany` resolving
      the fixture data).

      Coverage:
      - **`company`**: company CRUD (partial-update semantics, soft-delete
        via `isActive`/`isDeleted`, not a real row delete) plus the nested
        product CRUD, including the company-scoped 404 for
        `updateProduct`/`removeProduct` (a product id that exists but
        belongs to a *different* company id is treated as not-found, per
        the `productRepository.findOne({ where: { id, company: { id:
        companyId } } })` scoping).
      - **`geography`**: states/branches/data-sources CRUD; the
        cities-by-state and pincodes-by-city cascading list filters,
        asserting the exact `find()` `where` clause both with and without
        the parent-id filter; `createPincode`'s optional `cityId` (skips
        the city lookup entirely and leaves `city: null` when omitted,
        resolves-or-404s when given); `createBlacklistedPincode`'s
        `publishedBy` user resolution/404.
      - **`feedback`**: question/answer CRUD (active-only listing,
        soft-delete); `submit()`'s per-response `questionId`/`answerId`
        resolution, asserting the whole submission is rejected (no
        response rows written) if any single response references an
        unknown question or answer, and that a valid multi-response
        submission writes exactly one feedback header plus one response
        row per question/answer pair with the correct question/answer
        entities attached to each. Confirmed by reading
        `packages/database/src/entities/feedback/{feedback-answer,
        feedback-question}.entity.ts` that there is no linking table
        restricting which answers are valid for which question — answers
        are a single global list (matches the legacy pattern of a shared
        Yes/No/rating-style answer set) — so "any existing answer id is
        valid for any existing question id" is the real, intended
        behavior, not a gap.
      - **`verification`**: document-type CRUD including
        `createDocumentType`'s `isRequired` default-to-`true`;
        `verifyBanking`'s lead-scoped 404 and the actual
        `isVerified`/`verifiedAt` mutation (not just "save was called");
        `uploadDocument`'s lead/user 404s and optional `documentTypeId`
        resolution; `recordDownload`'s lead-scoped document 404 and the
        actual `DocumentDownloadLog` row written (document, lead, ip,
        user-agent). No status-transition/workflow state machine exists
        in this module beyond the one-way `isVerified` flip — tests
        document that as the current behavior, same judgment-call
        category flagged in batch 1.
      - **`search`**: one test per real search field read directly off
        `search.service.ts` (`leadReferenceNo`, `applicationNo`, lead-level
        `mobile`/`email`/`pancard`, `firstName` name-prefix, customer-level
        `pancard`/`aadhaarNumber`/`mobile`/`email`, `loan.loanNumber`, plus
        the numeric-only `lead.id` branch — asserted present for a purely
        numeric query and absent for both a non-numeric and a
        mixed-alphanumeric one), each asserting the exact bound-parameter
        object passed to `.where()`/`.orWhere()`. Also confirmed the
        `cif`/customer-master field has no equivalent in this schema per
        the service's own doc comment — not re-litigated, just verified
        the comment still matches the current entity set.
        **SQL-injection regression guard**: an `it.each` over four
        malicious payloads (`' OR '1'='1`, `'; DROP TABLE leads; --`,
        `1 OR 1=1`, `" OR ""="`) asserts every condition string passed to
        `.where()`/`.orWhere()` is a static `field (=|LIKE) :placeholder`
        pattern that never contains the payload itself, and that the
        payload only ever appears as the literal value of a bound
        parameter object (`{ exact: payload }`/`{ likeValue:
        \`${payload}%\` }`) — proving the parameterized-query port holds
        under the exact class of input that broke the legacy
        string-concatenated version. This is a regression guard against
        the already-fixed bug, not a re-investigation of it.

      **No bugs found in this batch** — all 5 modules are straightforward
      CRUD/lookup services with no workflow/status-transition logic to
      speak of (verification's one-way `isVerified` flip is the closest
      thing, and it's a simple boolean flip with no re-verification
      idempotency concern raised), and `search.service.ts` was already a
      clean parameterized-query implementation with a doc comment
      correctly describing its own scope and the one known gap (`cif`).

      Verification run from `backend/`: `bun install`, `bun run format &&
      bun run lint && bun run typecheck && bun run build` all clean across
      all 4 apps (zero new warnings); `cd apps/core-api && bun run test` —
      16 suites / 258 tests, all green.

      **core-api's Task #60 portion is now fully done across all 3
      batches (all 14 core-api modules have real unit-test coverage).**
      The overall `#60` checkbox above stays unchecked — do not check it
      off yet — because two pieces of work are still outstanding before
      the task as a whole is complete:
      1. `integrations-api` gaps: per Task #48's write-up, several
         `integrations-api` modules were "code-verified but not
         test-covered" and still have no spec files.
      2. e2e tests: no `.e2e-spec.ts` file exists in *any* service yet
         (`core-api`, `reporting-api`, `integrations-api`,
         `automation-worker`) — flagged as a cross-cutting gap in batches
         1 and 2 and still untouched by this batch.
      Whoever picks up the remainder of #60 should treat it as its own
      pass (or two): one to close the `integrations-api` unit-test gaps
      using the same `@nestjs/testing` + `getRepositoryToken` + `jest.fn()`
      mocking pattern established across all 3 `core-api` batches, and one
      to add the first `.e2e-spec.ts` files across all 4 services.

      **Flagged, not fixed (judgment calls / gaps, left for later)**:
      - `AuthService.signIn`'s lockout constant is named
        `MAX_FAILED_LOGIN_ATTEMPTS = 3` but the guard is
        `failedLoginCount > MAX_FAILED_LOGIN_ATTEMPTS`, so the account
        actually locks on the *4th* wrong attempt, not the 3rd — the tests
        document this exact boundary (3 exactly still succeeds) rather
        than silently "fixing" it to `>=`, since which of the two is
        intended is a product decision, not an engineering bug per se.
      - There is no account-*unlock* path exposed to the locked-out user
        themselves (`UsersService.unlock` exists but is presumably an
        admin-only action via `@Roles`, not self-service) and no
        automatic unlock-after-cooldown — same category as batch 1's
        "no state machine" flags, a product call rather than a defect.
      - `menu-permissions`'s grant/revoke *service* methods do not
        themselves check that the granting user holds any particular role
        — confirmed this is fine because all three controllers
        (`menu-permissions.controller.ts`'s `MenuItemsController`/
        `ExportPermissionsController`/`MisPermissionsController`) are
        already `@Roles('SA', 'CA')`-gated at the class level, matching
        this codebase's established thin-controller-does-authz split. Not
        a gap, just confirmed rather than assumed.

      **Deliberately left for batch 3**: controller-layer tests (same
      rationale as batch 1 — no controller specs exist anywhere in the
      codebase yet); e2e tests (still tracked as the cross-cutting gap for
      whichever batch does the final e2e pass).

      Verification run from `backend/`: `bun install`
      (`PUPPETEER_SKIP_DOWNLOAD=true` needed locally — an unrelated
      pre-existing `puppeteer` postinstall-download flake in this
      environment, not something introduced by this batch), `bun run
      format && bun run lint && bun run typecheck && bun run build` all
      clean across all 4 apps (zero new warnings); `cd apps/core-api &&
      bun run test` — 11 suites / 174 tests, all green.

      **`integrations-api` test-gap closure — DONE** (this sub-entry
      only touches `apps/integrations-api/`, no overlap with the
      `core-api` batches above). Confirmed via `find
      apps/integrations-api/src/modules -name "*.spec.ts"` that the
      pre-existing state matched what Tasks #48/#51 flagged: 10 spec
      files existed (`credeau`, `finbox`, `adjust`, `razorpay`
      webhook-util, `sms`, `email`, `upi` + its RSA util,
      `crif-bureau`, `ekyc`) covering 30 tests; 12 modules had none.
      Added 12 new spec files, 53 new tests (`integrations-api` now at
      22 spec files / 83 tests total, all green: `cd
      apps/integrations-api && bun run test`), using the established
      `@nestjs/testing` + mocked `HttpService`/`SignzyClientService` +
      `getRepositoryToken(Entity)` pattern (matching
      `credeau.service.spec.ts`/`crif-bureau.service.spec.ts`), each
      asserting the real outgoing request URL/headers/body against the
      vendor contract documented in the service's own doc comment, not
      just "was called":
      - `signzy/signzy-client.service.spec.ts` (8 tests) — the shared
        HTTP client every Signzy-backed module depends on: default
        preprod base URL, bare (non-`Bearer`) `Authorization` header,
        extra-header merging, absolute-URL passthrough, a configurable
        `SIGNZY_BASE_URL`, and both the `post`/`get` API-error/
        network-error branches (this client never throws — it always
        resolves an error result — so downstream module tests only
        need SUCCESS/API_ERROR branches, not a separate NETWORK_ERROR
        one; confirmed by reading every downstream service).
      - `esign/esign.service.spec.ts` (5) — `v3/contract/initiate`
        (methodId 1) and `v3/contract/pullData` (methodId 3) request
        shapes, the "no prior initiate" guard on download.
      - `bank-verification/bank-verification.service.spec.ts` (4) —
        `v3/bankaccountverification/bankaccountverifications` request
        shape, optional mobile/email defaulting to `''`.
      - `enach/enach.service.spec.ts` (3) — the real (non-hardcoded)
        ICICI mandate-transaction POST body and the 3-branch SUCCESS/
        API_ERROR/NETWORK_ERROR pattern (this module calls
        `HttpService` directly, not through `SignzyClientService`).
      - `face-match/face-match.service.spec.ts` (3) — `v3/face/match`.
      - `poi-verification/poi-verification.service.spec.ts` (6) — all
        3 methods/method-ids (`v3/pan/fetchV2`=1, `v3/pan/extractions`=2,
        `v3/aadhaar/extraction`=3).
      - `uan-verification/uan-verification.service.spec.ts` (4) —
        `v3/api/advance-employment-verification`, multi-UAN joining.
      - `domain-email-verification/domain-email-verification.service.spec.ts`
        (5) — both `verifyDomain`/`verifyEmail` methods, asserting the
        real `{ email }` request body (proving the legacy empty-body
        bug fix from Task #48 actually holds).
      - `video-kyc/video-kyc.service.spec.ts` (3) — the scripted
        consent-statement string built from loan amount/repayment
        fields, `requestId`/`customerUrl` vs. `consumerId`/`videoUrl`
        fallback fields.
      - `reverse-geocode/reverse-geocode.service.spec.ts` (3) — the
        `x-client-unique-id` extra header.
      - `appsflyer/appsflyer.service.spec.ts` (4) — android/iOS app-id
        resolution, the lowercase `authentication` header, the
        200-and-body-is-literal-"OK" success condition.
      - `whatsapp/whatsapp.service.spec.ts` (5) — the Meta template-
        message body shape, `repayment_reminder`'s real component
        structure, the `"###"` placeholder fallback, and the empty-
        components array for any other template name.

      **Bug found, flagged not fixed (judgment call)**:
      `PoiVerificationService.verifyPan()`
      (`apps/integrations-api/src/modules/poi-verification/poi-verification.service.ts`)
      computes its log's `proofNo` from the *input* PAN (`dto.pan`),
      not from anything in Signzy's response, and its SUCCESS/
      API_ERROR status is derived from that same always-truthy
      `proofNo` — so a failed/empty Signzy PAN-fetch response is
      always logged as SUCCESS as long as the caller supplied a PAN
      string. `ocrPan`/`ocrAadhaar` (the other two methods in this same
      service) both correctly derive their status from the actual
      response fields. Not fixed here since the correct fix depends on
      which response field should gate success (e.g.
      `result?.name`/`result?.number` matching the input) — a call for
      whoever owns this vendor contract, not something to guess at.
      Covered by a test documenting the current (bug-preserving)
      behavior rather than asserting a stricter one that isn't actually
      implemented, consistent with how batch 1/2 handled similar
      judgment-call gaps above.

      **No modules left uncovered.** Every vendor module under
      `apps/integrations-api/src/modules/` now has a spec file; the
      shared `signzy-client.service.ts` is tested directly rather than
      only implicitly through its callers.

      Verification run from `backend/`: `bun install`
      (`PUPPETEER_SKIP_DOWNLOAD=true` needed locally, same pre-existing
      flake noted in batch 2), `bun run format && bun run lint && bun
      run typecheck && bun run build` all clean across all 4 apps (zero
      new warnings); `cd apps/integrations-api && bun run test` — 22
      suites / 83 tests, all green.

      **reporting-api smoke-test coverage — DONE.** Per the standing
      instruction for this task ("thorough on core-api, smoke-level on
      reports/exports"), scope here is method-level smoke coverage, not
      exhaustive per-filter permutation testing. First ran
      `find apps/reporting-api/src/modules -name "*.spec.ts"` /
      `-name "*.service.ts"`: every one of the 10 reporting-api modules
      already had a spec file from the original Phase 5 build (contrary to
      the initial assumption that some modules would have zero coverage —
      that turned out not to be the case in this repo's current state), so
      the actual gap was **per-method**, not per-module: several services
      only had tests for their "interesting" methods (drift fixes, rebuilt
      stubs) and left straightforward passthrough report methods
      completely untested. Diffed every service's public async method list
      against every `service.<method>(` call in its existing spec file to
      find the exact gap, then added one shape-asserting test + one
      empty-result test per untested method (skipping a separate empty-case
      test only where the method is pure aggregation/bucketing logic over
      an already-covered empty input, to avoid tautological duplicate
      tests).

      **Method-level gaps filled, by module** (existing spec files
      extended, no new spec files needed since all 10 already existed):
      - `collection-reports.service.spec.ts`: +20 tests
        (`collectionPercentageByExecutive`, `monthwisePendingCollection`,
        `collectionCallsByStatus`, `paymentAnalysisByDisbursalMonth`,
        `preCollectionByMonth`, `collectionByMonth`, `recoveryByMonth`,
        `collectionByBranch`, `currentBucketStatus`,
        `fyRepaymentCollection` — 10 methods x happy-path + empty-array).
      - `collection-exports.service.spec.ts`: +24 tests (`loanClosed`,
        `totalRecovery`, `preCollection`, `pendingCollectionVerification`,
        `legalData`, `outstandingData`, `loanPool`, `followUp`,
        `paymentRejected`, `suspenseVerified`, `newCollectionReport`,
        `legalNoticeSentLog` — 12 methods x happy-path + empty-array).
      - `credit-reports.service.spec.ts`: +16 tests (`sanctionKpi`,
        `outstandingSanctionCases`, `userTypeOutstanding`,
        `outstandingSanctionAmount`, `outstandingCasesDateRange`,
        `sanctionExecutiveTa`, `sanctionExecutiveAchievement`,
        `bucketWiseSanctionExecutive`).
      - `disbursal-exports.service.spec.ts`: +8 tests (`loanDisbursed`,
        `newLoanDisbursed`, `disbursalAccountReport`, `loanDumpReport`).
      - `disbursal-reports.service.spec.ts`: +6 tests (`disbursalSummary`,
        `monthlyDisbursal`, `fyDisbursementCollection`).
      - `field-visit-reports.service.spec.ts`: +3 tests (`rmwiseVisit` —
        the two-query merge between visit counts and collection amounts
        per RM, including the zero-collection default).
      - `financial-exports.service.spec.ts`: +4 tests (`auditTatReport`,
        `dashboardData` — including `dashboardData`'s filter-out-CAM-rows-
        with-no-repaymentDate branch).
      - `lead-exports.service.spec.ts`: +2 tests (`leadInteractionSummary`).
      - `lead-reports.service.spec.ts`: +24 tests (`leadSourceStatus`,
        `sanctionProductivity`, `hourlyStatusWise`, `leadUtmSourceStatus`,
        `leadUtmCampaignStatus`, `sourceUtmSourceStatus`,
        `leadSourcingCityWiseStatus`, `leadCityWiseStatus`,
        `rejectionAnalysis`, `leadAssignmentSummary`,
        `leadRejectionAnalysisCampaign`, `leadDigitalSummary`).
      - `credit-exports.service.spec.ts`: no gap found, already fully
        covered.
      - `common/`: added `export-permission.guard.spec.ts` (5 tests,
        mirroring the existing `mis-permission.guard.spec.ts` — no
        `@RequireExportPermission` metadata passes through, SA/CA bypass
        the grant check, a granted non-admin passes, an ungranted
        non-admin is rejected, an unauthenticated request is rejected).
        `csv.util.spec.ts` had 6 tests for `toCsv` already but zero for
        `sendCsv` (explicitly named in this task's brief) — added 2
        (correct `Content-Type`/`Content-Disposition` headers + body on a
        real result set, and the empty-result-set/explicit-columns case,
        proving it degrades to a header-only CSV rather than crashing).

      **Real bugs found and fixed** (both small/unambiguous, fixed rather
      than just flagged, per this task's instructions):
      1. `collection-exports.service.ts`'s `legalNoticeSentLog` (export_id
         44) used `.andWhere('rejectionReason.reason ILIKE :legal', ...)`
         — `ILIKE` is PostgreSQL-only syntax; this stack is MySQL
         throughout (per `CLAUDE.md`'s architecture decisions). This would
         have thrown a real SQL syntax error the first time this export
         was actually invoked against the real database — never caught
         because the existing test suite mocked the query builder and
         never executed real SQL. Fixed to
         `LOWER(rejectionReason.reason) LIKE :legal` (MySQL's default
         collation is already case-insensitive, but lowering explicitly
         keeps intent clear regardless of collation). New test asserts the
         corrected `andWhere` call.
      2. **Timezone-dependent off-by-one date bug**, found via a test
         failure while adding `credit-reports.service.spec.ts`'s
         `sanctionKpi` test in this sandbox (`Asia/Kolkata`, IST,
         UTC+5:30 — this business's home timezone): both
         `credit-reports.service.ts`'s `monthBounds()` and
         `collection-reports.service.ts`'s `monthRange()`/
         `financialYearRange()` built a `Date` from local
         year/month/day components, then called
         `.toISOString().slice(0, 10)` to format it as `YYYY-MM-DD`.
         `toISOString()` converts to UTC first — for any positive-UTC-offset
         timezone (IST included), a local midnight `Date` shifts back to
         the previous day in UTC, so every month-bounded report/export in
         these two services would silently query one day short at the
         start of its range (e.g. a "January" report actually starting
         "December 31") whenever the server's `TZ` is set to IST (or any
         other positive-offset zone) rather than UTC. Fixed by adding a
         `formatLocalDate()` helper (in both files — extracting the
         calendar fields with `getFullYear()`/`getMonth()`/`getDate()`
         directly rather than routing through UTC) and swapping every
         `toISOString().slice(0, 10)` call for it. This is a genuinely
         new finding, not previously flagged in any prior Phase 5
         write-up or `REPORTING-QUESTIONS-FOR-CLIENT.md`/`client.txt` (both since
         retired, see Task #149) —
         worth a note to whoever configures the production containers'
         `TZ` env var, since UTC deployment would have silently masked
         this the whole time.

      **Not touched, per this task's scope**: `apps/core-api/` and
      `apps/integrations-api/` (owned by concurrent agents this run);
      controller-layer tests (matches the established repo-wide precedent
      of no controller specs anywhere, same call made in batches 1/2
      above); e2e tests (still the cross-cutting gap for whichever batch
      does the final pass).

      Verification run from `backend/`: `bun install`
      (`PUPPETEER_SKIP_DOWNLOAD=true bun install --force` needed in this
      sandbox — the same pre-existing unrelated `puppeteer` postinstall
      flake noted in batch 2, compounded here by a stale/incomplete
      `node_modules/.bin` from an interrupted install; not introduced by
      this work), `bun run format && bun run lint && bun run typecheck &&
      bun run build` all clean across all 4 apps (zero new warnings); `cd
      apps/reporting-api && bun run test` — went from 13 suites / 77
      tests (pre-existing) to **14 suites / 186 tests**, all green (new
      `export-permission.guard.spec.ts` file plus method-level additions
      to the other 9 spec files, +1 new test in `csv.util.spec.ts`'s
      existing file for `sendCsv`).

      **e2e tests (all 4 services) — DONE.** Added the first real
      `.e2e-spec.ts` files across all 4 services (each service's
      `test/jest-e2e.json` already existed, unused, before this pass). Every
      test here boots the real `AppModule` via `Test.createTestingModule` +
      `app.init()` (replicating each service's `src/main.ts` bootstrap —
      cookie-parser/global-prefix/validation-pipe setup lives in `main.ts`,
      not on the module, so a bare `createTestingModule` would miss it) and
      hits it with real `supertest` HTTP requests against a real local MySQL
      `finance_crm_backend` connection — no repository mocking anywhere in these
      files. Ran against a real DB (`DB_USERNAME=ansul` — the real local
      dev credentials, not `.env.example`'s placeholders; copied `.env` into
      the worktree root from the main tree for the run, then deleted it
      before finishing — confirmed via `git status` nothing sensitive is
      staged).

      Files added:
      - `apps/core-api/test/utils/{bootstrap,fixtures}.ts` — shared
        `createTestApp()` (real cookie-parser + `api/v1` global prefix +
        validation pipe, mirroring `src/main.ts`) and
        `createTestUser`/`deleteTestUser` fixtures. Fixtures create a
        dedicated, real, bcrypt-hashed, `SA`-roled test user directly via
        the app's own `User`/`UserRole` repositories rather than gambling on
        the environment's seeded `admin@financecrm.com` password (this
        worktree's DB only has that account's real bcrypt hash, not its
        plaintext — `SEED_ADMIN_PASSWORD` isn't recorded anywhere once
        seeding has happened) — still a fully real sign-in/JWT/cookie round
        trip, just against test-owned fixture data. Every spec's `afterAll`
        deletes everything it created, in FK-safe order; verified by
        querying `finance_crm_backend` directly after every run (`leads`/`loans`/
        `disbursement_banks`/`user_mis_permissions` all back to 0 rows,
        `users` back to the 1 pre-existing seeded admin).
      - `apps/core-api/test/app.e2e-spec.ts` — **fixed**, not just added
        (the Nest-CLI-scaffolded file already existed and was failing:
        it asserted `GET /` returns `200 "Hello World!"`, which was never
        true once `main.ts`'s `api/v1` global prefix and the global
        `JwtAuthGuard` existed — the real, correct behavior is `404` at the
        unprefixed root and `401` at `/api/v1` with no cookie, which is what
        it now asserts).
      - `apps/core-api/test/auth.e2e-spec.ts` — real sign-in (200 + real
        `access_token`/`refresh_token` cookies set, `roles: ['SA']` in the
        response body), real 401 on a wrong password and on an unknown
        email, real 401 hitting `GET /api/v1/auth/me` with no cookie, real
        200 on the same route with the real cookie from sign-in.
      - `apps/core-api/test/leads.e2e-spec.ts` — creates a real lead via an
        authenticated `POST /api/v1/leads`, fetches it back, changes its
        status via `PATCH /api/v1/leads/:id/status`, asserts the new
        `leadStatus` persisted for real on re-fetch *and* that the real
        `LeadFollowup` audit-trail row was written (per this codebase's
        workflow-changing-action convention); also asserts the same create
        call 401s with no cookie.
      - `apps/core-api/test/disbursal.e2e-spec.ts` — creates a lead, a real
        disbursement bank, a loan (`PENDING`), disburses it (asserts the
        loan flips to `DISBURSED` and exactly one real `COMPLETE`
        transaction-log row is written), then re-disburses the same loan and
        asserts a real `409` — an HTTP-level regression test for batch 1's
        real bug fix (`DisbursalService.disburse()`'s missing
        already-disbursed guard), not a re-test of the existing unit
        coverage.
      - `apps/integrations-api/test/utils/bootstrap.ts` +
        `test/health.e2e-spec.ts` — real boot (all vendor adapter modules +
        real DB), real `200` on `GET /api/v1/integrations/health`
        (`@Public()`), real `401` on a real non-public route
        (`GET .../credeau/leads/1/latest`) with no cookie — confirms
        `SharedAuthModule`'s global guard is genuinely wired up in this
        service too.
      - `apps/reporting-api/test/utils/{bootstrap,fixtures}.ts` +
        `test/health.e2e-spec.ts` + `test/mis-permission.e2e-spec.ts` — real
        boot, real `200` on `GET /api/v1/reporting/health`. **Real bug
        found and fixed during review**: reporting-api's `src/main.ts`
        never called `app.use(cookieParser())` (unlike
        `core-api`/`integrations-api`'s `main.ts`, and reporting-api didn't
        even depend on the `cookie-parser` package) — `JwtStrategy`'s cookie
        extractor (`packages/common/src/auth/jwt.strategy.ts`) reads
        `req.cookies[ACCESS_TOKEN_COOKIE]`, which was always `undefined`
        without that middleware, so **every reporting-api request 401'd
        before `MisPermissionGuard`/`ExportPermissionGuard` ever ran**, even
        with a perfectly valid, freshly-signed access token — first caught
        by two real HTTP requests carrying a real signed JWT cookie (one
        with `roles: []`, one with `roles: ['SA']`), both `401`, proving the
        gap was upstream of the permission guards' own role/grant logic, not
        a guard bug. This is exactly the class of gap e2e testing exists to
        catch that a guard's own repository-mocking unit spec
        (`mis-permission.guard.spec.ts`) cannot see. **Fixed** during merge
        review: added `cookie-parser`/`@types/cookie-parser` to
        `apps/reporting-api/package.json` and `app.use(cookieParser())` to
        `src/main.ts`, mirroring `integrations-api/src/main.ts`'s exact
        pattern (including its explanatory comment). The e2e test's own
        bootstrap helper (`test/utils/bootstrap.ts`) had the identical gap
        (it mirrors `main.ts`'s prefix/pipe setup but hadn't been mirroring
        the cookie-parser middleware either, so re-running the test after
        the `main.ts` fix still failed) — fixed there too. Re-verified: the
        `mis-permission.e2e-spec.ts` assertions were updated from "documents
        the bug" (expects `401`) to "confirms the fix" (a no-grant user gets
        a real `403` from `MisPermissionGuard`, an `SA`-role token is no
        longer blocked by auth at all) and both now pass against the real
        DB.
      - `apps/automation-worker/test/utils/bootstrap.ts` +
        `test/health.e2e-spec.ts` — real boot (real DB, real
        `JobRunnerModule` defaulting to `InProcessJobRunner`, all 14 real
        job modules registered) and real `200` on
        `GET /api/v1/automation/health` (this service registers no
        `SharedAuthModule`/global guard at all, so the route is reachable
        with no auth — confirmed by reading `src/app.module.ts`, not
        assumed).

      Verification run from `backend/`: `bun install`, `bun run format &&
      bun run lint && bun run typecheck && bun run build` all clean across
      all 4 apps (zero new warnings; `test/` is excluded from each service's
      `tsconfig.build.json`, so `bun run typecheck` doesn't cover these
      files — their types are verified by `ts-jest` actually running them,
      which it did, successfully, for all of the below); `cd apps/<service>
      && bun run test:e2e` for all 4 services against the real local
      `finance_crm_backend` MySQL database: core-api 4 suites / 14 tests,
      integrations-api 1 suite / 2 tests, reporting-api 2 suites / 4 tests,
      automation-worker 1 suite / 1 test — **all green, all against a real
      DB, none skipped/deferred**. `cd apps/core-api && bun run test` still
      16 suites / 258 tests, all green (unaffected).

      **e2e tests are now done for all 4 services.** Both this e2e batch
      and the concurrent `integrations-api` unit-test-gap batch have now
      landed and merged into `feature/microservices-migration` — Task #60
      is complete in full: core-api (3 batches, 258 unit tests),
      integrations-api (test-gap closure, 83 unit tests), reporting-api
      (smoke coverage + 2 real bug fixes, 186 unit tests), and e2e tests
      across all 4 services (21 tests, real DB, no mocking) — including a
      real, previously-undiscovered auth bug in `reporting-api` (missing
      `cookie-parser` middleware, meaning the entire service was
      unreachable by any authenticated caller) found and fixed during
      this pass.
- [x] **#61 Swagger/OpenAPI on `core-api`, `reporting-api`,
      `integrations-api` — DONE.** `automation-worker` skipped per the task
      wording — it still has no public routes beyond a health check.

      **Package**: `@nestjs/swagger@^11.4.6` added to all 3 services
      (checked npm — latest stable at the time; its `peerDependencies`
      require `@nestjs/common`/`@nestjs/core` `^11.0.1`, exactly matching
      this repo's pinned Nest major/minor, so it's the correct version, not
      a guess. The `12.0.0-alpha.*` prereleases on npm were deliberately
      not used).

      **Wiring** (`src/main.ts` per service): `DocumentBuilder` +
      `SwaggerModule.createDocument`/`.setup(...)`, mounted at an explicit
      literal path (independent of `app.setGlobalPrefix`, which only
      affects `@Controller`-routed paths, not a manually-mounted Swagger
      route) matching each service's existing prefix convention:
      - `core-api` — prefix is bare `api/v1` (confirmed by reading its
        `main.ts`, not assumed) — docs mounted at `api/v1/core/docs`
        (`docs-json` for the raw spec) to match the `<service>/docs`
        pattern the other two already use structurally.
      - `reporting-api` — prefix `api/v1/reporting` — docs at
        `api/v1/reporting/docs`.
      - `integrations-api` — prefix `api/v1/integrations` — docs at
        `api/v1/integrations/docs`.

      Auth scheme: cookie-based, not bearer — confirmed by reading
      `packages/common/src/auth/` (`JwtStrategy`'s `cookieExtractor` reads
      `ACCESS_TOKEN_COOKIE` = `'access_token'` from `req.cookies`, no
      `Authorization` header anywhere). `@nestjs/swagger`'s
      `DocumentBuilder.addCookieAuth(cookieName, options, securityName)`
      does support this (verified in its `.d.ts`/`.js` source, not
      assumed) — used with `securityName` left at its default (`'cookie'`)
      so every controller/route can reference it with the bare
      `@ApiCookieAuth()` decorator (also verified to default its `name`
      param to `'cookie'`, matching). Titles: `Finance CRM Core API` /
      `Finance CRM Reporting API` / `Finance CRM Integrations API`, version
      hardcoded `'1.0'` (these services don't bump `package.json`'s
      `0.0.1` per-release, so reading it in wouldn't add anything real).

      **CLI-plugin vs. manual `@ApiProperty()` decision**: none of the 4
      services had `@nestjs/cli`'s Swagger plugin enabled in `nest-cli.json`
      before this task, and it was deliberately **not** enabled now. Reason:
      every service's `start:prod` script runs `bun src/main.ts` directly
      (see this file's gotchas section on `dist/apps/<name>/src/main.js`) —
      the Swagger CLI plugin's DTO-shape inference from `class-validator`
      decorators is a `tsc`/webpack compile-time AST transform that only
      runs through `nest build`/`nest start`, which `start:prod` never
      invokes. Enabling the plugin would make `nest build` (used for
      typecheck/lint verification and local `nest start`) produce annotated
      DTOs while the actual production entrypoint silently served
      unannotated (empty-schema) ones — a real, easy-to-miss trap. Instead,
      manual `@ApiProperty()`/`@ApiPropertyOptional()` decorators were added
      by hand to the highest-traffic/most-complex DTOs (list-query DTOs and
      the main create/update request bodies) in `core-api` (19 DTO files)
      and `integrations-api` (22 DTO files, one per vendor's request body;
      `ekyc`'s query-param-only endpoints got `@ApiQuery` instead of a DTO).
      Trivial 1–3-field DTOs (most geography/lookup CRUD, auth) were left
      with `class-validator` decorators only — Swagger UI shows a generic
      but non-empty schema for these, deemed an acceptable trade for not
      hand-annotating every field of every DTO. `reporting-api` got no
      manual `@ApiProperty()` at all (deliberate scope cut, below).
      Also fixed a latent gotcha found while doing this: several
      `UpdateXDto extends PartialType(CreateXDto)` classes in `core-api`
      imported `PartialType` from `@nestjs/mapped-types` (no Swagger
      metadata support) instead of `@nestjs/swagger`'s own `PartialType` —
      switched all of them, or their update-DTO schemas would have rendered
      empty in Swagger UI regardless of the base DTO's annotations.

      **Controller/endpoint coverage**:
      - `core-api` — all 36 controllers get `@ApiTags`; all except the
        fully-`@Public()` `AuthController` and the health-check
        `AppController` get class-level `@ApiCookieAuth()`; every route
        handler gets an `@ApiOperation({summary})` describing what it
        actually does (read from the service call, not filler text); every
        path param gets `@ApiParam`.
      - `integrations-api` — all 22 (feature) + 1 (app) = 22 controllers
        get `@ApiTags`; 20 get `@ApiCookieAuth()`. **3 correctly left
        without it**, all genuinely `@Public()`: the health check, and two
        third-party-initiated webhooks that authenticate a different way —
        `razorpay-webhook.controller.ts` (HMAC signature in
        `x-razorpay-signature`, verified against `RAZORPAY_WEBHOOK_SECRET`)
        and `upi-callback.controller.ts` (ICICI EazyPay: no signature
        header at all, trust comes only from successfully RSA-decrypting
        the body with our private key) — both noted in their
        `@ApiOperation` summary so Swagger UI readers aren't misled into
        thinking these need a cookie.
      - `reporting-api` — deliberately the lightest pass, per this task's
        own instructions (111-ish endpoints across 10 report/export
        modules is too much for exhaustive per-field annotation to be worth
        the time). All 11 controllers get `@ApiTags` (grouped by
        report/export category — Lead Reports, Lead Exports, Credit
        Reports, Credit Exports, Disbursal Reports, Disbursal Exports,
        Collection Reports, Collection Exports, Financial Exports, Field
        Visit Reports, App) and class-level `@ApiCookieAuth()` (none of
        them are `@Public()`); all 102 route handlers (the actual count —
        "111" in this task's own estimate was an approximation) get a
        specific one-line `@ApiOperation({summary})` naming the actual
        report/export produced. No `@ApiProperty`/`@ApiQuery`/`@ApiResponse`
        were added here — an intentional scope cut, not an oversight.

      **Verification** (from `backend/`, `PUPPETEER_SKIP_DOWNLOAD=true` set
      for `bun install` since this sandbox has no network access for
      Puppeteer's Chromium download — pre-existing, unrelated to this
      task): `bun install`, `bun run format && bun run lint && bun run
      typecheck && bun run build` all clean across all 4 apps, zero
      warnings. `cd apps/<service> && bun run test`: core-api 258/258,
      integrations-api 83/83, reporting-api 186/186 — identical counts to
      Task #60's baseline, confirming nothing broke. `bun run test:e2e`
      against a real local `finance_crm_backend` MySQL DB (`.env` copied in
      temporarily from the main tree, deleted after, confirmed via `git
      status` nothing stray was left behind): core-api 14/14, reporting-api
      4/4, integrations-api 2/2 — all green, matching Task #60's counts.

      **Real boot + curl check** (the part that actually matters — a
      Swagger UI that only "typechecks" is worthless): started each service
      for real with `PORT=<port> bun run start:prod` against the real DB,
      then `curl`'d both the HTML UI and the raw spec:
      - `core-api` (port 3000): `GET /api/v1/core/docs` → 200,
        `GET /api/v1/core/docs-json` → 200, valid OpenAPI JSON, `info.title`
        = `"Finance CRM Core API"`, 111 documented paths, first operation's
        `tags`/`summary` populated correctly.
      - `reporting-api` (port 3002): `GET /api/v1/reporting/docs` → 200,
        `docs-json` → 200, 102 documented paths, correct title.
      - `integrations-api` (port 3001): `GET /api/v1/integrations/docs` →
        200, `docs-json` → 200, 33 documented paths, correct title.
      All 3 processes killed and their temporary `.env` copies removed
      afterward.

      **Fixed during merge review**: `core-api` had no dedicated,
      unauthenticated `GET /health` route at all — unlike
      `reporting-api`/`integrations-api`/`automation-worker`, which each
      got one during their own scaffolding tasks. The only route this
      service exposed at its root was `GET /` (the default Nest scaffold,
      still JWT-guarded like everything else, returning "Hello World!" —
      not a real liveness contract), which a concurrently-written
      `DEPLOYMENT.md` had to work around with an ALB health-check matcher
      accepting `HttpCode=200,401` against the guarded `GET /api/v1` route
      instead (treating "401 means it booted" as a liveness signal).
      Added `AppService.getHealth()` + `@Public() GET /api/v1/health` to
      `AppController` (`app.controller.ts`), matching the other 3
      services' exact pattern. Live-boot-verified:
      `curl http://localhost:3000/api/v1/health` → `200 ok`. `DEPLOYMENT.md`
      should be updated to point `tg-core-api`'s health check at
      `/api/v1/health` with a plain `200` matcher instead of the
      `200,401` workaround — flagged for whoever next touches that file
      (or done directly by whoever merges this).
- [x] **#62 Final full-stack verification + `DEPLOYMENT.md`.**
      `docker-compose up` must bring up all 5 containers (gateway, core-api,
      reporting-api, integrations-api, automation-worker) plus mysql (and
      redis if `REDIS_URL` gets configured), gateway must successfully proxy
      a request through to each service. Then write `DEPLOYMENT.md`: VPC/
      subnets, one EC2 instance per service, internal ALB target groups +
      listener rules, RDS setup, S3 bucket, security groups, full env-var
      checklist per service, Docker install/run commands — detailed enough
      for the user to execute by hand against real AWS.
      - [x] **`DEPLOYMENT.md` half — DONE.** Root-level `DEPLOYMENT.md`
            written as a hand-executable AWS runbook (no Terraform, per
            architecture decision #8 — no cloud credentials available to
            apply IaC against). Read `nginx.conf`/`docker-compose.yml`/every
            `apps/*/Dockerfile`/`apps/*/src/main.ts`/`.env.example`/
            `s3-storage.adapter.ts`/`data-source.ts`/`job-runner.module.ts`
            directly rather than inventing commands. Sections: (0) service
            port/prefix/health-path table, (1) VPC/subnets across 2 AZs,
            IGW, one NAT gateway, route tables, (2) one security group per
            tier with least-privilege ingress, (3) EC2 sizing + AL2023
            Docker install + per-service `docker run`/systemd units
            translated verbatim from `docker-compose.yml`/`Dockerfile`s,
            (4) RDS sizing/backups/parameter group + migration execution,
            (5) S3 bucket (blocked public access, confirmed via reading
            `S3StorageAdapter` that every read is a signed URL, never
            public), (6) IAM instance role scoped to S3 only, (7) full
            per-service env-var checklist cross-checked against
            `.env.example`'s inline service-ownership comments, (8) internal
            ALB target groups + listener rules mirroring `nginx.conf`'s 3
            `location` blocks exactly, (9) hand-rollout + rollback via
            git-SHA-tagged images, (10) optional ElastiCache Redis note tied
            to `JobRunnerModule`'s existing `REDIS_URL` toggle.
            **Judgment calls flagged in the doc, need client/dev
            confirmation:**
            - **Topology**: decided `gateway` stays the public-subnet,
              internet-facing edge (nginx keeps doing TLS/CORS/cookie-path
              work exactly as today) sitting in front of the **internal**
              ALB, rather than making the ALB itself internet-facing and
              retiring `gateway` — reasoned from the word "internal" in the
              already-confirmed decision in this file's §3.3. Flagged as a
              decision that could go the other way if the client would
              rather eliminate the extra hop.
            - **Instance sizes** (`t3.micro`/`t3.small` across the 5
              services, `db.t3.small` for RDS) — explicitly labeled as
              starting points for "modest initial load," not benchmarked
              against real traffic. Flagged to watch CloudWatch and resize
              rather than pre-guess further.
            - **RDS Multi-AZ** — left OFF (`--no-multi-az`) in the example
              command. Doubling RDS cost for automatic failover is a real
              tradeoff; the doc explicitly does NOT assert an actual
              RBI/NBFC regulatory requirement (none confirmed anywhere in
              the codebase/planning docs), just flags that this is a
              lending-business CRM where the client's compliance/ops owner
              should confirm whether a real SLA mandates it. **This belongs
              in `client.txt`/`FLOW.txt` (both since retired, see Task #149) as a
              client-facing question per
              this task's instructions — not added there directly by this
              task, the user will fold it in.**
            - **`core-api` has no `GET /health` endpoint at all** (confirmed
              by reading every `@Public()` controller in
              `apps/core-api/src/` — only `POST /api/signin` and
              `POST /api/forgot-password*` are public, no public `GET`
              anywhere). Worked around in the ALB target group with
              `--matcher HttpCode=200,401` (a 401 from the guarded root
              route still proves the app booted and is routing). Recommends
              a follow-up task to add a real `@Public() GET /health` to
              `core-api` matching `reporting-api`/`integrations-api`/
              `automation-worker`'s existing pattern — **not done here**
              since it would touch `apps/core-api/src/`, out of scope for
              this task (a concurrent agent owns that path for Task #61).
            - **MySQL charset**: flagged that `data-source.ts` never passes
              an explicit `charset: 'utf8mb4'` option to TypeORM/`mysql2`
              (relies on driver default), even though the local dev seed
              step explicitly creates its database with
              `CHARACTER SET utf8mb4`. The runbook covers the RDS-side fix
              (a custom parameter group forcing `utf8mb4` server defaults)
              but flags the app-side fix (an explicit `charset` option in
              `buildDataSourceOptions()`) as a separate, not-yet-made code
              change for whoever next touches `packages/database`.
            - **IAM**: gave the S3-scoped instance role to `core-api` only
              (not all 5 instances) since `StorageModule`/`S3StorageAdapter`
              exist but aren't wired into any controller yet (per this
              file's Phase 3 §4 note) — judgment call that core-api is the
              most likely first consumer (document workflows), revisit if a
              different service ends up owning file uploads.
            - **`docker-compose up` full-stack verification — DONE** (the
              other half of this task, completed in a later pass after the
              `refactor: flatten apps/packages into repo root` commit). This
              is the first time anyone actually ran `docker compose up
              --build` for the whole stack, and it surfaced **real
              regressions the flatten refactor introduced, none caught by
              `bun run format/lint/typecheck/build/test` since those never
              exercise cross-directory relative paths at runtime**:
              1. `database/tsconfig.json`'s `extends: "../../tsconfig.json"`
                 was a leftover from when it lived at `packages/database/`
                 (two levels deep) — now one level deep, so it pointed
                 *above* the repo root and broke `migration:run`/
                 `migration:generate`/`migration:revert`'s ts-node
                 compilation entirely (`TS5083: Cannot read file`). Fixed to
                 `"../tsconfig.json"`.
              2. `database/src/data-source.ts` loaded the repo-root `.env`
                 via `${__dirname}/../../../.env` — also a leftover from the
                 two-levels-deep layout, now overshooting one directory
                 above the repo root. Every migration/seed run was silently
                 loading zero real env vars and falling back to
                 `data-source.ts`'s hardcoded defaults (`root`/empty
                 password/`finance_crm_backend`) instead of the real `.env` values.
                 Fixed to `../../.env`.
              3. **All 4 services'** `app.module.ts` had
                 `envFilePath: ['.env', '../../.env']` — the exact same
                 leftover-depth bug. Since the flatten commit, **no service
                 has actually been loading the real root `.env` at all**,
                 silently falling back to `ConfigService`'s hardcoded
                 defaults for every `config.get(key, default)` call and
                 throwing on every `config.getOrThrow(key)` call for a var
                 only set in `.env`. This is a severe, previously-undetected
                 regression — nothing in the test suites boots via
                 `ConfigModule.forRoot` against a real filesystem layout the
                 way a real deployment does. Fixed to `['.env', '../.env']`
                 in all 4.
              4. All 4 Dockerfiles only `COPY`'d their own service's
                 `package.json` (plus `database`/`common`'s) before `bun
                 install --frozen-lockfile` — but the root `package.json`'s
                 `workspaces` array names all 6 members explicitly, so bun's
                 frozen-lockfile install requires every member's manifest
                 present or fails with `Workspace not found`. This was
                 always broken, not a flatten regression — nobody had run a
                 real `docker build` for any service before this pass.
                 Fixed by copying all 4 services' `package.json` files (not
                 just the building service's own) into every Dockerfile.
              5. Also never copied: the root `tsconfig.json` itself. `common/`
                 has no `tsconfig.json` of its own, so bun resolves
                 decorator semantics (`experimentalDecorators`) by walking up
                 the directory tree from each compiled file — on the host
                 this reaches `backend/tsconfig.json`, but inside a
                 container that never copied it, the walk finds nothing and
                 bun falls back to native (Stage 3) decorator semantics,
                 which pass `(value, context)` instead of `(target,
                 propertyName)` to property decorators. Every service
                 crash-looped on boot with `TypeError: undefined is not an
                 object (evaluating 'object.constructor')` inside
                 `class-validator`'s `ValidateBy`, the moment any DTO with a
                 decorator (`PaginationQueryDto`, the first one NestJS
                 touches) was loaded. Fixed by adding `tsconfig.json` to
                 every Dockerfile's manifest-`COPY` step.
              6. **Puppeteer's Chrome for Testing has no native
                 linux/arm64 build** — on an Apple Silicon host, `bun
                 install`'s postinstall silently downloads the linux **x64**
                 build instead, which then fails at container runtime
                 (`rosetta error: failed to open elf at
                 /lib64/ld-linux-x86-64.so.2` — no x86 emulation layer
                 inside a plain Linux container). This is exactly the
                 scenario `puppeteer-pdf-renderer.ts`'s own doc comment
                 anticipated ("In Docker/production, set
                 `PUPPETEER_EXECUTABLE_PATH` to an OS-installed chromium
                 binary") but no Dockerfile had actually implemented it yet.
                 Fixed: `core-api/Dockerfile` (the only service with a wired
                 `PdfRenderer` consumer — Task #63's sanction-letter
                 endpoint) now `apt-get install`s Debian's native-arch
                 `chromium` package and sets `PUPPETEER_SKIP_DOWNLOAD=true`
                 + `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`; the other
                 3 Dockerfiles just set `PUPPETEER_SKIP_DOWNLOAD=true`
                 (`@finance-crm/common` pulls in `puppeteer` as a dependency for all
                 of them even though only core-api renders PDFs today, so
                 there's no reason for the other 3 to spend build time
                 downloading a Chrome binary they'll never launch).
              7. `docker-compose.yml`'s `mysql` service only set
                 `MYSQL_ROOT_PASSWORD` — if `.env`'s `DB_USERNAME` isn't
                 literally `root` (as this repo's real local-dev `.env`
                 isn't — it's a dedicated non-root user, matching how local
                 host MySQL is set up per section 5), the container never
                 creates a matching MySQL user, so every service's real
                 `.env` credentials would fail to authenticate against the
                 dockerized MySQL with `ER_ACCESS_DENIED_ERROR`. Fixed by
                 adding `MYSQL_USER`/`MYSQL_PASSWORD` (same
                 `${DB_USERNAME:-root}`/`${DB_PASSWORD:-changeme}`
                 substitution already used for `MYSQL_ROOT_PASSWORD`) so the
                 container creates a real matching user — a no-op if
                 `DB_USERNAME` is left at `.env.example`'s default of
                 `root`. Also parameterized the mysql service's host port
                 mapping (`'${DB_HOST_PORT:-3306}:3306'`, was a hardcoded
                 `'3306:3306'`) so `docker compose up` doesn't collide with
                 an already-running local MySQL on the default port —
                 defaults to the exact same behavior as before if
                 `DB_HOST_PORT` isn't set.

              **Full verification actually performed** (not just config
              review): started Docker Desktop, brought up just `mysql`
              (`DB_HOST_PORT=3307 docker compose up -d mysql`), ran
              `migration:run` and `seed` from the host against the mapped
              port against a genuinely empty database (confirmed all 49+
              tables/23 role types/reference data seeded fresh), then
              `DB_HOST_PORT=3307 docker compose up -d --build` for the full
              5-container stack. All 4 app services booted cleanly with
              every route mapped and no crash-loop (confirmed via `docker
              compose ps` staying `Up`, not `Restarting`). Verified the
              gateway actually proxies, not just that containers exist:
              `GET :8080/api/v1/health` → core-api 200, `GET
              :8080/api/v1/reporting/health` → reporting-api 200, `GET
              :8080/api/v1/integrations/health` → integrations-api 200,
              unauthenticated `GET :8080/api/v1/leads` → 401 (confirms
              `JwtAuthGuard` is live through the gateway, not bypassed). Ran
              a real business flow end-to-end through the gateway against
              the fresh DB: signed in as the freshly seeded admin (`POST
              :8080/api/signin`), created a lead, upserted + sanctioned its
              CAM, then called Task #63's new `GET
              :8080/api/v1/leads/1/sanction-letter` — got back a real,
              valid 8-page PDF (`file` confirms `PDF document, version
              1.4`), confirmed it was uploaded to local storage
              (`core-api/storage/sanction-letters/lead-1-*.pdf` inside the
              container) and `CreditAnalysisMemo.sanctionLetterFileName`
              persisted correctly. Re-ran the full host-side
              `format/lint/typecheck/build/test` sweep after all the above
              fixes — all 4 services still clean, all suites green
              (core-api 17/262, reporting-api 14/186, integrations-api
              22/83, automation-worker 16/81).

              **Redis/BullMQ path also verified** (this compose file
              previously had no `redis` service at all — added one:
              `redis:7-alpine`, plus `REDIS_URL: ${REDIS_URL:-}` on
              `automation-worker` so it's overridable per-invocation without
              hardcoding BullMQ as the default). Re-ran with
              `REDIS_URL=redis://redis:6379 docker
              compose up -d --build`: `automation-worker`'s logs switched
              from `[InProcessJobRunner] Scheduled job "..." (..., in-process)`
              to `[BullMqJobRunner] Scheduled job "..." (..., bullmq)` for
              all 14 real cron jobs, and `redis-cli keys '*'` inside the
              `redis` container showed real `bull:<job-name>:repeat`/`:meta`/
              `:events` keys for each one — confirms `JobRunnerModule`'s
              `REDIS_URL`-gated auto-upgrade genuinely works end-to-end, not
              just that the code compiles. Brought the stack back down
              (`docker compose down`) afterward — `REDIS_URL` stays unset in
              `.env`/`.env.example`, so a plain `docker compose up` still
              defaults to `InProcessJobRunner`, unchanged from before this
              verification.

              **`automation-worker` job execution verified for real, not
              just registration.** Every check above only proved the 14
              jobs *schedule* successfully (DI wiring, no boot crash) — that
              doesn't prove a handler actually runs correctly against a live
              DB. Brought `mysql` + `automation-worker` back up alone (still
              against the same fresh dockerized DB, not local/host MySQL —
              the two are entirely separate MySQL instances, host port 3307
              vs. the local one's 3306) and waited for a real
              `*/5 * * * *` cron boundary to fire (`InProcessJobRunner`'s
              actual `CronJob`, real wall-clock time, not simulated). Logs
              confirmed `screener-lead-allocation-g50k`/`-b50k` and
              `credit-application-allocation-g50k`/`-b50k`/`-repeat` all
              fired at the correct time and ran a real TypeORM query against
              the live DB, correctly returning "no eligible leads/
              applications" (our one test lead has no `leadStatus` set, so
              it legitimately doesn't match their S1-stage eligibility
              filter) — a genuine clean real-DB execution, not a mock and
              not an error.
- [x] **Task #63 — Wire PDF generation into a real core-api endpoint
      (sanction letter).** DONE. New `core-api/src/modules/documents/`
      (`SanctionLetterService`, `SanctionLetterController`,
      `DocumentsModule`, wired into `app.module.ts`) —
      `GET /api/v1/leads/:leadId/sanction-letter`. This is the concrete
      "download sanction letter" use case Task #45 and the `#62`
      IAM write-up both deferred as future work; it's the first real
      caller of both `PdfRenderer` and `StorageAdapter`.
      - Added a `PdfModule` (`common/src/pdf/pdf.module.ts` +
        `pdf.tokens.ts`, `PDF_RENDERER` DI token) so PDF rendering follows
        the same factory-provider pattern as `StorageModule`/
        `JobRunnerModule` — only `PuppeteerPdfRenderer` exists today, but
        consumers depend on the token, not the class.
      - `SanctionLetterService.generate(leadId)`: loads the lead's
        sanctioned `CreditAnalysisMemo` (throws `ConflictException` if no
        CAM exists yet or it isn't `CamStatus.SANCTION` — generating this
        letter before sanction makes no sense), the `LeadCustomer` (name/
        father's name/PAN/address/gender-for-title), `CustomerBanking`
        (disbursal account number/IFSC), and the `Loan` if one exists yet
        (loan number — falls back to `applicationNo` since a loan record
        may not exist until the separate disbursal step), builds
        `SanctionLetterData`, renders via `PDF_RENDERER`, uploads the
        result to `STORAGE_ADAPTER` under `sanction-letters/lead-<id>-<ts>.pdf`,
        and persists that key on `CreditAnalysisMemo.sanctionLetterFileName`
        — the field this schema already reserved for exactly this (see
        Phase 3's CAM entity), never previously written to by any code
        path. Returns the raw PDF bytes to the controller.
      - **Real judgment call flagged in code, not guessed**:
        `CreditAnalysisMemo.roi` has no unit recorded anywhere in the
        schema/codebase (every reporting-api export just passes it through
        verbatim). This template computes a displayed APR as
        `roiPerDay * 365`, so the service assumes `cam.roi` is already a
        genuine daily rate — flagged in a code comment
        (`sanction-letter.service.ts`) for business/credit-policy review
        before the APR/penal-interest figures on a real generated letter
        are trusted.
      - `SanctionLetterController.download` streams the PDF back with
        `Content-Type: application/pdf` / `Content-Disposition: inline`
        (mirrors reporting-api's `sendCsv` pattern for binary responses) —
        this is the "internal FE calls BE, BE renders, FE displays/prints"
        flow; the frontend doesn't need its own PDF-rendering code.
      - Verified: `bun run format/lint/typecheck/build` clean across all 4
        services; 4 new unit tests
        (`sanction-letter.service.spec.ts`, mocking `PDF_RENDERER`/
        `STORAGE_ADAPTER`/all 5 repositories — not-found lead, no-CAM,
        not-yet-sanctioned CAM, and the full happy path asserting the
        rendered HTML contains the real loan number/borrower name and
        that the storage key/`sanctionLetterFileName` persist correctly)
        — core-api now at 17 suites / 262 tests, all green. **Not yet
        live-booted/curled against a real Puppeteer-rendered PDF** in this
        pass (no local MySQL/Chromium exercise done here) — do that as
        part of Task #62's full-stack `docker-compose` verification.
      - **Not done here, flagged as follow-up**: the other 3 PDF templates
        (AA consent form, CIBIL report, legal notice) still have no wired
        endpoint — no controller yet has the underlying data (bureau
        report, e-sign consent capture) modeled to call them meaningfully.
        Revisit once those flows exist.
      - **Follow-up idea, not decided, revisit only if template authoring
        pain actually shows up**: current templates
        (`common/src/pdf/templates/*.ts`) are raw HTML built via TS
        template-literal strings — no Tailwind, no component reuse, no
        visual preview while editing. User proposed a standalone internal
        `fe-pdf-service` (separate deployable, own auth, frontend calls it,
        it calls back into core-api for data, renders with Tailwind/JSX,
        prints via Playwright). Recommended against that specific shape:
        it reverses this file's already-made architecture decision
        (§3.6 — PDF generation is a shared library, not a service, to avoid
        a network hop on a synchronous action), doesn't actually make
        rendering faster (the headless-browser cost is the same wherever
        it runs — the win would be pure authoring DX), and needs a
        service-to-service auth mechanism that doesn't exist anywhere in
        this codebase yet. Lighter alternative floated instead, **not
        built, no code changes made for this**: keep Puppeteer running
        inside core-api (no new service, no new auth), but point it at an
        internal-only route inside the `frontend` app (e.g.
        `/internal/pdf/sanction-letter?leadId=1`, unreachable from the
        public internet) — a real React/Tailwind page instead of a
        template-literal string, printed to PDF the same way `page.
        setContent(html)` does today, just `page.goto(url)` instead. Only
        worth doing once someone actually needs to iterate on PDF visual
        design frequently enough that raw HTML strings are a real
        bottleneck — for today's 4 mostly-static, legally-reviewed
        documents, the current in-process approach stays the simpler
        default.


## Task #64 — ops-tooling gap closure (post-migration audit)

A code-level audit (every legacy `old-php-files/application/controllers/`
file cross-referenced against actual backend source, not just this doc)
found that the "migration complete" claim above undercounted a real
category: internal ops-support tooling with zero backend trace despite
Phases 1-7 being marked done. Closed in this task:

- **`core-api/src/modules/support/`** (new module, `@Roles('SA','CA')`):
  ports `SupportController.php` — eKYC/eSign reset, lead-allocation
  override (clears rejection metadata when reassigning a previously-
  rejected lead), and gated personal/employment/bank/CAM detail overrides
  that delegate to the existing `LeadsService`/`VerificationService`/
  `CamService` methods rather than duplicating them. A new shared
  `assertLeadEditableBySupport()` (`core-api/src/common/lead-editable.
  util.ts`) gates these to leads that are active and not yet disbursed,
  translating legacy's numeric `$allow_status_id` allow-list to this
  schema's `MasterStatus.name` values. Also added soft-delete endpoints
  for documents (`verification` module) and disbursement transaction logs
  (`disbursal` module), gated the same way.
- **Account Aggregator vendor integration** (new
  `integrations-api/src/modules/account-aggregator/` + `AccountAggregatorLog`
  entity/migration): ports `AAController.php`/`Aggregator.php` — the RBI
  Account Aggregator consent-based bank-statement flow via a gateway in
  front of Finvu. Confirmed via this doc's own Task #49 write-up that
  Finbox is an unrelated vendor and AA was a genuine, previously
  undocumented-as-open gap. Covers the 6-step flow (consent request/
  status, FI request/status/fetch-data, analytics report) following the
  `credeau` adapter pattern; `fetchFiData` returns JSON transactions
  grouped by month instead of porting legacy's server-rendered Tailwind/
  Chart.js HTML viewer. `POST /account-aggregator/callback` (`@Public()`)
  handles the gateway's async consent-status push.
- **Small admin utilities**: KYC document zip download
  (`Admin/KycZipController.php`, via the storage adapter rather than a raw
  filesystem path); company holiday calendar CRUD (`Admin/
  CompanyHolidayController.php`, new `CompanyHoliday` entity/migration —
  nothing reads it for SLA math yet, see TODO.md); bulk CSV lead import
  (`Admin/ImportController.php`, skips legacy's inline CIF check and
  inline BRE run — both flagged in TODO.md rather than faked); a
  `rejectionReasonId` filter on `GET /leads` (`RejectionController.php`'s
  `rejectedTaskList`).
- **Straightforward `CronJobs/` pieces**: `legal-notice-email-31-60-dpd`
  job (`automation-worker`, log-only, same integration gap as every other
  email job); `disbursal-executive-ta`/`collection-approval-hour` reports
  (`reporting-api`, ids 84/85 — the credit-side equivalent was already
  covered by id 38); `POST /esign/callback` and the AA callback above
  (the two genuinely server-to-server pieces of `ApiCallBackController.php`).
- **`backend/docs/EXCLUDED.md`** (new file): every legacy controller/
  feature reviewed and deliberately not built this pass — the DND/
  quotation sub-system, voice/IVR blast reminders, Aadhaar-masking,
  `CronSanctionController.php`, the remainder of `ApiCallBackController.php`
  (Digitap eKYC flows) and `CronReportController.php` (`lead_flow_report`,
  `conversion_report_report`) — plus the already-known out-of-scope
  customer-facing `api/`/marketing-site exclusions, now written down in
  one place instead of only living in `CLAUDE.md` prose.
- **Security fix found via docker smoke-testing this work**: no service
  had a `ClassSerializerInterceptor` registered, so `User.passwordHash`
  serialized into any response containing a `User` entity at any nesting
  depth (e.g. `Lead.screenerAssignedTo`, the new `AccountAggregatorLog.
  requestedBy`) — a pre-existing gap across the whole migration, just
  newly exposed by a new endpoint. Fixed with `@Exclude()` on the column
  plus the interceptor registered globally in `core-api`/`integrations-api`/
  `reporting-api`'s `main.ts`. Verified via a real `docker compose up`
  smoke test that the field is gone from responses without breaking
  login (which reads it internally before serialization).

Full verification: `bun run format/lint/typecheck/build/test` clean
across all 4 services (742 tests), plus a real `docker compose up --build`
against a persisted MySQL volume — logged in as the seeded super admin,
exercised the new support/AA/company-holiday/report endpoints with real
HTTP requests and confirmed real database writes, not just unit-test
mocks.

## Task #65 — pluggable email senders + Google Maps reverse-geocode fallback

Follow-up to the third-party integration audit that surfaced two live
legacy vendors with no backend equivalent (ZeptoMail — legacy's actual
production email sender — and AWS SES, configured but never called) plus a
resilience gap in reverse-geocoding (Signzy has no fallback provider).

- **Email**: `integrations-api`'s `EmailModule` now picks a send mechanism
  via `EMAIL_PROVIDER` (`smtp` default / `zeptomail` / `ses`), same
  factory-provider toggle pattern as `StorageModule`'s local/S3 switch. New
  `EmailSender` interface (`modules/email/senders/`) with three
  implementations: `SmtpEmailSender` (existing nodemailer behavior,
  unchanged default), `ZeptoMailEmailSender` (uses the official `zeptomail`
  npm SDK, request shape matches legacy's live `common_send_email()`
  `$active_id==1` branch — `from.address`/`to[].email_address.address`/
  `subject`/`htmlbody`), `SesEmailSender` (uses `@aws-sdk/client-ses`,
  same pattern as `S3StorageAdapter`). `EmailService` now depends on the
  `EMAIL_SENDER` token/interface instead of a raw `nodemailer.Transporter`.
- **Reverse geocode**: `ReverseGeocodeService` now falls back to Google
  Maps' Geocoding API (`GoogleMapsClientService`, official
  `@googlemaps/google-maps-services-js` SDK) when Signzy's reverse-geocode
  call doesn't return coordinates. This is **new resilience, not a ported
  legacy behavior** — legacy configured a `GOOGLE_MAPS`/`REVERSE_GEO_CODE`
  integration but never wired a caller to it. Digitap was considered as a
  second fallback but rejected: legacy's Digitap integration only has
  address→coordinates (`ADDRESS_TO_LAT_LONG`), the opposite direction of
  what this endpoint does (coordinates→address) — there is no legacy
  Digitap function it could stand in for. `ReverseGeocodeLog` gained a
  nullable `provider` column (`signzy` / `google_maps` / null if both
  failed) via migration `AddReverseGeocodeLogProvider1785151500000`.
- New env vars (`.env.example`): `EMAIL_PROVIDER`, `ZEPTOMAIL_URL`,
  `ZEPTOMAIL_TOKEN`, `AWS_REGION`, `GOOGLE_MAPS_APIKEY`.
- New deps in `integrations-api`: `zeptomail`, `@aws-sdk/client-ses`,
  `@googlemaps/google-maps-services-js` — all official vendor SDKs, not
  raw HTTP calls.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  new/updated unit tests for all three email senders and both
  reverse-geocode branches (primary success, fallback success, both fail)
  pass.
- **Not done**: AWS SES has no legacy call-shape to match (its lookup was
  commented out in `functions.inc.php`), so `SesEmailSender`'s request
  shape is a reasonable default, not a verified port. SendGrid (legacy's
  email-*validation*, not sending) and DesignHost/Smartping/Cartbi/TinyURL/
  Facebook-Lead-Ads/Mailgun/NuPay/TransUnion-CIBIL remain unbuilt — out of
  scope for this task, tracked separately if picked up later.

## Task #66 — pluggable SMS + Digitap PAN/Aadhaar OCR (batch 1 of a larger vendor-gap pass)

First installment of a larger follow-up to the third-party audit: user asked
for Digitap, a pluggable SMS layer (Vapio/MSG91/DesignHost), RUNO,
Smartping, and a pluggable SendGrid email-validation API. This task covers
the first two; RUNO/Smartping/remaining-Digitap-flows/email-validation are
tracked as open items below.

- **SMS pluggable**: `SmsModule`'s `SMS_SENDER` token now resolves through
  a factory (same pattern as `StorageModule`/`EmailModule`), with
  `SmsSender` interface in `modules/sms/senders/`. Only `VapioSmsSender` is
  implemented — **MSG91 and DesignHost/staticking.org were investigated
  and explicitly not ported**: MSG91's only legacy usage
  (`CronJobs/Test.php`, unrouted) is actually a WhatsApp Business API call,
  not SMS; DesignHost/staticking.org's two call sites
  (`UserController.php`'s student/parent_contact-table SMS,  a second
  controller's hardcoded-demo-credentials "Quotation" notifier) both read
  as leftover boilerplate unrelated to the loan CRM's actual business,
  not a real feature worth faithfully porting. User confirmed: build the
  pluggable shape now, skip both providers until a real flow exists to
  port.
- **Digitap OCR**: `PoiVerificationService.ocrPan`/`ocrAadhaar` are now
  pluggable via `OCR_PROVIDER` (`signzy` default / `digitap`), matching
  legacy's own dispatcher-by-name pattern
  (`payday_poi_ocr_api.php`'s `GET_PAN_OCR_DIGITAP`/
  `GET_AADHAAR_OCR_DIGITAP` method ids). New `DigitapClientService`
  (`modules/digitap/`) — no official Digitap SDK exists, so this is a raw
  HTTP client like `SignzyClientService`. Digitap's OCR endpoints take
  `multipart/form-data` with the actual image bytes (ported from legacy's
  `CURLFile`), not a JSON `documentUrl` like Signzy, so the client
  downloads the document server-side before uploading. Legacy's Digitap
  Aadhaar OCR flow merges a second "back image" call to get father-name/
  address; not replicated here since `OcrDocumentDto` only carries one
  document URL (matches the existing Signzy-based method signature) —
  `fatherName` stays null on the Digitap Aadhaar path, documented in the
  service's doc comment. `verifyPan` (Signzy PAN fetch, methodId 1) has no
  Digitap equivalent in legacy and stays Signzy-only.
- New env vars: `DIGITAP_API_TOKEN`, `OCR_PROVIDER`.
- Verified: `bun run format/lint/typecheck` clean; new unit tests for
  `VapioSmsSender`, `DigitapClientService`, and both OCR providers pass.

## Task #67 — Digitap Digilocker/eKYC OTP + address-to-lat-long (batch 2 of the vendor-gap pass)

Continuation of Task #66's remaining Digitap scope. Investigated all of
Digitap bank verification, Digitap eSign, Digitap Digilocker, Digitap eKYC
OTP, and Digitap address-to-lat-long/distance; only built the ones legacy
actually dispatches to.

- **Dead code found and excluded, not ported** (see `docs/excluded.md`'s
  new "Dead code — dispatcher never actually reaches it" section for full
  detail):
  - Digitap bank account verification — `payday_bank_verification_api_helper.php`'s
    dispatcher hardcodes `$method_id = (date('d') % 2) > 0 ? 1 : 1;` — both
    ternary branches return `1` (Signzy); Digitap is unreachable.
  - Digitap eSign upload/download — `CommonComponent::call_esign_api` always
    calls Signzy's `UPLOAD_ESIGN_FILE`; the Digitap upload call is
    commented out, so no `esign_provider = 2` log row is ever created and
    the download function's Digitap branch is unreachable in practice.
  - Digitap address-distance (`ADDRESS_DISTANCE_API_DIGITAP`) — the one
    live caller (`VerificationController::calculateAadhaartoLiveLocationDistance`)
    has this call commented out in favor of `ADDRESS_DISTANCE_GOOGLE`
    (not part of this task's scope).
- **Digitap Digilocker** (`EkycService`, `modules/ekyc/`): new
  `createDigitapDigilockerUrl`/`getDigitapDigilockerDetails` methods port
  `digitap_digilocker_create_url_api_call`/`digitap_digilocker_get_details_api_call`
  (`payday_aadhaar_digilocker_api.php`), confirmed live via
  `ApiCallBackController::digitapView()`/`digitapResponse()`. Alongside
  Signzy's existing Digilocker flow, not switching it out — `EkycLog` gets
  a new nullable `provider` column (`null`/`'signzy'` vs `'digitap'`,
  mirrors `ReverseGeocodeLog`'s pattern) to distinguish rows, since legacy
  runs both concurrently rather than dispatcher-selecting one.
- **Digitap eKYC OTP** (`EkycService`): new `createDigitapEkycOtp`/
  `submitDigitapEkycOtp` methods port `digitap_ekyc_create_otp_api_call`/
  `digitap_ekyc_create_otp_api_success`, confirmed live via
  `ApiCallBackController.php:1352`/`1380`/`1446`. `submitDigitapEkycOtp`
  re-reads the create-OTP log's stored response for
  `transactionId`/`fwdp`/`codeVerifier`, same as legacy.
- **`DigitapClientService`** (`modules/digitap/`) gained a `postJson`
  method alongside the existing `postMultipart`, for Digitap endpoints that
  take a plain JSON body (Digilocker/eKYC/address-to-lat-long) rather than
  a file upload. Same bare `Authorization: <token>` header convention.
- **Digitap address-to-lat-long** (new `modules/address-lat-long/`): ports
  `address_to_lat_long_api_digitap` (`payday_reverse_geo_code.php`), the
  opposite direction of the existing Signzy-based `reverse-geocode` module
  (coords → address). Digitap-only, no Signzy equivalent exists in legacy
  for this direction. Confirmed live via
  `VerificationController::calculateAadhaartoLiveLocationDistance`. Legacy
  composes the address server-side from `lead`/`lead_customer` columns not
  modeled in this schema (`current_house`/`aa_current_house`, etc.) — this
  port takes the already-composed address as a DTO input instead, matching
  how the OCR modules take a `documentUrl` rather than resolving one from
  stored lead fields. New `AddressLatLongLog` entity/table
  (`address_lat_long_logs`), mirrors `ReverseGeocodeLog`'s shape.
- New migrations: `AddEkycLogProvider`, `AddAddressLatLongLog`.
- No new env vars — reuses `DIGITAP_API_TOKEN`; URLs are hardcoded per
  sub-type, matching the OCR endpoints' precedent (legacy's
  `integration_config.php` hardcodes them per-environment too).
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  `integrations-api`'s full test suite (116 tests) passes.
- Open items carried forward: RUNO, Smartping, SendGrid email-validation
  (tracked in `docs/TODO.md`).

## Task #68 — RUNO sanction-team call allocation (batch 3 of the vendor-gap pass)

Investigated RUNO and Smartping's exact live/dead status before building
anything — found the scope was much narrower than the original ask.

- **Dead code found and excluded, not ported** (see `docs/excluded.md`):
  - Smartping click-to-call + bulk upload — `integration_config.php` has
    no `case "SMARTPING_CALL_CRM":` at all; the lookup always falls
    through to the `default:` case (`Status = 0`), so the integration can
    never succeed even though both controller call sites
    (`ThirdPartyAPIController::Click_to_call`/`dialer_data_upload`) are
    live and uncommented.
  - RUNO collection-team call allocation — no live caller anywhere; the
    only reference is commented out in `CronSanctionController.php`.
  - Also confirmed `CommonComponent::call_runo_management_api` (which
    `require_once`s a nonexistent `payday_runo_call_api.php`, no `_helper`
    suffix) is itself dead — never called from any controller, and would
    fatal-error if it were. The genuinely live call path is
    `TaskController.php` loading `payday_runo_call_api_helper.php`
    directly (bypassing `CommonComponent` entirely).
- **RUNO sanction-team call allocation** (new `modules/call-management/`
  + `modules/runo/`): ports `runo_sanction_allocation_api`
  (`payday_runo_call_api_helper.php`), confirmed live via
  `TaskController.php`'s `CR1`+`ENVIRONMENT=='production'`-only dispatch.
  New `RunoClientService` (raw HTTP, no official RUNO SDK) — `Auth-Key:
  <token>` header, distinct from Signzy/Digitap's bare `Authorization`
  convention. Request shape ported exactly (nested `customer`/`company`/
  `kdm` object, `userFields` array, `assignedTo` omitted + `?isCommonPool=true`
  appended to the URL when no agent is resolvable). Success check:
  `statusCode === 0`. Writes a `LeadFollowup` audit-trail row on success
  (matches legacy), always writes a `CallManagementLog` row
  (`providerId=1`, `methodId=1`) regardless of outcome. New
  `CallManagementLog` entity/table (`call_management_logs`), shared shape
  for a future Smartping provider (`providerId=2`) if its config ever
  gets fixed.
- New env var: `RUNO_API_KEY`.
- New migration: `AddCallManagementLog`.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  `integrations-api`'s full test suite (121 tests) passes.
- Open items carried forward: SendGrid email-validation (tracked in
  `docs/TODO.md`).

## Task #69 — pluggable email-validation API (SendGrid only) (final batch of the vendor-gap pass)

Closes out the vendor-gap follow-up started at Task #66. Unlike the other
batches, this wasn't a port of live legacy behavior — legacy's
`payday_email_verification_api_call('EMAIL_VALIDATION', ...)` dispatcher
(`payday_email_verification_api_helper.php`) is never actually invoked by
any controller (Mailgun/SendGrid/Signzy sibling functions all exist but
are dead) — the user explicitly asked for this as new forward-looking
scope, distinct from the existing Signzy-based `domain-email-verification`
module.

- New `modules/email-validation/`: `EmailValidator` interface +
  `SendGridEmailValidator` (the only implementation for now), same
  `EMAIL_VALIDATOR`-token factory-provider pattern as `EmailModule`/
  `SmsModule`. Uses the official `@sendgrid/client` SDK (the generic REST
  client `@sendgrid/mail` itself wraps) rather than raw HTTP, per the
  "use the official SDK when one exists" rule — `POST /v3/validations/email`,
  maps `result.verdict === 'Valid'` to `isValid`.
- Built as a general-purpose endpoint (`POST /email-validation`, DTO:
  `{leadId, email, emailType}`) taking the email directly rather than
  resolving `email`/`alternateEmail` from `LeadCustomer` like legacy does —
  avoids registering that entity's unrelated relation graph
  (state/city/maritalStatus/qualification/religion/occupation) for one
  field; matches this pass's established precedent (OCR's `documentUrl`,
  address-lat-long's `address`) of taking already-resolved input on the DTO.
- New `EmailValidationLog` entity/table (`email_validation_logs`), mirrors
  legacy's `api_email_verification_logs` shape (`emailType` 1=personal/
  2=alternate, `provider`, `isValid`, `verdict`).
- New env var: `SENDGRID_API_KEY`. New migration: `AddEmailValidationLog`.
- Verified: `bun run format/lint/typecheck/build` clean across all 4
  services; `integrations-api`'s full test suite (126 tests) passes.

This closes out the entire Task #66 vendor-gap follow-up — every item from
the original ask (Digitap, pluggable SMS, RUNO, Smartping, pluggable
SendGrid email-validation) has been investigated and either built or
documented as dead code in `docs/excluded.md`.

## Task #70 — explicit utf8mb4 charset on every DB connection

Small standalone fix from `docs/TODO.md`'s open items. `data-source.ts`
and all 4 services' `app.module.ts` `TypeOrmModule.forRootAsync` now pass
`charset: 'utf8mb4'` explicitly rather than relying on the MySQL driver's
default (which varies by server version/distro). Added a note to
`docs/DETAILS.md`'s Database section: since this only sets the
*connection* charset, the database itself must still be created with
`CREATE DATABASE ... CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` —
existing migrations' raw `CREATE TABLE` SQL has no per-table `CHARSET`
clause, so it inherits whatever the target database's default is.
Verified: `bun run format/lint/typecheck` clean across all 4 services.

While investigating the other open items, confirmed `document_types`
unseeded (TODO item) has no legacy source at all to extract from (already
noted in `DETAILS.md`'s seed provenance section) — clarified this in
`TODO.md` rather than leaving it looking like a simple oversight.

## Already done (prior to this monorepo migration, still true today)
Core loan-lifecycle CRUD/workflow — leads (incl. status/assignment/rejection
workflow + audit trail), CAM, BRE (rule/category CRUD + result recording),
disbursal, collection, verification, feedback, users/roles/auth (JWT +
httpOnly cookies, OTP forgot-password), company, geography. All in what is
now `apps/core-api`.

## Open items — full context

> Exception to this file's usual scope: the items below are **not**
> completed work. `docs/TODO.md`'s "Open items" section keeps each to a
> name + one-line description; the full reasoning behind why each is
> still open lives here so it isn't lost.

- **Client question: is the production crontab we were given exhaustive?
  Full comparison. RESOLVED — see Task #91.** The user supplied the real
  production crontab (`crontab -l` style dump). Cross-checked every entry
  against every `automation-worker` job built this session and against a
  fresh read of the actual legacy source each entry points to. The user
  later confirmed explicitly that the pasted crontab is exhaustive — only
  those entries run in prod. Every job below flagged as "not in this
  crontab" is now disabled by default in code (Task #91); this write-up is
  kept as-is for the historical reasoning trail.

  **Built in `automation-worker`, but the source PHP function is NOT in
  this crontab** — need the client to confirm these are genuinely dead,
  since it's not certain the list given is exhaustive:
  - `CronSanctionController::screenerLeadAllocationG50K()`/`B50K()` →
    `ScreenerAllocationService`
  - `CronSanctionController::creditApllicationAllocationG50K()`/`B50K()`/
    `REPEATNEWLOGICS()` → `CreditApplicationAllocationService`
  - `CronSanctionController::move_lead_hold_to_screener()` →
    `LeadHoldRedistributionService`
  - `CronSanctionController::move_application_hold_to_credit_G50K()`/
    `B50K()` → `ApplicationHoldRedistributionService`
  - `CronSanctionController::reject_application()`/`reject_lead()`/
    `reject_lead_new_bucket()` → `LeadRejectionService`
  - (`credeauPTBAllocation` is commented out in the crontab itself —
    confirmed dead, consistent with the existing dead-code findings,
    no action needed.)

  There are in fact **two** files both named `CronSanctionController.php`
  in the legacy export — `application/controllers/CronSanctionController.php`
  (what the 5 services above were built from) and
  `application/controllers/CronJobs/CronSanctionController.php` (what the
  real crontab paths actually point to, `CronJobs/CronSanctionController`).
  Diffed both files: every function shared between them
  (`screenerLeadAllocationG50K`, `move_lead_hold_to_screener`,
  `reject_application`, etc.) is **byte-identical** — the `CronJobs/`
  version is a later reorganization/move of the same file with 5 extra
  methods added (`credeauAllocation`, `RepeatOnlineCustomersAllocation`,
  `notContactableLeadAllocation`, `sanctionTargetUpdate`,
  `getFacebookCampaignData`), not a rewrite. So the logic already ported
  is confirmed byte-accurate against the real current file — the open
  question is purely whether these functions are still scheduled at all
  in production, not whether they were ported correctly.

  **In the crontab, but NOT built anywhere in `automation-worker`:**
  - `Automate::allocateLeadsAndApplication(leadType)` — a generic,
    unbanded allocation dispatcher (`CronJobs/Automate.php` +
    `CronJobs/CronLead_Model.php`, both read in full) — scheduled for
    leadType 3 (Lead Hold→screener, `0 2 * * *`), 4 (Application
    New→credit, `*/30 * * * *`), 6 (Application Hold→credit,
    `0 2 * * *`), 42+NEW and 42+REPEAT (partial-lead allocation,
    `*/15`/`*/10 * * * *`). Real behavioral differences from the
    `CronSanctionController`-based jobs above: no salary banding at all,
    a uniform 72-hour hold threshold (not 48h), eligibility gated by a
    `user_roles.lead_allocation_type` column not modeled in this schema,
    plus a "logged in today" (`user_activity_log`) eligibility check.
    Not touched — this needs the client's confirmation first (see
    `docs/TODO.md`).
  - `Automate::allocateLeadsAndApplicationReject(6, 3)` /
    `Automate::allocateLeadsAndApplicationReject(3, 2)`
    (`30 2 * * *`) and `Automate::actionOnUserActivity()`
    (`0 1 * * *`, "block user since 3 days no activity") — **function
    bodies don't exist anywhere in the `old-php-files` export**, checked
    the whole tree including every dated backup file. Blocked on the
    user supplying the real current source.
  - `CronSanctionController::credeauAllocation()` and
    `::RepeatOnlineCustomersAllocation()` — confirmed live (both appear
    uncommented in the crontab). Corrects this session's earlier
    `docs/EXCLUDED.md` framing ("not confirmed active/vestigial") — not
    yet built, tracked as its own `docs/TODO.md` item now that liveness
    is confirmed.
  - `CronLegalEmailerController::legalNoticeEmailer('dn', 60, 90)`
    (`45 9 * * *`) — confirmed live, and read in full: correct current
    entity (`COMPANY_NAME` = "Acme Financial Services Pvt Ltd.",
    Finance CRM branding), not the wrong "Naman Finlease"/"Loanwalle.com"
    content this session earlier and correctly excluded (a genuinely
    different, differently-scoped function). **Built for real this
    session — see Task #89.**
  - `Reminders::emailPrepayment(1..5)` / `Reminders::smsPrepayment(1..5,
    1)` (`CronJobs/Reminders.php`, read in full) — confirmed live, a
    different real controller than what `repayment-reminder-email`/
    `-sms` were originally built from
    (`CronEmailerController.php`/`CronSMSController.php`). **Rebuilt
    this session — see Task #89.**

  No new information surfaced for anything already in `docs/EXCLUDED.md`
  (Smartping, RUNO collection-team allocation, Digitap eSign/bank-
  verification, Aadhaar masking, etc.) — none of those appear in this
  crontab either, additional (not contradicting) confirmation they're
  dead.

- **Automation-worker jobs that only log instead of actually notifying**:
  several jobs (`not-contactable-lead-email`/`-sms`, `reloan-pitch-email`,
  `repayment-reminder-email-*`, `outstanding-loan-digest-email`,
  `closed-loan-feedback-email`, `birthday-email`) are log-only — they find
  the right recipients/content but don't actually send, because
  `integrations-api` has no generic transactional-email or promotional-SMS
  endpoint (only OTP SMS, a thank-you email, and 2 WhatsApp templates
  exist). Needs real `integrations-api` endpoints before these can send
  for real. (`repayment-reminder-sms` is the one exception — routed to
  the existing WhatsApp template instead of staying log-only.)
  **Recovery-stage escalation** (collection-defaulter job) is log-only for
  a different reason: this schema's `Loan` has no equivalent to legacy's
  escalation-stage columns — recommend a migration adding a
  `recoveryStage` enum column before wiring a real write.
- **AppsFlyer conversion-postback ingestion is a missing prerequisite**,
  not a job-level gap — no inbound webhook/entity exists anywhere for
  AppsFlyer's `acaf_response`/`acaf_id` postback data. A job needs this
  built first. **Moot as of Task #96** — client confirmed AppsFlyer isn't
  used; the integration is disabled, not being built out further.
- **Aadhaar-masking** has no `integrations-api` adapter and the schema's
  `Document` entity has no masking-state column — two blockers, needs
  both before this can be ported.
- **RDS Multi-AZ / compliance question** (Task #62/`DEPLOYMENT.md`) —
  RESOLVED. Client decision: enable Multi-AZ. Not asserted as a regulatory
  requirement (none confirmed anywhere in the codebase/planning docs), a
  deliberate availability call given this is a production loan-lifecycle
  CRM. `docs/DEPLOYMENT.md` §4.3 and the example `create-db-instance`
  command updated to `--multi-az`.
- **CIF search**: legacy's `cif` field/table has no equivalent anywhere in
  this schema — not searchable via `GET /search` yet.
- **`document_types` still unseeded**: legacy has no lookup table for this
  at all, only scattered string literals in code.
- **Device-advertising-id / `utm_medium`/`utm_term`**: accepted as raw
  request fields on a couple of DTOs, not persisted on `Lead`/
  `LeadCustomer` — follow-up decision for whoever owns the mobile-app/
  analytics-pipeline integration.
- **MySQL charset**: `database/src/data-source.ts` never passes an
  explicit `charset: 'utf8mb4'` to TypeORM/`mysql2` (relies on driver
  default) — `DEPLOYMENT.md` covers the RDS-side fix (parameter group) but
  not this app-side one.
- **Performance dashboard has no backend target data to read** (found
  while closing the ops-tooling gap): legacy's `PerformanceController.php`
  / `Performance_Model.php` compute a screener/credit/disbursal "today vs
  monthly target" popup by joining against `user_target_allocation_log`
  (a monthly per-user target-cases/target-amount table). No equivalent
  entity exists in `database/src/entities` — building the read-only
  aggregation endpoint without it would mean either fabricating targets or
  leaving them null, so it wasn't built. Needs a `UserTargetAllocation`
  -style entity+migration+seed/admin-write-path before this can be ported
  for real.
- **PDF templates still unwired** (Task #63): the AA consent form, CIBIL
  report, and legal notice templates have no controller calling them
  yet — no existing endpoint has the underlying data (bureau report,
  e-sign consent capture) modeled to call them meaningfully.
- **fe-pdf-service idea, deferred, not adopted** (Task #63): user proposed
  a standalone internal PDF-rendering service (frontend calls it, it calls
  back into core-api, renders with Tailwind/JSX, prints via Playwright).
  Recommended against — reverses this repo's "PDF generation is a shared
  library, not a service" decision, doesn't reduce render latency (same
  headless-browser cost wherever it runs), and needs a service-to-service
  auth mechanism that doesn't exist yet. Lighter alternative, not built:
  keep Puppeteer in core-api, point it at an internal-only route inside
  the `frontend` app instead of a raw HTML template-literal string. Only
  worth doing if PDF template-authoring actually becomes a real
  bottleneck.
- **RESOLVED — legacy CIBIL-report view file.** `old-php-files/
  application/views/cibil_pdf.php` (5,354 lines) is a full real
  individual's bureau report (PAN, DOB, address, credit history)
  hardcoded into the PHP view template, unrelated to anything ported
  here. Checked exposure: `old-php-files/` is its own separate git repo
  (not part of `backend/`), single squashed commit, **no remote
  configured** — confirmed nothing has been pushed anywhere. Client
  decision given that: leave the file as-is, no redaction/deletion
  needed, closing this out.
- Also flagged, still open: several live third-party credentials
  (Razorpay key/secret, an RSA private key, Signzy tokens, Adjust
  tokens, an AppsFlyer key) were found sitting in plaintext in
  `old-php-files/` across multiple tasks — none copied into this port,
  but they should be rotated by whoever owns those vendor accounts.

## Task #71 — CIF (Customer Identification File) customer master + search

Closes the "CIF search" `TODO.md` item. Ports
`TaskController::sanctionleads()`'s CIF block — a real, in-scope internal-
CRM feature (not the customer-facing surface), confirmed live: every time
a lead is sanctioned, legacy finds-or-creates a `cif_customer` row keyed
by pancard (so repeat borrowers share one CIF across multiple loan
applications) and stamps `leads.customer_id` with the resulting CIF
number (format `"FTC" + 8-digit zero-padded sequence`, e.g.
`"FTC00000004"`).

- New `CifCustomer` entity (`cif_customers` table): just the identity
  columns (`cifNumber` unique, `pancard` unique) — legacy's ~20-column
  KYC/employment snapshot at sanction time isn't duplicated, since this
  schema's `CreditAnalysisMemo`/`LeadCustomer` already keep that data
  live and normalized per lead (legacy needed the snapshot because its
  flat per-application tables get overwritten across repeat applications;
  this schema doesn't have that problem).
- `Lead.cifCustomer` (nullable `ManyToOne`) replaces legacy's
  `leads.customer_id` string column with a proper FK.
- `CamService.sanction()` now calls a new private `assignCifCustomer()` —
  find-or-create by pancard, link to the lead — right after marking the
  CAM `SANCTION`, mirroring the exact trigger point in legacy.
- `SearchService`'s `cif` field (legacy `LD.customer_id`) is now
  searchable — joins `lead.cifCustomer` and matches `cifNumber` exactly.
- `CifCustomer` had to be registered in every module that registers
  `Lead` (11 files in `core-api`, plus `integrations-api`'s `CommonModule`)
  per the `autoLoadEntities` gotcha in `CLAUDE.md` — `reporting-api`/
  `automation-worker` picked it up automatically via `ALL_ENTITIES`.
- New migration: `AddCifCustomer` (creates `cif_customers`, adds
  `leads.cifCustomerId`).
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full test suite (688 tests across all 4 services) passes.

## Task #72 — Performance dashboard target data

Closes the "Performance dashboard has no backend target data" `TODO.md`
item. Ports `Performance_Model.php` — a monthly disbursal target per
credit user (`user_target_allocation_log`), with "achieved" computed
live from `CreditAnalysisMemo` rather than stored (matches legacy, which
never persists the achieved figure either).

- New `UserTargetAllocation` entity (`user_target_allocations`, unique on
  `user`+`targetMonth`): `targetAmount`, `targetCases`, `createdBy`.
- New `core-api` module `performance`: `POST /performance/targets`
  (upsert, `@Roles('SA','CA')`) and `GET /performance/:userId?month=`
  (any authenticated user, `@Roles()`) — returns target vs. achieved
  (sum of `recommendedLoanAmount`/count of `CreditAnalysisMemo` rows
  where `lead.creditAssignedTo` matches, status is in the same
  DISBURSED/PART-PAYMENT family already used by
  `RepaymentReminderEmailService`/`CollectionDefaulterEscalationService`,
  and `disbursalDate` falls within the target month).
- New migration: `AddUserTargetAllocation`.
- Verified: `bun run format/lint/typecheck` clean; `core-api`'s full test
  suite (294 tests) passes.

## Task #73 — Lead CSV import: CIF cross-reference (BRE eligibility still blocked)

Partial resolution of the "Lead CSV import skips two legacy behaviors"
`TODO.md` item. Investigating the "inline BRE eligibility" half surfaced
a much bigger gap than expected — see the new `TODO.md` note: the BRE
rule *evaluation* engine (legacy's `aip_engine/bre_rule_engine.php`/
`check_eligibility.php`) was never ported anywhere in this backend, only
rule configuration CRUD and result-recording (`BreService`). That's a
real, separately-scoped task on its own, not a quick wire-up — left open,
not built blind.

The CIF cross-reference half **was** buildable, now that `CifCustomer`
exists (Task #71): `LeadImportService` now looks up `CifCustomer` by the
row's pancard and sets `userType` to `REPEAT` on a match — legacy's
proxy for "this pancard has been sanctioned before." Legacy's further
KYC/employment backfill from the CIF snapshot isn't replicated (this
schema's `CifCustomer` only keeps identity columns, documented on the
entity itself).
- Verified: `bun run format/lint/typecheck` clean; `core-api`'s full test
  suite (296 tests) passes.

## Task #74 — Audit module: straight-through eligibility gate + recordApprovalReason wiring

Closes 3 of 5 checks in the "Audit module gaps" `TODO.md` item, and its
`recordApprovalReason`-not-wired half.

- `AuditService.sendToPreAudit` (the port of legacy
  `TaskController::auditNew()`) now runs a `checkStraightThroughEligibility`
  gate when `lead.isStraightThroughProcessing` is true (legacy's
  `lead_creation_mode == 1`), matching legacy's first three checks:
  - `CreditAnalysisMemo.recommendedLoanAmount` must not exceed the lead's
    latest `CredeauLog.approvedAmount`.
  - A `FaceMatchLog` row with `status = SUCCESS` must exist for the lead.
  - A `ReverseGeocodeLog` row with `status = SUCCESS` must exist (live
    location captured).
  All three were buildable now because the underlying vendor-log
  entities already exist from earlier integration work — this task was
  purely about wiring the gate, not building new infrastructure.
- The remaining two legacy checks (aadhaar-residence-distance,
  >25km residence-proof-document fallback) are **not** ported — both
  need new infrastructure (a Google Maps distance adapter; `document_types`
  seeded) tracked as their own `TODO.md` item, not silently skipped.
- `recordApprovalReason` is now called automatically when the gate
  rejects a lead, writing the rejection message as a `LeadAudit` remark —
  the "specific rejection-flow trigger" this previously lacked. Still
  independently callable for any other manual audit remark.
- Verified: `bun run format/lint/typecheck` clean; `core-api`'s full test
  suite (301 tests) passes.

## Task #75 — Consent-form PDF wired (CIBIL report + legal notice correctly left unwired)

Resolves 1 of 3 templates in the "PDF templates unwired" `TODO.md` item;
the other two turned out to be genuinely blocked, not just missing a
controller — split out into their own `TODO.md` entries with the real
reason each.

- **Consent form (KFS)** — new `ConsentFormService`/`ConsentFormController`
  (`GET /leads/:leadId/consent-form`, `documents` module), mirrors
  `SanctionLetterService`'s exact pattern. All borrower-facing terms come
  straight from the lead's `CreditAnalysisMemo` (no sanctioned-status
  gate — this form is shown *before* e-sign, unlike the sanction letter).
  Nodal grievance officer contact reuses the real values already in
  `sanction-letter.template.ts`'s `GRIEVANCE_ESCALATIONS` third-escalation
  row, kept in sync rather than re-derived.
- **CIBIL report** — investigated, not built. `CrifBureauService`'s own
  code confirms only `SCORES`/`HEADER` fields of Surepass's response are
  ever parsed; the full account-list/enquiries schema `CibilReportData`
  needs isn't documented anywhere in this codebase or a captured sample
  response. Guessing Surepass's actual field names to build a mapper
  would be fabricating an integration.
- **Legal notice** — investigated, not built. The template's own doc
  comment already flags it as unreviewed generic boilerplate with no
  legacy source at all — wiring it to a real endpoint would mean shipping
  unvetted legal language as if production-ready, a business/legal call.
- Verified: `bun run format/lint/typecheck` clean; `core-api`'s full test
  suite (303 tests) passes.

## Task #76 — generic email-send endpoint + 5 of 6 automation-worker email jobs wired

Closes the "Automation-worker email/SMS jobs are log-only" `TODO.md`
item. 5 of 6 previously-log-only email jobs now send real content;
`legal-notice-email` correctly stays log-only (see below).

- New `integrations-api` endpoint `POST /email/send`
  (`SendGenericEmailDto`: `leadId`/`email`/`subject`/`html`/`typeId`) —
  `EmailService.sendGenericEmail()`, refactored `sendThankYouEmail`/
  `sendGenericEmail` to share one `send()` implementation. This is the
  "generic transactional email endpoint" every log-only job was blocked
  on; unblocks all of them at once rather than needing a bespoke
  `integrations-api` template per job.
- **Templates reorganized**: every template (email and PDF, across
  `automation-worker`/`integrations-api`/`common`) now lives under a
  per-package `src/templates/<type>/` folder (e.g.
  `automation-worker/src/templates/email/`,
  `common/src/templates/pdf/`) instead of being scattered inside
  individual module/job directories — easier to find/update. No
  behavioral change; only `common/src/pdf/index.ts`'s re-export paths
  and a few relative imports moved.
- **`birthday-email`**: ports `birthdayemailer()`'s real subject/message;
  legacy's 5-icon social-media footer dropped (no config for those URLs
  anywhere in this backend — see `birthday-email.template.ts`).
- **`not-contactable-lead-email`**: ports `freshNotContactableCustomerEmailer()`'s
  real subject; the marketing banner/rupee-icon/apply-button/app-store/
  social images use placeholder URLs (user's explicit choice) pending
  real asset configuration.
- **`closed-loan-feedback-email`**: ports `feedbackForCloseLoanEmailer()`'s
  real feedback-survey message; legacy's images/phone/social-links are
  all "Loanwalle.com"-branded (a different, predecessor brand) and were
  not ported — sending a different company's contact details to B4
  Salary customers would be actively wrong, not a cosmetic gap. Customer
  Care contact reuses the real values already in
  `sanction-letter.template.ts`'s `GRIEVANCE_ESCALATIONS`.
- **`reloan-pitch-email`**: ports `notificationSendMailAndWhatsapp()`'s
  real pitch content (the WhatsApp half was already confirmed dead code
  by an earlier task). The brand logo URL is real (`sl-website` S3
  bucket, this brand's actual asset), kept as-is.
- **`outstanding-loan-digest-email`**: ports `loanOutstandingCustomer1To60DaysEmailer()`'s
  due-amount computation and now sends too — one email per overdue loan,
  addressed to `CTO_EMAIL` (a real, intentional legacy override, not the
  borrower — see the job's doc comment). Sends plain internal-summary
  content rather than legacy's elaborate customer-styled HTML (background
  banners, 8 social/app-store icons, the literal text "LOANWALLE" in the
  body) — the real audience is one internal recipient, not a customer,
  so reproducing customer-facing styling for it would be pointless. New
  `CTO_EMAIL` env var.
- **`legal-notice-email`**: investigated, not wired — both candidate
  legacy sources are unusable, not just unwired. The DPD-bucket job
  itself (`legalNotice31To60DaysEmailer()`) calls its target function
  with an argument that never matches that function's own type list —
  dead code. The other same-named function has real content, but for a
  different, superseded legal entity ("NAMAN FINLEASE PRIVATE LIMITED"/
  Loanwalle.com, via an unrelated law firm) — porting it would mean
  sending a notice that impersonates a defunct company. Kept as a
  log-only "who's in the 31-60 DPD bucket" finder (genuinely useful for
  ops) rather than sending anything. Full reasoning in `docs/EXCLUDED.md`.
- Each job's `EmailLog.typeId` is a small free-form int (no shared enum
  — matches how legacy's own ad-hoc email sends never had one either).
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full test suite (710 tests across all 4 services) passes.

This closes out Task #20 (automation-worker email jobs) — 5 of 6
previously-log-only jobs now send real content; the 6th
(`legal-notice-email`) correctly stays log-only with no real content to
send. `repayment-reminder-sms`/`not-contactable-lead-sms` (SMS siblings)
remain correctly log-only too — confirmed no live legacy SMS template
exists for either.

## Task #77 — CIF report PDF: corrected architecture, no schema guessing needed

Closes the "CIBIL report PDF template unwired" `TODO.md` item — but the
earlier framing of that item (both in this doc and `TODO.md`) was itself
wrong, based on an incomplete read of `payday_surepass_crif_api.php`.
Re-reading it in full found the real fix needs no guessed schema at all.

- **What was wrong before**: the assumption was that rendering a CIBIL
  report needed a custom `CibilReportData`-shaped template (account list,
  enquiries, etc.), blocked on not knowing Surepass's full JSON schema.
- **What's actually true**: Surepass's response includes
  `data.credit_report_link` — a URL to **Surepass's own already-rendered
  PDF report**. Legacy downloads that exact file and re-uploads it
  (`CommonComponent::upload_document`); it never builds its own report
  document, and never itemizes accounts/enquiries anywhere in the legacy
  file (confirmed by a full re-read, not just the summary fields
  previously checked).
- **Fix**: `CrifBureauService.fetchReport` now downloads
  `credit_report_link` and stores it via `StorageAdapter`, populating
  `CrifBureauLog.reportFileKey` (a column that existed but was never
  actually populated before this). New `GET /crif-bureau/report/:leadId`
  downloads the stored PDF for the lead's most recent successful pull —
  same streaming-bytes pattern as every other document endpoint in this
  codebase (`SanctionLetterController`/`ConsentFormController`), not a
  signed-URL response.
- The existing `CibilReportData`/`renderCibilReportHtml` template
  (`common/src/templates/pdf/cibil-report.template.ts`) is not used by
  this fix and stays unwired — legacy's real report *is* the downloaded
  PDF, not something to reconstruct from structured fields.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full test suite (713 tests across all 4 services) passes.

## Task #78 — legal-notice PDF wired (watermark kept, per explicit instruction)

Closes the "Legal notice PDF template unwired" `TODO.md` item. The
default recommendation was to leave it unwired (unreviewed legal
content), but the user explicitly chose to wire it with the warning kept
visible rather than wait for legal sign-off.

- New `LegalNoticeService`/`LegalNoticeController`
  (`GET /leads/:leadId/legal-notice`, `documents` module) — computes
  `outstandingAmount` as `CAM.repaymentAmount` net of verified
  (`APPROVED`, non-deleted) `Collection.receivedAmount`, borrower name/
  address from `LeadCustomer`, loan number from `Loan`/`Lead.applicationNo`.
  `daysToRespond` is a hardcoded `15` — no legacy source gives a real
  response window, called out in the service's doc comment as a default,
  not a confirmed value.
- The template's own `renderLegalNoticeHtml` is unchanged — the visible
  "PLACEHOLDER TEMPLATE — NOT REVIEWED BY LEGAL COUNSEL. DO NOT SEND
  AS-IS." watermark and title-bar warning are still rendered into every
  PDF this endpoint produces.
- Verified: `bun run format/lint/typecheck` clean; `core-api`'s full test
  suite (305 tests) passes.

## Task #79 — TAT-hold redistribution: live CR1/CR2 roster (business decision: role-based)

Closes the "TAT-hold redistribution roster" `TODO.md` item. User's explicit
decision: build a live role-based roster rather than porting legacy's
hardcoded employee-id arrays.

- New `automation-worker` `hold-redistribution` job module, ports
  `move_lead_hold_to_screener()` and `move_application_hold_to_credit_G50K()`
  / `_B50K()` from `CronSanctionController.php`.
- `LeadHoldRedistributionService`: redistributes leads stuck in
  `LEAD-HOLD` (stage S3) 48+ hours since `screenerAssignedAt` back into the
  live active-`RoleType.code='CR1'` pool, same round-robin load-balancing
  as `ScreenerAllocationService`. Legacy's odd `(monthly_salary_amount = 0
  OR >= 50000)` filter — which silently excludes the 1-49999 band — is
  ported as-is since nothing indicates it was a bug rather than an
  intentional exclusion.
- `ApplicationHoldRedistributionService`: redistributes applications stuck
  in `APPLICATION-HOLD` (stage S6) back into the live active-`CR2` pool,
  banded G50K/B50K by salary, same pattern as
  `CreditApplicationAllocationService`. Found and documented a real legacy
  bug while porting: both callers invoke `get_application_hold(48)`, but
  that model method's signature is `($type = 0, $set_hours = 0)` — `48`
  binds to the unused `$type` param, and `$set_hours` falls through to its
  `empty()`-checked default of 36. The **real** enforced threshold is 36
  hours, not 48 (legacy's own `lead_followup` remark text incorrectly says
  "TAT 48 HOURS COMPLETED"). This port uses the real 36-hour threshold and
  states it correctly in the remark — same
  documented-not-silently-fixed convention as `LeadRejectionService`.
- Both jobs use `Number.MAX_SAFE_INTEGER` for the round-robin's per-user/
  per-run caps — legacy's hold-redistribution methods had no `cronLimit`,
  unlike the initial-allocation crons.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  10 new tests (both services) pass.

## Task #80 — `reject_application()` TAT scope-widening: confirmed org-wide

Closes the "`reject_application()` TAT scope-widening" `TODO.md` item —
no code change needed. `LeadRejectionService` (`automation-worker`) already
applies the TAT rule to every application in stage S5/S6 regardless of
assignee, built that way when first ported because hardcoding legacy's 8
(possibly ex-)employee ids would have been meaningless here — it was left
flagged for business confirmation rather than treated as settled. The user
has now explicitly confirmed: widen to org-wide (matching what was already
built). No further action required.

## Task #81 — IAM S3 role scope: extend to `integrations-api` (`DEPLOYMENT.md`)

Closes the "IAM S3 role scope" `TODO.md` item. `DEPLOYMENT.md` §6.2
originally scoped the S3-permission instance role to `core-api` only,
with an explicit note to "extend this decision when a future task wires
storage into a different service." Task #77 (this session) did exactly
that — `integrations-api`'s `CrifBureauModule` now imports `StorageModule`
for real (downloads Surepass's rendered bureau-report PDF, re-uploads via
`StorageAdapter`). Updated §6.2 to create a second S3-scoped role/instance
profile (`finance-crm-integrations-api-role`) alongside `core-api`'s, and added
`STORAGE_DRIVER`/`AWS_S3_*` to §7.2's `integrations-api` env checklist
(previously only listed under `core-api`). `reporting-api`/
`automation-worker`/`gateway` remain SSM-only, still no S3 code path.

## Task #82 — Audit residence-proof-distance check: Google Distance Matrix wired

Closes the "Audit module residence-proof-distance check" `TODO.md` item.
Both previously-missing pieces are now built:

- New `integrations-api` `AddressDistanceService`/`AddressDistanceController`
  (`POST /address-distance`), ports `address_distance_api_google`
  (`payday_reverse_geo_code.php`), confirmed live via
  `VerificationController::calculateAadhaartoLiveLocationDistance`. Reads
  coordinates already captured by two existing modules — the Aadhaar/eKYC
  address's lat/long (`AddressLatLongLog`, `addressType=2`, Digitap) and
  the customer's live-location lat/long (`ReverseGeocodeLog`) — and calls
  Google's Distance Matrix API (`GoogleMapsClientService.distanceMatrix()`,
  official `@googlemaps/google-maps-services-js` SDK) directly with
  coordinates rather than re-deriving address text like legacy did (legacy
  computed lat/long from stored coordinates too, then never used them,
  sending address strings instead — a dead-code quirk not ported). Logs
  every call to a new `AddressDistanceLog` entity and, on success, writes
  the result to a new `LeadCustomer.residenceDistanceKm` column (mirrors
  legacy's `customer_current_aadhaar_residence_distance`).
- `core-api`'s `AuditService.checkStraightThroughEligibility` now enforces
  the >25km threshold, rejecting straight-through if the distance is
  missing or exceeds it.
- **Correction to the earlier TODO.md framing**: the >25km
  residence-proof-*document* fallback (legacy: `docs_type LIKE
  '%PRESENT_ADDRESS_PROOF%'`) is **not** ported, and seeding
  `document_types` (Task #21) does not unblock it — that was an incomplete
  read. Legacy's `docs_type` is a free-text tag column on the `docs` table,
  entirely distinct from `docs_master_id`/this schema's `DocumentType` FK.
  `Document` has no matching free-text category column, so there's no way
  to identify a "present address proof" upload without fabricating a
  mapping. The gate fails closed instead: >25km always requires manual
  audit, no document-upload bypass, until a real `docs_type`-equivalent
  column is added — a deliberate, documented conservative default, not a
  silent behavior gap.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full test suites pass (core-api 307, integrations-api 134,
  automation-worker 101, reporting-api 189); 4 new
  `AddressDistanceService` tests plus 2 new `AuditService` gate tests.

## Task #83 — City/State sourcing + category columns (real UAT data, not fabricated)

Prerequisite for the BRE rule engine's geo-eligibility rules. The legacy
UAT dump (`finance_crm_legacy_uat`, Task #41b) is still restored locally —
queried `master_city.m_city_category`/`m_city_is_sourcing` and
`master_state.m_state_is_sourcing` directly (631 cities / 35 states,
matching the already-seeded row counts exactly) rather than fabricating
values.

- New `City.category` (`'A'`/`'B'`, null for 2 legacy rows with none set)
  and `City.isSourcing`/`State.isSourcing` columns + migration
  (`AddCityStateSourcing`).
- `cities.json`/`states.json` extended with the real extracted values;
  `seedFlatLookup`'s state insert and the cities bulk-insert both updated
  to write the new columns — but only on a **fresh** bootstrap (the seed
  skips already-populated tables, so any dev/UAT database that already
  ran the old seed needs `cities`/`states` truncated and re-seeded to
  backfill — flagged in `TODO.md`, not silently left inconsistent).
- Deliberately **not** ported: legacy's pincode-level sourcing
  (`master_pincode.m_pincode_is_sourcing`/`_trial_sourcing`) and the
  `_trial_sourcing` flags on city/state — out of scope for the specific
  BRE rules that motivated this column; noted in `City`'s doc comment.
- Verified: `bun run format/lint/typecheck` clean across all 4 services.

## Task #84 — CustomerBlacklist: global identity-matching redesign

Per explicit product decision (redesign, not keep per-lead-only).
`CustomerBlacklist` was `{lead, reason, createdBy, remarks}` — a per-lead
annotation, not the cross-lead identity blacklist legacy's
`checkBlackListedCustomer()` actually implements (matches by PAN, mobile/
alternate-mobile, email/alternate-email, or first-name+DOB, across every
blacklist row ever created, not just the lead that created it).

- New identity-snapshot columns on `CustomerBlacklist` (`firstName`, `dob`,
  `pancard`, `mobile`, `alternateMobile`, `email`, `alternateEmail`) +
  migration (`AddCustomerBlacklistIdentityColumns`).
  `CollectionService.blacklistLead()` now captures the snapshot from
  `Lead`/`LeadCustomer` at creation time — matching legacy, a later
  profile edit on the original
  lead doesn't retroactively change who gets blocked.
- New `CustomerBlacklistCheckService` (`collection` module, exported for
  cross-module use) ports the exact OR-matching logic, confirmed via
  `BreRuleModel::checkBlackListedCustomer()`. Legacy's hardcoded QA
  mobile-number bypass list is not ported.
- Verified via the legacy UAT dump which excluded-reason ids (1/15/29/52)
  the "5 recent rejects" streak check skips — confirmed real text
  ("DUPLICATE LEAD", "TEST LEAD" x2, "IMPORT LEAD DIRECT REJECT"), all
  already seeded.
- Verified: `bun run format/lint/typecheck` clean; `core-api`'s full test
  suite (325 tests) passes.

## Task #85 — BRE engine: `LeadEligibilityService` (Phase A) + `BreEvaluationService` (Phase B)

Closes "The BRE rule *evaluation* engine was never ported" `TODO.md` item
— the largest remaining backend task. A forked investigation first
established that legacy actually has **three separate functions**, not
one engine — conflating them would have misdesigned the port:

1. `check_customer_eligibility()` (`aip_engine/check_eligibility.php`) — a
   lightweight 9-check pre-screen gate, auto-rejects to `SYSTEM-REJECT`/S8
   on first failure. This is what directly unblocks the CSV-import
   complaint. **Ported as `LeadEligibilityService`** (`leads` module):
   employment type, salary mode, salary floor (waived for REPEAT), age
   21-54, state/city sourcing, blacklist (via Task #84's
   `CustomerBlacklistCheckService`), a "5 consecutive most-recent rejects"
   streak (excluding test/dedupe-type reasons), and a >15-day DPD check
   against the customer's most recent terminal-stage loan. Faithfully
   ports two real legacy quirks rather than "fixing" them: no
   short-circuit (every check runs), and the recorded rejection reason is
   whichever check **fails last** in evaluation order (legacy reuses one
   `$rejection_id` variable with no reset) — the DPD check runs last and
   unconditionally, so it always wins if it fails. Not ported: the
   `$settlementData`-referencing branch (dead code, its data-fetch call is
   commented out in legacy and never actually rejects anyone) and the
   hardcoded QA mobile whitelist bypass. Wired into `LeadImportService`
   (runs right after each CSV row is created) and exposed as
   `POST /leads/:leadId/check-eligibility` for later re-runs as more data
   becomes available (dob/employment aren't in this backend's minimal CSV
   format) — legacy called the same function from multiple lifecycle
   points, not just import.
2. `check_customer_mandatory_documents()` — a doc-completeness gate before
   BRE can run. **Not ported** — same `docs_type` free-text-column gap
   documented in Task #82.
3. `bre_rule_engine()` (`aip_engine/bre_rule_engine.php`) — the full
   26-active-rule scored engine, triggered by an explicit "Run BRE"
   button, confirmed genuinely live (not dead code, unlike several other
   legacy features flagged this session). **Ported as
   `BreEvaluationService`**
   (`POST /leads/:leadId/bre-results/run`): of legacy's 39 configured rule
   slots (all seeded in `bre-rules.json`), only 28 have real evaluation
   logic in legacy's own engine — the other 11 are configured but never
   actually evaluated by legacy itself (5 silently unimplemented:
   `Current Residence Type`, `Company Name Match`, `Geotagging`, the
   "<=180 days..." DPD rule, `Internal Dedupe`; 6 explicitly commented out
   in source: `Personal`/`Office Email Verification`, `Aadhaar`/`PAN OCR
   Verification`, `DOB Verification`, `Current Residence Since`) — this
   port produces no `BreRuleResult` row for those 11, matching legacy
   exactly. Of the 28 legacy evaluates, 14 are built with real logic (Age
   Criteria, Employment Type, Salary Mode, Location Criteria, Salary
   Criteria with City Category, Customer Mobile OTP, Aadhaar EKYC/PAN NSDL
   Verification, Min/Max Loan Amount/Tenure, Customer Reference Available,
   Active Loan — via `CifCustomer`'s cross-lead pancard lookup, Blacklisted
   Customer, Final FOIR Percentage); the other 14 get a `NOT_APPLICABLE`
   result with the specific blocker noted in `relevantInputs` (Novel
   Pattern bank-analysis vendor never ported, bureau/bank/account-
   aggregator log JSON-field parsing not done, `bre_quote_engine()`'s
   city-band FOIR table not modeled, or no Aadhaar-specific address/
   pincode field exists) — this mirrors what legacy's own engine does when
   its vendor data is genuinely absent, not a cop-out. Final decision
   aggregation ported exactly (any REJECT wins; else any REFER wins; else
   all-APPROVE; else NOT_APPLICABLE). Legacy's `customer_bre_run_flag`
   column isn't ported — "has this lead been BRE-evaluated" is already
   derivable from whether `BreRuleResult` rows exist.

Investigated but deliberately deferred rather than built in this pass
(all flagged in `TODO.md`, not silently dropped): the Novel Pattern
bank-statement-analysis vendor (confirmed real and live via
`ThirdPartyAPIController.php`/`ApiCallBackController::callback_novel_bank
_analysis()` — needs its own `integrations-api` module, webhook
controller, log entity, and real API credentials); per-vendor JSON-field
parsing for the bureau/bank/account-aggregator log entities;
`bre_quote_engine()`'s city-band FOIR lookup table.

Verified: `bun run format/lint/typecheck` clean across all 4 services;
full test suites pass; 9 new `LeadEligibilityService` tests, 6 new
`BreEvaluationService` tests.

## Task #86 — BRE: 6 more rules built for real (`bre_quote_engine()` was never actually missing data)

Follow-up to Task #85, same session — the user asked to keep going until
the backend was genuinely done rather than stop at the first defensible
NOT_APPLICABLE boundary. Reading further into `bre_rule_engine.php` (and
its co-located `bre_quote_engine()`, at the very top of the same file)
found that most of Task #85's "blocked" reasons were wrong or
incomplete:

- **`bre_quote_engine()` is 100% hardcoded PHP, not a missing DB table.**
  Task #85's TODO note ("needs the actual band table... not modeled")
  was incorrect — the full city-category x salary-band FOIR-percent
  table is inline PHP in the same file as the rule engine, no external
  data source needed at all. Ported exactly as `eligibleFoirPercent()`;
  `Eligible Loan Amount`/`Eligible Loan Tenure` are now real rules.
  Legacy's 3rd sub-branch per band (`office_email AND residence_type`
  both present) is dead/unreachable code (the preceding OR-branch already
  wins the `else if` chain for that same input) — not ported, documented
  inline, same treatment as the near-identical dead branch already found
  in `Final FOIR Percentage`.
- **`CrifBureauLog.cibilScore`/`.response` already hold what `SCORE`/
  `Overdue Accounts`/`ID Variation (PAN)`/`Inquiries in last 30 days`
  need.** Confirmed via `CrifBureauService`'s own JSON-path extraction
  (`SCORES.SCORE.SCORE-VALUE`) that Surepass's raw CRIF response shares
  the same root object as `ACCOUNTS-SUMMARY`/`PERSONAL-INFO-VARIATION`/
  `INQUIRY-HISTORY` legacy's other three rules read (all siblings under
  `credit_report`) — a same-object extrapolation from confirmed evidence,
  not a guess at an unrelated shape. All 4 now parse
  `CrifBureauLog.response` for real.
- **`Bank Account Verification` needed `BankVerificationLog.response`
  parsing, which was genuinely buildable** — `BankVerificationService`'s
  own Signzy penny-drop response shape (`result.active`/`.nameMatch`)
  matches legacy's rule exactly. Now real; `CustomerBanking` existence is
  used as the "on file" signal legacy's `$bank_account_data` implied.
- **Two rules are still genuinely blocked, confirmed by deeper reading,
  not assumption**: `Bank Statement & Bank Account Match (API)` still
  needs the Novel Pattern vendor (unchanged from Task #85). `Account
  Aggregator` is blocked on a real shape mismatch — this backend's
  `AccountAggregatorService` normalizes Finvu's response into
  `AaTransaction`/`AaMonthlySummary` rather than storing the raw
  `fiObjects`/`Summary`/`Profile.Holders.Holder` structure legacy's rule
  expects, so the field paths aren't confirmed to exist — flagged as its
  own `TODO.md` item rather than guessed.
- Net result: `BreEvaluationService` now builds 21 of the 28 rules
  legacy's own engine evaluates with real logic (up from 14); only 7
  remain `NOT_APPLICABLE` (4 Novel-Pattern-blocked, `Account Aggregator`,
  plus `Current Employment Experience`/`Pincode Matching`, both genuine
  schema gaps confirmed in Task #85).
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full test suites pass (core-api 326 tests); `BreEvaluationService`'s
  spec suite extended to 7 tests covering the new bureau/bank-verification/
  eligible-loan-amount paths.

## Task #87 — CartBI ("Novel Pattern") bank-statement analysis: built for real

Closes the "Novel Pattern bank-statement-analysis vendor never ported"
`TODO.md` item. Re-examined the earlier framing that this was "blocked"
— it wasn't. Same standard as every other vendor in this codebase: a
real adapter reading credentials from env vars, functional the moment
real keys are supplied, never mocked. Confirmed via legacy source
(`integration_config.php`'s `BANK_ANALYSIS` case) that this vendor is
actually branded "CartBI" (cartbi.com); "Novel Pattern" is legacy's own
internal nickname for it.

- New `integrations-api` `BankAnalysisModule`
  (`POST /bank-analysis/upload`, `POST /bank-analysis/callback`), ports
  `payday_bank_analysis_call_api_helper.php`'s
  `bank_analysis_doc_upload_api()`/`bank_analysis_doc_download_api()` and
  `ApiCallBackController::callback_novel_bank_analysis()`. Upload reads a
  stored `BANK STATEMENT` `Document` via `StorageAdapter.download()`,
  multipart-POSTs it to CartBI, and stores the returned `docId` on
  `Document.novelReturnDocId` (new column). CartBI processes
  asynchronously; either its upload response already says "processed"/
  "downloaded" (triggers an immediate download call) or its callback
  webhook does later (`@Public()`, no auth — matches legacy, which has
  none either).
- New `BankAnalysisLog` entity (mirrors `api_banking_cart_log`) logs both
  the UPLOAD and DOWNLOAD steps.
- Wired into `core-api`'s `BreEvaluationService`: `Banking Document`,
  `Bank Statement Average Monthly Balance`, `Bank Statement Fraud Score`,
  and `Bank Statement & Bank Account Match (API)` (last-4-digit account
  match against `CustomerBanking`, same as legacy's `substr(...,-4,4)`
  check) now parse `BankAnalysisLog.response` for real instead of
  returning `NOT_APPLICABLE`. `BreEvaluationService` now builds 25 of 28
  legacy-evaluated rules with real logic (up from 21); only 3 remain
  `NOT_APPLICABLE` (`Account Aggregator`, `Current Employment
  Experience`, `Pincode Matching`).
- Also seeded 2 more confirmed `document_types` rows while reading the
  legacy mandatory-document check that names them:
  `docs_master_id=6`→"BANK STATEMENT", `16`→"SALARY SLIP" (both real
  labels, from `check_common_rules.php`'s
  `check_customer_mandatory_documents()` — not built into a check yet
  itself, just the two labels this task's upload validation needed).
- Live plaintext CartBI credentials found in `integration_config.php`
  (same class of finding as the existing Razorpay/Signzy/Adjust/AppsFlyer
  rotation note) — added to that `TODO.md` bullet, not reused anywhere.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full test suites pass (core-api 328, integrations-api 141); 7 new
  `BankAnalysisService` tests, `BreEvaluationService`'s spec suite
  extended to 9 tests.

## Task #88 — `CustomerBlacklist`/`City`/`State` backfill note closed: moot given the real rollout plan

Removes the "identity backfill on existing dev/UAT databases" `TODO.md`
item — not built, clarified as not applicable. Per the user: the actual
production rollout is a **fresh** database (new schema, empty tables) →
`bun run seed` (reference/lookup data, including `cities`/`states`/
`document_types`) → a one-time legacy-data migration import → users reset
their password via forgot-password (auth secrets/hashes intentionally
not carried over from legacy). Since `seedFlatLookup`'s "only insert if
the table is empty" guard always sees empty tables on that path, every
seed-populated column (`City.category`/`.isSourcing`, `State.isSourcing`,
`CustomerBlacklist`'s identity-snapshot columns, `document_types`) gets
real data on the very first run — there is no scenario in the actual
migration plan where a partially-seeded table needs a manual backfill.
This caveat only ever applied to this project's own local/CI dev
databases that happened to run the seed before these columns existed;
not a concern for the real migration.

## Task #89 — Real production crontab reconciliation: 3 jobs rebuilt from the real source

The user supplied the actual production crontab. Full comparison against
what's built is in the "Open items — full context" section above (client
question on the `CronSanctionController` allocation/rejection jobs' real
status, blocked items awaiting source). This task covers the 3 pieces
confirmed live and approved to build/fix immediately:

- **`repayment-reminder-email` — small fix, not a rebuild.** Confirmed
  the content/subject already matches `Reminders::emailPrepayment()`
  (`CronJobs/Reminders.php`, the real scheduled controller) almost
  verbatim — an earlier port session had already converged on
  near-identical content via a different (but nearly duplicate) legacy
  file. Only real gap: legacy's crontab has no `emailPrepayment(0)` call
  — dropped the day-0 bucket from `RepaymentReminderEmailService.BUCKETS`
  (`[5,4,3,2,1,0]` → `[5,4,3,2,1]`), updated the doc comment to cite the
  real source. Also confirmed (reading `SMSModel::getAllRepaymentReminderSMS()`
  directly): when called with `reminder_flag=true`, `$current_date` gets
  reassigned to equal `$reminder_date`, so the SQL window collapses to a
  single exact day — this port's existing "exact day offset" bucket
  matching was already correct, not a normalization/simplification as an
  earlier write-up assumed.
- **`repayment-reminder-sms` — real rebuild.** Real source:
  `Reminders::smsPrepayment($days, $type=1)`, confirmed scheduled for
  days 1-5 with `$type=1` ("Waiver") — direct Vapio SMS with a
  discount-offer message (`discount = (CAM.recommendedLoanAmount *
  daysBefore) / 100`, DLT template `1707177191819066667`), not the
  WhatsApp-template substitution this port previously used (built when no
  generic SMS-send endpoint existed). Sends to `LeadCustomer.mobile`
  only — legacy doesn't fan out to `alternateMobile` in this job, unlike
  its email sibling. New `integrations-api` generic SMS-send capability
  added to unblock this: `SmsService.sendGenericSms()` +
  `SendGenericSmsDto` + `POST /sms/send`, mirroring `EmailModule`'s
  existing `POST /email/send` pattern exactly (reuses the already-generic
  `SMS_SENDER`/`VapioSmsSender`, previously only exposed for OTP).
  Underlying query/matching criteria (exact-day match, DISBURSED/
  PART-PAYMENT, exclude pending-collection leads) is unchanged — both the
  old and new versions of this job read the same
  `SMSModel::getAllRepaymentReminderSMS()` query.
- **`legal-notice-email` — real rebuild, first genuinely-sent legal
  notice in this backend.** Real source:
  `CronLegalEmailerController::legalNoticeEmailer('dn', 60, 90)`, read in
  full — confirmed correct current entity and DPD window (60-90 days, not
  the 31-60 this port previously targeted, which was based on the
  confirmed-dead `legalNotice31To60DaysEmailer()` wrapper). New
  `LegalEmailLog` entity + migration mirrors legacy's `legal_email_logs`
  dedup table (keyed by lead+loanNumber+noticeType) — legacy LEFT JOINs
  this to skip loans already notified for a given type; this port does
  the same via an explicit lookup before sending. Outstanding-amount
  reuses this codebase's already-established simplification
  (`CAM.repaymentAmount` net of verified `Collection.receivedAmount`,
  same computation `core-api`'s `LegalNoticeService` PDF already uses)
  rather than porting legacy's ~150-line `getLoanRepaymentDetails()`
  discount/penalty engine. Added optional `cc` support to
  `EmailSender`/`SendGenericEmailDto`/all 3 email senders (SMTP/
  ZeptoMail/SES) to support legacy's `cc_email = LEGAL_EMAIL`
  requirement — the first caller of `POST /email/send` that's needed it.
  **Deliberate content deviation**: legacy's body says "Please find
  attached a Demand Notice," implying a PDF attachment — this backend's
  generic email-send endpoint has no attachment support, and the only
  existing legal-notice PDF (`core-api`'s `LegalNoticeService`) is a
  "NOT REVIEWED BY LEGAL COUNSEL" placeholder that must not go out
  attached to a real, live notice — the email body states the notice
  inline instead of claiming a nonexistent attachment.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full test suites pass (core-api 328, integrations-api 142,
  automation-worker 104, reporting-api 189); rewrote/extended spec
  coverage for all 3 jobs plus the new `SmsService.sendGenericSms()` and
  email-sender `cc` support.

## Task #90 — Cron timing externalized out of code + remaining real crontab jobs built

Follow-up to Task #89. Implemented everything genuinely present in the 4
legacy files already read in full that session
(`CronJobs/Automate.php`, `CronJobs/CronLead_Model.php`,
`CronJobs/CronSanctionController.php`, `CronJobs/CronSanction_Model.php`)
but not yet built, plus a general mechanism to set any cron job's timing
from config instead of hardcoding it. `allocateLeadsAndApplicationReject`/
`actionOnUserActivity` (also in the real crontab) remain out of scope —
confirmed absent from every file in the `old-php-files` export (re-checked
again this task, including dated backups) — still blocked on the user
supplying real source.

- **Cron timing out of code — `ConfigurableJobRunner`** (`common/src/jobs/
  configurable-job-runner.ts`): a `JobRunner` decorator wrapping whichever
  concrete runner `JobRunnerModule`'s factory selects
  (`InProcessJobRunner`/`BullMqJobRunner`), intercepting every
  `schedule(name, cronExpression, handler)` call. Env var key
  `CRON_<NAME_UPPER_SNAKE>` (job name kebab-case → upper snake, dashes →
  underscores). Unset: use the hardcoded default (fully backward
  compatible, no per-job file changes). Set to `disabled`
  (case-insensitive): skip scheduling entirely, log it. Any other value:
  used as the cron expression instead of the default. Applies automatically
  to every existing and future job — no changes needed to any individual
  job file. Documented in `docs/DETAILS.md`'s new "Cron job timing"
  section.
- **`credeauAllocation()` → 4th band on `CreditApplicationAllocationService`**
  (real source: `CronJobs/CronSanctionController.php:1130`). Targets
  straight-through NEW leads: `isStraightThroughProcessing=true`,
  `userType=NEW`, stage S1 or S4, no salary threshold at all (unlike the
  existing G50K/B50K/REPEAT bands — `CreditBandConfig.minSalary=0` now
  skips the salary filter entirely rather than applying a vacuous
  `>= 0` bound, which would incorrectly exclude leads with a null salary).
  Extended `CreditBandConfig` with `stageCodes?: string[]` and
  `straightThroughOnly?: boolean`. Roster: legacy's hardcoded
  `user_id IN (1)` replaced with the same live active-CR2 pool the other
  bands already use (established "hardcoded roster → live role"
  precedent). `cronLimit=5`, `bucketSize=100`, cron `*/30 * * * *`.
- **`RepeatOnlineCustomersAllocation()` → new
  `RepeatOnlineCustomersAllocationService`** (real source: `CronJobs/
  CronSanctionController.php:453`). Filters `userType=REPEAT`, new
  `Lead.leadDirectDisbursal` column (legacy `lead_direct_disbursal` — new
  migration + entity column; no write path exists yet anywhere in this
  backend, documented inline — the read-side filter is real, nothing sets
  it `true` yet), `leadStatus='DISBURSAL-NEW'`, `creditAssignedTo IS
  NULL`. Assigns credit (and screener if unset). Roster: legacy's
  hardcoded `user_id IN (70,136,129)` replaced with the live active-CR2
  pool. Working hours 07:00–23:30 (a genuinely different window from the
  usual 09:00–23:30 — passed inline, not the shared
  `ALLOCATION_WORKING_HOURS` constant). `cronLimit=25`, `bucketSize=1000`,
  cron `*/2 * * * *`.
- **`Automate::allocateLeadsAndApplication($leadType, $userType)` → new
  `AllocateLeadsAndApplicationService`** (real source: `CronJobs/
  Automate.php` + `CronJobs/CronLead_Model.php`). One legacy function
  covering all 5 real crontab lines via `(leadType, userType)`, ported as
  one `BANDS`-config-array-driven service (this codebase's established
  pattern): Lead Hold→screener (72h since `screenerAssignedAt`, dynamic
  cap `floor(leads/users)` or 1), Application New→credit (no threshold,
  fixed cap 10), Application Hold→credit (72h since `creditAssignedAt`,
  dynamic cap), partial-lead NEW→screener and partial-lead REPEAT→credit
  (both: created within the last 15 minutes — an upper age bound, the
  opposite of every other "stale" threshold in this codebase; matched via
  `MasterStatus.stageCode='S1'`, legacy id 42 has no seed row, same
  substitution `ScreenerAllocationService` already uses). Roster
  eligibility ported for real (schema support already existed, corrected
  an earlier assumption in this task that it didn't): active users with
  the matching role (`CR1` for screener-target bands, `CR2` for
  credit-target) **and** a `UserActivityLog` row with `activityType=LOGIN`
  dated today — `UserActivityLog` is already genuinely written on every
  login in `core-api`'s `AuthService`, not new infrastructure. Legacy's
  further `user_roles.lead_allocation_type` sub-splits have no schema
  equivalent — same simplification already used elsewhere (draw from the
  full eligible pool). No working-hours gate (legacy's
  `allocateLeadsAndApplication()` has none, unlike every
  `CronSanctionController` allocation method). No total per-run cap in
  legacy — only per-user, ported via `Number.MAX_SAFE_INTEGER` as
  `allocateRoundRobin`'s total-run limit.
- **Real conflict, not silently resolved**: this task's `Automate`-based
  jobs target the same lead stages as the already-built
  `CronSanctionController`-based jobs from Task #89 and earlier. Both sets
  are now scheduled simultaneously by default in `automation-worker` —
  `CRON_<NAME>=disabled` (this task's own new mechanism) is the lever to
  turn off whichever turns out to be wrong once the client answers the
  crontab-completeness question, with no redeploy. See `docs/TODO.md`'s
  "Open items" for the full detail — not repeated here.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full `automation-worker` test suite passes (121 tests, 21 suites) with
  new/extended coverage for `ConfigurableJobRunner`, the 4th
  `CreditApplicationAllocationService` band, `RepeatOnlineCustomersAllocationService`
  (6 tests), and `AllocateLeadsAndApplicationService` (9 tests covering
  all 5 bands, the dynamic-cap path, the stageCode multi-row match, and
  the logged-in-today eligibility gate).

## Task #91 — production crontab confirmed exhaustive: disable every job not in it

Direct follow-up to Task #90, same session. The user pasted the real
production crontab in full a second time and stated explicitly that,
other than those entries, no other `automation-worker` cron job runs in
prod — resolving the open "is the crontab exhaustive?" question from
Task #89/#90 with a definitive yes.

- **`ConfigurableJobRunner` extended to treat `disabled` as a valid
  hardcoded default, not just an env override** (`common/src/jobs/
  configurable-job-runner.ts`): the disabled check now runs against the
  *resolved* expression (env override if set, else the job's own default)
  rather than only the override. This lets a job ship with
  `cronExpression: 'disabled'` as its literal default — off in every
  environment unless a `CRON_<NAME>` env var explicitly gives it a real
  cron expression — using the exact same sentinel already recognized as
  an override value, one shared convention for both directions.
- **Every job confirmed absent from the crontab now defaults to
  `disabled`** — code and tests kept intact (nothing deleted), each
  service's class doc comment gets a one-line "Disabled by default —
  confirmed absent from the real production crontab" note plus which env
  var re-enables it:
  - `ScreenerAllocationService` (`screener-lead-allocation-g50k`/`-b50k`)
  - `LeadRejectionService` (all 3 rules: `reject-lead-screener-tat`,
    `reject-lead-new-bucket-tat`, `reject-application-credit-tat`)
  - `CollectionDefaulterEscalationService` (all 3 DPD buckets)
  - `ApplicationHoldRedistributionService` (`-g50k`/`-b50k`)
  - `LeadHoldRedistributionService`
  - `CreditApplicationAllocationService`'s G50K/B50K/REPEAT bands (the
    `credeau` band is confirmed live and stays enabled — same file, only
    3 of its 4 `BANDS` entries changed)
  - `ClosedLoanFeedbackEmailService`, `OutstandingLoanDigestEmailService`,
    `ReloanPitchEmailService`, `NotContactableLeadEmailService`,
    `NotContactableLeadSmsService`, `PoiFatherNameSyncService`,
    `BirthdayEmailService`, `AppsflyerDisbursalEventPushService`
  - `AllocateLeadsAndApplicationService`'s `allocateLeadsAndApplicationReject`/
    `actionOnUserActivity` bands were never built (blocked on missing
    source, see `docs/TODO.md`) — nothing to disable there.
- `BirthdayEmailService` is called out with an extra caveat in its own
  doc comment: it's the one method with a real `routes.php` alias in
  legacy, so it may still fire via a direct URL hit from an external
  scheduler this backend has no visibility into — disabled here anyway
  per the user's explicit "only this are running" instruction, since
  that's about this backend's own crontab-equivalent scheduling.
- Jobs confirmed present and left enabled: repayment-reminder-email/-sms
  (5 bands each), `AllocateLeadsAndApplicationService` (5 bands),
  `credeau-application-allocation`, `legal-notice-email-60-90-dpd`,
  `repeat-online-customers-allocation`.
- `docs/DETAILS.md`'s "Cron job timing" section extended with the full
  disabled-by-default job list and which env var re-enables each.
  `docs/TODO.md`'s crontab-exhaustiveness question marked RESOLVED.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full `automation-worker` test suite passes (121 tests, 21 suites) —
  every spec asserting a literal hardcoded cron string for a
  now-disabled job updated to assert `'disabled'` instead.

## Task #92 — Account Aggregator rebuilt: both real flows, real BRE rule

Direct follow-up to the blocked "BRE `Account Aggregator` rule" TODO item.
Reading the real legacy source (`bre_rule_engine.php`, `AAController.php`,
`aa_api_curl_helper.php`, `constants.php`) surfaced something bigger than
a field-name mismatch: **two separate, parallel Account Aggregator flows
both exist live in the current CRM**, wired to two different buttons on
the same Verification page — confirmed by the client as both genuinely in
active use, not one dead/one live. The previous build
(`AA_GATEWAY_URL`/generic-REST-path design) matched neither.

- **`LEGACY` flow** (5-step, Finvu-shaped): consent request → status →
  FI-request → FI-status → FI-fetch-data → analytics-report. Every step's
  request/response shape is read directly from `AAController.php`'s own
  field-access code (`$resArr['result']['url']`/`['consentHandle']`/
  `['consentId']`/`['sessionId']`/`['fiRequestStatus']`/`['body'][0]
  ['fiObjects'][0]...`), not guessed.
- **`NOVEL_PATTERN` flow** (CartBI, "Novel Pattern" internally — same
  vendor as `BankAnalysisModule` but a different endpoint/flow): a single
  consent request (`CreateConsentRequest`), then an async webhook
  callback (`getConsentResponseCallback`, real payload confirmed:
  `docId`/`requestId`/`status`/`reportFileName`/`endTime`/`message`/
  `fileNo`), then (once `status` is "Processed") a downloaded report.
  **The exact downloaded-report JSON shape was confirmed against a real
  production sample the client pasted** (a genuine CartBI "Novel Pattern"
  net-banking-request response for a real lead) —
  `{data: [{ifscCode, accountName, bankFullName, camAnalysisData:
  {minBalanceLastThreeMonth, averageBalanceLastThreeMonth,
  averageBalanceLastSixMonth, ...}, transactions: [...], ...}]}` — not
  inferred from source reading alone.
- **Real discovery, not a guess**: `aa_api_curl_helper.php`'s
  `sendCurl_request()` hardcodes a single vendor URL
  (`{NP_URL}api/generateNetBankingRequest`) for every non-Signzy call
  regardless of the `$endUrl` argument passed in (which looks like a REST
  path per step but is never actually used for routing) — both flows hit
  the exact same endpoint, differentiated only by request-body shape.
  Renamed the confusing legacy `NP_URL`/`NP_TOKEN` env vars to
  `ACCOUNT_AGGREGATOR_NP_URL`/`ACCOUNT_AGGREGATOR_NP_TOKEN` here.
- **`AccountAggregatorLog` schema extended**: new `provider` enum
  (`LEGACY`/`NOVEL_PATTERN`, legacy `aa_provider`), `docId`/
  `reportFileName` columns (`NOVEL_PATTERN` only, legacy `aa_doc_id`/
  `aa_file`). `responsePayload` widened from `text` to `longtext` — a
  real downloaded `NOVEL_PATTERN` report (full transaction history +
  analysis) is routinely several hundred KB, well past `text`'s ~64KB
  MySQL limit; production itself persists these externally (a file,
  referenced by name) for the same reason, this port keeps it simpler via
  `longtext` instead of a second storage path.
- **`AccountAggregatorService`** rebuilt end to end against the confirmed
  real shapes for both flows; `AccountAggregatorCallbackController`
  rewritten with the real webhook payload shape (was a generic invented
  `consentHandleId`/`consentId`/`status` shape before) and triggers the
  download step when `status` is "Processed".
- **BRE "Account Aggregator" rule built** in `bre-evaluation.service.ts`
  (rule id 39 in legacy) — reads the latest successful `FI_FETCH_DATA`
  `AccountAggregatorLog` for the lead (either provider, most recent),
  branches parsing by `log.provider`, compares against the customer's
  declared bank account (`CustomerBanking.ifscCode`/`beneficiaryName`).
  Legacy's real 3-branch decision logic ported faithfully **including its
  own bug**: the mismatch branch compares the AA response's *bank name*
  against the customer's *own name* (should logically be account-holder
  name vs. account-holder name) — not silently corrected, same
  documented-not-fixed convention used for other ported legacy bugs
  (`ApplicationHoldRedistributionService`'s TAT threshold,
  `LeadRejectionService`'s remark text).
- **Bug caught during implementation**: an early draft collapsed a real
  `NETWORK_ERROR` (the HTTP call itself failed) down to `API_ERROR`
  whenever the response shape check failed — meaning a genuine network
  outage would misreport as "vendor responded with bad data". Fixed via
  a `resolveStatus()` helper that only downgrades a `SUCCESS` status, and
  added a passing NETWORK_ERROR test that would have caught this.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  full test suites pass (core-api 331, integrations-api 146,
  automation-worker 121, reporting-api 189) — new/updated coverage for
  both `AccountAggregatorService` flows, the rewritten callback
  controller, and 4 new BRE spec cases (NOT_APPLICABLE with no data,
  APPROVE on match, REFER on IFSC mismatch, `Current Employment
  Experience` reassigned as the "still genuinely blocked" NOT_APPLICABLE
  example since Account Aggregator no longer is one).

## Task #93 — CAM send-back now writes the lead-status side effect

`frontend/docs/skip.md` (the frontend team's backend-gap research)
confirmed `CAMController::reEditCAM()` writes `status = "SEND BACK"` to
**both** the lead and the CAM row, but `CamService.sendBack()` only ever
updated the CAM's own status — a real backend gap, not a frontend
integration task. This schema collapses legacy's `status`/`stage`/
`lead_status_id` trio into one `MasterStatus` FK; the closest seeded
equivalent is `APPLICATION-SEND-BACK`, the same status name
`AuditService.sendToPreAudit()`'s own send-back path already uses.
`CamService.sendBack()` now also transitions `lead.leadStatus` to that
status and writes a `LeadFollowup` entry (`"Lead allocate by self"`-style
convention every other workflow-changing action in this codebase already
follows), matching legacy's dual write. `CamController`/`CamModule`
updated to pass the acting user through (needed for the followup) and
register `MasterStatus`/`LeadFollowup`. Verified: 15/15 `cam.service.spec`
tests pass, including new coverage for the lead-status side effect and
the "status not seeded" failure path.

## Task #94 — CartBI bank-analysis results view: new GET endpoint

Same `skip.md` source: `BankAnalysisController` had an upload trigger
but no way to fetch a lead's parsed CartBI result afterward — no
standalone "view results" screen was buildable frontend-side. Added
`GET /bank-analysis/leads/:leadId/result` (`BankAnalysisService.getResult()`)
— finds the latest successful `DOWNLOAD`-method `BankAnalysisLog` for the
lead and parses its `response` into a flat, typed result (account
details, fraud score, average/min balance fields). The exact real field
shape (`data[0].{bankFullName, accountNumber, ifscCode, camAnalysisData:
{...}}`) was confirmed against a real production report sample the
client supplied earlier this session (Task #92's Account Aggregator work
— both flows share the same underlying CartBI analysis engine, same
field names). Throws `NotFoundException` when no completed analysis
exists yet (consistent with every other async-result lookup in this
codebase, e.g. `AccountAggregatorService.getConsentStatus()`) rather than
returning null, so the frontend can distinguish "not ready" from "wrong
lead ID" via the response body. Verified: 10/10
`bank-analysis.service.spec` tests pass, including 3 new cases for
`getResult()`.

## Task #95 — RUNO self-allocation: lead self-claim ported for real

Third `skip.md` item: legacy's `TaskController::allocateLeads()` is a
self-service bulk "claim these leads for myself" action — acting user's
role determines which queue (screener/credit/disbursal) they can claim
from, self-assigns, transitions status, writes a followup, and (CR1 in
production only) fires RUNO's sanction-call allocation in the same
request. Neither `changeStatus()` nor `assign()` implement "acting user
claims this lead for themselves" the way legacy's function does —
attaching RUNO to either would fabricate a trigger condition the backend
never actually implements.

- New `POST /leads/self-allocate` (`LeadsService.selfAllocate()`) —
  takes `{leadIds, assignTarget}` (`assignTarget` reuses the existing
  `LeadAssignmentStage` enum from `assign()`). Since this schema's JWT
  carries an array of role codes (not legacy's single session `label`),
  the caller specifies which queue it's claiming from and the acting
  user must hold an authorizing role for it — `CR1` for `SCREENER`,
  `CR2` for `CREDIT`, `DS1`/`DS2` for `DISBURSAL`, with `CA`/`SA` as a
  universal override (matches legacy's own `$label == 'X' || $label ==
  'CA' || $label == 'SA'` condition structure exactly). A lead not
  currently in the right "New" status for the target queue is silently
  skipped (returned in the response's `skipped` array), matching
  legacy's own `continue` — a bulk checkbox selection can legitimately
  include leads another agent claimed first, that's not an error.
  `SCREENER`'s source match uses `stageCode='S1'` (legacy ids 41/42/1,
  same substitution used throughout this codebase for the two unseeded
  partial-lead ids). Also backfills `screenerAssignedTo` whenever it's
  empty regardless of which branch fired, ported as-is from legacy.
- **New architecture: `core-api` calling `integrations-api` directly.**
  Previously only `automation-worker` called `integrations-api` over
  HTTP; firing RUNO synchronously in the same request as the self-claim
  (matching legacy exactly) needed `core-api` to do the same. Added
  `core-api/src/common/integrations-api.client.ts` +
  `integrations-api-client.module.ts`, mirroring automation-worker's own
  client exactly (env-var-driven `INTEGRATIONS_API_URL`, no
  service-to-service auth token needed since `integrations-api` has no
  global JWT guard registered — confirmed by reading its `app.module.ts`,
  not assumed). Added `@nestjs/axios`/`axios` as new `core-api`
  dependencies (previously only used by `integrations-api`/
  `automation-worker`).
  The RUNO call is wrapped in try/catch and never blocks the lead claim
  itself — matches legacy's own fire-and-forget call (no error handling
  around it either).
- **Known gap, not fabricated**: legacy also writes the claimed status
  onto the `loan` table's `loan_status_id` for the `DISBURSAL` branch.
  This schema's `LoanStatus` enum has no "in process" value, and a
  `Loan` row may not even exist yet at the `DISBURSAL-NEW` stage
  (created explicitly later via `DisbursalService.createLoan()`) — not
  ported.
- No explicit `ENVIRONMENT == 'production'` gate ported (no precedent
  anywhere else in this codebase) — `RunoClientService` already refuses
  to function without a real `RUNO_API_KEY` configured, serving the same
  practical purpose.
- Verified: 48/48 `leads.service.spec` tests pass (6 new cases:
  forbidden-role, SCREENER allocate+skip+RUNO-fire, CA/SA-no-RUNO,
  CREDIT with screener backfill, DISBURSAL, RUNO-failure-doesn't-block-batch).

**Still blocked at the time, since resolved**: `skip.md`'s remaining 3
items — AppsFlyer attribution (client later confirmed it's not used,
see Task #96), domain/email verification auto-trigger timing (client
confirmed manual, staff-triggered verification via the CRM is correct
— the built explicit "Verify" button needed no change), and the
collection followup template picker (`CollectionController::
get_followup_template_lists()` needs new `master_sms_template`/
`master_whatsapp_template`/`master_email_template`-equivalent tables —
but the actual template *content* is real production business copy
this session has no access to and must not fabricate; still needs the
client to supply the real template rows before this is buildable — see
`docs/TODO.md`).

## Task #96 — AppsFlyer disabled: client confirmed it's not used

Client instruction: AppsFlyer is dead code, disable it. Rather than
deleting the fully-built adapter (`integrations-api`'s `AppsflyerModule`,
real `POST /appsflyer/events` endpoint) and the log-only cron job
(`automation-worker`'s `AppsflyerDisbursalEventPushService` — already
`cronExpression: 'disabled'` by default per Task #91, since it wasn't in
the confirmed-exhaustive production crontab either), both modules were
simply unregistered from their respective `app.module.ts` (import +
`imports` array entry commented out, with an inline note explaining why
and pointing back here) — the code stays in place, fully reversible by
uncommenting, in case AppsFlyer is adopted later. `AppsflyerPushEventLog`
(entity + migration) left as-is — dormant, unused schema is harmless,
not "dead code" in the sense that matters (nothing executes against it).
Resolves the previously-open AppsFlyer schema-gap item (`Lead`/
`LeadCustomer` never had an `appsflyerId` column to source from) — moot
now, no further attribution work needed.

Verified: `bun run format/lint/typecheck` clean across all 4 services;
full test suites unaffected (core-api 339, integrations-api 149,
automation-worker 121, reporting-api 189) — the disabled modules' own
unit tests still exist and pass, only their `app.module.ts` wiring
changed.

## Task #97 — CompanyHoliday gets a real consumer: repayment-date working-day adjustment

Client-confirmed business rule, resolving the previously-open
`CompanyHoliday`-has-no-consumer item: if a repayment date falls on a
Sunday or a company/festival holiday, it isn't used as-is — it moves to
the nearest working day instead.

- New `common/src/dates/adjust-for-non-working-day.ts` —
  `adjustForNonWorkingDay(isoDate, holidayDates, direction)`, exported
  from `@finance-crm/common` (shared, not `core-api`-specific, in case another
  service needs the same rule later). Takes/returns plain `YYYY-MM-DD`
  strings and does all arithmetic in UTC — a calendar date has no
  timezone of its own, and UTC math sidesteps DST/server-timezone
  ambiguity entirely. Direction defaults to `'previous'`
  (client-confirmed), configurable per environment via
  `REPAYMENT_DATE_WORKING_DAY_DIRECTION=previous|next`.
- The only legacy precedent for this exact adjustment
  (`api/application/models/Instant_Model.php::checkLoanEligibility()`,
  the excluded customer-facing app — legacy's *main* CAM flow only
  validates/rejects a holiday/Sunday date, never auto-adjusts it) uses a
  two-phase check: a `while` loop over holidays, then a single
  *un-looped* Sunday check afterward. That has a latent bug — if the
  Sunday-adjusted date is itself a holiday, legacy's holiday loop never
  re-runs. This port uses one unified loop (continues while the
  candidate is *either* a Sunday *or* a holiday) so that case is handled
  correctly instead of carrying the bug forward — a deliberate, documented
  improvement, not silently different behavior.
- `CompanyHolidaysService.getActiveHolidayDates()` — new method, returns
  every active/non-deleted `CompanyHoliday.holidayDate` as a `Set<string>`
  (cheap repeated lookups inside the adjustment loop vs. one DB round-trip
  per candidate date). `CompanyModule` now exports `CompanyHolidaysService`
  (previously only exported `TypeOrmModule`) so `CamModule` can import it.
- `CamService.upsert()` runs any incoming `dto.repaymentDate` through
  `resolveWorkingRepaymentDate()` before saving — the only place this
  backend currently writes `CreditAnalysisMemo.repaymentDate` at all
  (confirmed via a fresh read: no other module calculates or writes it,
  `upsert()` was a pure client-supplied pass-through before this).
- Verified: 20/20 `cam.service.spec` tests pass (5 new cases: unchanged
  date, Sunday→previous, holiday-lands-on-Sunday→continues past it,
  consecutive-holiday walk-back, `direction=next` override). Full
  workspace: `bun run format/lint/typecheck` clean, all 4 services'
  suites pass (core-api 344, integrations-api 149, automation-worker
  121, reporting-api 189).

## Task #98 — CPV/field-verification workflow (`tbl_verification`)

Ports the CPV (Customer Physical Verification) residence/office
field-verification workflow — the largest gap found in the legacy-table
usage audit. A scoping pass first found that `VerificationController.php`
is almost entirely digital/API identity verification, not CPV; the actual
field-executive report-submission handler no longer exists anywhere in
`old-php-files` (only a commented-out view template survives as a schema
fossil) — so only initiation/queueing/allocation are faithful ports, and
the report-capture fields are reconstructed from that fossil rather than
ported from live behavior.

- New `database/src/entities/field-verification/field-verification-visit.entity.ts`
  — `FieldVerificationVisit`, one row per visit (`visitType` discriminates
  RESIDENCE/OFFICE, mirroring `LoanCollectionVisit`'s `addressType`
  pattern, rather than legacy's single row with both merged together).
  Carries `requestedBy`/`scmAssignedTo`/`allocatedTo` (User FKs),
  `status` (PENDING/ALLOCATED/POSITIVE/NEGATIVE), and the full
  residence + office report field set (`metWith`, `relation`,
  `livingStandard`, `neighbourCheck`, `latitude`/`longitude`, etc. —
  `latitude`/`longitude` are real typed columns despite never being
  populated in legacy, since there's no legacy format to match). Migration
  `1785540000000-AddFieldVerificationVisit`.
- `core-api/src/modules/field-verification/` — new module:
  - `initiate()` ports `TaskController::initiateFiCPV()` — routes the
    request to the State Collection Manager (`CO2`) covering the lead's
    state via `UserRoleLocation`, matching legacy's first-match lookup
    (no load-balancing there either); left `null` if no CO2 covers the
    state rather than failing the request.
  - `listQueue()` — role-scoped: `CO3` (Collection Head) sees everything,
    `CO2` sees requests routed to them, `CFE1` (Collection Field
    Executive) sees visits allocated to them, any other permitted role
    sees only what they personally requested. `CO2`/`CO3`/`CFE1`/`CO1`
    role codes already existed in seed data — no new roles needed.
  - `allocate()` ports `VerificationController::assignLeadToCollectionuser()`.
  - `submitReport()` — new (no live legacy handler to port), captures the
    full report field set plus a POSITIVE/NEGATIVE verdict.
  - Every transition writes a `LeadFollowup` audit-trail row via the same
    `writeFollowup` private-helper pattern established in
    `audit.service.ts`/`leads.service.ts`, rather than a CPV-specific
    history table.
- Naming: module is `field-verification` (not `verification`) since
  `core-api/src/modules/verification/` already exists for the
  documents/banking concerns `VerificationController.php`'s non-CPV
  methods were ported to.
- Verified: `bun run format/lint/typecheck` clean across all 4 services.

## Task #99 — Export/MIS report catalogs (`master_export`/`master_mis_report`)

Models the catalog `UserExportPermission.exportId`/`UserMisPermission.misId`
previously granted access against as a plain int with no real table
behind it (both entities' doc comments flagged this explicitly).

- New `database/src/entities/reporting/export-catalog.entity.ts` /
  `mis-report-catalog.entity.ts` — `ExportCatalog`/`MisReportCatalog`
  (`name`, `heading`, `isLive`; `isActive`/`isDeleted` come from
  `BaseEntity`, matching legacy `m_export_active`/`m_export_deleted`).
  Migration `1785550000000-AddExportMisReportCatalogs` seeds both tables
  verbatim from the real production `master_export`/`master_mis_report`
  data (a real UAT export: 54 export rows, 78 MIS report rows) with
  explicit primary keys matching legacy `m_export_id`/`m_report_id` —
  every existing `@RequireExportPermission(id)`/`@RequireMisPermission(id)`
  decorator throughout `reporting-api` hardcodes those legacy ids, so the
  catalog's row ids had to line up with them.
- `UserExportPermission.exportId`/`UserMisPermission.misId` (plain ints)
  are now real `@ManyToOne` relations (`export`/`mis`) to the new catalog
  entities — same physical FK column names, so no data migration needed
  beyond adding the FK constraint. `ExportPermissionGuard`/
  `MisPermissionGuard` and `MenuPermissionsService.grantExportPermission()`/
  `grantMisPermission()` (which now does a `findOrFail` catalog lookup
  before granting) updated accordingly.
- New `reporting-api/src/modules/report-catalogs/` — admin CRUD
  (`ExportCatalogsController`/`MisReportCatalogsController`, `@Roles('SA',
  'CA')`) for managing the catalog itself; legacy had no equivalent admin
  screen (catalog rows were managed by direct DB edit), so this is new,
  not ported.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  core-api 344 tests / reporting-api 189 tests pass.

## Task #100 — Access-audit logging for MIS reports/exports (`mis_access_logs`/`export_access_logs`)

`ExportPermissionGuard`/`MisPermissionGuard` correctly gated access but
never wrote an audit row.

- New `database/src/entities/reporting/export-access-log.entity.ts` /
  `mis-access-log.entity.ts` — `ExportAccessLog`/`MisAccessLog` (who,
  what, when via `BaseEntity.createdAt`, `startDate`/`endDate` from the
  report's own query-string date-range filter if present, `ipAddress`,
  `userAgent`). Legacy also split the user-agent into `platform`/
  `browser` columns; there's no UA-parsing anywhere in this codebase to
  populate those reliably (`UserActivityLog.platform` has the identical,
  pre-existing gap — it's declared but never actually set by
  `auth.service.ts`), so this keeps the full raw `userAgent` string only
  rather than fabricating a parse. Migration
  `1785560000000-AddExportMisAccessLogs`.
- Both guards now log after granting access (admin bypass or a real
  grant — not on the `ForbiddenException` paths), setting the
  export/mis/user relations by id only (already validated by the
  permission check / JWT) to avoid an extra round trip on every
  reporting request.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  reporting-api 189 tests / core-api 344 tests pass.

## Task #101 — Collection DPD-bucket-range permission gating (`collection_bucket_wise_permission`) + `CustomerBanking.accountType` (`master_bank_type`)

Bundled together — both were small permission/lookup primitives added in
the same migration.

- New `database/src/entities/collection/collection-bucket.entity.ts` —
  `CollectionBucket` (`name`, `startDpd`, `endDpd`). Legacy's
  `master_collection_bucket_wise` has no rows in the UAT dump (only a
  column-comment reference — checked, no `CREATE TABLE`/`INSERT`
  anywhere), so this ships empty; admins populate ranges via CRUD rather
  than seeding fabricated boundaries.
- New `database/src/entities/collection/user-collection-bucket-permission.entity.ts`
  — `UserCollectionBucketPermission` (user, nullable userRole, bucket,
  nullable grantedBy), same shape as `UserExportPermission`/
  `UserMisPermission`.
- New `core-api/src/modules/collection/collection-bucket-permission.service.ts`
  — bucket CRUD, grant/revoke/list for the permission, and
  `getVisibleDpdRange(userId)` porting `UMS_Model::getCreditUserList()`'s
  `MIN(mcbw_start)`/`MAX(mcbw_end)` join for CO1/CO2/CO3 agents (real DPD
  computation itself — `DATEDIFF(CURDATE(), cam.repaymentDate)` — already
  exists via `CreditAnalysisMemo.repaymentDate` but was never wired into
  a row-level collection-worklist filter; `collectionBucketCaseWise`'s
  existing "bucket" report uses a different, incompatible closed-loan-only
  formula and hardcoded names, so this doesn't touch it). New
  `collection-buckets.controller.ts` exposes bucket CRUD and
  grant/revoke/list, both `@Roles('SA', 'CA')`.
- `CustomerBanking.accountType` — new `database/src/entities/verification/bank-type.entity.ts`
  (`BankType`, name only) plus a `@ManyToOne` on `CustomerBanking`, seeded
  with the 5 real legacy `master_bank_type` rows (SAVING/CURRENT/SALARY/
  FIXED/RECURRING) via `seed-reference-data.ts`.
- Migration `1785570000000-AddBankTypeAndCollectionBuckets`.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  core-api tests pass (20 collection-module tests).

## Task #102 — DB-backed CAM/sanction-letter branding (`Company.cin`/`logoFileKey`)

`sanction-letter.template.ts` hardcoded the lender name/CIN/registered
office as constants (`Acme Leasing Finance Private Limited`) with no
logo at all — no DB-backed source existed for multi-company branding.

- `Company` (already a real entity with `name`/`address`) gained `cin`
  and `logoFileKey` (a storage key, not a URL — resolved through
  `StorageAdapter` at render time, same pattern as every other
  file-reference field in this schema). Migration
  `1785600000000-AddCompanyBranding`. `CreateCompanyDto`/
  `CompanyService` updated accordingly — no new endpoints needed, this
  reuses the existing company CRUD.
- `SanctionLetterData` gained `lenderName`/`lenderCin`/
  `lenderRegisteredOffice` (now required, resolved by the service, not
  the template) and an optional `logoDataUri`. The template's old
  `LENDER_NAME`/`LENDER_CIN`/`LENDER_REGISTERED_OFFICE` constants became
  exported `DEFAULT_LENDER_*` fallbacks, used by
  `SanctionLetterService.generate()` when a lead has no `Company`
  assigned (`Lead.company` is nullable) — the real legacy values are
  preserved as the default, not fabricated.
- Logo is embedded as a base64 data URI (`resolveLogoDataUri()`,
  downloading the file via `StorageAdapter.download()`) rather than an
  `<img src>` URL, so Puppeteer's PDF render doesn't depend on network
  reachability of the storage backend.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  core-api 345 tests pass (including a new case asserting a company's
  branding and logo flow through to the rendered HTML).

## Task #103 — Cross-vendor PAN-keyed API-response cache (`vendor_api_caches`)

Ports legacy `customer_api_data`'s intent (avoid a redundant, often
billed, vendor call for the same PAN across a person's multiple leads)
as a generic opt-in cache rather than a forced change to every vendor
adapter — the underlying legacy `PANTOALLMOBILE` call itself has no
equivalent adapter in `integrations-api` to port, so this builds the
cache primitive plus one real integration to prove it.

- New `database/src/entities/integrations/vendor-api-cache.entity.ts` —
  `VendorApiCache` (`pan`, `apiProvider`, `apiType`, nullable
  originating `lead`, `request`/`response`), indexed on
  `(pan, apiProvider, apiType)`. No expiry column, matching legacy.
  Migration `1785600800000-AddVendorApiCache`.
- New `integrations-api/src/common/vendor-api-cache.service.ts` —
  `VendorApiCacheService.get()`/`.set()`, registered in that service's
  `CommonModule` for any vendor module to inject.
- Wired into `PoiVerificationService.verifyPan()` (Signzy PAN fetch,
  `v3/pan/fetchV2`) as the first real consumer — PAN fetch returns
  static per-person data, unlike KYC/bureau checks that must stay fresh
  per application, making it a safe candidate to cache and reuse.
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  integrations-api poi-verification suite (10 tests, including 2 new
  cache-hit/cache-write cases) passes.

## Task #104 — Video-KYC inbound callback (`api_callback_video_ekyc`)

Ports `VideoKYCController::VideoKycCallBack_post()` — the last of the 8
legacy-table-usage-audit gaps. Legacy's callback handler does two
distinct things: (1) log the Signzy ConsenzAI verdict callback and flip
`lead_customer`'s vkyc flags, and (2) download/unzip/classify a bundle
of session documents from a second, unrelated third-party endpoint
(`myconcall.com`, with a hardcoded auth token committed in source).
Only (1) is ported — it's the actual documented gap
(`video-kyc.service.ts` only did outbound session creation); (2) is a
separate, undocumented legacy feature against a different vendor
domain with a stale-looking hardcoded secret, out of scope to guess at.

- New `database/src/entities/integrations/video-kyc-callback-log.entity.ts`
  — `VideoKycCallbackLog`, a physically separate table from `VideoKycLog`
  (mirrors legacy's separate `api_callback_video_ekyc`/
  `api_video_ekyc_logs` tables).
- `LeadCustomer` gained `vkycFlag`/`vkycCompletedOn`/`vkycRequestIp`,
  mirroring `lead_customer.customer_vkyc_flag`/`customer_vkyc_completed_on`/
  `customer_vkyc_request_ip` (previously not modeled at all). Migration
  `1785601100000-AddVideoKycCallback`.
- New `integrations-api/src/modules/video-kyc/video-kyc-callback.controller.ts`
  (`@Public()`, same pattern as `esign-callback.controller.ts`) — logs
  every callback regardless of whether a lead matches, and when it does,
  flips the `LeadCustomer` flags and writes a `LeadFollowup` entry
  against the lead's current `leadStatus` (porting `Tasks->insertApplicationLog()`).
- Verified: `bun run format/lint/typecheck` clean across all 4 services;
  integrations-api video-kyc suite (6 tests) passes.

## Task #105 — Fresh rewrite: database layer (98 entities against the legacy schema)

Executes the restart decided 2026-08-01 (see the superseded entry this
replaces in `docs/TODO.md`'s history). The prior `backend/` content was
archived to `backend/old/` (gitignored, kept on disk as reference —
not a sibling `old-backend/` directory as the original plan sketched;
the new backend was built in place instead). `database/legacy-baseline/
legacy-schema.sql` and `docs/SCHEMA-MAP.md` came along as the tracked
spec the entity port is written against; everything else — service
code, tooling, `node_modules` — stayed archived untracked in `old/`.

All 98 entities in `docs/SCHEMA-MAP.md` are now typed against real
legacy table/column names from the start, one commit per domain
(geography, company, users/auth/menu-permissions, leads, cam/bre,
disbursal, collection, verification/field-verification, feedback,
integrations, reporting/audit — 27 of the 98 were already legacy-shaped
from the in-place migration before the restart and were carried over
as-is; the rest were re-pointed at their real tables). Judgment calls
worth remembering:

- **No invented FK columns.** Where legacy already links two tables via
  an existing column that isn't a formal FK (`leads.customer_id` ↔
  `cif_customer.cif_number`, `collection.loan_no` ↔ `loan.loan_no`),
  the relation is expressed at the entity level via
  `@JoinColumn({ referencedColumnName })` on that existing column —
  never by adding a new column just to model the relationship. Caught
  and fixed one violation (`Lead.cifCustomer` had invented
  `lead_cif_customer_id`) mid-rewrite.
- **`ADOPT-UNVERIFIED` tables** (absent from the UAT dump but real, per
  `docs/SCHEMA-MAP.md`): `BlacklistedPincode`, `CollectionBucket`,
  `LeadAudit`, and five integration-log tables. Real column names
  recovered from the legacy PHP source (`old-php-files/`) rather than
  guessed, with the entity doc comment citing the exact file/query.
- **Curated column subsets, not full-width adoption**, for a handful of
  very wide legacy tables (`cif_customer`, `lead_customer`,
  `credit_analysis_memo`, `loan`, `tbl_verification`) — only the
  columns already proven to matter (via
  `old/database/src/migrate-legacy/*.ts`'s verified mapping, or direct
  DDL reading for `tbl_verification` which has no such reference) are
  mapped; legacy's remaining unused columns are left unmapped, which is
  fine — additive/adoption migrations only ever add, never drop.
- **`FieldVerificationVisit`** now maps `tbl_verification` as ONE row
  per lead with residence/office columns side by side (legacy's real
  physical shape), not unpivoted into synthetic per-visit-type rows the
  way the pre-restart entity modeled it.

Also landed: `check-drift.ts`/`check-schema-map.ts`/
`additive-schema-changes.ts` (ported from the pre-restart work), a
hand-composed `InitialSchema` migration (9 `ADD COLUMN`s, 4
`ADD PRIMARY KEY`s, 14 `CREATE TABLE`s for the `NEW`/`ADOPT-UNVERIFIED`
tables — deliberately not raw `typeorm migration:generate` output,
which proposes real FK constraints onto shared legacy tables), and a
fix to `BaseEntity` (used by the 6 genuinely-new tables) to
fully-explicit-type every column instead of relying on TypeORM's
implicit inference, matching every legacy-adopted entity's convention.

Verified end-to-end against a disposable restore of
`legacy-baseline/legacy-schema.sql`: the migration applies cleanly and
`check:drift` reports zero drift across all 98 tables (1365 columns).

Not done yet: the 5 service rewrites (`core-api`, `reporting-api`,
`integrations-api`, `automation-worker`, `gateway`) porting logic across
from `backend/old/` — see `docs/TODO.md`.

## Task #106 — Fresh rewrite: core-api (19 modules against the rewritten database layer)

First of the 5 service rewrites from Task #105. `@finance-crm/common` was
ported first (auth guards/decorators, JWT strategy, pagination DTOs,
job-runner abstraction, PDF/storage adapters, `find-or-fail`) since
every service depends on it — a straight port, no coupling to
app-specific entity shapes. `core-api`'s skeleton (`package.json`,
`nest-cli.json`, `tsconfig*.json`, `Dockerfile`, `main.ts`) followed the
same layout as `backend/old/core-api`.

`CommonModule` registers `TypeOrmModule.forFeature(ALL_ENTITIES)` and
exports `TypeOrmModule`, rather than a manually curated entity subset —
core-api's own scope (leads/CAM/BRE/disbursal/collection/verification/
feedback/users/company/geography/audit/menu-permissions/search) already
touches nearly the whole relation graph, so curating a subset would
just re-derive `ALL_ENTITIES` piecemeal and risk the "Entity metadata
for X#y was not found" boot crash the pattern exists to prevent
(matches the same `ALL_ENTITIES` pattern already used by
`reporting-api`/`automation-worker` in `backend/old/`). Every feature
module imports `CommonModule` and uses `@InjectRepository` directly,
instead of each module re-registering its own entity subset the way
`backend/old/core-api` did.

All 19 modules (auth, geography, company, users, menu-permissions,
leads, bre, cam, disbursal, collection, verification, feedback,
documents, audit, search, support, field-verification, performance)
are ported and wired into `app.module.ts`, one commit per module
folder. Most modules ported with only entity-property-name adjustments
(the rewritten entities' naming/nullability differ from the
pre-restart ones in dozens of small ways — wrong relation names,
columns that are nullable in the real legacy schema but weren't in the
pre-restart entity, NOT-NULL columns with no default that the old code
never set). Two modules needed a real redesign, not just renaming,
because the rewritten entity models the legacy table's actual physical
shape rather than the pre-restart entity's invented shape:

- **`field-verification`**: `tbl_verification` is one row per LEAD with
  residence and office tracked as two parallel column groups on the
  same row (legacy's own shape), not one row per visit with generic
  type/status/relation enums. Endpoints now key off `leadId` with a
  `track: RESIDENCE|OFFICE` discriminator on every mutating call
  instead of a `visitId`. There's no column to persist "routed to this
  SCM" (unlike the old model's `scmAssignedTo`), so the CO2 queue scope
  is computed live from `UserRoleLocation` + `Lead.state` instead of
  reading a stored assignment. Also fixed
  `FieldVerificationVisit.id` from `@PrimaryColumn` to
  `@PrimaryGeneratedColumn` — the additive migration makes
  `tbl_verification.verify_id` `AUTO_INCREMENT` (same situation as
  `MasterReligion`), and TypeORM won't read a generated value back onto
  a `@PrimaryColumn` entity after `save()`.
- **`performance`**: `user_target_allocation_log` has no time-window
  column at all — it's one rolling row per (user, SANCTION|COLLECTION
  type), with achieved-to-date figures updated directly on the row by
  the legacy cron. The old module invented a monthly `targetMonth`
  column and computed "achieved" live from `CreditAnalysisMemo`; the
  new one scopes by `type` instead of month and trusts the stored
  achieved columns (keeping them in sync going forward is
  automation-worker's job, not core-api's).

One gap flagged rather than guessed: `CustomerBanking` has no
verified/verified-at pair in the real legacy schema (only
`account_status_id`, an unmapped lookup) — `verifyBanking()` can't
express "mark verified" without inventing a column, so it's listed in
`docs/TODO.md` pending the real `account_status_id` value list.

Ran a systematic sweep afterward for NOT-NULL, no-default
`datetime`/`timestamp` columns across every entity core-api touches,
cross-checked against every `.create()` call site — this class of bug
compiles fine (`.create()` takes a `Partial<Entity>`) but fails at
insert time. Found and fixed 8 sites the module ports missed
(`LeadFollowup`, `UserExportPermission`, `UserMisPermission`,
`LeadCustomer`, `LeadCustomerReference`, `DocumentType`, `Document`,
`DocumentDownloadLog`) beyond what the ports themselves already caught
elsewhere (`BreRule`/`BreRuleResult`/`CreditAnalysisMemo`/`Collection`/
`DisbursementBank`/`DisbursementTransactionLog`/`CustomerBlacklist`/
`UserCollectionBucketPermission`/`UserTargetAllocation`).

typecheck/lint clean across the whole repo throughout. Not done yet:
the other 4 service rewrites — see `docs/TODO.md`.

## Task #107 — Fresh rewrite: integrations-api (30 vendor modules against the rewritten database layer)

Second of the 5 service rewrites from Task #105. Scaffold
(`package.json`/`nest-cli.json`/`tsconfig*.json`/`Dockerfile`/`main.ts`)
followed `core-api`'s established pattern exactly. `CommonModule`
registers `TypeOrmModule.forFeature(ALL_ENTITIES)` rather than a
curated subset — with ~30 independent vendor modules touching a wide,
overlapping slice of the relation graph (Lead/User/Company/Product/
geography/CifCustomer/LeadCustomer plus each vendor's own log entity),
curating by hand risks the same "Entity metadata not found" boot
crash the pattern exists to prevent (same reasoning as `core-api`'s
`CommonModule`, matching the `ALL_ENTITIES` pattern `backend/old/
reporting-api`/`automation-worker` already used).
`VendorApiCacheService` (the `customer_api_data` cross-lead cache,
keyed by PAN) updated for the rewritten `VendorApiCache` entity:
`provider`/`apiType` are numeric enums now, not free strings.

4 shared vendor HTTP clients ported unchanged first, since several
vendor modules depend on them: `SignzyClientService` (eKYC/eSign/
face-match/bank verification/UAN/domain-verification/video-KYC/
reverse-geocode — the most-used vendor across this service),
`DigitapClientService` (Signzy's alternate-provider counterpart),
`GoogleMapsClientService` (reverse-geocode fallback + address
distance), `RunoClientService` (call-allocation API).

This service's scale (30 vendor modules) called for parallel forks
rather than one-at-a-time porting, each in an isolated git worktree
(`Agent` tool's `isolation: "worktree"`) to avoid the shared-tree
coordination cost `core-api`'s parallel porting hit (see that task's
lessons — one fork's module importing a sibling fork's
still-in-progress module broke the shared pre-commit hook repeatedly).
3 of 4 dispatched forks completed successfully (found and fixed the
same class of NOT-NULL-no-default timestamp bugs `core-api`'s sweep
caught, plus module-specific redesigns noted below); merged back into
master sequentially with one conflict-resolution commit per merge
(only `app.module.ts`'s import/registration lists ever conflicted,
never module source — confirms the worktree-isolation fix worked). The
4th fork (razorpay/upi/enach) correctly stopped rather than guess: its
isolated worktree had no access to `backend/old/` (gitignored, so
`git worktree add` — which only checks out tracked files — never
brings it in), which two sibling forks had instead worked around by reading it via
absolute path rather than reporting the same blocker;
that inconsistency is why the user then set the standing rule
"one agent at a time, only spin up more with explicit permission" —
see `feedback_one_agent_at_a_time` in this session's memory. Those 3
modules were ported directly on `master` afterward instead of via a
replacement fork.

Judgment calls and real entity-shape adjustments worth remembering
(each also documented in its own commit body):

- **Systematic NOT-NULL-no-default column sweep**, same class of bug
  `core-api`'s Task #106 swept for: `CredeauLog.provider`/`method`,
  `EkycLog`/`FaceMatchLog`/`VideoKycLog`/`VideoKycCallbackLog`/
  `DomainVerificationLog`/`BankVerificationLog`'s `provider`/`method`,
  `UpiCollectionLog.provider`/`status`, `UpiCallbackLog.lead`/`method`,
  `RepaymentLog.method`/`source`, `AccountAggregatorLog.errorMessage`.
- **`AdjustDeviceLog` had the same `@PrimaryColumn`→
  `@PrimaryGeneratedColumn` bug** `FieldVerificationVisit` had in Task
  #106 — `api_adjust_logs.ad_log_id` is additive-migration
  `AUTO_INCREMENT` but the entity wasn't reading the generated id back
  after `save()`. Fixed the same way.
- **`crif-bureau` real redesign, not a rename**: `CrifBureauLog` is
  shaped around 3 legacy API steps with no generic `status`/
  `reportFileKey`/`requestedAt` columns; `reportFile` is a `longtext`
  holding actual base64 PDF bytes, not a storage key (dropped
  `StorageAdapter` usage entirely). Only step 1 (Surepass) is
  implemented — steps 2/3 aren't reconstructable without the original
  PHP source, left null rather than guessed (see `docs/TODO.md`).
- **`finbox` ports device-connect only** — bureau-connect/bank-connect
  legacy tables were never adopted as `@finance-crm/database` entities; blocked
  on missing entities, not invented (see `docs/TODO.md`).
- **`call-management`**: `CallManagementLog` is a campaign-level batch
  log with no lead/user/mobile/provider columns at all (unlike the
  pre-rewrite entity) — dropped those, kept the lead/agent trail via
  `LeadFollowup` instead.
- **`adjust`**: `AdjustDeviceLog` has no advertisingId/requestUrl/
  resolvedUtmSource/resolvedUtmCampaign columns, only generic
  request/response text — `inspectDevice()` now returns a small
  `{log, resolvedUtmSource, resolvedUtmCampaign}` shape instead of the
  raw log.
- **`account-aggregator`**: `AccountAggregatorLog` has no
  `requestedBy` column (dropped that parameter) and a NOT-NULL
  `errorMessage` the old code never set (added to every log write
  across both LEGACY and NOVEL_PATTERN flows).
- **`address-distance`/`address-lat-long`**: both map the SAME
  physical shared table (`address_lat_long_api_logs`, SPLIT per
  `docs/SCHEMA-MAP.md`) with a different status enum
  (`AddressApiStatus`, not the shared `ApiCallStatus`) and a required
  `apiName` discriminator legacy's own PHP source doesn't always set
  explicitly — read `payday_reverse_geo_code.php` directly rather than
  guessing. Added 3 real columns (`methodId`/`providerId`/`message`,
  the last holding the computed distance value) to
  `AddressDistanceLog` that were missing from its mapping but already
  present on the shared table (confirmed via the sibling
  `AddressLatLongLog` entity + the legacy PHP source).
- **`appsflyer`** ported fully but deliberately **not registered** in
  `app.module.ts`, replicating `backend/old/integrations-api`'s exact
  "client confirmed unused" decision and comment.
- **`upi`**: `Loan.status` is a legacy free-string label, not the enum
  the pre-rewrite code assumed — switched to the string constant
  pattern `core-api`'s `disbursal.service.ts` already established.
  `UpiCollectionLog`/`UpiCallbackLog`'s numeric `ApiCallStatus` enum
  values happen to match the old ad-hoc `statusId` convention
  (PENDING=0/SUCCESS=1/API_ERROR=2), preserving webhook-response
  compatibility.
- **`enach`**: `EnachLog.provider`/`requestType` are NOT NULL with no
  determinable value from the ported code or legacy PHP source — both
  are pure DB bookkeeping columns (neither feeds the real ICICI
  request body), defaulted to the least-wrong options and flagged in
  `docs/TODO.md` rather than left silently guessed.

typecheck/lint/format clean across the whole repo throughout. Not
done yet: the other 3 service rewrites — see `docs/TODO.md`.

## Task #108 — Fresh rewrite: automation-worker (20 jobs against the rewritten database layer)

Third of the 5 service rewrites from Task #105. Scaffold followed
`core-api`/`integrations-api`'s established pattern; `CommonModule`
registers `TypeOrmModule.forFeature(ALL_ENTITIES)`, same reasoning as
the prior two services. Ported directly on `master`, one job at a
time, no forks — the user set "one agent at a time, only spin up more
with explicit permission" after `integrations-api`'s parallel-fork
run (Task #107), and this service's 20 jobs didn't justify revisiting
that.

`JobRunnerModule`'s `JOB_RUNNER` token (`@finance-crm/common`) is used
throughout instead of the static `@Cron()` decorator — every job's
cron timing/on-off state is overridable via `CRON_<NAME>` env vars.
`IntegrationsApiClient` (thin HTTP wrapper over `INTEGRATIONS_API_URL`)
ported unchanged for jobs that send SMS/email/WhatsApp.

Real entity-shape fixes made while porting (each also documented in
its own commit body):

- **`LeadFollowup.createdAt`/`updatedAt` have no DB default** — every
  allocation job (`screener-allocation`, `credit-application-
  allocation`, `repeat-online-customers-allocation`,
  `allocate-leads-and-application`, `lead-rejection`) now sets both
  explicitly on `.create()`, the same NOT-NULL-no-default class of bug
  `core-api`/`integrations-api`'s sweeps caught.
- **`legal-notice-email` real redesign**: `LegalEmailLog` has no
  `noticeType` column at all (old code referenced one) — `typeId` is a
  single generic "1=>Legal Email" value per the entity's own doc
  comment, so dedup was rewritten to be by-lead-only. Also fixed
  NOT-NULL `sentTo`/`sentCc` the old code never set; `sentBcc` has no
  source anywhere in this schema, defaulted to empty string and
  flagged in `docs/TODO.md`.
- **`reloan-pitch-email`**: `CustomerBlacklist` PAN matching switched
  from joining through `lead.pancard` (the live lead's current
  profile) to the blacklist row's own snapshot `pancard`/`firstName`/
  `mobile` columns — the entity's doc comment is explicit this is a
  deliberate point-in-time snapshot, not a live join. Same fix reused
  in `reporting-api`'s `credit-exports`/`collection-exports`.
- **`poi-father-name-sync`**: `PoiVerificationLog.methodId` doesn't
  exist — the real property is `method`.
- **`outstanding-loan-digest-email`/`repayment-reminder-email`**:
  `Loan.loanNumber` is nullable now (unlike the pre-rewrite entity) —
  both jobs skip loans with no loan number rather than crash.
- **`appsflyer-disbursal-event-push`**: `LoanStatus` enum doesn't
  exist — `Loan.status` is a plain legacy free-string label, fixed
  with the same string-constant pattern `core-api`'s
  `disbursal.service.ts` established. Kept **not registered** in
  `app.module.ts`, matching `integrations-api`'s `AppsflyerModule`
  "client confirmed unused" precedent.
- **`hold-redistribution`**: ported the real 36-hour TAT threshold —
  not the "48" the legacy call site's naming implies, which its own
  default-parameter fallthrough doesn't actually enforce.
- **`not-contactable-lead-sms`**: kept log-only, no real SMS send
  wired up — confirmed the pre-rewrite service never injected
  `IntegrationsApiClient` either, and a real send needs the actual
  Vapio DLT template id/message copy, which isn't available.

typecheck/lint/format clean across the whole repo throughout. Not
done yet: `reporting-api` (Task #109) and `gateway` — see `docs/TODO.md`.

## Task #109 — Fresh rewrite: reporting-api (11 modules against the rewritten database layer)

Fourth of the 5 service rewrites from Task #105. Scaffold followed the
same established pattern (port #3002). Ported one module at a time,
no forks, per the standing "one agent at a time" rule. Every module's
pre-rewrite code was written against invented table/column names (the
old `reporting-api` predates the legacy-schema adoption in Task #105)
— each required verifying every table/column reference against the
real `@finance-crm/database` entities rather than a mechanical copy.

Two resolution strategies used depending on query complexity:
1. **Full QueryBuilder rewrite** using entity property-path syntax
   (`credit-reports`/`credit-exports`, and fixing `disbursal-reports`/
   `disbursal-exports`'s join targets) — TypeORM's alias-translation
   handles real column names automatically, including inside raw
   `SUM(CASE WHEN ...)` fragments passed to `.select()`.
2. **Raw parameterized SQL with every name corrected to the real
   legacy schema**, kept where correlated subqueries don't map
   cleanly onto QueryBuilder joins: `credit-reports.processTat()`
   (recursive CTE w/ window functions) and the entire
   `collection-reports` module (15 report methods, heavy correlated-
   subquery DPD-bucket math).

Real entity-shape fixes made while porting (each also documented in
its own commit body):

- **`ExportAccessLog`/`MisAccessLog` have no `roleCode` column** —
  only `userRoleId: number | null`, which the JWT payload can't
  determine (it only carries role code strings, not a specific
  `UserRole` row id) — left null rather than guessed in both
  `export-permission.guard.ts`/`mis-permission.guard.ts`.
- **`collection-reports`**: rewrote every raw query against the real
  legacy table/column names (`leads`/`credit_analysis_memo`/`loan`/
  `collection`/`master_status`/`loan_collection_followup`/
  `master_followup_type`/`master_followup_status`/`master_role_type`/
  `user_roles`/`master_branch`/`lead_followup`) instead of the
  invented plural names the file was originally written against.
  Also fixed `Collection.verificationStatus` (`payment_verification`)
  being a numeric enum (0/1/2), not the string `'APPROVED'` every
  query compared against.
- **`collection-exports`**: `Lead` has no `leadCustomer` relation —
  `LeadCustomer` joined as an entity class on `customer.leadId =
  lead.id` throughout, matching the `credit-exports`/
  `disbursal-exports` precedent. `netDisbursalAmount` lives on
  `CreditAnalysisMemo`, not `Loan`. `Collection.repaymentType` isn't a
  relation either (`repaymentTypeId` is a varchar matching
  `MasterStatus.id` with no formal FK) — joined the same entity-class
  way.
- **`field-visit-reports`**: `LoanCollectionVisit` (legacy
  `tbl_collection_followup`) has no workflow-status column at all —
  the old file referenced a `fieldStatus` with PENDING/ASSIGNED/
  CANCELLED/HOLD/COMPLETED values that doesn't exist on this GPS/
  visit-shaped entity. Every report collapses to a completed/pending
  split off the real `completedAt` column instead of fabricating
  states; `rmConveyance` now wires up the real `totalDistanceKm`
  column the old doc comment incorrectly claimed didn't exist.
- **`disbursal-reports`/`disbursal-exports`**: raw string table joins
  (`'credit_analysis_memos'`/`'loans'`/`'lead_customers'`/
  `'customer_bankings'`) replaced with real entity-class joins;
  `LoanStatus` enum (doesn't exist) replaced with the string-constant
  pattern; `Lead.leadStatusId` (no such scalar property) replaced with
  comparing the bare `leadStatus` relation directly, which TypeORM
  translates to the join column.
- **`credit-exports`**: `CustomerBanking` has no verified/verified-at
  state (only kept the real `isActive` half of the old filter);
  `Loan.status` has no WAIVED value so `loanWaived()` filters via
  `MasterStatus.name = 'DISBURSED-WAIVED'` through the lead relation
  instead; `blacklisted()` fixed to the same `CustomerBlacklist`
  snapshot-column pattern as `automation-worker`'s
  `reloan-pitch-email` (Task #108).
- **`financial-exports`/`lead-reports`/`lead-exports`/
  `report-catalogs`** ported unchanged (including their `.spec.ts`
  files where present) — already written against relation-based
  QueryBuilder syntax or entity shapes that matched exactly.

typecheck/lint/format clean across the whole repo throughout. Not
done yet: `gateway` — see `docs/TODO.md`.

## Task #110 — Fresh rewrite: gateway (nginx reverse proxy)

Fifth and last of the 5 service rewrites from Task #105 — the fresh
rewrite is now complete. Pure routing/CORS/cookie-forwarding, no app
code, so `Dockerfile`/`nginx.conf` ported unchanged from
`backend/old/gateway`: the path-prefix routing
(`/api/v1/integrations/` → `integrations-api`, `/api/v1/reporting/` →
`reporting-api`, catch-all `/` → `core-api`) still matches exactly,
since `core-api`/`integrations-api`/`reporting-api`'s
`setGlobalPrefix()` calls are unchanged from the pre-rewrite services
this config targeted. `automation-worker` has no public routes, so
it's not proxied, matching the old config. Wired into
`docker-compose.yml` (port 8080, `depends_on`
core-api/integrations-api/reporting-api); no `package.json` — nginx
only, not a bun workspace member.

All 5 services (`core-api`, `integrations-api`, `automation-worker`,
`reporting-api`, `gateway`) plus the shared `database`/`common`
packages are now rebuilt against the legacy schema. typecheck/lint/
format clean across the whole repo. Remaining gaps are tracked in
`docs/TODO.md` (unported unit tests, a handful of entity/data gaps
blocked on external input) — none block running the system.

## Task #111 — Close 4 of 5 TODO items previously marked "blocked on missing source" using `old-php-files/application` directly

Several gaps flagged during Tasks #105-#110 as "blocked on missing
source/data" had been investigated by searching `old-php-files/` but
came up empty. Re-investigating directly against
`old-php-files/application` (three parallel research passes, plus
direct verification against `database/legacy-baseline/legacy-schema.sql`)
found that 4 of the 5 were actually resolvable — the source/schema
existed, it just hadn't been found by the earlier search framing. One
item (`Automate::allocateLeadsAndApplicationReject`/
`::actionOnUserActivity`) was re-searched exhaustively and is now
double-confirmed genuinely absent — left blocked, not guessed (see
`docs/TODO.md`).

- **`EnachLog.provider` default corrected to `WORLDLINE`** —
  `payday_enach_api.php`/`ICICIeNachController.php` both hardcode
  `enach_provider => 1`, which the column's own DB comment
  (`1=>Worldline 2=>DigiTap`) decodes as Worldline, not the `DIGITAP`
  guess this shipped with. Surfaced a real, separate, still-open gap
  while re-reading that source: `EnachService.initiateTransaction()`
  actually performs legacy's `TRANSACTION_INITIATE` operation, which
  logs to a different table (`api_enach_transaction_schedule_logs`,
  `aetl_`-prefixed columns) with no entity yet — not something
  `EnachLog`/`requestType: REGISTER` can correctly express.

- **`master_bank_account_status` modeled, real bank verification
  implemented** — the entity layer previously claimed no master table
  existed for `customer_banking.account_status_id`; it does
  (`legacy-schema.sql:2177`, and the column itself carries the DB
  comment `'master_bank_account_status id'`). Added `BankAccountStatus`
  + a proper `CustomerBanking.accountStatus` relation.
  `VerificationService.verifyBanking()` (`core-api`) was a stub that
  returned the record unchanged — now implements the one convention
  legacy code confirms (`DisbursalController::verifyDisbursalBank()`:
  id `1` = verified, sibling records on the same lead reset to
  unverified). No real `bas_name` label data is seeded anywhere in this
  environment, so the full status-picker (arbitrary values, not just
  verify/unverify) stays unbuilt — flagged in `docs/TODO.md`.

- **Collection followup SMS/email template picker ported** —
  `CollectionController::get_followup_template_lists()` is now real
  (`CollectionService.listFollowupTemplates()`/
  `renderFollowupTemplateContent()`, `core-api`). Found a fully-built
  but unregistered-and-misdocumented `SmsTemplate` entity already
  sitting in `@finance-crm/database` — its class doc comment wrongly claimed
  `m_st_type_id=1` meant OTP; the real DB comment says `1=>collection`,
  confirmed against `legacy-schema.sql`, and it's exactly the table
  `Collection_Model::get_sms_template_lists()` queries. Added a new
  `EmailTemplate` entity (`master_email_template`) with its schema
  inferred from `Collection_Model.php`'s own queries, since no DDL for
  that table exists anywhere on disk. WhatsApp deliberately not built —
  `master_whatsapp_template` never existed in legacy and its own list
  method (`get_whatsapp_template_lists()`) is called but never defined
  anywhere in the PHP source, a legacy dead end. Content rendering does
  a real per-lead merge for both SMS and email, even though legacy's own
  `get_email_template_content()` never actually uses its `$lead_id`
  parameter (hardcoded preview values regardless of which lead is
  open) — per this project's "real adapters, not mocks" principle, this
  port doesn't reproduce that stub. No real template content is seeded
  anywhere in this environment for either table — flagged in
  `docs/TODO.md`.

- **`CrifBureauLog` steps 2/3 ported** — a dormant Signzy CRIF
  passthrough (`payday_signzy_crif_api.php`) implements exactly the
  `api1`/`api2`/`api3` shape the entity models, chained synchronously
  (step 1 `POST v3/test-encrypt-data` creates the log row and, on
  success, immediately triggers step 2 `POST .../create-bureau-consent`,
  which immediately triggers step 3 `POST .../test-decrypt-data`) via
  the same `runCurl()` helper legacy reuses for all 3 calls, branching
  on response shape. Commented out in `CibilController.php` — Surepass
  (already ported) stays the live default; Signzy stays available but
  dormant, exposed as a separate endpoint. `otpBypass: true` is always
  set, so the flow completes within one call — legacy's own
  `callbackUrl` field has no implemented handler anywhere in the PHP
  source, so this port doesn't fabricate a callback endpoint with no
  real payload shape to port. Legacy's final step also writes a
  `cibil_url` column that doesn't exist on the real `tbl_cibil_log`
  table (confirmed against `legacy-schema.sql` — writing it would throw
  a MySQL error, consistent with this flow apparently never running
  successfully in production); the URL is returned directly instead of
  invented as a column. Also caught that `api3Request`/`api3Response`
  are `varchar(100)` in the real schema (unlike `api1`/`api2`'s
  `text`/`longtext`) and truncates to fit — a genuine legacy limitation,
  not introduced by this port.

typecheck/lint/format clean across the whole repo throughout; new
service-layer test coverage added where it extended an existing spec
file (`crif-bureau.service.spec.ts`, which also had a pre-existing,
unrelated `bureauType` assertion bug fixed as a drive-by). No live
MySQL or vendor sandbox is reachable in this environment, so none of
this was exercised end-to-end — real verification needs a DB seeded
from `legacy-schema.sql` plus the additive migration, and Signzy
sandbox credentials.

## Task #112 — Port/write the 30 missing unit-test specs flagged in Task #106-#109

Closed the entire "unit tests not ported" TODO item: all 20 `core-api`
specs, both `integrations-api` specs, and all 8 `reporting-api` specs
(including the `collection-exports` controller). `core-api` and
`reporting-api` are fully green (305 and 185 tests respectively).
`integrations-api`'s new `enach`/`upi` specs passed immediately; the
full-suite run also surfaced and fixed 3 unrelated pre-existing failures
(all confirmed as test bugs, not service bugs — the service code was
already correct in all 3 cases):

- **`finbox.service.spec.ts`**: compared `log.status` against the raw
  string `'API_ERROR'` instead of the real `ApiCallStatus.API_ERROR`
  enum member the service actually assigns.
- **`credeau.service.spec.ts`**: same class of bug against
  `log.decision`/`log.apiStatus` — compared to `'PROCEED_TO_BANK'`/
  `'SUCCESS'`/`'NETWORK_ERROR'` string literals instead of the real
  `CredeauDecision`/`ApiCallStatus` enum members.
- **`crif-bureau.service.spec.ts`**: `Buffer.from('pdf-bytes').buffer`
  exposes Node's shared internal buffer *pool* ArrayBuffer, not one sized
  to the string — leaking unrelated bytes into the "downloaded PDF"
  assertion. Fixed by copying into a fresh, correctly-sized ArrayBuffer
  (`new Uint8Array(Buffer.from(...)).buffer`) instead, matching what a
  real `responseType: 'arraybuffer'` axios response actually provides.

Full `integrations-api` suite is now green (158/158) alongside `core-api`
and `reporting-api`.

- **Most `core-api` specs ported verbatim** from `backend/old` — business
  logic in `auth`, `bre.service`, `cam` (mostly), `company`, all 4
  `documents` modules, `feedback`, `geography`, `lead-import`/
  `lead-lookups`/`lead-eligibility`, `search`, `support`, and `users`
  hadn't drifted since the old spec was written.
- **A handful needed real adaptation for entity/DTO drift**, not blind
  copying:
  - `bre-evaluation`: `CrifBureauLog` now stores `api1`/`api2`/`api3`
    response columns instead of a single `response` field,
    `LeadCustomer.mobileVerifiedStatus` replaced a boolean
    `isMobileVerified`, `AccountAggregatorLog.provider` is a numeric enum
    not a string, `BreDecision` has no `NOT_APPLICABLE` member (the
    service reuses the entity column's own `0` sentinel), and
    `Loan.status` is a free-string label, not an enum.
  - `cam`: `CamStatus` has no `SEND_BACK` member (`sendBack()` reverts to
    `DRAFT`), no `sanctionedAt` column (`sanction()` stamps `updatedAt`),
    `CifCustomer.create()` always passes `spouseName: ''`.
  - `collection`: the constructor grew 4 repos
    (`SmsTemplate`/`EmailTemplate`/`CreditAnalysisMemo`/`Loan`) plus
    `ConfigService` since the old spec was written; the visits tests
    needed a full rewrite since `VisitAddressType`/`VisitFieldStatus`
    don't exist on the real `tbl_collection_followup` schema (free-text
    `visitAddress`/`rejectReason` plus a plain `completedAt` timestamp
    instead).
  - `disbursal`: `LoanStatus` isn't a real enum (mirrored the service's
    own private `LOAN_STATUS` string-constant map in the spec instead),
    `createBank`/`updateBank` gained a required `actingUserId` param, and
    `DisbursementTransactionLog` has no relation back to `Loan` (rewrote
    the "tied to its loan" test against the real
    `CreateDisbursementTransactionDto` shape).
  - `menu-permissions`: `CreateMenuItemDto` grew required
    `companyId`/`productId`/`sectionLabel`/`stage`/`boxBgColor` fields and
    `create()` gained a `currentUserId` param; `remove()` only flips
    `isActive` (`master_lms_menu` has no `is_deleted` column).
  - `leads`: one exact-match assertion (`addReference`) didn't account
    for the `createdAt` timestamp the service now stamps.
- **`performance` was written fresh, not ported** — `PerformanceService`
  was fully rearchitected since the old spec (legacy stores one rolling
  row per `(user, SANCTION|COLLECTION type)` with achieved-to-date
  figures updated directly by the legacy cron, replacing the old spec's
  monthly-target/live-CAM-aggregation design; dropped
  `CreditAnalysisMemo`/`MasterStatus` dependencies, changed both method
  signatures).
- **`integrations-api`'s `enach`/`upi` had no old spec to port from**
  (both were rewritten by hand after a fork correctly refused to guess at
  `backend/old/`, Task #107) — written fresh following this codebase's
  established `HttpService`-mock convention (`adjust.service.spec.ts` et
  al): success/`API_ERROR`/`NETWORK_ERROR` paths for `enach`, plus a real
  RSA keypair round-trip (generated at test time, same approach as
  `icici-rsa.util.spec.ts`) to exercise `upi`'s actual encrypt/decrypt
  path instead of mocking it away.
- **All 8 `reporting-api` specs written fresh, not ported** — every
  pre-rewrite spec asserted against the invented plural-table-name/
  QueryBuilder-mock shape Task #109's rewrite replaced with real
  QueryBuilder/raw-SQL queries against the actual schema, so none of them
  applied even as a starting point. Coverage prioritized real computed
  business logic over mechanical query-construction checks:
  `disbursal-exports`' GST home-state/inter-state split math,
  `disbursal-reports`' two-hour-band bucketing (including the legacy
  quirk where the bucket label text doesn't literally match the hour for
  most of the day — kept as-is) and per-executive bucketing,
  `field-visit-reports`' pending/completed percentage math and RM-to-
  collection-amount map lookup, `collection-reports`' DPD-bucket
  classification (on/before due date, 1-10 DPD, 10+ DPD, still-open) and
  its own hour-bucketing quirk, and `collection-exports` controller's
  `includeContactDetails` role gate (SA/CA only, never trusted from the
  query string alone — a real PII-exposure control, not just a filter).
  Every method not covered by one of those got at least a guard-clause/
  date-range/status-filter check against the real query text.

typecheck/lint/format clean throughout; committed incrementally per
module rather than as one giant commit.

## Task #113 — Adopt Finbox bureau-connect/bank-connect (upload + fetch)

Closed the "Finbox bureau-connect/bank-connect flows blocked on missing
entities" TODO item — it had been mischaracterized as needing a new
schema export, when the already-ported `FinboxLog` (device-connect) was
itself built the exact same way `docs/SCHEMA-MAP.md`'s own
`ADOPT-UNVERIFIED` table already flagged: reconstructed from legacy PHP's
own INSERT arrays, not a real schema dump.

- **`FinboxBureauConnectLog`/`FinboxBankConnectLog` entities** added
  (`api_finbox_bureauconnect_logs`/`api_finbox_bank_connect_logs`,
  `finbox_br_`/`finbox_bc_`-prefixed columns), mirroring `FinboxLog`
  column-for-column. Bureau-connect's `id`/`isActive`/`isDeleted` are
  confirmed by a real `SELECT ... ORDER BY finbox_br_id DESC` in
  `LeadModel.class.php::getFinboxBureauConnectApiLog()`; bank-connect's
  three equivalent columns are inferred from the sibling tables' shape
  since no query anywhere in `old-php-files/` references them — flagged
  in that entity's own doc comment, not silently assumed.
- **`FinboxService.runBureauConnect()`** ports
  `get_finbox_bureauconnect_data()` — passes the lead's CRIF bureau report
  (`CrifBureauLog.api1Response`, raw XML) through to Finbox, extracting
  `REPORT-ID`/`DATE-OF-ISSUE` via a straight port of legacy's
  `common_extract_value_from_xml()` (plain substring splitting, not real
  XML parsing — matches legacy exactly). Found and deliberately did not
  reproduce a legacy variable-shadowing bug: PHP reuses `$user_id` mid
  function for the request's `user_id` field (`base64(pan)`) and then
  reuses it AGAIN for the log's `finbox_br_user_id` audit column, silently
  clobbering the acting user's real id. Since this only affects an audit
  column (not a value that reaches the vendor or a business decision),
  the port stores the real acting user's id instead — documented in the
  method's doc comment, not silently diverged.
- **`FinboxService.runBankConnectUpload()`** ports
  `get_finbox_bank_connect_upload_data()` — uploads the lead's stored
  `BANK STATEMENT` document to Finbox as multipart form data, reusing the
  exact storage-adapter-download + `FormData`/`Blob` pattern
  `BankAnalysisService.upload()` already established for the equivalent
  CartBI flow (this schema has no local filesystem to read legacy's
  `$document_path . $filename` from).
- **`FinboxService.runBankConnectFetch()`** ports
  `get_finbox_bank_connect_fetch_data()` — a GET against Finbox's
  per-entity endpoint. Found and documented (not reproduced) a second
  legacy bug: the driving loop (`call_finbox_bank_connect_fetch_api()`)
  iterates `method_id` 2-9 but `return`s inside its first iteration, so
  every real legacy invocation only ever fetches `LIST_ACCOUNTS`
  regardless of the loop's apparent intent. This port exposes the full
  8-method list as a real `method` parameter instead, defaulting to
  `LIST_ACCOUNTS` to match legacy's actual effective behavior.
- 3 new routes on `FinboxController` (`POST finbox/bureau-connect`,
  `POST finbox/bank-connect/upload`, `POST finbox/bank-connect/fetch`),
  no `FinboxModule` changes needed (`CommonModule`'s `ALL_ENTITIES`
  already covers new entities registered in `database/src/index.ts`).
- `finbox.service.spec.ts` extended with 10 new tests (guard clauses,
  real request-shape assertions, SUCCESS/API_ERROR/NETWORK_ERROR paths)
  on top of the 2 existing device-connect tests — all mocked, no real
  Finbox/vendor calls made.

typecheck/lint/format clean throughout. No live vendor sandbox reachable
in this environment, so none of this was exercised end-to-end against
the real Finbox API — same limitation as every other integrations-api
task.

## Task #114 — Build the full `master_bank_account_status` picker

Closed the "`master_bank_account_status` labels beyond id 1 aren't
seeded" TODO item. The real 5-row label set was confirmed against a real
production export supplied for this purpose (1=`ACCOUNT AND NAME
VERIFIED SUCCESSFULLY`, 2=`ACCOUNT VERIFIED BUT NAME MISMATCH`, 3=`IFSC
CODE WRONG`, 4=`ACCOUNT NUMBER WRONG`, 5=`CUSTOMER BANK OFFLINE` — a
closed set, `bas_name` has a UNIQUE key and the export's AUTO_INCREMENT
confirms exactly 5 rows). Recorded in `BankAccountStatus`'s doc comment;
the raw export itself lives outside this repo and isn't a project
artifact.

Turned out the actual code fix needed no hardcoded label text at all —
every other lookup table in this codebase (`GeographyService`,
`LeadLookupsService`, `DocumentTypesController`) exposes its full active
row set via a plain `find({ where: { isActive: true } })` listing
endpoint; the picker is schema-driven, not enum-driven. The real labels
were only needed to (a) fix the entity's stale "not known" doc comment
and (b) confirm the picker was worth building at all.

- **`VerificationService.listBankAccountStatuses()`** — same shape as
  the existing `listDocumentTypes()`.
- **`VerificationService.setBankAccountStatus(leadId, bankingId,
  accountStatusId)`** — the real status-picker
  `DisbursalController::verifyDisbursalBank()` always had (arbitrary
  `master_bank_account_status` values, not just a verify/unverify
  toggle). Resets sibling bank accounts on the lead back to unverified
  only when the target status is "verified" (id `1`) — legacy's own
  sibling-reset rule, not applied for any other status.
  `verifyBanking()` now delegates to this method instead of duplicating
  the sibling-reset logic, keeping its existing route contract
  unchanged.
- New `GET /bank-account-statuses` route
  (`BankAccountStatusesController`, mirrors `DocumentTypesController`'s
  read-only shape) and `PATCH /leads/:leadId/banking/:bankingId/status`
  (`CustomerBankingController`, new `SetBankAccountStatusDto`).
- New `verification.service.spec.ts` (none existed before) covering
  `listBankAccountStatuses`, `verifyBanking`'s existing sibling-reset
  behavior, and `setBankAccountStatus`'s full branch set (arbitrary
  non-verified status skips the sibling reset; verified status triggers
  it; 404 for an unknown status id; 404 for a banking record not
  belonging to the lead).

typecheck/lint/format clean throughout; `core-api` at 312 passing tests
(up from 305).

## Task #115 — UAT-vs-prod schema diff: close the eNACH TODO item + 6 additive column gaps

A real prod schema export (`prod_finance-crm.sql`, phpMyAdmin/RDS dump, 149
tables, schema-only) was diffed table-by-table against the UAT baseline
(`legacy-schema.sql`, 125 tables) via `mysqldump`/`SHOW CREATE TABLE`
through the real `mysql` CLI (not hand-rolled `information_schema`
queries) — both loaded into local throwaway databases (`finance_crm_uat`,
`finance_crm_prod`) for the comparison, `sed`-normalized to strip MariaDB/MySQL 8
`SHOW CREATE TABLE` formatting noise (redundant per-column `CHARACTER
SET`, `AUTO_INCREMENT` values) before diffing, which cut an initial
108-of-125-tables-differ false positive down to 34 genuinely different
tables. Every finding below was cross-checked against `old-php-files/`
before being acted on — several looked actionable from the DB diff alone
but turned out to have zero legacy business-logic evidence, and were
deliberately left unmapped rather than guessed at (see the "not touched"
list).

**eNACH transaction-schedule TODO item — closed.** Confirmed directly
against both schema exports that `api_enach_transaction_schedule_logs`
(the table `payday_enach_api.php`'s `TRANSACTION_INITIATE` flow logs to,
`aetl_`-prefixed columns) doesn't exist as a real table in either
database — legacy's own `insertTable("api_enach_transaction_schedule_logs",
...)` call is dead/broken code, not a portable target. Prod's schema
shows what actually replaced it: 4 new columns directly on `loan`
(`loan_enach_schedule_amount`/`_date`/`_identifier`/`_status`) that match
the `aetl_requested_amount`/`_deduct_request_date`/`_request_id`/
`_status_id` fields by type and shape — the latest schedule snapshot
lives on the loan record itself instead of a separate log table. Also
added the 2 pre-existing (UAT too) but never-mapped columns
`loan_enach_mandate_registration_no`/`_datetime`.
- `Loan` entity: added all 6 columns (`enachMandateRegistrationNo`,
  `enachMandateDate`, `enachScheduleAmount`, `enachScheduleDate`,
  `enachScheduleIdentifier`, `enachScheduleStatus`). `enachScheduleStatus`
  kept as a raw `number`, not an enum — prod's column carries no DB
  comment, and legacy's `$apiStatusId` convention (1=success; 2/3/4 are 3
  distinct failure causes) isn't fully reproducible with just 2 outcome
  buckets.
- `EnachService.initiateTransaction()` now also looks up the `Loan` by
  `loanNumber` and writes the schedule fields onto it (status collapsed
  to 1=success/2=failure) alongside the existing `EnachLog` write, when a
  matching loan exists. No-ops (log-only) if the loan isn't found yet.
- `enach.service.spec.ts`: 2 new tests (writes onto the matching loan;
  no-op when no loan matches).

**5 safe additive columns — added, all confirmed against real legacy
business logic, not just schema presence:**
- `AccountAggregatorLog.s3Flag` (`s3_flag`, "1=>uploaded") — schema-only,
  no legacy code sets/reads it yet; modeled for forward-compat.
- `CifCustomer.credeauApprovedCustomer` (`cif_credeau_approved_customer`)
  — confirmed against `TaskController.php:2287`'s `(!empty($cam->
  lead_creation_mode) && $cam->lead_creation_mode == 1) ? 1 : NULL`; wired
  into `CamService.assignCifCustomer()`'s new-CIF-creation path (`lead.
  creationMode === 1 ? 1 : null`), with 2 new `cam.service.spec.ts` tests.
- `CreditAnalysisMemo.sanctionLetterRecoveryStatus`
  (`sanction_letter_recovery_status`, "sanction recovered file") —
  schema-only, no legacy code sets/reads it yet.
- `LeadCustomer.aaAadhaarAddressCoordinates`/`aaCurrentEaadhaarAddress` —
  confirmed live in `payday_reverse_geo_code.php`'s `address_to_lat_long`
  (address_type==2 branch) and `payday_aadhaar_digilocker_api.php`
  respectively; a pre-existing UAT-and-prod gap, not prod-only. Wiring the
  first one to a real service turned out to already half-exist — see
  Task #116.
- `BankVerificationLog.httpCode`/`PoiVerificationLog.httpCode`+
  `dualResponse`/`EmailVerificationLog.httpCode` (`bav_http_code`/
  `poi_http_code`/`poi_veri_dual_response`/`ev_http_code`) — schema-only
  diagnostic columns, no legacy code sets/reads them yet.

**Deliberately not touched — flagged for the user instead of guessed at:**
- `BankVerificationProvider`/`PoiVerificationProvider` enum reordering:
  prod's DB comment on both tables inserts Surepass as provider 1,
  shifting Signzy/Digitap down — a real semantic conflict (not just an
  additive change) affecting how existing logged rows would be
  interpreted if the enum values were changed. Needs confirmation against
  live vendor-dispatch code before touching, not a diff-driven blind fix.
- `LeadCustomer.customerDualPanFlag` — real prod column, but zero
  references anywhere in `old-php-files/` or this codebase; left unmapped
  per this entity's own stated convention ("mapped only when proven
  needed elsewhere").
- Index/engine-only differences (extra secondary indexes on `users`/
  `leads`/`customer_banking`, a few `MyISAM`-vs-`InnoDB` tables in prod) —
  performance-tuning info, not correctness gaps.

**Bug found and fixed along the way, not just the diff work:**
`UpiService.createQrRequest()`'s ICICI response decryption
(`icici-rsa.util.ts`'s `decryptFromIcici`) was completely broken on the
Node/OpenSSL version this repo actually runs on (v24) — `privateDecrypt`
with `RSA_PKCS1_PADDING` throws `"RSA_PKCS1_PADDING is no longer
supported for private decryption"` unconditionally (a Bleichenbacher/
Marvin-attack mitigation Node added; `publicEncrypt` with the same
padding constant is unaffected, only decrypt is blocked). Every real
ICICI UPI QR response would have hit this and silently logged
`API_ERROR` in production. Both pre-existing specs
(`icici-rsa.util.spec.ts`, `upi.service.spec.ts`) were failing
deterministically because of this, not flakily — confirmed via
`git stash` that the failures predate this session's changes. Fixed by
decrypting raw (`RSA_NO_PADDING`) and manually stripping the PKCS#1 v1.5
block-type-2 envelope (`00 02 <padding> 00 <data>`) by hand, since Node
no longer offers a padding option that does this unpadding for us. Both
specs pass again; no other spec regressed.

typecheck/lint/format clean throughout; touched suites (`enach.service
.spec.ts`, `cam.service.spec.ts`, `icici-rsa.util.spec.ts`,
`upi.service.spec.ts`) green, full monorepo test run clean (core-api 313,
integrations-api 170, automation-worker 121, reporting-api 185, all
passing). The local `finance_crm_uat`/`finance_crm_prod` comparison databases and
`prod_finance-crm.sql` live outside this repo and weren't committed.

## Task #116 — Two more Task #115 findings closed: Digitap address-to-lat-long write-back + minimal `CustomerProfile` entity

**Digitap `address_to_lat_long` write-back.** Task #115 flagged this as
"not ported" — turned out to be only half true: `AddressLatLongService`
(`address-lat-long` module) already ports the actual Digitap call and
logging (`address_lat_long_api_logs`). The one real gap was legacy's
extra step on a successful `AADHAAR` (`address_type==2`) lookup —
writing the resolved coordinates onto
`lead_customer.aa_aadhaar_address_coordinates` (`"<lat>,<long>"`,
`payday_reverse_geo_code.php` line ~311). `getLatLong()` now also looks
up the `LeadCustomer` by `leadId` and writes this, no-op if none exists
yet. 3 new tests in `address-lat-long.service.spec.ts` (writes on
AADHAAR success, skips on CURRENT, no-op when no lead_customer row
exists).

**Minimal `CustomerProfile` entity.** Task #115 flagged `customer_profile`
(80 columns, the customer-facing app/website self-registration profile —
out of this project's CRM scope) as having no entity and needing a
bigger scoping decision. Checked exactly how the in-scope CRM code
actually uses it (`Task_Model.php`, joined via
`leads.lead_customer_profile_id -> customer_profile.cp_id`) and found it
reads exactly one column, `cp_spouse_mobile` — no need for the full
table. Added a 2-column `CustomerProfile` entity (`id`, `spouseMobile`),
same deliberately-reduced-scope convention as `CifCustomer`, plus
`Lead.customerProfileId`/`customerProfile` (reusing the existing
`lead_customer_profile_id` column, no new column added).

typecheck/lint/format clean throughout; full monorepo test run clean
(core-api 313, integrations-api 173 (up from 170), automation-worker
121, reporting-api 185, all passing).

## Task #117 — Confirm and fix `BankVerificationProvider`/`PoiVerificationProvider` enum values against real prod data

Task #115's UAT-vs-prod schema diff flagged that both tables' real prod
column comments (`1=>Surepass, 2=>DigiTap/Digitap, 3=>Signzy`) disagreed
with the UAT-derived enums then in code, and asked the client for real
log rows to confirm which vendor each id actually is. Client supplied a
prod export (5 `api_poi_verification_logs` rows, 6
`api_bank_account_verification_logs` rows, 2026-08-04) plus confirmed
Surepass is genuinely wired as an automatic instant-failover provider
for both PAN and bank-account verification (alongside Digitap), used
whenever Signzy is down.

Cross-checked the real rows against legacy PHP rather than trusting the
prod column comment alone: every real POI row is provider 3, with
request shape `{panNumber, getStatusInfo:true}` — an exact match for
`TaskController.php`'s hardcoded `sendCurl_request($requestData,
'panextensive', 'Signzy')` call. Every real bank-verification provider-3
row's response carries Signzy's own field names
(`signzyReferenceId`, `bankTransfer`, `auditTrail.nature: "BANK RRN"`),
matching `payday_bank_verification_api_helper.php`'s
`signzy_bank_account_verification_api()`. Both independently confirm
provider 3 = Signzy in both tables, i.e. the prod comment is accurate
and the UAT-derived enums in code were wrong.

Fixed both enums (`database/src/entities/integrations/
poi-verification-log.entity.ts`, `bank-verification-log.entity.ts`) to
`SUREPASS=1, DIGITAP=2, SIGNZY=3`, replacing `PoiVerificationProvider`'s
old `SIGNZY=1, DIGITAP=2` (Surepass wasn't represented at all) and
`BankVerificationProvider`'s old `NUPAY=1, SIGNZY=2, DIGITAP=3`. Grepped
every call site first — both enums are only ever referenced by name
(`PoiVerificationProvider.SIGNZY`, `.DIGITAP`; `BankVerificationProvider
.SIGNZY`), never by raw numeral, so reordering the underlying values
needed no call-site changes. `NUPAY` had zero other references in the
codebase, safe to drop.

2 of the 6 real bank-verification rows had `bav_provider_id = 44`,
outside the 1-3 range entirely, with a double-JSON-encoded request body
(unlike the single-encoded provider-3 rows) and a response whose bank
RRN was the fixed string `SZYON01` rather than a numeric transaction
reference like the real provider-3 rows (`621615006077`). Both rows
were byte-identical (same request/response/timestamp — one call logged
twice). Client confirmed (2026-08-04): provider 44 is a **test** row,
ignore for now — no enum entry needed. `SZYON01` is expected too: it's
a penny-drop transaction reference *from the provider* (Signzy), not a
real bank RRN — explains why it doesn't look like the numeric RRNs on
genuine rows.

## Task #118 — Full code-level legacy-vs-new audit, round 1: Leads (2 confirmed bugs fixed)

Started a systematic, domain-by-domain re-audit of the whole migration —
reading actual legacy PHP function bodies against the actual new
TypeScript, not just confirming a module/route/table with a matching
name exists (client explicitly asked for code-level checking, not
file-name matching). Tracked as a 14-domain checklist (leads, BRE, CAM,
disbursal, collection, verification, users/auth, company/geography/
audit/feedback, search, integrations-api's 30 vendor modules,
automation-worker cron jobs, reporting-api, and two frontend sweeps).
This entry covers round 1: Leads.

**Bug 1 — `lead_entry_date` never set on lead creation.** Legacy sets
`lead_entry_date = date("Y-m-d")` at insert time
(`TaskController.php:3394`, `CronSanctionController.php:261`).
`LeadsService.create()` (`core-api/src/modules/leads/leads.service.ts`)
never set `Lead.leadEntryDate` at all — every lead created through the
new system (manual create and CSV import both route through this one
method) would have it null forever. This is silently severe:
reporting-api's MIS reports/exports filter `lead.leadEntryDate BETWEEN
:from AND :to` in 14+ query sites across `lead-reports.service.ts` and
`lead-exports.service.ts`, and automation-worker's not-contactable-lead
email/SMS jobs filter `leadEntryDate: MoreThanOrEqual(...)` — a NULL
`lead_entry_date` fails all of those silently (no error, just an
invisible lead). Fixed by adding `leadEntryDate: new Date()` to
`create()`.

**Bug 2 — the legacy same-day duplicate-lead reject rule was never
ported, based on a mixed-up justification.** Legacy's
`checkCustomerDedupe($lead_id)` (`LeadModel.class.php:1485`) is real,
live code: if a lead with the same PAN/mobile/email was already entered
*today*, `check_eligibility.php` (lines 87-91, 229-237) auto-rejects the
new one — gated only by `COMP_ENVIRONMENT == 'production'`, invoked live
from `CronSanctionController.php`'s automated-sanction cron (confirmed
in-scope, not the excluded customer-facing `api/` install).
`LeadEligibilityService`'s doc comment claimed this check "references an
undefined `$settlementData` variable... and never actually rejects
anyone" — that's wrong. `$settlementData` belongs to a different,
genuinely-dead check ("Loan Active: Loan is Settled", whose own
data-fetch is separately commented out) that the port correctly still
doesn't implement. `checkCustomerDedupe` doesn't reference
`$settlementData` at all, confirmed by reading its body directly. Fixed
by adding `LeadEligibilityService.hasSameDayDuplicate()` (exact-day match
on `leadEntryDate`, matching legacy's `lead_entry_date = '$current_date'`
equality, not a rolling window), wired in between the reject-streak and
DPD checks to preserve legacy's no-short-circuit "last failing check
wins the recorded reason" ordering. Not porting the
`COMP_ENVIRONMENT == 'production'` gate — no environment-flag concept
exists in this codebase, and like the whitelist-mobile bypass this
codebase already declines to port, it reads as a UAT-testing convenience
rather than a real business rule. The frontend's existing duplicate-lead
warning (`routes/index.tsx`) already covers the human-facing side as a
soft warning — its comment claiming "no legacy equivalent" for a hard
block was also wrong, corrected in the same pass (see frontend
`docs/todo.md`).

**Also fixed in passing**: `hasRecentRejectStreak()`'s 3-month lookback
filtered `createdAt` (`created_on`, the DB row-insert timestamp) instead
of `leadEntryDate` (`lead_entry_date`) — legacy's `checkCustomerRejected`
filters `lead_entry_date`, a distinct nullable column. Same fix now makes
both checks consistent.

Verified everything else touched in Leads (self-allocate role/stage
rules, blacklist check, DPD check, queue role-scoping) against legacy
and found it correctly ported, including some faithfully-preserved
legacy quirks (no-short-circuit rejection-reason overwrite ordering,
`checkRepeatCustomer`'s dead code correctly *not* ported since its
legacy call site is commented out and its body starts with an
unconditional early `return`).

2 new tests (`lead-eligibility.service.spec.ts`: same-day duplicate
rejects with `DUPLICATE LEAD`; `leads.service.spec.ts`: `create()` sets
`leadEntryDate`). Full core-api suite: 315 passing (up from 313).
typecheck/lint/format clean.

## Task #119 — Full code-level legacy-vs-new audit, round 2: BRE (clean) + CAM (3 bugs fixed)

Continuing the round-1 (Task #118) domain-by-domain audit.

**BRE: no bugs found.** Read `bre_rule_engine.php`/`bre_quote_engine.php`
in full against `bre-evaluation.service.ts`. Two things independently
verified as already correct: the FOIR-percent table's unreachable third
tier (`office_email AND residence_type` both present — dead because the
preceding `OR` branch in the same `if/elseif` chain already wins for that
input) is deliberately modeled as only 2 reachable tiers per band, matching
legacy's real behavior; the final-decision aggregation
(`rule_counter == approve_rule_counter` etc.) is a faithful port of
legacy's counting algorithm, not just an equivalent simplification. The
existing doc comments describing 28-of-39 configured rules actually
running, 25 built with real logic, 3 `NOT_APPLICABLE` with named blockers,
were all independently confirmed accurate against the source.

**CAM: 3 real gaps, all fixed in `CamService`/`UpsertCamDto`.**
`CAMController::savePaydayCAMDetails()` (the legacy CAM-save action) has
several server-side hard validations that `CamService.upsert()` had none
of:

1. **`recommendedLoanAmount` had no ₹1,15,000 hard cap** (legacy: "Loan
   recommended cannot be grater then Rs. 1,15,000."). Added `@Max(115000)`
   to `UpsertCamDto`.
2. **No check that `recommendedLoanAmount <= appliedLoanAmount`**
   (`lead.loanAmount`). Added to a new `assertWithinLoanLimits()`.
3. **No check that `recommendedLoanAmount <= eligibleLoanAmount`** — legacy
   computes this from `appraisedMonthlyIncome`/`appraisedObligations` via a
   *flat* `FOIR_PERCENTAGE` constant (`config.php`: NEW=45%, REPEAT=50%),
   the same constant `bre-evaluation.service.ts`'s `finalFoirPercentage`
   rule already uses — **not** the dead city/salary-tiered table from
   `bre_quote_engine()` (that one only feeds a separate BRE rule). Also
   found `appraisedMonthlyIncome`/`appraisedObligations` were optional in
   the DTO even though legacy's form validation requires both — made them
   required (`@IsPositive()`/`@Min(0)` respectively, `obligations` can
   legitimately be zero) since the eligible-loan check needs them anyway.
4. **The `lead_status_id in (5, 6, 11)` gate** (CAM can only be saved
   while the lead is `APPLICATION-INPROCESS`/`APPLICATION-HOLD`/
   `APPLICATION-SEND-BACK`) was missing entirely. Cross-checked the
   mapping from `LEAD_STATUS_CODES`' 1-indexed ordering against two
   already-independently-verified ids elsewhere in this codebase
   (`SYSTEM-REJECT`=8, `REJECT`=9) before trusting it.

**Caught a self-inflicted regression before shipping it**: adding the
status gate directly inside `CamService.upsert()` would have also broken
`SupportService.overrideCamDetail()`, which calls the same method — legacy
has a *separate* support-override action
(`SupportController::updateCAMDetail()`) gated by a much wider status list
(`assertLeadEditableBySupport`'s 15 statuses, including `SANCTION`/
`DISBURSAL-*`), confirmed by reading that legacy function directly (it
doesn't even touch `recommendedLoanAmount`/ROI, only salary-credit/remark
fields). Fixed by adding an `enforceStatusGate` param (default `true`,
`SupportService` passes `false`) — the loan-amount caps still apply
either way since they're real ₹ limits, not a workflow-stage rule.

**Not fixed, moved to `docs/TODO.md`** (bigger scope, needs more room than
this pass): CAM save also doesn't validate mandatory residence/Aadhaar/
office address fields like legacy does; `checkLoanEligibility()`'s
Credeau-approved-amount auto-fill (a narrower UI-convenience default, not
a validation gap) isn't ported.

**Frontend**: corrected `lib/cam.ts`'s pre-existing, already-accurate FOIR
cap comment is untouched (it was already correct) — added a new frontend
`docs/todo.md` item instead, since the CAM form doesn't mark the
newly-required income/obligation fields as required or validate the new
caps client-side before submit (server 400s are still caught by the
existing generic `ApiError` toast handling, so nothing silently breaks).

7 new/updated tests across `cam.service.spec.ts` (status gate, applied-cap,
eligible-cap, REPEAT's wider FOIR, editable-lead test fixture) and
`support.service.spec.ts` (2 new: override bypasses the status gate,
support's own wider gate still applies). Full core-api suite: 321 passing
(up from 315). typecheck/lint/format clean.

## Task #120 — Full code-level legacy-vs-new audit, round 3: Disbursal (1 critical gap found, logged not fixed)

Continuing the domain-by-domain audit (Tasks #118-119). Read
`DisbursalController.php` in full. First identified the real live
disbursal action: two sibling functions exist, `allowDisbursalToBank()`
(older, 332-675) and `allowDisbursalToBank_new()` (746-1114) — confirmed
`_new` is the live one by tracing the actual "Disburse" button in the
canonical `main_js.php` (binds `#allowDisbursalToBank_new`'s click to
`base_url("allowDisbursalToBank_new")`) and `disbursal_new.php` (button
id is `allowDisbursalToBank_new`); the old function has no live view
binding it, dead.

**Critical finding, not fixed this pass**: the real ICICI bank-transfer
API integration that actually moves the loan amount to the customer's
account (`payday_disbursement_icici_helper.php`, 611 lines — request
encryption, the transfer call, status polling) has no equivalent
anywhere in `integrations-api`, and `DisbursalService.disburse()` never
calls out to any vendor — it only flips `Loan.status` to `DISBURSED`
against a client-supplied reference string. Full detail in
`docs/TODO.md` (logged as the top item, not implemented — client-directed
to log and keep auditing rather than build unsupervised, given this is
real money movement with RSA crypto to get exactly right and no sandbox
in this environment to verify against).

Also surfaced but left bundled with the above pending a wiring decision:
`allowDisbursalToBank_new()`'s payment-method/disbursement-bank
consistency checks (`disb_bank_imps_api_active`/`disb_bank_neft_api_active`
vs the chosen method/mode) and its recompute of `tenure`/
`repayment_amount`/`admin_fee` from CAM using the *actual* disbursal date
rather than CAM's originally-planned one.

Confirmed already covered correctly from a prior pass (Task #60,
`docs/COMPLETED.md` above): the `disburse()` re-disbursement guard
(rejects disbursing a non-`PENDING` loan) was a real bug already found
and fixed there, with the broader lifecycle state-machine gap already
correctly flagged as a product decision rather than something to
unilaterally harden.

## Task #121 — Full code-level legacy-vs-new audit, round 4: Collection (2 bugs fixed, 1 critical gap found)

Continuing the domain-by-domain audit (Tasks #118-120). Read
`CollectionController.php` (1904 lines) in full.

**Fixed, `CollectionService`/DTOs:**

1. **No duplicate-payment-reference guard.** Legacy's `UpdatePayment()`
   hard-rejects a new payment if its `refrence_no` already exists
   anywhere in `collection` (a global check, not scoped to the lead —
   `SELECT count(id) FROM collection WHERE refrence_no = '...'`).
   `CollectionService.createPayment()` had none. Added the same check
   (`ConflictException`), and made `CreatePaymentDto.referenceNo`
   required to match legacy's form validation (it was optional).
2. **No double-blacklist guard.** Legacy's `addToBlackList()` blocks
   re-blacklisting an already-blacklisted lead ("Application already
   added in black list."). `CollectionService.blacklistLead()` had no
   check against `lead.isBlacklisted`, so calling it twice would create
   two `CustomerBlacklist` rows for the same lead. Fixed.

**Critical finding, not fixed this pass** (logged in `docs/TODO.md`,
same reasoning as the Task #120 disbursement gap — real money/loan-
closure consequences, needs its own careful port, not something to
build blind mid-audit): legacy's real "verify a collected payment"
action is the `agent == 'AC1'` branch inside `UpdatePayment()` (confirmed
this is the live path, not the separate `verifyCustomerPayment()` — that
one targets a `recovery` table that doesn't exist in either schema dump
in this environment, and its only view caller is an unrelated `Admin/`
panel, so it's dead code). That branch:
- Computes the lead's real repayment totals via `calculateRepaymentAmount()`
  → `CommonComponent::get_loan_repayment_details()` — no equivalent exists
  anywhere in `core-api` (checked the whole `collection` module; the one
  `repaymentAmount` reference is an unrelated SMS/email template
  placeholder, not a real calculation).
- For Full-Payment/Settlement/Pre-closure repayment types, hard-rejects
  verification unless the received amount (plus discount, minus refund)
  *exactly* matches the computed total, with different discount
  allocation (principal/interest/penalty) per repayment type and timing.
- On success, also flips any other same-PAN `UNPAID-REPEAT` lead to
  `REPEAT` — a cross-lead side effect.

`CollectionService.verifyPayment()` does none of this — it unconditionally
accepts any amount. Full detail in `docs/TODO.md`.

**Also logged, not fixed** (smaller, bundled together since they'd
touch overlapping call sites): `CollectionService` has no `LeadFollowup`
repository at all, so blacklist/payment actions don't write to the
shared audit-trail entity the rest of the app uses (legacy does, for
both actions) — `LoanCollectionFollowup` exists but is a separate,
collection-specific entity; and `UpdatePayment()`'s role-conditional
required fields (`scm_remarks` for CO1/CO2/CR2/CAGY/CO4, `date_of_recived`
+`ops_remarks` for AC1) aren't enforced.

2 new tests (duplicate-reference-number rejection, double-blacklist
rejection). Full core-api suite: 323 passing (up from 321).
typecheck/lint/format clean.

## Task #122 — Close out 4 of the 6 TODO items logged in Tasks #119-121 (client-directed)

Client asked to fix every open TODO item, then keep auditing. Implemented
the 4 that are genuinely safe to build without a live vendor sandbox or
unverifiable financial-calculation risk; the 2 CRITICAL items (ICICI
disbursement, payment-verification reconciliation math) stay logged —
see below for why.

**CAM residence + office address validation** (`CamService`). Legacy's
`savePaydayCAMDetails()` requires 3 address blocks; checked each against
the real schema before implementing rather than assuming all 3 map
cleanly:
- Residence (`current_house`/`current_locality`/`res_city_id`/
  `res_state_id`/`cr_residence_pincode`) — all map to existing
  `LeadCustomer` columns (`currentAddressLine1`/`currentAddressLine2`/
  `city`/`state`/`pincode`). Ported.
- Office (`emp_house`/`emp_street`/`office_state_id`/`emp_pincode`) —
  all map to existing `LeadEmployment` columns. Ported.
- Aadhaar address (`aa_current_house`/`aa_current_locality`/
  `aa_current_city_id`/`aa_current_state_id`/`aa_cr_residence_pincode`)
  — none of these columns exist in this schema (`LeadCustomer`'s own doc
  comment already documents this block was deliberately left unmapped
  rather than guessed at). **Not ported** — moved to `docs/TODO.md` as
  its own item, since fixing it means an additive-schema decision, not a
  validation fix.

**CAM Credeau-STP eligible-loan override** (`CamService.
eligibleLoanAmount()`). While implementing this, found it wasn't just a
UI-convenience gap as originally logged — `CamService.
assertWithinLoanLimits()` (Task #119) computes the eligible-loan cap
purely from the flat FOIR% formula, with no Credeau consideration at
all, meaning it could have wrongly *rejected* a legitimate
Credeau-approved amount above the FOIR cap for STP
(`lead.creationMode == 1`) leads — a real validation bug, not just a
missing convenience. Fixed: for a `creationMode == 1` lead with a
Credeau `Approve` decision of at least Rs. 5,000, the eligible cap is
now the Credeau-approved amount instead of the FOIR figure. Legacy's
`credeau_decision`/`credeau_approved_amount` are cached columns on
`lead_customer` with no equivalent in this schema — used the lead's most
recent `CredeauLog` row instead, the same pattern
`AuditService.checkStraightThroughEligibility()` already established.

**Collection `LeadFollowup` audit-trail writes** (`CollectionService.
blacklistLead()`/`createPayment()`). Both now write to the shared
`LeadFollowup` audit trail alongside their own action, matching legacy:
blacklist reuses the lead's *current* status (not a transition) with
remarks naming the reason/executive note; payment creation resolves the
followup's status from the selected repayment type's `MasterStatus` row
(matching legacy's own lookup), not the lead's current status.

**Collection role-conditional required remarks**
(`PAYMENT_REMARKS_REQUIRED_ROLES`/`PAYMENT_VERIFIER_ROLE` in
`collection.service.ts`). `createPayment()` now requires `remarks` for
`CO1`/`CO2`/`CR2`/`CAGY`/`CO4` roles; `verifyPayment()` requires
`closureRemarks` for `AC1`. Legacy's `date_of_recived` requirement for
`AC1` wasn't ported — this port already captures `receivedDate` at
creation time, not re-collected at verify time, so there's nothing to
require it against; a structural difference from legacy's single
combined create+verify endpoint, not a gap.

**Still not implemented, stay logged in `docs/TODO.md`** — re-confirmed
the reasoning holds after re-reading the actual legacy source in full,
not just re-stating the earlier caution:
- **ICICI disbursement** — genuinely blocked on real vendor
  credentials/sandbox access this environment doesn't have; wrong RSA
  crypto here fails silently or worse.
- **Payment-verification reconciliation math** — read
  `LeadModel::getLoanRepaymentDetails()` in full this pass (353 lines,
  previously only partially read). It's substantially riskier than the
  initial surface read suggested: date-bucketed interest/penalty
  formulas (penalty tenure hard-caps at exactly 60 days late regardless
  of how much later payment actually arrives), a full interest→
  principal→penalty amortization waterfall, a dual discount-
  reconciliation path, and — critically — real read-modify-write side
  effects on the `loan` and `credit_analysis_memo` tables on every call.
  No production data or live legacy system exists in this environment to
  verify output against; a subtle transcription error would silently
  corrupt real repayment/discount figures. Confirmed with the client
  this stays logged rather than built blind.

10 new tests across `cam.service.spec.ts` (2 address-validation tests,
1 support-override-skips-address-check test, 3 Credeau-override tests)
and `collection.service.spec.ts` (1 LeadFollowup-on-blacklist test, 3
role-conditional/LeadFollowup-on-payment tests). Full core-api suite:
334 passing (up from 323). typecheck/lint/format clean.

## Task #123 — Full code-level legacy-vs-new audit, round 5: Verification (2 findings, both logged not fixed)

Read `VerificationController.php` (1498 lines) — confirmed every major
vendor integration referenced there has a real module in
`integrations-api`: UAN (`uan-verification`), domain/email
(`domain-email-verification`), face match (`face-match`), Account
Aggregator (`account-aggregator`), OCR (already covered under POI
verification, Task #118's `PoiVerificationService`).

Two findings:
1. **Dual/alternate-PAN fraud check isn't ported** — but legacy's own
   live version (`getPanNoOnDeteail()`) looks internally inconsistent
   with itself (treats `pan_valid_status == 2` as *success*, opposite of
   every other read of that field in the same file) — logged rather than
   silently reproducing or "fixing" possibly-buggy legacy behavior
   without confirming which reading is right. Full detail in
   `docs/TODO.md`.
2. **Bureau-vs-address match is legacy's own dead code** —
   `address_match_verification_api_call()` calls
   `CommonComponent::call_address_match_api()`, which doesn't exist
   anywhere in the codebase (fatal error every time legacy calls it).
   Moved to `docs/EXCLUDED.md`'s dead-code section, not tracked as a
   migration gap.

No code changes this round — both findings are logged, not fixed.

## Task #124 — Full code-level legacy-vs-new audit, round 6: Users/roles/auth (verified correct, 1 policy gap logged)

Read `LoginController.php`'s real credential-check path in full
(`dashboard()`, 182-350) plus its authoritative gate,
`Admin_Model::user_authentication()`.

**Verified correct, not a bug** (worth recording since the first read
looked like a real off-by-one): `AuthService.signIn()`'s lockout check
(`user.failedLoginCount > MAX_FAILED_LOGIN_ATTEMPTS`, i.e. `> 3`) looked
inconsistent against `LoginController.php`'s `user_logins_failed_count
>= 3` checks at first read. Traced it further: those `>= 3` checks are
on the wrong-password failure branch and only decide which *message* to
show (a cosmetic, legacy-only inconsistency in legacy's own two
threshold values) — the actual authoritative block, checked before
password verification even happens, is
`Admin_Model::user_authentication()`'s `user_logins_failed_count > 3`,
which matches the port exactly.

**1 real gap found, logged as a policy decision, not fixed**: legacy's
14-day rolling password-expiry
(`LoginController.php:207-214`) isn't enforced anywhere in
`AuthService`. Not implemented because it's genuinely ambiguous whether
to carry the policy forward (this port already has its own, different
password-reset-required gate for un-migrated legacy MD5 passwords — the
14-day rule might have been a compensating control for MD5's weakness
specifically) and because enforcing it without a frontend "password
expired" recovery screen (confirmed: none exists) would just strand
locked-out staff. Full detail in `docs/TODO.md`.

Confirmed the 5 users/roles/activity-log/role-location admin modules
already built are comprehensive and match `CLAUDE.md`'s stated scope.
`UserController.php`'s own function list (sign_up/dashboard/profile/
sms_details/viewUserInvoice/loginOtp) reads like a different, UMS-
prefixed sub-app bundled into the same CodeIgniter install rather than
this CRM's own user management (same pattern already established for
`PromotionalSmsDndController.php`/`QuotationController.php` in
`docs/EXCLUDED.md`) — not chased further given no evidence it's
in-scope CRM functionality; worth a dedicated look if it turns out to
be real.

No code changes this round.

## Task #125 — Full code-level legacy-vs-new audit, round 7: Search (clean) + integrations-api's 30 vendor modules (1 minor gap)

**Search: verified clean.** `SearchController::filter()` is exactly the
SQL-injection-vulnerable code `CLAUDE.md` already flags (raw string
concatenation across all 9 search fields). `SearchService.search()`
covers all 9 fields (`leadReferenceNo`/`applicationNo`/`mobile`/`email`/
`pancard`/`firstName` prefix-match/`aadhaarNumber`/`loanNumber`/
`cifNumber`) fully parameterized via TypeORM QueryBuilder — injection
genuinely fixed, not just moved. Only difference: sort order (port:
newest-first by id; legacy: oldest-first by created_on) — a reasonable
UX choice, not flagged.

**Integrations-api: cross-referenced every `integration_config.php`
dispatcher case (21 total) against the 29 existing vendor modules**,
rather than reading all 30 module implementations line-by-line (out of
scope for one round given the audit's remaining size). All 21 map to an
existing module except one:

- `URL_SHORTENER_API` (TinyURL) — real, live (used by `AAController.php`/
  `ApiCallBackController.php`/`payday_sms_sent_api.php` to shorten
  repayment/consent links before SMS). No equivalent in the `sms`/
  `account-aggregator` modules. Logged in `docs/TODO.md` — low severity.

Also resolved a false alarm before it became one: `CIBIL_CALL` (a
distinct-looking dispatcher case, direct TransUnion CIBIL API) looked
like it might be a whole separate, unported bureau vendor alongside
CRIF. Checked `CrifBureauLog`'s own doc comment and `BureauType` enum
(`TU=1, CRIF=2`) — the port already correctly models both TU/CIBIL and
CRIF as bureau-type variants of the same Surepass-fronted flow, matching
legacy's real `tbl_cibil_log.cibil_bureau_type` column. Not a gap.

No code changes this round.

## Task #126 — Full code-level legacy-vs-new audit, round 8: automation-worker cron jobs (1 finding, reinforces an existing item)

Cross-referenced all 16 `CronJobs/*.php` controllers against
`automation-worker`'s 19 jobs. Most (`CronCallController`,
`CronMiscellaneousController`, `CronSanctionController`, `Automate*.php`,
`CronReportController`, `Test.php`) were already covered in
`docs/EXCLUDED.md` from a prior audit pass. Spot-checked the previously-
unexamined ones (`CronCollectionController`, `CronController`,
`CronSMSController`, `Reminders`, `Wishes`) — every job found has a
corresponding `automation-worker` job with a doc comment explicitly
citing its legacy source function, several with careful notes on
deliberate deviations (e.g. `not-contactable-lead-sms`'s note that
legacy's copy-pasted +/-30min dedup window is boilerplate, not a real
per-job requirement).

**One real finding**: `CronCollectionController::calculationAllLoans()`
calls `CommonComponent::get_loan_repayment_details()` — the same
353-line calculation engine already found unported during the
Collection audit (Task #121) — for every active loan nightly, to keep
outstanding interest/penalty/principal fields current. No equivalent
job exists. Folded into the existing CRITICAL TODO item rather than
filed separately, since it shares the same root blocker (the
calculation engine itself needs porting and verification first).

`sendNotificationEvery15Min()` (`CronSMSController.php`) reads like
customer-facing-app-adjacent re-engagement messaging
(`getIncopleteJourneyData()` — abandoned application nudges), not
chased further given the strong signal it's out of this CRM's scope,
consistent with other marketing/customer-app exclusions already in
`docs/EXCLUDED.md`.

No code changes this round.

## Task #127 — Full code-level legacy-vs-new audit, round 9: reporting-api (already exhaustively audited, 1 doc-continuity gap found)

`ReportsController.php`/`ExportController.php` are enormous (925 + 3961
lines, ~125 functions). Before attempting a fresh line-by-line pass,
checked what prior work already exists — found the reporting-api build
history in `docs/COMPLETED.md` already contains a report_id-by-report_id
audit far more rigorous than a fresh re-read in this round could
reasonably redo: explicit legacy bugs already found and fixed
(`SanctionStatusWiseDetailedModel`'s silently-ignored date-range filter;
`ExportLoanWaived`'s `loan_status_id=40` schema mismatch), a from-scratch
rebuild of a report whose legacy model method doesn't exist at all
(`SanctionTATReport`), and a cross-cutting finding already flagged
everywhere: `master_statuses`' auto-incremented ids don't match legacy's
numbering past the first ~19 rows, so every status filter resolves by
name, never by assuming a legacy numeric id carries over.

**One gap found**: `REPORTING-QUESTIONS-FOR-CLIENT.md`, referenced
repeatedly in that build history as where several flagged assumptions
were tracked for client/accounts-team review (GST home-state-lookup
assumption, DPD-bucket approximation, no-target-concept for achievement
reports, Tally export stub), no longer exists and none of those specific
items appear in current `docs/TODO.md`/`docs/EXCLUDED.md`. Logged as its
own TODO item rather than guessed at — these are judgment calls that
need the original context, not something to reconstruct from the
codebase.

No code changes this round.

## Task #128 — Full code-level legacy-vs-new audit, round 10: frontend `leads.$leadId.tsx` (2 severe pre-existing bugs fixed, 1 self-inflicted regression caught)

Systematically checked mutation payloads against their backend DTOs
across `leads.$leadId.tsx` (6956 lines, 54 mutations) — the same class
of check that caught the payment-recording bug earlier today. Found and
fixed:

1. **Bank account creation completely broken** —
   `CreateCustomerBankingDto.confirmAccountNumber` is required
   server-side; neither `BankingCard` (the normal verification-section
   form) nor `SupportBankOverrideAction` (the ops-support override) ever
   sent it. Every submission from either form was already failing
   backend validation, independent of anything changed today. Added the
   field to both forms plus client-side match validation
   (account number vs. confirm) — the backend stores both values
   without enforcing they're equal, so the match check is the entire
   point of asking twice.
2. **Self-inflicted regression caught before it shipped separately**:
   `SupportCamOverrideAction` shares `core-api`'s `UpsertCamDto` (the
   full DTO, not a partial type) with the main CAM form. Task #119's
   earlier fix today made `appraisedMonthlyIncome`/`appraisedObligations`
   required — this override form never had those fields at all, so it
   would have started failing the moment that backend change shipped.
   Added both fields.

Spot-checked the other `Support*OverrideAction` forms
(`overrideAllocation`/`overridePersonalDetail`/`overrideEmploymentDetail`)
against their DTOs (`AllocationOverrideDto`/`UpsertLeadCustomerDto`/
`UpsertLeadEmploymentDto`) — all three match field-for-field, no bugs.
Also re-verified `disburseLoan`/`createLoan` against `DisburseLoanDto`/
`CreateLoanDto` — both correct.

## Task #129 — Full code-level legacy-vs-new audit, round 11 (final): lead-creation form (1 fix) — 14-domain audit complete

Checked `routes/index.tsx`'s lead-creation form (the entry point for the
whole workflow) against `CreateLeadDto`. `companyId`/`productId` are
required server-side, but their `form.Field`s had no validators and the
submit button was gated only on `mutation.isPending` — a user could
submit with neither selected, in which case the request would fail
server-side (correctly rejected, not a silent-broken-forever bug like
the payment/banking ones) but only with a late, generic error instead
of an inline one. Added validators matching the existing
`firstName`/`mobile` pattern already in the same form, and switched the
submit button to `form.Subscribe` on `state.canSubmit` (the same
pattern already used elsewhere in `leads.$leadId.tsx`/`login.tsx`/
`forgot-password.tsx`).

This closes the 14-domain, code-level legacy-vs-new audit (Tasks
#118-129) started this session. Summary of everything found across all
14 rounds:

**Real bugs found and fixed** (7): Leads' missing same-day duplicate
check + never-set `lead_entry_date` (Task #118); CAM's missing
loan-amount caps + Credeau-override validation bug (Task #119, #122);
Collection's missing duplicate-payment/double-blacklist guards (Task
#121); frontend payment recording completely broken (`loanNumber` never
sent, Task #122); frontend bank account creation completely broken
(`confirmAccountNumber` never sent, Task #128); frontend CAM override
regression self-caught before separate discovery (Task #128); frontend
lead-creation form missing required-field validation (Task #129).

**Critical gaps found, logged not built** (2, both need real-world
resources this environment doesn't have): the ICICI disbursement
bank-transfer vendor API (Task #120); the loan repayment/interest/
penalty reconciliation engine (Task #121, reinforced by Task #126).

**Smaller gaps logged** (7): CAM Aadhaar-address validation (schema
gap), collection role-conditional remarks, TinyURL link-shortening,
14-day password-expiry policy (product decision needed), dual-PAN
verification (legacy's own logic looks inconsistent),
`REPORTING-QUESTIONS-FOR-CLIENT.md` content-continuity gap.

**Confirmed correct / false alarms resolved** (4): the auth
lockout-threshold check (initially looked like an off-by-one, wasn't);
`CIBIL_CALL` (initially looked like an unported bureau vendor, was
already correctly modeled); Search's SQL-injection fix (genuinely
fixed, not just moved); BRE's FOIR dead-code tier and decision
aggregation (both already faithfully ported).

**Domains verified clean, no findings**: BRE, Company/Audit/Feedback
admin CRUD, Search.

## Task #130 — CAM Aadhaar-address validation, backed by a real eKYC write-back (closes a Task #129 TODO item)

Closed the "CAM save doesn't validate the mandatory Aadhaar-address
block" gap logged in the 14-domain audit. Turned out to be two pieces,
not one — validating without first populating the fields would have
broken every CAM save permanently, since nothing wrote to them:

- **Schema**: mapped 6 real, pre-existing `lead_customer` columns onto
  `LeadCustomer` (`aa_current_house`/`aa_current_locality`/
  `aa_current_landmark`/`aa_cr_residence_pincode`/`aa_current_state_id`/
  `aa_current_city_id` → `aaAddressLine1`/`aaAddressLine2`/`aaLandmark`/
  `aaPincode`/`aaState`/`aaCity`). Confirmed against `legacy-schema.sql`
  (lines 1683-1691) these already exist in the schema — an unmapped-
  column fix, not an additive-migration column.
- **Validation**: `CamService.assertMandatoryAddressFields()`
  (`core-api/src/modules/cam/cam.service.ts`) now also requires the
  Aadhaar-address block on CAM save, matching legacy's
  `CAMController::savePaydayCAMDetails()`.
- **Write-back** (the prerequisite the original TODO entry missed):
  `EkycService.getEaadhaar()` (`integrations-api/src/modules/ekyc/
  ekyc.service.ts`) now calls a new `writeBackAadhaarAddress()` on a
  successful e-Aadhaar fetch, porting the tail end of legacy's
  `payday_aadhaar_digilocker_api.php` handler — splits Signzy's
  `splitAddress` response onto the new fields and resolves state/city
  by looking the returned pincode up against `master_pincode` (the
  existing `Pincode` entity, via its `city`/`city.state` relations),
  same as legacy does, rather than a name-based lookup.

`bun test` across all 6 packages: 335 (core-api) + 176
(integrations-api, incl. 3 new `getEaadhaar` write-back tests) + 121
(automation-worker) + 185 (reporting-api) passing, all green.
Typecheck/lint/format clean across the monorepo.

## Task #131 — Reconstructed `REPORTING-QUESTIONS-FOR-CLIENT.md`

Closed the "file referenced repeatedly but no longer exists" TODO item.
The file was lost during the `apps/*` → flat-root layout change; rebuilt
it at the repo root from the specific approximations/decisions already
documented across `docs/COMPLETED.md`'s reporting-api build history
(Tasks #54/#55), cross-checked against current `reporting-api` source
(code comments and the `COMPANY_HOME_STATE_NAME` env var still match
what's described). Sections: (1) retired/hidden reports skipped
(BOB-partner program + ~10 others, plus the Field/Visit reports that
were later built despite being on this list); (2) 5 reports/exports with
real DB rows but zero legacy code to port from, deliberately not built;
(3) 6 reports rebuilt from broken/stub/dead legacy code (Sanction TAT,
Hourly Collection, Pending Recovery export, Tally export, Hourly
Disbursal By Executive, Lead Conversion); (4) 7 confirmed schema-gap
approximations needing business sign-off (GST home-state split, DPD
bucket proxy, no-target achievement report, dropped CIBIL exclusion,
best-effort loan dump, Legal Notice Log proxy, RM Conveyance proxy).

Not a code change — this is a documentation reconstruction. The
underlying business questions inside the file are still open/unanswered
as far as this repo's history shows; only the "file doesn't exist" gap
is closed.

## Task #132 — TinyURL link-shortening ported as a real `integrations-api` module

Closed the "TinyURL link-shortening isn't ported" TODO item. Ports
`payday_url_shortener_api.php`'s `tinyurl_api_call()` — the only case
`URL_SHORTENER_API` ever dispatches to in `integration_config.php`.
Request/response shape matches legacy exactly (JSON body with a 1-day
`expires_at`, Bearer auth, `data.tiny_url` on `code === 0` success).

- **New entity + table**: `UrlShortenerLog` (`api_url_shortener_logs`,
  `database/src/entities/integrations/url-shortener-log.entity.ts`).
  This table is **not present in `legacy-schema.sql`** — confirmed real
  via the live `insertTable("api_url_shortener_logs", ...)` call in the
  PHP, same class of gap as `master_email_template` (Task #95's note).
  Columns follow the exact `us_*` keys that insert populates; the PK
  name (`us_log_id`) follows this codebase's own `<prefix>_log_id`
  convention since the real PK name isn't visible in any available
  dump — documented as inferred, not confirmed, in the entity's doc
  comment and in `docs/SCHEMA-MAP.md`'s ADOPT-UNVERIFIED table (now 12
  rows). `CREATE TABLE`/`DROP TABLE` hand-added to the single additive
  migration (`InitialSchema1785612347061`), matching the existing
  `api_call_campaign_logs`/`api_whatsapp_logs` pattern — not run against
  a live DB in this sandbox (none reachable here); needs
  `migration:run` at merge/deploy time like every other schema change
  made without local DB access this session.
- **New module**: `integrations-api/src/modules/url-shortener/`
  (service/controller/module/DTO), `POST /url-shortener/shorten`, wired
  into `AppModule`. Credentials via `TINYURL_API_URL`/
  `TINYURL_API_TOKEN` env vars (added to `docs/DEPLOYMENT.md`'s
  integrations-api checklist) — never the real token hardcoded in
  legacy's `integration_config.php`, same policy as every other vendor
  credential found hardcoded in legacy this migration.
- **Not wired into any outbound-message flow** — legacy's real callers
  (`send_docs_upload_link()`'s doc-upload link, the Account Aggregator
  consent-email link) don't have live TS equivalents that send a link
  via SMS/email at all yet (the AA module returns its consent URL to
  the caller; nothing in `core-api`/`automation-worker` forwards it via
  SMS/email today, and the doc-upload-link feature itself isn't ported).
  Wiring TinyURL into a flow that doesn't exist yet would be speculative
  scope-creep, not a real port — the adapter now exists and is callable
  the moment those flows are built, matching this migration's standing
  policy that vendor adapters are real integrations, not mocks, ready
  the moment they're needed.

Verified: `bun run check:schema-map` passes (125 legacy tables + 103
entities covered); typecheck/lint/format clean across the monorepo;
`bun test` — 3 new tests (success, API_ERROR, NETWORK_ERROR paths) bring
integrations-api to 179 passing; full suite still green across all 4
tested packages (335 + 179 + 121 + 185).

## Task #133 — 14-day password expiry enforced + dual-PAN fraud check ported (2 client decisions, 1 new legacy bug found)

Closed both remaining "needs a product decision" TODO items — asked the
client rather than guessing, per their own instruction that ambiguous
items should be flagged, not forced. Both decided: **enforce the 14-day
password rotation but make the window configurable**, and **fix the
dual-PAN interpretation bug (status==1 is success) rather than reproduce
it**.

**Password expiry** — ports `LoginController::dashboard()` (:207-214)'s
rolling reset requirement into `AuthService.signIn()`
(`core-api/src/modules/auth/auth.service.ts`), at the same point in the
flow legacy checks it (after credentials verified, before login stats
are recorded) with the same trigger (unset or >`PASSWORD_EXPIRY_DAYS`
days since last reset, default 14 — env var, per the client's "make it
configurable" answer, added to `docs/DEPLOYMENT.md`). Distinct message
(`PASSWORD_EXPIRED_MESSAGE`) from the existing never-migrated-MD5-user
gate (`PASSWORD_RESET_REQUIRED_MESSAGE`) so the frontend can route both
to "forgot password" without conflating the copy. Frontend
(`frontend/core-crm/src/routes/login.tsx`) catches the distinct message
and redirects to the existing `/forgot-password` OTP flow (already
fully built — no new screen needed) with a toast that relays the
backend's own message text rather than hardcoding "14 days", since the
window is now configurable server-side. 4 new `auth.service.spec.ts`
tests (null `lastPasswordResetAt`, past the window, exactly at the
13-day boundary, a configured `PASSWORD_EXPIRY_DAYS=30`) bring core-api
to 339 passing.

**Dual-PAN fraud check** — while implementing the client's "fix it:
status==1 is success" decision, found a second, more severe bug the
original TODO entry hadn't caught: `VerificationController::
getPanNoOnDeteail()` calls `CommonComponent::call_pan_verification_api
($lead_id, $request_array)`, but that method's real signature
(`components/CommonComponent.php:68`) only takes `$lead_id` — PHP
silently drops the second argument, so `$request_array['dual_pancard']`
never reaches `pan_verifcaition_v3_api_call()` at all. Confirmed via a
full-codebase grep: `dual_pancard` appears in exactly two files, the
verification helper itself and this one (only) caller. Every "dual PAN"
check that has ever run in production has therefore silently
re-verified the lead's own existing PAN against itself, never the
alternate PAN a staff member actually typed in — the feature has never
worked, not just been misread. Built a real, working version instead of
reproducing dead code: `PoiVerificationService.verifyDualPan()`
(`integrations-api/src/modules/poi-verification/poi-verification.service.ts`,
new `POST /poi-verification/dual-pan`) actually queries Signzy for the
alternate PAN, compares the returned name against `LeadCustomer`'s
stored name (ports `common_parse_name()`'s exact tokenization), and
returns `isNameMatch` where `1`/true means matched — the corrected
convention. Logs with `isOtherPancard=true` (`poi_other_pan_veri_flag`),
the one part of this flow that was already correctly modeled. 3 new
`poi-verification.service.spec.ts` tests (name match, name mismatch,
duplicate-PAN rejection) bring integrations-api to 182 passing.

Verified: typecheck/lint/format clean across the monorepo and the
frontend; full `bun test` across all 4 tested backend packages (339 +
182 + 121 + 185, all green) plus frontend `tsc -b` clean.

## Task #134 — Payment-verification loan-closure reconciliation engine (CRITICAL gap closed)

Closed the CRITICAL "payment verification has no loan-closure
reconciliation math" TODO item — real money-math, taken slowly and
deliberately (checked in with the client mid-implementation once the
full scope of legacy's quirks became clear; chose the full-port option
over a validation-only or hold-off scope).

**`CollectionService.calculateRepaymentDetails()`**
(`core-api/src/modules/collection/collection.service.ts`) ports
`CommonComponent::get_loan_repayment_details()` →
`LeadModel::getLoanRepaymentDetails()` (353 lines,
`components/classes/model/LeadModel.class.php:640`) faithfully,
including two genuine legacy quirks rather than "fixing" them:

- **Discount computed twice with the same variable names, so the second
  silently shadows the first.** The first pass (using whatever discount
  is currently stored on `loan`) feeds the principal/interest/penalty
  received-vs-pending split and `total_due_amount`; a second,
  unconditional pass right before the function returns recomputes
  discount from scratch (comparing scheduled repayment against a "real
  interest" scenario) and *that* value is what gets both returned and
  persisted. Kept as distinctly-named locals (`stored*Discount` vs.
  `final*Discount`) to reproduce the *behavior* without reproducing the
  variable-shadowing bug in the TypeScript.
- **Persists back onto `Loan`/`CreditAnalysisMemo` on every call**,
  including read-only preview calls — matches legacy exactly and is
  what keeps a lead's figures self-refreshing without a dedicated cron
  job (see `docs/TODO.md`'s residual item on the still-missing nightly
  `calculationAllLoans()` equivalent).

**Repayment-type ids resolved by name, not hardcoded.** Legacy hardcodes
Full-Payment/Settle/Writeoff as literal `master_status.status_id` 16/17/18
— ids this schema's auto-increment doesn't reliably preserve (the
disbursal-reports audit's established finding). Resolved via
`MasterStatus.name` (`CLOSED`/`SETTLED`/`WRITEOFF`) instead;
`Collection.repaymentTypeId` already stores this schema's real
`MasterStatus.id` (confirmed via `createPayment()`'s existing code).

**Two new, real, pre-existing legacy columns mapped** (confirmed against
`legacy-schema.sql`, not additive): `CreditAnalysisMemo
.advanceInterestAmount` (`cam_advance_interest_amount`) and `Loan
.principalDiscount`/`.interestDiscount`/`.penaltyDiscount`
(`loan_principle_discount_amount`/etc. — `Loan.totalDiscount` was already
mapped, the 3 individual components weren't).

**`CollectionService.verifyPayment()` rewritten** to port the real
`agent == 'AC1'` branch of `CollectionController::UpdatePayment()`
(confirmed live; the separate `verifyCustomerPayment()` is dead code
against a `recovery` table absent from the real schema):

- **Already-verified guard added** (`ConflictException`) — legacy's own
  `!empty($collectionDetails['payment_verification'])` check, missing
  from this port until now; without it a second verification call could
  double-apply the cross-lead REPEAT flip and loan discount writes.
- On approval, resets loan discount to 0, recomputes via
  `calculateRepaymentDetails()`, then hard-rejects the verification
  (before anything is persisted) unless the amount reconciles — the exact
  formula differs by type and by whether verification happens before or
  after the scheduled repayment date:
  - **Full-Payment (`CLOSED`) pre-due-date**: `receivedAmount + discount -
    refund` must exactly equal the total repayment (or a real-interest
    variant) or it rejects with "Loan closure amount(s) is incorrect."
  - **Full-Payment post-due-date**: legacy has **no rejection at all**
    even when the amount doesn't reconcile — the `else { throw }` is
    commented out in the real source. Replicated as-is, not "fixed" —
    flagged in code comments so it doesn't read as an oversight.
  - **Settle (`SETTLED`)**: rejects if verified before the repayment
    date; otherwise requires an exact match and splits the discount
    across principal/penalty.
  - **Writeoff (`WRITEOFF`)**: only a date check, no amount
    reconciliation at all.
  - `refund` is subtracted only in the Full-Payment pre-due-date case —
    nowhere else. A real legacy quirk, not an omission here.
- On approval, also transitions the lead's status to the payment's own
  repayment type, inserts a `LeadFollowup`, and flips the single most
  recent *other* lead with the same PAN still marked `UNPAID-REPEAT` to
  `REPEAT` — all three previously completely missing, not just the
  amount validation the TODO entry's headline focused on. This applies
  for *every* approved payment type, not just closures (matches legacy:
  the reset+recompute+status-transition block runs on any
  `payment_verification == 1`, only the amount hard-reject is
  type-specific).
- New preview endpoint `GET leads/:leadId/payments/repayment-details`
  (`PaymentsController`) exposes `calculateRepaymentDetails()` directly
  — the same figures `verifyPayment()` validates against, matching
  legacy's own `repaymentLoanDetails()` preview action.

**Not ported**: the NOC-letter-sending side effect
(`sent_loan_closed_noc_letter()`) — no NOC-generation infrastructure
exists anywhere in this codebase yet, a separate unported feature. The
nightly `calculationAllLoans()` cron-job equivalent in
`automation-worker` is also not built this pass — logged as a smaller
residual follow-up in `docs/TODO.md` now that the underlying engine is
built and documented.

Verified: 11 new tests (`collection.service.spec.ts`) — a hand-computed,
gate-fail-vs-gate-pass pair for `calculateRepaymentDetails()` (verified
against manually worked arithmetic, not just shape assertions) plus 8
`verifyPayment()` reconciliation scenarios (pre/post-due-date Full
Payment, Settle date/amount rejects, Settle discount split, Writeoff
date gate, already-verified guard, cross-lead REPEAT flip) using
`jest.spyOn` to isolate the branching logic from the full calculation.
core-api: 339 → 350 passing. `bun run check:schema-map` passes (125
legacy tables + 103 entities). Full monorepo `bun test`: 350 + 182 + 121
+ 185, all green; typecheck/lint/format clean throughout.

## Task #135 — Nightly loan-outstanding recompute cron job (closes Task #134's residual follow-up)

Closed the smaller residual gap left open by Task #134: legacy's
`CronCollectionController::calculationAllLoans()`, which nightly
recomputes every disbursed loan's outstanding interest/principal/penalty
via `get_loan_repayment_details()` even when no payment event happens
that day (interest/penalty accrue purely with time).

**Extracted the calculation into `@finance-crm/common`** rather than duplicating
Task #134's ~250-line reconciliation logic a second time:
`calculateLoanRepayment()` (`common/src/loan-repayment/
calculate-loan-repayment.ts`) is the pure computation (no DB I/O, all
inputs passed in, including an injectable `now` for deterministic
tests) — `core-api`'s `CollectionService.calculateRepaymentDetails()`
was refactored to call it (fetch entities, build the input, call the
function, persist the result) rather than compute inline, with zero
behavior change (all 38 existing `collection.service.spec.ts` tests
still pass unmodified against the refactor). `automation-worker`'s new
`LoanOutstandingRecomputeService` calls the exact same function — its
own DB-fetching glue (resolving CLOSED/SETTLED/WRITEOFF status ids by
name, finding the first verified terminal collection row, summing
verified receipts) mirrors `CollectionService`'s, since
`automation-worker` reads/writes the shared database directly rather
than calling `core-api` over HTTP (this repo's standing architecture).
Precedent for this pure-function-in-`@finance-crm/common` pattern already
existed (`adjustForNonWorkingDay()`).

**`automation-worker/src/jobs/loan-outstanding-recompute/`**: loops
every `Loan` currently `status === 'DISBURSED'`, recomputes and persists
each via the shared function, catching and logging per-loan failures so
one bad record doesn't abort the whole nightly run (matches the
established per-lead try/catch pattern already used by
`RepaymentReminderSmsService` and siblings). **Disabled by default**
(`CRON_EXPRESSION = 'disabled'`) — no real production crontab
entry/time was confirmed for `calculationAllLoans()` during the audit
that found this gap (Task #126), only that legacy runs it nightly;
built and tested, off everywhere unless `CRON_LOAN_OUTSTANDING_RECOMPUTE`
is set to a real cron expression, same convention as every other
unconfirmed-schedule job in this codebase (e.g. `poi-father-name-sync`).

**`common` package gained its first test suite** — it never had one
before (only `typecheck`). Added a `tsconfig.build.json` excluding
`**/*spec.ts` from typecheck (matching every other service's existing
convention) since the plain `tsconfig.json` has no jest/bun test
ambient types configured.

Verified: 6 new `common` tests (`calculate-loan-repayment.spec.ts` —
gate-fail, CAM-update-independent-of-gate, missing-date throw, the same
hand-computed full-reconciliation scenario as Task #134, CLOSED-status
zeroing, and the auto-discount detection branch with exact hand-worked
numbers) plus 6 new `automation-worker` tests
(`loan-outstanding-recompute.service.spec.ts` — schedule registration,
empty-loan-set no-op, query shape, the same hand-computed scenario,
per-loan failure isolation, gate-fail skipping the collection query).
Full monorepo `bun test`: common 6, core-api 350 (unchanged — refactor
only), integrations-api 182, automation-worker 121 → 127, reporting-api
185, all green; typecheck/lint/format clean throughout.

## Task #136 — Curated Collection repayment-type lookup (`?stage=` filter on `GET /master-statuses`)

Closes a frontend TODO item: the payment-recording "Repayment type"
dropdown (`frontend/core-crm/src/routes/leads.$leadId.tsx`'s
`PaymentsCard`) listed every `MasterStatus` row instead of a curated
repayment-type subset, since no dedicated lookup endpoint existed.
Traced legacy's real dropdown source
(`application/views/Collection/repayment.php`, populated from
`CollectionController::paymentHistory()`) rather than guessing at a
hardcoded name list: legacy filters `master_status` by
`status_stage = 'S16' AND status_active = 1 AND status_deleted = 0` —
a stage-code filter, not a fixed set of status names.

`LeadLookupsService.listMasterStatuses()` (`core-api`) now takes an
optional `stage` param, filtering by `MasterStatus.stageCode` (plus
`isDeleted: false`, matching legacy's full WHERE clause — the existing
unfiltered call path is untouched, still just `isActive: true`, to
avoid changing behavior for its other callers). `GET /master-statuses`
exposes it as `?stage=S16`. Frontend's `listMasterStatuses()`
(`lib/lookups.ts`) takes the same optional param;
`PaymentsCard`'s repayment-type dropdown now calls
`listMasterStatuses('S16')` instead of the unfiltered list. The other 6
call sites of `listMasterStatuses` across the frontend (lead status
change, loans/sanctions/collections/rejected-leads filters) are
unaffected — updated their `queryFn` to `() => listMasterStatuses()`
only because the function gained a parameter (TanStack Query was
passing its query context as that argument otherwise), not because
their behavior changed.

Verified: 1 new `lead-lookups.service.spec.ts` test (stage filter
applies `isDeleted: false` + `stageCode`); core-api 350 → 351 passing.
Frontend `tsc -b` clean.

## Task #137 — Role-gate the workflow endpoints that had none, and fix a guard bug that would've blocked admins from any of them

Cross-checked the client's 17-role permission document against every
place role codes actually control access in the new backend (not just
where they're mentioned in comments). Found role-based access control
was applied consistently to admin/config endpoints (`SA`/`CA`
everywhere) and a few modules (audit: `AM`/`AH`/`AU`; field-verification/
collection-buckets: `CO1`/`CO2`/`CO3`/`CFE1`), but **the core
loan-lifecycle stage-gated actions the client's document describes in
detail had zero backend role restriction**: `CamController`'s
upsert/sanction/send-back, `LoanController`'s disburse/settle/close/
write-off, and `PaymentsController`'s create/verify. The frontend hides
the relevant buttons/forms from the wrong role, but nothing stopped an
authenticated user from calling any of these directly by leadId,
bypassing the intended workflow entirely.

- **`CamController`**: `upsert`/`sanction`/`send-back` now
  `@Roles('CR2', 'CR3')` — matches the frontend's existing
  `useHasRole('CR2', 'CR3')` gate on the CAM section
  (`routes/leads.$leadId.tsx`). `GET` (view) stays open — audit,
  disbursal, and collections all need to read CAM data downstream.
- **`LoanController`**: `create`/`disburse`/the transaction-log
  endpoints now `@Roles('DS1', 'DS2')`, matching `LeadsService`'s
  existing `SELF_ALLOCATE_RULES` for the disbursal stage.
  **`settle`/`close`/`write-off` now `@Roles('SA', 'CA')`** —
  deliberately more restrictive than DS1/DS2, because these three
  endpoints flip the loan status directly with **zero reconciliation
  check**, completely bypassing the loan-closure validation
  `verifyPayment()` now enforces (Task #134). That's not something this
  pass fixed architecturally (they may be a legitimate admin override
  path, or dead/superseded by the payment-verification flow — genuinely
  unclear without asking whoever built them originally), but restricting
  them to admin-only at least closes the "any authenticated user can
  bypass reconciliation" hole. Flagged in each endpoint's own doc
  comment so it doesn't read as an oversight later.
- **`PaymentsController`**: `create` now
  `@Roles(...PAYMENT_REMARKS_REQUIRED_ROLES)` (`CO1`/`CO2`/`CR2`/
  `CAGY`/`CO4`) and `verify` now `@Roles(PAYMENT_VERIFIER_ROLE)`
  (`AC1`) — both constants already existed in `CollectionService`
  (ported from `UpdatePayment()`'s real `agent ==` branches), just
  weren't exported/used to actually gate the endpoint; now exported and
  reused instead of a second, separately-maintained role list.
- **`RolesGuard`** (`@finance-crm/common`) had a real bug independent of the
  above: it required an *exact* match against a handler's `@Roles(...)`
  list with no admin override, so `@Roles('AM', 'AH')`-style guards
  (already used by the audit module) would reject `SA`/`CA` outright —
  contradicting both the client's own documentation ("Client Admin...
  can perform all actions available to every other role") and this
  codebase's own established pattern (`LeadsService`'s self-allocate
  logic already carries a code comment citing legacy's universal
  `$label == 'X' || $label == 'CA' || $label == 'SA'` check). Fixed at
  the guard level — `SA`/`CA` now always pass any `@Roles(...)` check —
  rather than repeating `'SA', 'CA'` in every list, so this also
  retroactively fixes the audit module's existing gate for free. An
  endpoint that should genuinely be admin-only still works correctly as
  `@Roles('SA', 'CA')` — everyone else is rejected, admins pass via
  either path. `RolesGuard` had no test coverage before this; added one
  (`roles.guard.spec.ts`, 5 tests) since this is exactly the kind of
  logic a silent regression shouldn't be able to slip through again.
- **Frontend parity fix**: `useHasRole()` (`lib/roles.ts`) had the exact
  same gap — an `SA`/`CA` admin would now be correctly *permitted* by
  the backend to, say, save a CAM, but the frontend would still hide the
  form from them because their literal role isn't in that form's
  specific allowlist. Same fix, same reasoning, mirrored client-side.

**Also found, not fixed — flagged for the client to confirm, not
guessed at**: `CustomerBlacklistController`, `CollectionVisitsController`,
`CollectionFollowupsController`, and `CustomerBankingController` (penny-drop/
bank-status verification) have the same "zero role restriction" gap.
Unlike the three fixed above, legacy's `CollectionController.php` doesn't
gate these by `agent ==` either (same general looseness as most of
legacy outside the payment-recording branch), so there's no real legacy
role check to port — assigning `CO1`/`CO2`/`CO3` (or `DS1`/`DS2` for
banking) here would be a guess, not a verified port. Left open rather
than risk locking out a legitimate workflow with the wrong role list.

**Also found, not fixed — a likely documentation typo, not a code
issue**: the client's own 17-role document lists item 6 as `AC2 -
Account Head` with a description that exactly matches what the real
code's `AH` role gates (final audit approval, right before eSign/
sanction) — not what item 17, later in the same document, describes for
the *actual* `AC2` (finance/accounting). Also found in the client's
role doc but never referenced anywhere in this codebase: `AC2`, `ST`,
`OL`, `CC`, `MR`. Found in this codebase but not in the client's role
document: `AU`, `CFE1`, `CAGY`.

Verified: `common` 11 → 16 passing (5 new `RolesGuard` tests);
`core-api` 351 passing unchanged (role decorators don't affect
service-level unit tests, which call services directly, bypassing the
guard); full monorepo `bun test` and `tsc -b` (frontend) both clean.

## Task #138 — HMAC-authenticate service-to-service calls (closes a real, possibly-live auth gap)

User-requested hardening: the only real inter-service HTTP traffic in
this system — `core-api`'s and `automation-worker`'s `IntegrationsApiClient`
calling `integrations-api` — carried zero authentication. Worse than
just "unsafe": `integrations-api` has had a global `JwtAuthGuard`
(cookie-only JWT extraction, no `Authorization: Bearer` support) since
`app.module.ts` started importing `SharedAuthModule`, and a
server-to-server axios call never carries a session cookie — so these
calls to any non-`@Public()` route (27 of 34 controllers, including
`/sms/send`, which is actually called from `RepaymentReminderSmsService`
et al.) may have been silently 401ing in production, not just
"unauthenticated but working." `core-api`'s copy of the client even
carried a stale comment claiming `integrations-api` had no guard at all.

**`common/src/auth/internal-service-auth.util.ts`** (new) — HMAC-SHA256
over `METHOD.PATHNAME.TIMESTAMP.<raw body bytes>`, same primitives
(`createHmac`, `timingSafeEqual`) as `razorpay-webhook.util.ts`'s
vendor-signature verification, the closest existing precedent. Binding
method + pathname (not just timestamp + body) closes cross-endpoint/
cross-method replay for free. 5-minute replay window (fixed constant,
not configurable — this is a trusted-internal-network scenario, not a
public-API rate limit), checked symmetrically for clock skew in both
directions.

**`JwtAuthGuard`** (`common/src/auth/guards/jwt-auth.guard.ts`) now
checks for `x-internal-signature`/`x-internal-timestamp` headers before
falling through to the normal cookie-JWT Passport check — a second
valid path, not a bypass of the first; every existing cookie-based
request is unaffected. A valid internal signature sets `request.user`
to a synthetic `{ sub: 0, email: 'system@internal', roles: ['SYSTEM'] }`
identity, deliberately **not** added to `RolesGuard`'s `SA`/`CA`
admin-override list — a route that later gains `@Roles(...)` should
reject an internal caller by default, not silently inherit admin
rights. Fails closed (401, not 500) when `INTERNAL_SERVICE_SECRET`
isn't configured — `reporting-api`, which is never a real receiver, can
safely leave it unset.

**Consolidated the two near-duplicate `IntegrationsApiClient` classes**
(`core-api`, `automation-worker`) into `common/src/http/
integrations-api-client.ts` — one signing implementation instead of two
that had already drifted (the stale comment). Signs the *exact* bytes
sent: pre-serializes the body to a string once, signs that buffer, then
sends the string (not the object) as the axios payload with an explicit
`content-type: application/json` header, so `integrations-api`'s
`request.rawBody` (already captured via `rawBody: true` in its
`main.ts`, for the Razorpay webhook) is guaranteed byte-identical to
what was signed — the single most fragile part of this design if
skipped. Repointed ~18 import sites (8 automation-worker job service/
module pairs, `core-api`'s `LeadsModule`/`LeadsService`) to `@finance-crm/common`;
deleted both old files. `INTERNAL_SERVICE_SECRET` — one shared secret
across all 3 services involved (this is authenticating "is this a
legit internal caller," not per-caller authorization; matches the
existing `JWT_ACCESS_SECRET=<same value as core-api>` precedent).

Verified: 9 new `internal-service-auth.util.spec.ts` tests (round-trip,
tampered body/path/method, wrong secret, missing/malformed headers,
stale/future timestamp) + 5 new `jwt-auth.guard.spec.ts` tests
(`@Public()` bypass, valid/invalid internal signature, unset-secret
fail-closed, cookie-path fallthrough) + 2 new `integrations-api-client.spec.ts`
tests (signed POST/GET verify against the real util). `common`
16 → 27 passing; `core-api` 351 passing unchanged; `automation-worker`
127 passing unchanged; full monorepo `bun test`/`typecheck`/lint clean.
Not live-verified end-to-end against a real running `integrations-api`
(no local MySQL instance in this sandbox — same standing limitation as
every other entry in this doc) — the guard/util/client unit tests are
the DB-free proof the signing round-trip is correct in isolation.

## Task #139 — 3-stage config/secrets resolution chain (AWS Secrets Manager / SSM Parameter Store -> .env -> crm_settings DB), cron schedules wired up as the first DB-sourced consumer

User-requested, alongside Task #138: config and secrets across all 4
NestJS services (`core-api`, `integrations-api`, `reporting-api`,
`automation-worker`) should try AWS first (via IAM role, no explicit
access keys), fall back to the existing `.env` file, and — for "other
configurable settings," explicitly including cron-job schedules — read
from a new shared DB table instead of only env vars.

**`database`**: new `CrmSetting` entity (`entities/settings/crm-setting.entity.ts`,
`NEW` per `docs/SCHEMA-MAP.md`, extends `BaseEntity`) backing a `crm_settings`
table — `serviceName` (`''` = shared/global, else scopes a row to one of
the 4 service names) + `settingKey`/`settingValue` (not `key`/`value` —
`key` is a MySQL reserved word) under a `@Unique(['serviceName',
'settingKey'])` constraint. `CREATE TABLE`/`DROP TABLE` appended to the
single hand-maintained migration
(`1785612347061-InitialSchema.ts`, reverse order in `down()` per
convention); `docs/SCHEMA-MAP.md`'s NEW-table section now covers 8 tables.

**`common/src/crm-settings/`** — `CrmSettingsService` (`get(serviceName,
key)`, `getAllForService(serviceName)`, both reading `crm_settings` via
`@InjectRepository`), with global (`''`) rows overridden by
service-specific rows on a key clash. `CrmSettingsModule` wraps it with
`TypeOrmModule.forFeature([CrmSetting])`. Required adding
`@nestjs/typeorm`/`@finance-crm/database`/`mysql2` to `common/package.json` —
previously only the 4 services themselves talked to the DB, `common` was
DB-agnostic.

**`common/src/config/aws-secrets-loader.ts`** + **`aws-ssm-loader.ts`**
(new) — `ConfigModule.forRoot({ load: [...] })` factories, one per AWS
source. Both use the AWS SDK's default credential provider chain (no
explicit `accessKeyId`/`secretAccessKey`, same pattern as
`S3StorageAdapter` — resolves to the EC2 instance profile in production)
and both resolve to `{}` rather than throwing on any failure (unset env
var, no credentials, secret/parameter not found, malformed JSON) — AWS
being unavailable is the expected local-dev path, not an error that
should block boot. `awsSecretsLoader` reads one JSON secret
(`AWS_SECRETS_MANAGER_SECRET_NAME`) as a flat key/value object;
`awsSsmLoader` reads a path recursively (`AWS_SSM_PARAMETER_PATH`,
paginated via `NextToken`, `WithDecryption: true` for `SecureString`
params) and strips the path prefix from each parameter name to get the
key. Confirmed via `@nestjs/config`'s source
(`ConfigService.get()`/`config.module.ts`) that `.env` is parsed into
`process.env` *before* `load` factories run, and that `load`-returned
values are checked *before* `process.env` in `ConfigService.get()` — so
wiring `load: [awsSsmLoader, awsSecretsLoader]` (later entries win on a
key clash, Secrets Manager listed last) gets the full 3-stage precedence
for free, no manual bootstrap ordering needed. Wired into all 4 services'
`app.module.ts`.

**`ConfigurableJobRunner`** (`common/src/jobs/configurable-job-runner.ts`)
extended: `schedule()` now checks a `crm_settings`-sourced override
(`dbOverrides` map, same `CRON_<NAME>` key convention as the existing env
var) before the `CRON_<NAME>` env var, before the hardcoded default — DB
wins, env var is now a fallback rather than the top override. Stays
synchronous (every job's `onModuleInit()` calls `.schedule()` directly)
by having `JobRunnerModule`'s `JOB_RUNNER` factory provider bulk-load all
DB overrides *once*, at construction time, via a now-`async` factory
(NestJS supports async factory providers natively) — `CrmSettingsService
.getAllForService(SERVICE_NAME)`, `SERVICE_NAME` defaulting to
`automation-worker` (the only consumer of `JobRunnerModule` today). A
query failure there (e.g. migration not yet run in some environment)
logs a warning and falls back to no DB overrides rather than blocking
boot — only cron *timing* depends on it, not the DB connection the rest
of `automation-worker` already hard-requires.

**Scope decision (confirmed with user via 3 clarifying questions):**
`CrmSettingsService` is built as a general-purpose capability, but only
cron-job schedules are actually wired up to read from it — the ~130
existing `config.get()` call sites across the 4 services are untouched.
Reload semantics are restart-only (no polling/live-reload) — a changed
DB row, secret, or parameter takes effect on next boot, matching how
changing an env var already worked. Consolidated into `@finance-crm/common`
rather than duplicated per-service, same reasoning as Task #138's
`IntegrationsApiClient` consolidation.

**Docs**: `CLAUDE.md` gets a new architecture-decisions bullet for the
3-stage chain (don't relitigate the restart-only/cron-only scope without
a new explicit decision). `docs/DEPLOYMENT.md` — §6.1 corrected (S3 is
no longer the only AWS-native integration), §6.2's IAM commands gain a
`secretsmanager:GetSecretValue`/`ssm:GetParametersByPath` statement
(scoped to this deployment's specific secret/path, not `*`) for all 4
NestJS-service roles (not `gateway`, which is pure nginx), §7.1-7.4 each
gain `AWS_SECRETS_MANAGER_SECRET_NAME`/`AWS_SSM_PARAMETER_PATH` (both
optional), §7.4 additionally gains `SERVICE_NAME`, §7.6's table gains 3
rows. `.env.example` gains the same 3 vars with explanatory comments.

Verified: `common` 27 → 43 passing (4 new `crm-settings.service.spec.ts`,
4 new `aws-secrets-loader.spec.ts`, 4 new `aws-ssm-loader.spec.ts`, 4 new
`configurable-job-runner.spec.ts` — this file had no spec before); all 4
services typecheck clean after the `app.module.ts` wiring change;
`database`'s `check:schema-map` confirms `docs/SCHEMA-MAP.md` still
covers all 125 legacy tables and all 104 entities; full monorepo
`bun test` (888 passing across `common`/`core-api`/`integrations-api`/
`automation-worker`/`reporting-api` combined, 0 failing) / `typecheck` /
`lint` / `format` clean. Not live-verified against a real running AWS
Secrets Manager, SSM Parameter Store, or MySQL instance (no AWS
credentials or local MySQL in this sandbox — same standing limitation as
every other entry in this doc); the loader/service/runner unit tests
mock the AWS SDK clients and the TypeORM repository respectively, so
they're the DB/AWS-free proof the resolution logic itself is correct.

## Task #140 — Replace the TypeORM migration with plain numbered `.sql` files, runnable via CLI or pasted directly into phpMyAdmin

User-requested: the single hand-maintained TypeORM migration
(`database/src/migrations/1785612347061-InitialSchema.ts`) required this
repo's own Bun/TypeORM tooling to run — no good for environments (shared
hosting, UAT) where the only real access is phpMyAdmin, not a direct DB
connection. Replaced entirely with `database/sql-migrations/`: `init.sql`
(the 149-table legacy baseline, structure only, extracted from a real
`dev` schema export — confirmed byte-for-byte structurally identical to
`prod`) plus `m1.sql`/`m1.down.sql` (hand-translated from the old
migration's `up()`/`down()`, one statement per line, exact
statement-for-statement reverse pairs). Every file is plain, valid SQL —
no TypeORM/TypeScript dependency to run any of them.

**`database/src/run-sql-migrations.ts`** (new, `bun run migrate`) — CLI
flags: `--init` (baseline only, onto an empty DB), `--mN` (m1 through mN),
`--mA-mB` (an explicit range, e.g. resume from `--m2-m4` without
re-running `m1`), no flags defaults to `--m1`. No tracking table records
what's already applied — the operator is trusted to pass the right range;
re-running an already-applied file fails loudly (`ADD COLUMN`/`CREATE
TABLE` on something that exists), not a silent no-op.

**Revert-on-failure, and why it can only be best-effort**: MySQL
auto-commits every DDL statement even inside `START TRANSACTION`/`COMMIT`
— there is no real `ROLLBACK` for schema changes, unlike Postgres. The
closest real equivalent: each `mN.sql` has a paired `mN.down.sql` with the
exact same statement count in exactly reversed order. If statement J in
`mN.sql` fails, the runner runs the last (J-1) statements of `mN.down.sql`
(their stored order is already the correct reverse of the successful
prefix — see that file's header for the proof), then does the same in
reverse file order for every earlier `mI.sql` this same invocation had
already fully applied — restoring the database to its state before this
invocation started. Cannot undo a previous, separate invocation. `init.sql`
has no down file at all — it's a one-time bootstrap onto an empty
database, so the correct recovery from a partial failure is dropping and
recreating that database, not statement-by-statement rewind.

**Statement parser** (`parseStatements()`) has to do real work, not a
naive `sql.split(';')`: real legacy `COMMENT` strings contain embedded
semicolons (e.g. `'1=>salaried;2=>self-employed'`), and `init.sql` has one
real `DELIMITER $$ ... CREATE TRIGGER ... END$$ DELIMITER ;` block
(phpMyAdmin's mechanism for a trigger body's own internal semicolons,
`DELIMITER` itself being a client-side-only directive, not real SQL). The
parser tracks quote state (single/double/backtick, with `''`-doubling and
backslash escapes) and delimiter state (starts at `;`, a `DELIMITER
<token>` line switches it until the next one) and only splits on the
current delimiter outside a quote.

**Two real bugs found via testing before deleting the old migration**
(user explicitly required real-database verification first, including
against real UAT/dev data — not just typecheck/lint): (1) the naive
semicolon splitter fragmented `init.sql`'s `COMMENT '...;...'` columns
into broken partial statements, and didn't understand `DELIMITER` at
all — fixed by the parser rewrite above. (2) `m1.sql`'s `ADD PRIMARY KEY`
for `tbl_verification` was stale — a real prod schema export confirms
that table already has `PRIMARY KEY (verify_id)` with `AUTO_INCREMENT`;
`additive-schema-changes.ts`'s claim it was one of the tables with no
primary key was simply wrong (or stopped being true before it was last
verified). Removed from `m1.sql`/`m1.down.sql` (30 statements each,
matching) and from `additive-schema-changes.ts`'s `ADDED_PRIMARY_KEYS`.

Verified end-to-end against a real local MySQL 9.7.1 instance (root
password set to a real value, not `--skip-grant-tables`): `--init` runs
clean (451 statements, all 149 tables including the trigger); `m1`
applies clean on top (30/30); `bun run check:drift` against the result
reports **zero drift — 1423 columns across 102 tables match** (the only
3 "not in" entries are pre-existing, already-known unconverted entities,
unrelated to this work); re-running `check:drift` against a database
loaded from the real `dev.sql` file directly (not the extracted
`init.sql`) produces the identical 1423/102 result, confirming the
extraction wasn't corrupted. Revert-on-failure independently confirmed
twice: once via a fork injecting a failure into the (still-buggy)
31-statement version, and again by hand after both fixes — a clean
duplicate-table injection at statement 18/31 was correctly detected,
reverted (17 statements undone in exact reverse order), and
`information_schema` confirmed the database was back to exactly 149
tables with zero leftover columns/tables afterward. Also verified
against the real `uat.sql` (16MB, real customer data — row counts only,
never row content): `m1.sql` ran end-to-end against real UAT data
(including the `ADD PRIMARY KEY` statements — additive-schema-changes.ts
had flagged these as needing re-verification against production/real
data, now done), with identical row counts on all 9 touched tables
before and after, confirming additive-only with no data loss. Old
migration file and its `migration:generate`/`migration:run`/
`migration:revert` scripts deleted only after all of the above passed —
`ts-node` dropped from `database/package.json` (was solely for those
scripts). `docs/DETAILS.md`, `docs/DEPLOYMENT.md` §4.6, and
`docs/SCHEMA-MAP.md`'s drift-check pointer (itself already stale,
referencing `typeorm migration:generate` instead of the actual
`check-drift.ts` tool) updated to match; `CLAUDE.md` gets a new
architecture-decisions bullet.

## Task #141 — Make every m1.sql item idempotent (closes the UAT/prod structural gap Task #140 left as a manual step)

Follow-up to Task #140: that task's `tbl_verification` fix removed the
stale `ADD PRIMARY KEY` statement entirely, leaving UAT — the one real
environment actually missing that primary key — with no way to get it
except a documented manual one-off `ALTER TABLE`. User asked directly:
"can't we do in migrate check if exists or not — if exists don't
create else add it?" Yes, and it's now built.

**Why the obvious shorthand doesn't work**: tested `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS` against a real local MySQL instance — it fails
with a syntax error. That clause is MariaDB-only; prod is real MySQL
8.0.45. `CREATE TABLE IF NOT EXISTS`/`DROP TABLE IF EXISTS` ARE native
and portable (also verified) — the gap is specifically `ADD COLUMN`/
`ADD PRIMARY KEY`/`ADD CONSTRAINT`. The portable fix, verified working
on real MySQL: check `information_schema` first, build the real
statement as a string, run it via `SET`/`PREPARE`/`EXECUTE`/
`DEALLOCATE` only when the target doesn't already exist.

**This broke the existing 1-up-statement-per-1-down-statement revert
model** — each conditional item is now several physical SQL statements
(a "block"), not one. Rewrote `m1.sql`/`m1.down.sql` around a block
format: each item is a blank-line-separated block led by a `-- TARGET:
<KIND> <table.column-or-name>` comment; `run-sql-migrations.ts` parses
blocks instead of flat statements for the `--mN`/`--mA-mB` path
(`--init` unchanged, still flat statements, since `init.sql` has no
revert concept at all).

**The harder problem idempotency introduces**: if an item is a no-op
(target already existed before this run), its down-block must NOT run
during a later revert — otherwise reverting would delete something
that predates this invocation, not something this run added. Solved
with a pre-flight snapshot: before running a file's blocks, the runner
checks whether each block's target already exists, and gates every
revert decision on that snapshot (not on current state at revert time,
which would already reflect this run's own changes).

Verified end-to-end against a real local MySQL instance, 4 scenarios:
(1) fresh `--init` + `m1` — all 30 blocks apply, `check:drift` reports
the identical 1423 columns/102 tables/zero-drift result as before the
rewrite; (2) re-running `m1` against an already-migrated database — all
30 blocks correctly no-op, no error; (3) the critical test — manually
added one column BEFORE running a corrupted copy of `m1.sql` (forced
to fail partway through, real MySQL, not simulated), confirmed via
`information_schema` after the run that the manually pre-added column
**survived** the revert untouched while every column/table/key/
constraint this run itself added was **fully removed** — proving the
pre-flight-snapshot gating actually works, not just that the code
doesn't crash; (4) full monorepo `typecheck`/`lint`/`format`/`bun
test` clean.

**Caught a real oversight by testing against the actual real UAT data**
(asked directly: "did you test all cases again after doing changes?" —
answer at that point was no, only the 4 synthetic scenarios above had
run). Loading the real `uat.sql` and running the newly-idempotent `m1`
against it, `tbl_verification` still had no primary key afterward —
because Task #140 had *removed* that statement from `m1.sql` entirely
(reasoning: prod/dev already have it), not made it conditional.
Idempotency only helps for statements still present in the file; it
doesn't undo an earlier deletion. Fixed by adding `tbl_verification`
back as a 31st idempotent block (and to
`additive-schema-changes.ts`'s `ADDED_PRIMARY_KEYS`, also restored) —
now unconditionally safe to include: no-ops on prod/dev (confirmed via
a fresh baseline run), genuinely adds it on UAT (confirmed by
re-running against the same loaded real UAT database — block 11/31
was the only non-no-op, `information_schema` confirmed the PRIMARY KEY
now exists, and row counts on all 9 touched tables — including
`tbl_verification` itself — were unchanged, both before this fix and
after). Re-ran the full monorepo verify after this fix; still clean
(`common` 43, `core-api` 351, `integrations-api` 182, `automation-worker`
127, `reporting-api` 185 — all unchanged, this task touched only
`database`). `CLAUDE.md`'s Task #140 bullet extended to document the
idempotency/block/snapshot design.

**Second real gap caught the same way** (user: "are we adding trigger in
m1 if not as in uat its not but in dev and prod.sql its there"):
confirmed directly against the raw dumps — `dev.sql`/`prod.sql` both
have a real trigger (`before_insert_collection_bucket_wise_permission`
on `collection_bucket_wise_permission`, byte-identical between the
two), `uat.sql` has none. Same class of gap as `tbl_verification`'s
primary key. Attempted the same `PREPARE`/`EXECUTE` idempotency
pattern first — real MySQL's prepared-statement protocol explicitly
rejects `CREATE TRIGGER` ("not supported in the prepared statement
protocol yet", confirmed against a real instance before writing it
into the actual file). Used unconditional `DROP TRIGGER IF EXISTS` +
plain `CREATE TRIGGER` instead — reaches the same idempotent end state
without needing `PREPARE` at all. Added a new `TRIGGER <name>` target
kind to `run-sql-migrations.ts` (existence-checked via
`information_schema.TRIGGERS` for the runner's own before-snapshot/
revert bookkeeping, same as every other kind) and a 32nd block to
`m1.sql`/`m1.down.sql`. Verified end-to-end via `mysql2` (not just the
`mysql` CLI, which has its own separate client-side `DELIMITER`
handling that doesn't prove the runner's own parser/execution path
works): correctly no-ops against a fresh prod/dev-mirror baseline
(already has it, `check:drift` still 1423/102), and actually creates
it against real UAT data (0 triggers before, 1 after, confirmed
compatible against UAT's real `collection_bucket_wise_permission`
column shape).

## Task #142 — Security review remediation, part 1: authentication hardening

Full-repo security review (user-requested, 2026-08-06; no pending diff
existed, so the whole 68k-LOC codebase was reviewed rather than a branch
diff). This task fixes the authentication findings; parts 2-4 follow in
tasks #143-#145.

**Password-reset OTP was generated with `Math.random()`**
(`AuthService.generateNumericOtp`) — V8's `Math.random()` is a seeded
xorshift128+ PRNG whose future output is recoverable from a handful of
observed values, and this OTP is the sole factor guarding a password
reset. Now `randomInt(100_000, 1_000_000)` from `node:crypto`
(`randomBytes` was already imported one line up, so the CSPRNG was
already in scope). Exclusive upper bound, so the range is still
100000-999999 inclusive.

**Nothing capped OTP guesses.** A 6-digit OTP is a 10^6 keyspace and the
request stayed valid for its full 10-minute window no matter how many
wrong guesses arrived — `verifyPasswordResetOtp` neither counted misses
nor consumed the row. Added `password_reset_requests.otpAttemptCount`
(m2.sql/m2.down.sql, the one schema change this remediation needed) and
a `MAX_OTP_ATTEMPTS = 5` cap that burns the request via `consumedAt`
once reached. Burning the *request* rather than the account means a
genuine typo costs a new OTP email, never a lockout. The error stays the
same generic `Invalid or expired OTP` either way, so a burned request is
indistinguishable from a wrong guess.

**Repeatedly requesting a reset multiplied live OTPs instead of rotating
one** — `verifyPasswordResetOtp` picks the newest unconsumed request, but
every older one stayed independently guessable until it expired.
`requestPasswordReset` now calls a new
`invalidateOutstandingResetRequests()` first, and `resetPassword` calls
it again after consuming its own row.

**The failed-login lockout was permanent and self-inflictable.**
`failedLoginCount > MAX_FAILED_LOGIN_ATTEMPTS` locks an account, and
nothing except an SA/CA calling `UsersService.unlock` ever cleared it —
not `resetPassword`, not `changePassword`. So anyone who knew a staff
email could permanently lock that account, including every admin, with
four unauthenticated requests. Both password-change paths now reset
`failedLoginCount` to 0, making the lockout self-recoverable through the
normal forgot-password flow.

**No rate limiting existed anywhere in the repo.** Added
`@nestjs/throttler` (6.5.0) to `core-api` and `integrations-api`:
`ThrottlerModule.forRootAsync` with a `THROTTLE_TTL_MS`/`THROTTLE_LIMIT`
baseline (60s/300 by default), `ThrottlerGuard` as an `APP_GUARD`, and
much tighter per-handler `@Throttle` budgets on every credential route —
`signin` 10/min, `forgot-password` 5/15min, `verify-otp` and
`forgot-password/reset` and `change-password` 10/15min,
`refresh-token` 30/min. `ThrottlerModule` is listed before `AuthModule`
in `AppModule`'s imports so the throttle guard precedes the auth guards
and a flood is rejected before any DB work.

**The reset OTP was written to the application log in plaintext**
(`NotificationsService.sendPasswordResetOtp`). Logs reach CloudWatch/
container logs, i.e. far more people than a staff mailbox. Now logged
only that an OTP was issued; printing the value requires an explicit
`AUTH_OTP_DEBUG_LOG=true` (local development only). Note the pre-existing
gap this exposes: there is still no delivery transport for this OTP —
`integrations-api`'s `/email/send` can't be reused as-is because
`SendGenericEmailDto` requires a `leadId` and a staff password reset has
no lead. `NotificationsService` remains the single seam for wiring one.

**A deactivated user's access token kept working for up to 15 minutes.**
`JwtStrategy.validate` returned the payload without any lookup, and
`revokeAllRefreshTokensForUser` only covered refresh tokens. `validate`
now does one primary-key lookup and rejects unless the account is still
`isActive && !isDeleted`; `SharedAuthModule` registers
`TypeOrmModule.forFeature([User])` for it (safe because all three HTTP
services register `ALL_ENTITIES` in their own `CommonModule`, which
satisfies `User`'s `Company`/`Product` `@ManyToOne` targets — the
`autoLoadEntities` gotcha in CLAUDE.md). Roles still come from the token
payload, so a role change takes effect on the next refresh rather than
the next request — deliberately unchanged, and a far smaller exposure
than a deactivated account continuing to work. `automation-worker` has
no guards and doesn't import this module, so it's unaffected.

**`JwtStrategy` didn't pin its algorithm set.** jsonwebtoken infers
HS256/384/512 from a symmetric `secretOrKey` today, but that's key-type
sniffing, not a guarantee. Now explicitly `algorithms: ['HS256']`.

**`changeme` placeholder secrets booted happily.** `.env.example` ships
`JWT_ACCESS_SECRET=changeme` and `INTERNAL_SERVICE_SECRET=changeme`, and
every consumer reads them via `getOrThrow`, which only checks presence —
a deployment that copied the example file verbatim ran on a one-guess
secret. A guessable `JWT_ACCESS_SECRET` is total auth bypass (mint a
token with `roles: ['SA']` for any `sub`); a guessable
`INTERNAL_SERVICE_SECRET` grants the SYSTEM identity on
`integrations-api`, which the gateway proxies publicly. New
`@finance-crm/common` `assertStrongSecrets(config, names)` rejects a known
placeholder or anything under 32 characters and is called from all three
HTTP services' `bootstrap()` before `listen()` — `reporting-api` passes
only `JWT_ACCESS_SECRET`, since it is never an internal-request receiver
and legitimately has no `INTERNAL_SERVICE_SECRET`. `NODE_ENV=development`
downgrades it to a warning so local work against the example file keeps
running.

**Session cookies defaulted to non-`secure`.**
`COOKIE_SECURE` defaulted to `'false'`, so a deployment that never set
the variable shipped session cookies over cleartext http. Inverted: only
an explicit `COOKIE_SECURE=false` (which `.env.example` still sets, for
local http) disables it.

**Also in this pass**, since they're the same one-line-per-service shape:
`helmet()` added to all three HTTP services (there were no security
response headers at all); Swagger moved behind `SWAGGER_ENABLED=false`
(`SwaggerModule.setup` mounts raw Express handlers the global
`JwtAuthGuard` never sees, so it was publishing the complete route/
parameter/DTO inventory to anyone who could reach the gateway); and
`app.set('trust proxy', TRUSTED_PROXY_HOPS)` in all three, because
without it every audited IP (`User.lastLoginIp`,
`UserActivityLog.ipAddress`, the document-download trail, and both
reporting access logs) recorded the gateway/ALB's address rather than
the client's, making the audit trail useless for forensics. A hop
*count* rather than `true` on purpose — `true` lets any client forge
`X-Forwarded-For`. The UPI callback's `text()` body parser also gained a
`16kb` limit, since that route is `@Public()` and previously accepted an
unbounded body straight into memory and into `encryptedResponse`.

Verified: `bun run lint` clean, `typecheck` clean across all six
workspaces, and the auth suite extended from 28 to 33 tests — new cases
cover the wrong-guess counter below the cap, the burn at the cap,
outstanding-request invalidation on re-request, the OTP range, and the
`failedLoginCount` reset on password reset.

## Task #143 — Security review remediation, part 2: unauthenticated endpoints

Continues Task #142. Every `@Public()` route in the repo was re-examined;
four of the seven vendor callbacks had no authentication at all, and one
public core-api route disclosed borrower PII.

**Forgeable video-KYC completion.**
`VideoKycCallbackController` was unauthenticated AND resolved the target
lead from the payload's own `leadId`, with no correlation back to a
session we had actually created — unlike the account-aggregator callback
next door, which does match `requestId` against its originating consent
log. So an unauthenticated POST could set `vkycFlag`/`vkycCompletedOn` on
any lead in the system and write a matching
`VIDEO KYC API CALLBACK(Success)` followup: a forged regulatory KYC check
on a loan file. Fixed both halves — the lead is now resolved only by
looking `requestId` up against the `VideoKycLog` row written when
`VideoKycService.createSession` ran (payload `leadId` is no longer read at
all, and the field is gone from the payload interface), and the route is
behind the new token guard below. An unrecognised `requestId` resolves to
no lead, which the existing "logged without a matching lead" path already
handled.

**Forgeable eSign completion.** `EsignCallbackController` was
unauthenticated, flipped the latest `EsignLog` for any `leadId` to
`SUCCESS`, and wrote the payload's `finalSignedContract` verbatim into
`log.returnUrl` — the stored location of a signed loan agreement, pointed
wherever the caller liked. Three fixes: the token guard; `returnUrl` is
only persisted if it parses as an `https:` URL (an `http:` link is
swappable in transit, and `javascript:`/`data:` would be a stored payload
for whatever renders it later, with the rejection logged); and a callback
against a log that already has a `respondedAt` verdict is ignored, so a
completed eSign can't be retroactively rewritten by replaying one.

**New `VendorCallbackTokenGuard`** (`integrations-api/src/common/`). Two
of the seven public callbacks already authenticate themselves — Razorpay
by `x-razorpay-signature` HMAC, ICICI UPI by RSA-decrypting the body —
and the other four (Signzy video-KYC, Signzy eSign, CartBI bank-analysis,
CartBI account-aggregator) had nothing, because legacy had nothing. That
isn't a reason to keep an open endpoint that decides KYC and
loan-agreement completion, and `JwtAuthGuard`/`@Roles` can't apply since a
vendor's server carries no staff session cookie. So: a `VENDOR_CALLBACK_
TOKEN` shared secret, generated by us and configured vendor-side, compared
with `timingSafeEqual` (length-checked first, since that throws on a
mismatch). Accepted as the `x-callback-token` header or a `?token=` query
parameter — the query form is weaker because it lands in access logs, but
it's the only option some vendor consoles offer and still far better than
nothing. **Fails closed when the env var is unset**, deliberately: a guard
that waves requests through without its secret is exactly the bypass it
exists to remove, and "won't function until real credentials are
supplied" is already this repo's convention for integrations. Applied via
plain `@UseGuards` on the four controllers (no metadata/global
registration needed) and declared in integrations-api's Swagger doc as an
`addApiKey` scheme.

**Bleichenbacher padding oracle on the public UPI callback.**
`icici-rsa.util.ts` decrypts with `RSA_NO_PADDING` and unpads PKCS#1 v1.5
by hand — unavoidable, since Node removed `RSA_PKCS1_PADDING` support for
`privateDecrypt` outright. Its comment asserted this was safe because the
endpoint was "not a public oracle taking attacker-supplied ciphertexts".
That was simply wrong: `UpiCallbackController.handleDepositCallback` is
`@Public()`, feeds the raw request body straight in, and returned the
exception message to the caller — so `Invalid PKCS#1 v1.5 padding` vs
`...no separator found` vs a JSON-parse failure vs "no matching UPI
collection log" were each separately observable, which is precisely the
per-attempt signal that attack needs. Fixed on both sides: the util now
has a single, contentless padding error, and the controller returns one
constant `Callback could not be processed` while logging the real reason
server-side. The unpad also now validates the minimum 8-byte non-zero
padding run that block type 2 requires, which the previous version
skipped. The misleading comment is replaced with what's actually true.

**Unauthenticated borrower-PII disclosure.**
`POST /leads/:leadId/feedback` is `@Public()` (customers submit feedback
without a staff session) and returned the saved `CustomerFeedback`
entity — which carries the `lead` relation just assigned onto it. `Lead`
has no `@Exclude()` fields, so `ClassSerializerInterceptor` passed its
`mobile`/`email`/`pancard` straight through, and anyone could walk
`leadId` to harvest it. `FeedbackService.submit` now returns `{ id }`
only, with its return type narrowed accordingly, plus a 10/min
`@Throttle`. The existing spec asserted the old leaky shape
(`expect(result).toEqual(expect.objectContaining({ lead, ... }))`); it now
seeds a `lead` onto the mocked save result and asserts `{ id: 99 }`, so it
proves the relation is stripped rather than that it was never present.

Verified: lint/format clean, typecheck clean across all six workspaces,
`core-api` 356 tests pass (was 356 — one rewritten, none added there),
`integrations-api` 189 pass (was 182: +6 for the new guard spec, +1 for
the video-KYC correlation case).

## Task #144 — Security review remediation, part 3: PDF template injection, Chrome sandbox

Continues Tasks #142-#143.

**The four PDF templates interpolated DB strings with no escaping at all.**
`sanction-letter.template.ts` put `borrowerFullName`, `fatherName`,
`panNumber`, `residenceAddressHtml`, `applicationNo`, `lenderName` (twice,
one of them inside an `alt="..."` attribute) and `logoDataUri` (inside
`src="..."`) straight into the markup; `legal-notice`, `consent-form` and
`cibil-report` did the same with borrower name/address, the nodal
grievance officer's details, and bureau-supplied account rows
(`lenderName`, `accountStatus`, `paymentHistory`). Meanwhile every email
template in `automation-worker` already escaped — so this was an
inconsistency, not an unknown risk.

That mattered more than cosmetic markup breakage because these templates
are rendered by headless Chrome. `CreateLeadDto.firstName` is
`@IsString() @MinLength(1)` with no charset restriction and CSV import
accepts names too, so a stored `<script>`/`<img onerror>` executed
server-side, inside the VPC, while producing a legally meaningful
document — giving both content forgery on a loan agreement and an
outbound-fetch primitive. Every string interpolation across the four
templates is now wrapped in `escapeHtml`. The remaining bare
interpolations are all typed `number` (`tenureDays`, `roiPerDay`,
`daysToRespond`, the `accountSummary` counts, the computed `apr`) or
module-level constants (`STYLE`, `GRIEVANCE_ESCALATIONS`), which is why
they're left alone. Note `residenceAddressHtml`/`borrowerAddressHtml` are
misleadingly named — both are built by `join(', ')` on plain address
fields, not pre-rendered HTML, so escaping them is correct.

**One `escapeHtml`, not nine.** The helper existed in eight separate
copies (seven in `automation-worker`'s email templates, one in
`integrations-api`'s thank-you template) and nowhere in the PDF path. Now
a single `@finance-crm/common` `html/escape-html.ts`, re-exported from the package
index, and all eight local copies deleted in favour of importing it. It
escapes `"` and `'` in addition to `& < >` — the seven
`automation-worker` copies only did the latter three, which is fine for
text position but not for the attribute-position interpolations the PDF
templates have (`<img src="${...}" alt="${...}">`), where a bare quote
closes the attribute and opens an event handler. It also renders
`null`/`undefined` as `''` rather than the string `"null"`.

**Chrome no longer runs unsandboxed as root.**
`PuppeteerPdfRenderer` launched with `--no-sandbox
--disable-setuid-sandbox`, the standard workaround for Chrome refusing to
sandbox as root — and all four Dockerfiles ran as root, since none had a
`USER` directive. Combined with unescaped templates, a renderer
compromise landed as root in the container. All four Dockerfiles now
create an explicit non-root `app` user (uid/gid 1001) and switch to it;
`core-api` additionally pre-creates and chowns its `storage/` directory,
since the local-disk storage adapter writes there. The user is created
explicitly with `groupadd`/`useradd` rather than reusing whatever user
`oven/bun:1` may ship — the Docker daemon wasn't available to verify that
image's contents, and CLAUDE.md's "don't guess" rule applies. The sandbox
flags are gone, with `PUPPETEER_DISABLE_SANDBOX=true` left as an escape
hatch for an environment that genuinely lacks the required kernel
namespaces. `--disable-dev-shm-usage` added, which is a stability flag
(Docker's 64MB default /dev/shm can crash Chrome), not a sandbox
weakening.

**Defence in depth on the render itself**: `setRequestInterception` now
aborts any request whose scheme is http/https/ws/wss/ftp/file/blob, so
even markup that somehow reaches the page can't fetch IMDS, call out, or
read local files. Blocking by scheme rather than allow-listing, so the
`about:blank` document `setContent` renders into is never itself aborted.
Templates reference only inlined `data:` URIs, so nothing legitimate is
blocked.

**`@finance-crm/common`'s tests were never actually running.** The package had 11
spec files and no `test` script, so no service's jest picked them up
(each has `rootDir: src` scoped to itself). Added one. Two findings fell
straight out of it: `jwt-auth.guard.spec.ts`'s fall-through case crashed
the jest worker outright — its mock `ExecutionContext` had no
`getResponse`, so the real `AuthGuard('jwt')` base implementation threw a
bare `TypeError` inside its own promise where `expect(...).toThrow()`
couldn't see it (fixed: fuller mock context, and the assertion is now an
async `.rejects`); and `aws-secrets-loader.spec.ts`/`aws-ssm-loader.spec.ts`
are written against `bun:test`, whose `mock` has no jest equivalent, so
they're in `testPathIgnorePatterns` and the `test` script runs them with
`bun test` after the jest pass rather than leaving them unexecuted.

Verified: lint/format/typecheck clean. `common` now runs 56 tests (48
jest + 8 bun), up from 0 executed — including new specs for `escapeHtml`
(6) and `assertStrongSecrets` (7) from Task #142. Also verified the fix
end-to-end with a throwaway script: an `<img src=x onerror=...>` payload
fed through `borrowerFullName`/`residenceAddressHtml` comes out as
`&lt;img src=x` in both the sanction-letter and legal-notice HTML, and a
real render still produces a valid 197KB `%PDF-1.4` with the sandbox
enabled and network blocked.

## Task #145 — Security review remediation, part 4: CSV injection, segregation of duties, upload limits, token reuse

Final remediation pass from the security review (Tasks #142-#144). One
finding from that review is deliberately NOT fixed here and is now tracked
in `docs/TODO.md` instead — see the end of this entry.

**CSV formula injection in every export.**
`reporting-api`'s `escapeCsvField` implemented RFC 4180 quoting correctly
but did nothing about a cell *beginning* with `=`, `+`, `-`, `@`, tab or
CR — which Excel/LibreOffice/Sheets evaluate as a formula. RFC 4180
quoting is no defence: the spreadsheet strips the quotes before parsing
the value. Exports carry attacker-influenceable free text (lead names,
collection remarks, and customer feedback, which arrives through an
unauthenticated endpoint), so opening a report was a code-execution path
on the staff member's machine — `=HYPERLINK`, `=WEBSERVICE` for silent
exfiltration, or a DDE payload. Now prefixed with a single quote (the
standard neutralisation: displays as text, the `'` isn't shown by any
major spreadsheet) and force-quoted so the `'` can't be mistaken for a
delimiter by a non-spreadsheet consumer. A negative number gets guarded
too, which is intentional — `-500` and `-1+1` aren't distinguishable
without parsing spreadsheet syntax, and the guarded form displays
identically. 10 new spec cases.

**No segregation of duties on payment verification.**
`verifyPayment` checked only that the payment was still `PENDING`, never
that the verifier differed from the person who recorded it. Because
`RolesGuard`'s `ADMIN_OVERRIDE_ROLES` lets `SA`/`CA` satisfy both
`@Roles(...PAYMENT_REMARKS_REQUIRED_ROLES)` on `createPayment` and
`@Roles(PAYMENT_VERIFIER_ROLE)` here, one admin could book a collection
against a loan and sign it off in two requests — including the
discount/refund figures this method writes into the loan's closure
amounts. Now rejects with a `ForbiddenException` when
`payment.collectionExecutiveId` (set to the acting user in
`createPayment`) equals the verifier. `Number(...)` on both sides because
that column is a `bigint` and comes back as a string.

**Unbounded in-memory file upload.** `LeadImportController` used
`FileInterceptor('file')` with no options: multer's default
`limits.fileSize` is unbounded and Nest buffers the whole upload in
memory, so one request could exhaust the heap. Capped at 5MB / 1 file,
with a mimetype+extension filter (a convenience check, not a trust
boundary — the CSV parser still validates content). Role-gated to SA/CA
already, so this was DoS-by-privileged-user rather than anonymous, but
the cap costs nothing.

**Refresh-token rotation had no reuse detection.** Tokens rotate on every
refresh, so a token that exists in the table but is already revoked means
two parties hold the same one — it was stolen and replayed. Previously
that just 401'd the replayer, leaving the thief free to keep refreshing on
whichever branch the real user didn't take. `refreshTokens` now looks the
hash up a second time when the primary (unrevoked, unexpired) query misses
and, if it finds a revoked row, revokes every live token for that user and
logs it. A hash that has never been issued revokes nothing.

**Refresh cookie tightened to `sameSite: 'strict'`.** It is only ever sent
to `POST /api/v1/auth/refresh-token` by the app's own XHR, never on a
top-level navigation, so nothing legitimate needs `lax`'s cross-site
relaxation. The access cookie stays `lax` — it's scoped to `/`, and
`strict` there would drop the session on any inbound link into the app.

**Not fixed: there is no per-lead authorization model.** Every
authenticated staff user can read and modify every lead and download any
lead's KYC zip / sanction letter / consent form / legal notice, and the
entire `menu-permissions` module is managed CRUD that no guard consumes.
This is real, but fixing it means *inventing* policy: `QUEUE_ROLE_SCOPES`
(the only role→stage mapping that exists, ported from legacy
`TaskController.php`) covers just CR1/CR2/CO1/CO3/DS1 and falls through to
"sees everything" for every other role, so building per-lead reads on it
would deny CR1 a lead outside their stages while still letting
CR3/CO2/DS2/AC1 see all of them — inconsistent, and liable to block
legitimate workflows. Menu permissions are worse: no route→`master_menu`
mapping exists anywhere to enforce. This is the same judgment call
`docs/TODO.md` already records for the 4 ungated collection/verification
endpoints (Task #137) — a guessed role list "risks locking out a
legitimate workflow rather than a verified fix". Written up as a new
`docs/TODO.md` open item with the three specific questions the client
needs to answer.

Verified: lint/format/typecheck clean; full suite green across every
workspace — `core-api` 360 (was 356), `integrations-api` 189,
`reporting-api` 193 (was 183), `automation-worker` 127, `common` 56 (48
jest + 8 bun).

### Task #142-#145 verification addendum — m2.sql exercised against a real MySQL

The migration pair added in Task #142 was initially only structurally
checked (1 block, exact reverse, valid TARGET kind the runner recognises).
With real DB credentials available it was then run end-to-end against a
throwaway `finance_crm_m2_test` database — deliberately NOT `finance_crm_prod`/`finance_crm_uat`,
which are the two databases present on that host:

- `bun run migrate --init --m2` from empty: init's 149 tables, then all 32
  m1 blocks (block 32, the trigger, correctly reported `already exists,
  no-op`), then `[m2] (1/1) COLUMN password_reset_requests.otpAttemptCount`.
- Column confirmed present via `SHOW COLUMNS`: `int NOT NULL DEFAULT 0`,
  matching the entity.
- Re-running `--m2-m2` reports `already exists, no-op` — idempotent, as
  required.
- `m2.down.sql` piped straight into the `mysql` client (the paste-into-
  phpMyAdmin path every file here must support, not just the runner) drops
  the column; re-running it is a clean no-op.
- `check:drift` against the migrated database: **no drift, 1424 columns
  across 102 tables** (1423 before this column). The 3 "not in database"
  entities it lists are the pre-existing known gaps already tracked in
  `docs/TODO.md` (`master_email_template` isn't in any dump), not
  regressions.
- Throwaway database dropped afterwards.

## Task #146 — Remove six vendor integrations from code (client-directed)

The client supplied a definitive keep-list of vendors (Surepass, CRIF
direct, Signzy, Digitap, Google Maps, Razorpay, ICICI, Vapio, RUNO,
ZeptoMail — plus CartBI and the SES/SMTP email senders, confirmed
separately once the diff below was put to them) and asked for everything
else removed from code, with the explicit constraint: **don't delete data
from the DB — delete from code so no new data is mapped to it.**

**First: the diff between that list and reality.** Their original remove
list had 14 names, but only 3 had real code (Credeau, AppsFlyer, and
Mailgun-as-an-SMTP-host). The other 11 (TransUnion, QuickChart, NuPay,
RouteMobile, Whistle, Sms24hours, Pinbot.ai, Aisensy, Yellow.ai, Cube
Software, Facebook Graph API, Exotel) existed only as `.env.example`
entries, legacy-porting comments, and provider *enum values*. Meanwhile
seven vendors were live in code and absent from the keep-list entirely —
Adjust, CartBI (two modules), Finbox, TinyURL, AWS SES, generic SMTP, and
the generic WhatsApp client. And three keep-list entries turned out not to
exist: **SendGrid** is only an email *validator*, never a sender;
**Worldline** is only an `EnachProvider.WORLDLINE = 1` enum value written
onto `enach_log` rows while the API actually called is ICICI's; **MSG91**,
**Smartping** and **DesignHost/staticking.org** are comment-only. Putting
that diff to the client is what produced the final scope below.

**Removed (real code deleted).** DB tables and rows preserved in every
case; only the read/write paths are gone.

- **Credeau** — the `credeau` module, `CredeauLog`/`CredeauDecision`, and
  its two *read* call sites. This is the only removal with a behavioural
  consequence, and it's a credit-control one, so it is flagged in
  `docs/TODO.md` for credit-policy review rather than treated as a clean
  deletion: `CamService.eligibleLoanAmount()` used Credeau's approved
  amount as the eligible-loan ceiling for a `creationMode == 1` lead with
  an `Approve` of at least Rs. 5,000 (STP leads now get the same flat-FOIR
  ceiling as everyone else, which can be higher *or* lower), and
  `AuditService.checkStraightThroughEligibility()` rejected a CAM whose
  recommended amount exceeded it (that cap is gone; the FOIR cap in
  `assertWithinLoanLimits()` is now the only ceiling, and every other gate
  in that audit check is untouched). `AuditService` lost its now-unused
  `camRepository` injection as a result.
- **AppsFlyer** — the `appsflyer` module (already unregistered),
  `automation-worker`'s `appsflyer-disbursal-event-push` job and its
  `CRON_APPSFLYER_DISBURSAL_EVENT_PUSH` entry, and
  `AppsflyerPushEventLog`. `automation-worker` is 19 jobs now, not 20.
- **Adjust** — the `adjust` module and `AdjustDeviceLog`. With AppsFlyer
  gone this removes the whole attribution category.
- **Finbox** — the `finbox` module and all three log entities.
- **TinyURL** — the `url-shortener` module and `UrlShortenerLog`. Nothing
  called it (Task #132's own note said as much), so it was clean.
- **WhatsApp, whole category** — the `whatsapp` module and `WhatsappLog`.
  It was one generic HTTP client pointed at `WHATSAPP_API_URL`, and every
  candidate provider behind it (Pinbot.ai, Whistle, Aisensy, Yellow.ai) is
  off the keep-list, leaving no provider. Nothing called it either.

**Kept, and why.** `FOLLOWUP_TEMPLATE_TYPE.WHATSAPP = 3` stays in
`CollectionService` — a legacy numeric type id the frontend already sends,
which already returned "No WhatsApp followup templates exist."
`CRON_CREDEAU_APPLICATION_ALLOCATION` and the
`credit-application-allocation` job's `credeau` band stay: despite the
name they are a lead-**allocation** band (assigning STP leads to credit
users, confirmed live in the production crontab) and never called the
vendor — renaming the env var would silently break environments already
setting it, so it got a clarifying comment instead. `lead.credeauStatus`
and `cifCustomer.credeauApprovedCustomer` stay, and the latter is still
written — but from our own `lead.creationMode`, never from vendor data,
which is the line drawn throughout this task.

**Two deliberate non-deletions**, both following directly from "don't
delete data":

- **Provider enum values are kept** (`BankVerificationProvider`,
  `EnachProvider.WORLDLINE`, etc.). They decode numeric provider ids
  already stored on existing rows; deleting them makes historical data
  unreadable.
- **`m1.sql` is untouched.** It creates `whatsapp_logs`,
  `api_appsflyer_push_events`, `api_finbox_*` and
  `api_url_shortener_logs`, and adds `api_adjust_logs`' primary key. It is
  an already-applied migration whose block count and ordering
  `m1.down.sql` contractually mirrors — editing it would break that
  contract and risk dropping preserved tables. `ADDED_PRIMARY_KEYS` in
  `additive-schema-changes.ts` keeps its `api_adjust_logs` entry for the
  same reason (it's a schema fact already shipped to the app-server team,
  not a write path).

`docs/SCHEMA-MAP.md` marks each of the eight dropped entities
`_entity removed_` while keeping its legacy table row, so
`check:schema-map` still accounts for every table and the preserved tables
stay documented rather than silently vanishing. Also scrubbed:
`.env.example` (Credeau/Finbox/Adjust/AppsFlyer/WhatsApp blocks deleted,
the Vapio and email blocks reworded off dormant-vendor name-dropping),
`SMTP_HOST`'s default (was literally `smtp.mailgun.org`, now
`getOrThrow` with no default), `integrations-api`'s Swagger description,
and `sms.module.ts`'s comment. `CLAUDE.md` gains a "the vendor list is a
client-owned decision" architecture rule; `docs/EXCLUDED.md` gains the
full removal record.

Verified: typecheck clean across all six workspaces, lint/format clean,
`check:schema-map` covers all 125 legacy tables and all 96 remaining
entities (was 104). Tests: `core-api` 358 (was 360 — the two Credeau
eligible-loan override cases are replaced by one asserting an STP lead now
gets the flat-FOIR cap), `integrations-api` 159 (was 189 — 30 belonged to
the deleted modules' specs), `automation-worker` 119 (was 127 — the
AppsFlyer job's spec), `reporting-api` 193, `common` 56, all passing. And
verified against a real MySQL on a throwaway `finance-crm_vendor_test` database:
after `--init --m2`, all six vendors' tables (`api_credeau_log`,
`api_adjust_logs`, `api_appsflyer_push_events`,
`api_finbox_device_connect_logs`, `api_url_shortener_logs`,
`whatsapp_logs`) are still present and created, and `check:drift` reports
no drift across 1332 columns / 96 tables — i.e. the code no longer maps
them, and nothing dropped them.

## Task #147 — Restore the Credeau integration (client reversal of Task #146)

The client asked for Credeau back the same day Task #146 removed it. Only
the Credeau portion of commit `32af956` is reverted; the other five removals
(AppsFlyer, Adjust, Finbox, TinyURL, WhatsApp) stand.

`cam.service.ts`, `cam.service.spec.ts` and `audit.service.ts` were restored
wholesale from the pre-removal commit, which is exact rather than
reconstructed: diffing those three files across `efe11df..32af956` and
filtering out every line mentioning Credeau produced an empty result, so the
removal commit had touched them for Credeau reasons only and nothing from
the security-review work sitting in the same files could be lost. Everything
else was re-added surgically because `32af956` changed those files for
several vendors at once — `database/src/index.ts`'s export,
`integrations-api`'s import + registration (both back in their original
alphabetical slots next to `CrifBureauModule`), and the `CREDEAU_CLIENT_ID`/
`CREDEAU_AUTH_TOKEN` block in `.env.example`.

So the two credit-control behaviours are live again, and the credit-policy
question Task #146 raised is void — `docs/TODO.md`'s open item for it is
deleted, not amended: `CamService.eligibleLoanAmount()` again uses Credeau's
approved amount as the eligible-loan ceiling for a `creationMode == 1` lead
with an `Approve` of at least Rs. 5,000, and
`AuditService.checkStraightThroughEligibility()` again rejects a CAM whose
recommended amount exceeds it (with its `camRepository` injection back).
`docs/SCHEMA-MAP.md`'s `api_credeau_log` row is a real `CredeauLog` mapping
again, and `CLAUDE.md`/`docs/DETAILS.md`/`docs/EXCLUDED.md` no longer list
Credeau as removed — `EXCLUDED.md` records the removal-then-restore
explicitly rather than silently dropping it, so the history stays legible.

**Caught a real regression from Task #146 while verifying this.** That task
had replaced `SMTP_HOST`'s literal `smtp.mailgun.org` default with
`config.getOrThrow<string>('SMTP_HOST')` — removing the vendor hostname, but
turning an unset variable into a **hard boot failure**, because that factory
provider runs at startup and `EMAIL_PROVIDER` defaults to `smtp`. Any service
that never sends email would refuse to start. Now
`config.get<string>('SMTP_HOST', 'localhost')`: no vendor name, no boot
failure, and a wrong host fails at send time where it belongs.
`.env.example` matches. This is exactly the class of thing a typecheck and
unit tests can't catch, which is why the verification below includes a real
boot.

Verified: lint/format clean, typecheck clean across all six workspaces,
`check:schema-map` covers all 125 legacy tables and all 97 entities (back up
from 96). Tests: `core-api` 360 (back from 358 — the two Credeau
eligible-loan override cases return, replacing the single flat-FOIR case
#146 substituted), `integrations-api` 162 (up from 159 — `credeau.service.spec.ts`'s
3 cases), `automation-worker` 119, `reporting-api` 193, `common` 56, all
passing. And booted `integrations-api` for real against a throwaway
migrated database: starts clean with no errors,
`CredeauModule dependencies initialized`, both routes mapped
(`POST /api/v1/integrations/credeau/check`,
`GET /api/v1/integrations/credeau/leads/:leadId/latest`), 52 routes total,
and zero route or module references to any of the five vendors that stayed
removed.

## Task #148 — Password-reset OTP delivery (closes the forgot-password flow)

The flow generated, hashed and stored an OTP correctly and then nobody
received it — `NotificationsService` was a log-only stub. Blocking, because
every migrated legacy user has a null `passwordHash` and must reset before
their first sign-in, so nobody could sign in at all.

**Legacy had no working behaviour to port.**
`ForgetPasswordController::verifyUser()` short-circuits on line 38 with
`set_flashdata('err', "Work in progress for the same.")` and redirects
before reaching any send code — legacy's forgot-password never worked
either. What it does contain, as dead code, is a complete decision about
what the email should say, so `password-reset-otp-email.template.ts` ports
that content rather than inventing copy: greeting, CRM URL, which login the
OTP is for, the OTP, the requesting IP/user-agent, a timestamp, and an
IT-support line. Those request-context rows are the design's point, not
decoration — they are the only signal a staff user gets that *someone else*
is trying to reset their password. Legacy split UA into platform/browser/
version via CodeIgniter's `$this->agent`; there is no equivalent here and a
UA-parsing dependency for one email isn't worth it, so the raw header is
shown in one row.

**The `leadId` blocker was self-inflicted.** Task #142 recorded that
`integrations-api`'s `/email/send` couldn't be reused because
`SendGenericEmailDto` requires a `leadId` and a staff reset has no lead.
Checking legacy settled it: `common_send_email()` writes `api_email_logs`
with **no `lead_id` at all** (only `email_provider`/`email_type_id`/
`email_address`/`email_content`/`email_api_status_id`/`email_created_on`),
and `api_email_logs.email_lead_id` is `DEFAULT NULL` in the real schema —
which `EmailLog` already models as `nullable: true`. So the requirement was
an over-constraint this codebase added, not a schema fact. `leadId` is now
`@IsOptional()`, and `EmailService.send()` resolves a lead only when one is
supplied (still via `findOrFail`, so a bad id is a 404 rather than a
silently lead-less row).

**Shape**: a dedicated `POST /email/password-reset-otp` on
`integrations-api`, mirroring how `thank-you` is split — `core-api` owns the
OTP and request context, `integrations-api` owns the template and transport.
`core-api`'s `NotificationsService` calls it through `IntegrationsApiClient`,
i.e. over the HMAC-signed internal path every other inter-service call uses,
so no new unsigned client. `AuthController.forgotPassword` now captures
`@Ip()`/`@Headers('user-agent')` the way `signIn` already did, and
`requestPasswordReset` threads them through.

Two deliberate choices:

- **The email body is not persisted.** Every other sender writes the HTML to
  `email_content`; this one writes `[body not logged — contains a one-time
  credential]` via a new `logContent: false` on `send()`. Storing it would
  put a live OTP in the database in plaintext, recreating exactly the leak
  that removing it from the application log closed in Task #142.
- **A send failure does not throw.** `requestPasswordReset` returns the same
  generic response whether or not the email exists, so surfacing a transport
  error would leak account existence — and the OTP row is already committed,
  so failing the request would be misleading. Failures are logged for an
  operator.

`AUTH_OTP_DEBUG_LOG` still prints the OTP for local development (where
there is usually no mail transport), and now runs *in addition to* the send
rather than instead of it.

Verified end-to-end against a real MySQL and both services actually
running, not just unit tests — `core-api` 361 and `integrations-api` 162
pass (4 new template specs covering OTP presence, User-Agent escaping,
display-name escaping and the null-IP placeholder), and against a live
`finance-crm_otp` database with a seeded user:

- `POST /api/forgot-password` → 200 with the generic message, and
  `[NotificationsService] Password reset OTP email dispatched for
  priya@financecrm.com` in core-api's log, i.e. the signed internal call to
  integrations-api succeeded.
- The resulting `api_email_logs` row has `email_lead_id` **NULL** (proving
  the DTO relaxation works), `email_type_id` 2, and
  `email_content` = the placeholder — **the OTP is not in the database**.
  `email_api_status_id` 3 (network error) is the expected local outcome with
  `SMTP_HOST=localhost` and no mail server: the send was attempted, which is
  the part under test.
- The attempt cap: 5 wrong guesses drove `otpAttemptCount` 0→5 and set
  `consumedAt`, and the 6th returned the identical
  `"Invalid or expired OTP"` — confirming a burned request is
  indistinguishable from a wrong guess, as intended.
- Rate limiting fires for real: `verify-otp` 429s after its 10/15min budget,
  `signin` after exactly 10/min. The 429 body is Nest's
  `"ThrottlerException: Too Many Requests"` — which is precisely the
  unshowable text the frontend now maps to friendly copy.

**Still needed to actually deliver mail**: real `EMAIL_PROVIDER` settings
(`smtp`/`zeptomail`/`ses`) plus `LMS_URL` and `TECH_EMAIL`, which the email
uses for its URL and support-contact rows. Tracked with the other
deployment actions in `docs/TODO.md`.

## Task #149 — Legacy-source verification of three open items, CSP, doc cleanup

Closes two `docs/TODO.md` items by checking what legacy actually does, adds
the gateway CSP, and retires two dead doc references. Client-directed
follow-up to Tasks #142-#148.

### The 4 ungated collection/verification endpoints — legacy has no gate, so neither do we

`docs/TODO.md` had these open pending a client decision on the intended role
list. Read the legacy handlers instead, and the answer is unambiguous:

- `CollectionController::insert_request_for_collection_visit()` (:361) —
  gates on `if (empty($_SESSION['isUserSession']['user_id']))`, i.e.
  authenticated only. It *does* contain five `in_array(agent, ['CO1','CO2',
  'CO3','CO4'])`-style blocks, which is what made an earlier grep look like
  role gating — but every one of them only calls
  `form_validation->set_rules(...)`. They are **role-conditional required
  fields** (`CO1`/`CO4` must supply `visit_scm_user_id`, `CO2`/`CO3` must
  supply `visit_rm_user_id`), not authorization. A role in none of the lists
  simply has fewer required fields; it is never rejected.
- `insert_loan_collection_followup()` (:148) — no role check at all.
- `confirm_is_cfe_visit_completed()` (:1577) — no role check at all.
- `addToBlackList()` (:1420, the only writer of `customer_black_list`) —
  session check only.

Per the client's rule for this item ("if there is no gate we will also not
do"), no role gates are added. The item is closed as *matching legacy*
rather than left open on a guess.

### Per-lead authorization — legacy has none either

Also closed on evidence. Legacy's only per-lead scoping is:

1. `TaskController.php:86-94` — the queue *listing* filters on
   `lead_screener_assign_user_id`/`lead_credit_assign_user_id` = session
   user. This backend already ports that faithfully as
   `LeadsService.listQueue()`/`QUEUE_ROLE_SCOPES`.
2. `CredeauController.php:67` — exactly one real per-action ownership check
   ("You are not authorized to perform this action!" when the credit
   assignee isn't you and the lead is in status 5/6/11). It guards
   `credeauApplicationMoveToNew()`, which **is not ported** — so there is no
   site in this codebase to attach it to.
3. `DisbursalController.php:790` — the equivalent disbursal ownership check
   exists but is **commented out**, i.e. deliberately disabled in
   production.

Everything else takes a lead id with no ownership check. Legacy does pass
lead ids encrypted (`$this->encrypt->decode($this->input->post('lead_id'))`,
19 sites in `CollectionController` alone) — worth naming for what it is:
IDOR-by-obscurity, not authorization. This backend's plain integer ids are
more honest about the actual access model, which is "any authenticated staff
user". So the flat model is not a regression against legacy; it is parity.
Closed on the same rule as above.

### ICICI disbursal — scoped, with three defects that must not be ported

Verified the source matches the earlier audit (611 lines, 5 functions,
`composite-payment`/`composite-status` endpoints, `URN`+`UNIQUEID`+`UTR`
success shape). Details and the three crypto defects — a hardcoded AES
session key *and* IV, `OPENSSL_PKCS1_PADDING` misused as `openssl_decrypt`'s
options bitmask, and an encrypt/decrypt IV-handling mismatch — are recorded
in `docs/TODO.md`, which remains open. Still not implemented: real money
movement needs a sandbox and credentials unavailable here. What changed is
that "port it faithfully" is now known to be the wrong instruction.

**Found while reading it:** `old-php-files/application/prod_private.key` is
a real 3272-byte PKCS#8 RSA **production private key** (plus two genuine
ICICI certificates alongside it) sitting in the legacy repo. It decrypts
ICICI bank-payment responses. Raised in `docs/TODO.md` as its own CRITICAL
item to rotate, independent of any porting work.

### CSP and security headers on the gateway

The frontend had no CSP, and `gateway/nginx.conf` is where it belongs since
that proxy fronts every service. Added `Content-Security-Policy`,
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and
`Permissions-Policy`, all with `always` so they survive 4xx/5xx — the
responses an injected payload is most likely to ride on. This is the
defence-in-depth layer behind the frontend's `safeExternalUrl()` guard.

Scoped to what the app really loads: `script-src 'self'` with no
`'unsafe-inline'` (Vite's production build emits external module scripts
only); `style-src` does need `'unsafe-inline'` because Tailwind v4 and the
Radix primitives set inline styles at runtime; `img-src`/`font-src` need
`data:` for the logo the PDF/email templates embed; `frame-ancestors 'none'`
because clickjacking a loan-approval button is a real concern. HSTS is
deliberately absent — this block listens on plain `:80` with TLS terminating
upstream, so it belongs wherever HTTPS is actually served.

Documented a genuine nginx footgun in the file: `add_header` is not additive
across levels, so a `location` block declaring any `add_header` of its own
silently discards all of these. The existing locations use only
`proxy_set_header` (a request-header directive), so inheritance holds today.
Could not validate mechanically — no nginx binary and no Docker daemon in
this environment — so verified by inspection instead: braces balance (9/9),
every directive terminates, and the `;`-bearing CSP value is fully quoted.

### Retired `client.txt`/`FLOW.txt`

The client confirmed these aren't needed. Both lived in the umbrella `FINANCE-CRM/`
folder outside either git repo and are gone from disk. The `docs/TODO.md`
item tracking their loss is removed, and the two historical
`docs/COMPLETED.md` write-ups that referenced them are annotated in place
rather than rewritten — those are a record of what was true at the time.

## Task #150 — Port the ICICI disbursal (real bank transfer)

Client-directed implementation of the item that had stood as CRITICAL since
Task #120: the API that actually sends loan money to a customer. Ports
`payday_loan_disbursement_call()`, `icici_disburse_loan_amount_api()`,
`icici_request_encrypt()`, `icici_response_decrypt()` and
`icici_disburse_loan_status_api()`.

**Read the whole legacy flow first, because the safety lives in its ordering,
not in its API call.** Before this, `DisbursalService.disburse()` treated
*every* disbursal as offline: it flipped the loan to `DISBURSED` and wrote a
`COMPLETE` transaction row unconditionally, with no vendor call and no guard.

### The three crypto defects, fixed not reproduced

New `icici-envelope.util.ts` implements the hybrid envelope (AES-128-CBC body
under an RSA-encrypted session key). Legacy's version had three faults, and
"port it faithfully" would have shipped all of them:

1. `$sessionKey = 1234567890123456` is **hardcoded** — the real
   `hash('MD5', time(), true)` is commented out — and `$iv` is the same
   constant. AES-CBC under a fixed key *and* fixed IV is deterministic, so two
   disbursals of the same amount to the same account are byte-identical on the
   wire: correlatable and replayable. Both are now `randomBytes(16)` per
   request, with a test asserting two identical payloads produce different
   ciphertext.
2. `openssl_decrypt` was passed `OPENSSL_PKCS1_PADDING` as its options
   bitmask — an RSA padding mode, meaningless for AES, working only because it
   numerically equals `OPENSSL_RAW_DATA`. Node's API has no such argument, so
   the bug cannot survive the port.
3. Decrypt did `substr($encData, 16)`, treating the first block as a prepended
   IV that its own encrypt side never added. Since ICICI builds the response,
   `decryptResponse` handles both: it prefers the response's own `iv` field and
   falls back to the prepended-block reading when that field is empty — which
   is what legacy's `substr` was really compensating for, given the sample
   response in the legacy source shows `"iv": ""`. Which branch is real needs
   sandbox confirmation (`docs/TODO.md`).

### The part that actually prevents a double payment

Legacy has two guards at different layers and both are ported. A previous
transaction in INITIATED, PENDING or HOLD **blocks** a new attempt; COMPLETE
blocks; only FAILED permits a fresh one. Plus a loan already carrying
`disburse_refrence_no` blocks outright.

The critical detail is legacy's status write on failure: **it sets PENDING, not
FAILED** — and PENDING is in the blocking set. That is deliberate. If you do
not know whether the money left, you must not let anyone retry. Ordering is
preserved too: the transaction row is written **before** the vendor call, so a
crash mid-call still leaves a blocking record.

One deliberate improvement: legacy collapsed "ICICI explicitly rejected it"
and "we have no idea what happened" into the same PENDING write, blocking
retries even for calls that provably never left the process. The port splits
them into a three-way outcome — SUCCESS / REJECTED / UNKNOWN — where only
REJECTED writes FAILED and permits a retry. This is safer in one direction
only: nothing legacy treated as blocking became retryable. Failure to *build*
the request is the one case classified REJECTED rather than UNKNOWN, since
nothing left the process.

### Scope split and other ported rules

`integrations-api`'s new `icici-disbursement` module owns the vendor call only
(payload, encrypt, POST, decrypt, classify, log to `api_disburse_logs`).
`core-api`'s `DisbursalService` owns every business precondition, because it
owns the loan lifecycle and the `lead_disbursement_trans_log` the vendor call
must never bypass. `core-api` reaches it over the existing HMAC-signed internal
path.

Ported verbatim: the ₹7,000/₹100,000 bounds on the *sanctioned* amount (net
disbursal is what gets sent), the requirement for a loan account number and
verified customer banking details, the `IMPS/ICICI/<loanNo>/<bene name, 15
chars>/<amount>` payment reference, `x-priority: 0100`, the fixed sender
mobile and `retailerCode`, and the 300s timeout — a short timeout would
manufacture UNKNOWN outcomes.

**Not ported**, each for a stated reason: NEFT (legacy never built a request
payload for it and its response branch is commented out — rejected rather than
guessed); the QA mobile-number bypass that returns a fake success response in
development; the commented-out "this account number was already used" check;
and legacy's `if (!in_array($user_id, array(37, 31, 69, 83, 115)))` hardcoded
five-user whitelist. That last one *is* a real authorization gate, but
hardcoding user ids is not portable — the route keeps its existing
`@Roles('DS1','DS2')` and the acting user is now recorded on the transaction
row. Narrowing it to a named list is a client decision, not a guess.

The plaintext request is logged with `passCode`/`bcID` redacted; those are
standing credentials, not per-transaction values.

`buildTransactionReferenceNo()` uses `randomInt`, not `Math.random` — the
reference is ICICI's idempotency key, and a predictable suffix could collide
two distinct payments onto one reference.

Verified: lint/format clean, typecheck clean across all six workspaces, and
**49 new tests** — 9 on the envelope (round-trip, both IV branches, the
non-determinism that defect 1 was about, short-ciphertext rejection) and the
disbursal suite up from 22 to 36, covering SUCCESS/REJECTED/UNKNOWN outcome
mapping, PENDING-on-transport-throw, all three in-flight blocking states,
retry-after-FAILED, the already-referenced loan, both rupee bounds and missing
banking details. `core-api` 375, `integrations-api` 175 total.

**Never exercised against ICICI.** No sandbox or credentials exist here, so
this is written from the legacy source and the sample response embedded in it.
It stays inert until `ICICI_DISBURSAL_*` is set. `docs/TODO.md` lists the four
things to confirm in a sandbox before any environment is switched to
`paymentMode: ONLINE`.

## Task #151 — Close the test-coverage gaps, and make tests actually run on commit

Prompted by a direct question — "is everything tested, nothing missed?" — the
honest answer was no. An audit of all 241 non-trivial source files found 133
without a spec. Most of that is fine: ~90 are thin controllers that delegate
to a tested service, plus health endpoints. But five real gaps sat in code that
is either security-critical or that this session had just written or changed,
and one whole repo had no test runner at all.

**`icici-disbursement.service.ts` had no spec** — the worst of them. It builds
the money payload and classifies bank responses, i.e. it decides whether a
loan gets marked disbursed. Task #150 had tested the crypto envelope (9) and
the core-api orchestration (36) but not the service between them. Now 28 tests
using a real generated keypair written to temp files, so the actual
`readFileSync` + crypto path runs rather than being mocked: all three outcome
classifications, legacy's four-level error precedence
(`ActCodeDesc`>`MESSAGE`>`Response`>`description`), UNKNOWN on transport
failure / undecryptable response / non-JSON body, the 15-char beneficiary
truncation, `tranRefNo` echoed as the envelope `requestId`, proof that the
posted body contains neither the account number nor the passcode in
plaintext, that `passCode`/`bcID` are redacted from the persisted log, and
that NEFT is rejected without any API call.

**`LocalDiskStorageAdapter` had no spec**, despite being a real security
boundary: `Document.filePath` is an unvalidated client string
(`CreateDocumentDto` is only `@IsString() @MinLength(1)`) that the KYC-zip
endpoint feeds straight into `download()`. Its `resolvePath` is the only thing
between that and arbitrary file read. It was reviewed as correct in Task #142
and left untested — exactly the kind of guard that later gets "simplified".
13 tests now cover four traversal shapes across download/upload/delete, the
base-path-itself case, absolute-looking keys, and normal round-trips. One test
documents a real limitation rather than hiding it: the check is lexical, so it
does **not** follow symlinks — planting one requires filesystem access rather
than API access, so this is recorded, not fixed.

**`JwtStrategy.validate` had no spec**, though Task #142 added the only
per-request account check in the system to it. 6 tests: active passes,
deactivated/soft-deleted/missing all rejected, lookup is by token subject, and
— deliberately — the payload is returned rather than the DB row, so roles stay
token-scoped until the next refresh.

**The four PDF templates' escaping had no committed test.** Task #144 added
`escapeHtml` across all of them and verified it with a throwaway script, which
proves nothing about the next edit. 5 tests now push an
`<img src=x onerror=...>` payload through every string field of all four,
including one specifically for attribute-position escaping via `logoDataUri`
(where a bare quote closes the attribute and opens an event handler).

**`NotificationsService` had no spec** for the OTP delivery written in Task
#148. 6 tests: the dispatch shape, optional IP/UA omitted rather than sent
empty, the email-as-name fallback, that a delivery failure does **not** throw
(surfacing it would leak account existence), and that the OTP is never logged
unless `AUTH_OTP_DEBUG_LOG=true` — where it is additive to sending, not
instead of it.

**The frontend had no test runner at all**, so `safeExternalUrl` — the XSS
guard added in the same session — had zero automated coverage. Added `vitest`
plus 21 tests: every dangerous scheme blocked (`javascript:` in three casings
and with leading whitespace/tab/newline, `data:`, `vbscript:`, `file:`,
`blob:`, `about:`), real http/https and relative/protocol-relative links
allowed, and the original string returned rather than a normalised one, since
callers render it as both href and visible text.

Writing that test found a **real bug in the guard**: it used
`window.location.href` as the `URL` base, so in any non-browser context the
`ReferenceError` was swallowed by the catch and the function rejected
*everything*. A guard that silently rejects everything is as broken as one
that accepts everything, just harder to notice. Now falls back to an http base
when `window` is undefined.

**Neither pre-commit hook ran tests.** Both repos linted, formatted and
typechecked on commit while ~1000 tests sat unenforced. The backend had no
root `test` script at all. Added one (mirroring `typecheck`'s per-package
loop) and appended `&& bun run test` to both hooks. Commits are slower now;
for a lending system that is the right trade.

Two of these tests were failing when first written and the **code was right
both times** — my expectation was wrong. Recorded because the corrections are
now the documentation: `'Priyadarshini Sharma Extra Long'.slice(0, 15)` is
`'Priyadarshini S'`, not `'Priyadarshini'`; and `safeExternalUrl('::::')`
correctly *allows* it, because a schemeless string resolves to a harmless
same-origin path — the guard's job is blocking dangerous schemes, not
validating that a path is meaningful.

**Enforcing the tests immediately found a flake.** The new hook failed on its
first run: `automation-worker`'s `not-contactable-lead-sms.service.spec.ts`
died with `SIGSEGV` in a jest worker. Not a real failure — the suite passes
alone and the full suite passes on re-run — it is memory pressure from 21
suites each spinning up a Nest `TestingModule` in parallel. Left alone that
would be worse than no hook, because a hook that fails randomly gets bypassed
with `--no-verify`. Capped that package at `maxWorkers: "50%"` and confirmed
stability over three consecutive package runs and two full backend runs.

Totals: backend 979 (`core-api` 381, `integrations-api` 194,
`reporting-api` 193, `automation-worker` 119, `common` 80), frontend 21. All
passing, lint/format/typecheck clean in both repos.

**Still deliberately untested**, so it is not mistaken for coverage: the ~90
thin controllers; `database/`'s CLI scripts, which are verified by running
them against a real MySQL instead; `PuppeteerPdfRenderer` and
`S3StorageAdapter`, which need a browser and an AWS account respectively; and
the `gateway` nginx config, which has no nginx binary or Docker daemon
available here and was reviewed by inspection.

## Task #152 — PEM key material by value, and every secret out of this repo

Two client-directed changes, both about where credentials live.

### Keys are configured by value, not by file path

`ICICI_UPI_*_KEY_PATH` and `ICICI_DISBURSAL_*_PATH` are gone. Key material must
not sit on an EC2/ECS filesystem, so all four PEMs are now read from config —
Secrets Manager in a deployed environment, `.env` locally — by the same chain
as every other secret. Nothing to mount, nothing baked into an image, nothing
left behind on a terminated instance, and rotation becomes a secret update
rather than a deploy.

| was | is |
|---|---|
| `ICICI_UPI_PUBLIC_KEY_PATH` | `ICICI_UPI_PUBLIC_KEY` |
| `ICICI_UPI_PRIVATE_KEY_PATH` | `ICICI_UPI_PRIVATE_KEY` |
| `ICICI_DISBURSAL_PUBLIC_CERT_PATH` | `ICICI_DISBURSAL_PUBLIC_CERT` |
| `ICICI_DISBURSAL_PRIVATE_KEY_PATH` | `ICICI_DISBURSAL_PRIVATE_KEY` |

New `@finance-crm/common` `readPemFromConfig()` handles the awkward part: a PEM is
multi-line and `.env` is not. It accepts three equivalent encodings —
real newlines (what JSON holds), literal `\n` sequences (a single-line `.env`
entry), and base64 of the whole PEM (escape hatch for a pipeline that mangles
backslashes) — normalises CRLF, and adds a trailing newline. It validates the
result **and names the offending variable**, because OpenSSL's error for a
malformed key (`error:0909006C…`) says nothing about which one was wrong. 11
tests, including that the output actually loads via `createPrivateKey` rather
than merely looking like a PEM.

`readFileSync` is now absent from the whole source tree. The three remaining
`*PATH` variables are not key material: `AWS_SSM_PARAMETER_PATH` (an SSM
prefix), `STORAGE_LOCAL_PATH` (upload dir), `PUPPETEER_EXECUTABLE_PATH` (the
chromium binary).

One subtlety worth recording: in `UpiService` the key reads sit **inside** the
existing `try`, not hoisted above it. Hoisting them (my first attempt) made a
malformed key throw a 500 instead of writing the `API_ERROR` log row that every
other vendor failure in that service produces — a contract change disguised as
a refactor. The spec caught it.

### Every credential out of `backend/`

`docs/THIRD-PARTY-KEYS.md` is **deleted**. It was a file of real extracted
vendor credentials — Razorpay live key + secret, Surepass/Digitap/CartBI
tokens, SendGrid keys, AWS SES IAM keys, SMS and WhatsApp passwords. Gitignored,
but still sitting in a working tree that gets copied, zipped and shared.

Secrets now live in exactly two places: the legacy PHP (their original source,
so nothing is unrecoverable) and `the external secret store`, outside every
git repo. The `.gitignore` entry stays, with a note, so recreating the file can
never be committed by accident. `docs/DEPLOYMENT-DEV.md`'s reference to it is
repointed.

Swept the whole repo against 38 known credential values from that file and
confirmed zero remain. The one lingering hit was `docs/COMPLETED.md` describing
the legacy Razorpay leak as `Key => "rzp_live_..."` — already redacted, but even
the live-key *prefix* trips secret scanners, so the sentence now describes it
instead of quoting it.

### The two secret files

`secret.json` deleted, replaced by `secret.dev.json` and `secret.prod.json`
plus a `SECRETS-README.md`. Both carry all 132 keys the code can read, derived
from `.env.example` plus the 40 dynamically-built `CRON_<NAME>` keys — not
hand-maintained.

Real legacy values are filled in, **split by environment** wherever legacy had
an `ENVIRONMENT`-gated pair: Surepass (distinct dev/prod JWTs), Digitap (dev
token, prod base64-encoded from its `client_id:client_secret`), CartBI (distinct
tokens), Signzy (`api-preproduction` vs `api`), SendGrid (validation vs send
key). Where legacy had one value it is used for both and flagged.

Also fixed while auditing `.env.example`, which turned out to be missing 7 keys
the code actually reads: `PASSWORD_EXPIRY_DAYS`,
`REPAYMENT_DATE_WORKING_DAY_DIRECTION`, `TECH_EMAIL`, `NODE_ENV`, `PORT`,
`COMPANY_HOME_STATE_NAME`, `CRON_LOAN_OUTSTANDING_RECOMPUTE` — and had
`AWS_REGION` declared **twice**, which in a `.env` file is silently
last-one-wins.

Three defects in the old `secret.json`, all carried into production had nobody
looked:

1. **A live Razorpay key in a UAT-pointed config** — `rzp_live_…` with its
   secret, while `DB_*` pointed at the UAT database, so every test payment
   charged real money. Dev now has a `REPLACE_WITH_rzp_test_KEY` placeholder;
   prod keeps the live pair. That pair should be rotated regardless.
2. **`DB_HOST` was a phpMyAdmin URL**
   (`https://auth-db502.hstgr.io/index.php?route=…`), not a hostname, so
   `mysql2` could never have connected. Corrected to the host.
3. **`SMTP_HOST` was `smtp.mailgun.org`** — a vendor removed from the code.

`SECRETS-README.md` lists exactly what is still outstanding (39 prod, 28 dev,
minus the intentionally-blank ones) with the reason each cannot be recovered
from legacy, ranked so the ICICI disbursal credentials and the rotated UPI keys
come first.

Verified: lint/format/typecheck clean, full suite green (backend 990 — up 11
from the new PEM helper tests; frontend 21), and both JSON files parse with
identical key sets.

## Task #153 — recover the legacy config values Task #152 missed (2026-08-07)

Task #152 filled `secret.dev.json`/`secret.prod.json` from a **summary** of the
legacy credentials (`docs/THIRD-PARTY-KEYS.md`, since deleted) rather than from
the legacy config itself, and reported 39 prod / 28 dev values as
"unrecoverable, ask the client". Re-reading the actual PHP found 11 of them.
Outstanding is now **21 prod / 11 dev**.

Two process errors caused it, both worth not repeating:

1. **A summary was treated as a source.** The keys doc said
   `ICICI_GENERATE_EAZYPAY_..._MERCHANT_ID` was "env-var-only, no hardcoded
   value" and stopped there, so the disbursal credentials — which live in a
   *different* file it never covered
   (`application/helpers/integration/payday_disbursement_icici_helper.php`) —
   were never looked for.
2. **Three stale copies of the integration config exist**
   (`integration_config.php`, `_04052026.php`, `_20260613.php`) and the first
   pass grepped the dated backups. Only the undated one is live.

Recovered: `ICICI_DISBURSAL_API_KEY`, `ICICI_DISBURSAL_PASSCODE`,
`ICICI_DISBURSAL_BC_ID`, all four PEM values (`ICICI_UPI_PUBLIC_KEY`,
`ICICI_UPI_PRIVATE_KEY`, `ICICI_DISBURSAL_PUBLIC_CERT`,
`ICICI_DISBURSAL_PRIVATE_KEY`), `ICICI_UPI_TERMINAL_ID`,
`ICICI_UPI_QR_API_URL`, `TECH_EMAIL`, `CTO_EMAIL`. Full provenance table in
`SECRETS-README.md`.

Three of those would have been silently wrong if guessed:

- `ICICI_UPI_TERMINAL_ID` is **5411**, not the `6012` the `UPI_API` block sets
  as its default — legacy overrides it to `5411` inside the `QRCODE_REQUEST`
  branch, and the QR request is the only UPI subtype ported.
- `ICICI_UPI_QR_API_URL` must **end in the merchant ID** (`.../QR3/242204`),
  because legacy builds it as `".../QR3/" . MerchantId` and `UpiService` POSTs
  the configured URL verbatim. Task #152 stored the bare prefix, which 404s.
- The UPI and disbursal "public keys" are **two different X.509 certificates**
  (`prod_public_key_collection_icici.pem`, CN `eazypayapi.icicibank.com`, for
  UPI; `prod_public_icici.txt`, CN `upiclient.icicibank.co.in`, for disbursal)
  while **one** private key (`prod_private.key`) decrypts both responses.

Also fixed: something had stripped the literal substring `changeme` out of both
files, so `https://changeme.financecrm.com` had become `https://.financecrm.com` and
every standalone placeholder had become `""` — which reads as "deliberately
blank" rather than "missing". Placeholders are now `CHANGEME`, and the 6 genuinely
optional blanks are enumerated in `SECRETS-README.md` so the two are
distinguishable.

`JWT_ACCESS_SECRET`, `INTERNAL_SERVICE_SECRET` and `VENDOR_CALLBACK_TOKEN` are
now generated (32 random bytes each) rather than listed as client asks — there
is no reason to ask a client for a value only this system consumes, and the
services refuse to boot without them.

**`secret.dev.json` points disbursal at ICICI's sandbox
(`apibankingonesandbox.icicibank.com`), deliberately diverging from legacy**,
which used the production URL in *both* environments behind nothing but a
hardcoded mobile-number bypass. Same class of defect as the live Razorpay key
in the UAT config found in Task #152, except the blast radius is real bank
transfers. ICICI issues separate sandbox credentials, so dev disbursal fails
authentication until those arrive — the correct failure mode.

Two things this surfaced, both now in `docs/TODO.md`:

- Legacy gates disbursal on a **hardcoded five-user whitelist**
  (`payday_disbursement_icici_helper.php:159`). The port guards by role, which
  is the right shape but strictly weaker; needs a client decision before
  `paymentMode: ONLINE`.
- **Both ICICI certificates are long expired** (2018-02-14 and 2019-05-24).
  Neither PHP's `openssl_public_encrypt` nor Node's `publicEncrypt` checks
  `notAfter` — only the RSA public key inside is used — which is why legacy
  still works and why these are genuinely the values in production today.

Verified: all four PEM values load through `readPemFromConfig` and a real
encrypt/decrypt round-trip through `icici-rsa.util` matches; `icici-envelope.util`
produces a fresh session key and IV per request against the **real** bank
certificate (confirming the three legacy crypto defects fixed in Task #150 stay
fixed with real key material); `requestId` tracks `payload.tranRefNo`; and a
sweep of every recovered credential value across `backend/` returns zero hits.

## Task #154 — a real disbursal-authorisation list, replacing legacy's hardcoded five (2026-08-07)

`docs/TODO.md` carried an open question from Task #153: legacy gates the ICICI
disbursal call on a hardcoded user-id whitelist
(`payday_disbursement_icici_helper.php:159`,
`if (!in_array($user_id, array(37, 31, 69, 83, 115)))`, throwing
"Un-Authorized access of disbursement api"), while the port guarded the route
by role only — the right shape, but strictly weaker: a role admits everyone
holding it, legacy admitted five named people. Closed by giving the port the
same restriction in a form that survives a rewrite: a table.

**`disbursal_authorised_users`** (`DisbursalAuthorisedUser`, `NEW` in
`docs/SCHEMA-MAP.md`) — `BaseEntity` + a unique `userId` FK to `users.user_id`
+ `grantedById`. Deliberately small: this is a membership list, not a
permission system. Revocation flips `isActive` rather than deleting, so the
grant history of a money permission survives.

**Enforcement** is in `DisbursalService.disburseOnlineViaIcici()`, not the
controller, and runs **before** the transaction row is written or ICICI is
called — an unlisted user cannot even leave a blocking `INITIATED` row behind.
It **fails closed on a missing acting user**: `actingUserId === undefined` is
rejected exactly like an unlisted id, so a caller that loses the user id can
never move money anonymously. Scope matches legacy: ONLINE only. OFFLINE
disbursal is bookkeeping for a transfer a human already made and stays
role-gated. The list is *in addition to* `@Roles('DS1','DS2')` on the route,
never instead of it.

**Managing it**: `GET/POST/DELETE /disbursal-authorised-users[/:userId]`
(`DisbursalAuthorisedUsersController`), `@Roles('SA','CA')` — editing who may
move money is a higher privilege than moving it. `POST` is idempotent:
re-granting a revoked user reactivates the existing row rather than colliding
on the unique index, and 404s on a user id that doesn't exist so a typo can't
create a dangling grant.

**The table ships EMPTY**, which means nobody can disburse online until the
client names people. That is the correct fail-closed default for a money path
— legacy's five are legacy user-ids and have to be confirmed as still-current
humans, not copied across on faith. That confirmation is the one thing left
open in `docs/TODO.md`.

**Migration**: folded into `m1.sql` rather than added as `m3.sql`, and the
former `m2.sql`/`m2.down.sql` (the OTP attempt counter) was folded in too and
deleted — there is now exactly ONE migration file for an operator to run.
Safe only because every block is idempotent: an environment that already ran
an earlier m1 re-runs it and no-ops on everything it already has. `m1.sql` is
now 35 blocks, `m1.down.sql` its exact 35-block reverse (verified by diffing
the reversed TARGET list).

Tests: 6 new cases in `disbursal.service.spec.ts` — unlisted user rejected
with nothing written or sent, absent acting user rejected (fail-closed),
OFFLINE unaffected, grant reactivates instead of duplicating, grant 404s on an
unknown user, revoke deactivates rather than deletes. 387 core-api tests pass.

## Task #155 — stop creating the unused `whatsapp_logs` table (2026-08-07)

Client instruction: m1.sql should not create a WhatsApp table when there is no
WhatsApp module, and must not touch the old one.

Both halves checked before changing anything:

- **m1.sql never dropped any table.** Its only `DROP` is
  `DROP TRIGGER IF EXISTS before_insert_collection_bucket_wise_permission`,
  a drop-then-create used purely for idempotency (real MySQL's prepared-
  statement protocol rejects `CREATE TRIGGER`, so the `information_schema`
  gate other blocks use isn't available there). No legacy table, and
  specifically not `api_whatsapp_logs`, was ever at risk.
- **`api_whatsapp_logs`** — the real legacy table (prod shape `msg_*`) — is
  created by `init.sql` (the 149-table legacy baseline) and is `LEGACY-ONLY`
  in `docs/SCHEMA-MAP.md`: no entity, no code, untouched.

What was removed is `whatsapp_logs`, a different table: a `NEW` one this
rewrite invented (`wa_*` columns, deliberately never mapped onto the legacy
one) whose entity and module were deleted in Task #146. m1.sql was still
creating it, so every fresh environment got an empty table nothing could read
or write. Its `CREATE TABLE` block is gone from `m1.sql` and the matching
`DROP TABLE` block from `m1.down.sql` — 34 blocks each now, still exact
reverses (verified by diffing the reversed TARGET list).

This drops nothing: an environment that already ran an earlier m1 keeps the
empty table it was given, and no row anywhere is affected. It only stops
*new* environments from acquiring it.

The removed vendors' **legacy** log tables (`api_finbox_device_connect_logs`,
`api_appsflyer_push_events`, `api_url_shortener_logs`) are deliberately still
created — those are real tables an environment may hold rows in, so the
"every existing table and row is preserved" rule still applies to them.
`CLAUDE.md`'s vendor-removal decision was corrected to state this split
(it previously claimed m1.sql was untouched by vendor removals).

## Task #156 — cron schedules no longer read from `crm_settings` (2026-08-07)

Client instruction: don't take cron from settings.

`ConfigurableJobRunner` resolved each job's timing as `crm_settings` row →
`CRON_<NAME>` env var → the job's hardcoded default. The DB stage is gone; it
is now env var → hardcoded default, with `disabled` (from either, case-
insensitive) still meaning "don't schedule this job at all". All 40 job names
and their defaults are unchanged, and no job file needed touching — the
override lives entirely in the wrapper.

Removed with it:

- `JobRunnerModule` no longer imports `CrmSettingsModule`, no longer injects
  `CrmSettingsService`, and its `JOB_RUNNER` factory is **synchronous** again
  (the `async`/`await` existed only to bulk-load `getAllForService` before
  `schedule()` could stay sync). The try/catch that tolerated a failed
  settings query at boot went with it — there is no longer a query to fail.
- `SERVICE_NAME` — it existed solely to scope which `crm_settings` rows a
  process read. Nothing in any service reads it now (verified by grep), so it
  is out of `.env.example` and `docs/DEPLOYMENT.md` rather than left as an
  env var that silently does nothing.
- The 4-stage config chain in `.env.example`'s header and `CLAUDE.md`'s
  architecture decision is now a 2-stage one (SSM → Secrets Manager, over
  `.env`). **Nothing is read from the database.**

Tests: the two DB-override cases in `configurable-job-runner.spec.ts` are
replaced by env-var equivalents plus a case pinning the `CRON_<NAME>` key
derivation and one for a hardcoded `disabled` default. 84 common tests pass.

`CrmSettingsService`, `CrmSettingsModule`, the `CrmSetting` entity and the
`crm_settings` table still exist with **zero consumers** — cron was the only
one. Whether to delete them outright is left as an open item in
`docs/TODO.md` rather than decided here, since dropping the table is a schema
call the client should make (same class of decision as Task #155's).

## Task #157 — fix the intermittent SIGSEGV in the test run (2026-08-07)

`bun run test` failed roughly 1 run in 20 with:

```
A jest worker process (pid=...) was terminated by another process:
signal=SIGSEGV, exitCode=null.
```

Not a test defect. Two things established that before anything was changed:

- **The suite it killed varied run to run** — `notifications.service.spec.ts`
  on one machine, `cam.service.spec.ts` here. A real defect picks the same
  file every time.
- **Every test that ran, passed.** The count just dropped (387 -> 381)
  because one suite never executed; the worker holding it died first.

The crash is in jest-worker's forked child processes under Bun's runtime, so
the fix is to not fork any: `jest --runInBand` in all five services' `test`
scripts. This removes the failure mode by construction rather than retrying
or suppressing it. `test:watch`/`test:cov` are left alone (interactive/one-off,
and watch mode wants its workers).

Measured: 1-in-20 before; 0 SIGSEGV in 12 consecutive core-api runs and 7
consecutive full-repo runs after. Full run goes from ~9s to ~14s, core-api
from 2.5s to 3.9s — worth it for a pre-commit hook that was failing one
commit in twenty for no real reason.

## Task #158 — Remove Credeau for good, this time including its allocation cron band (2026-08-07)

Credeau's history up to this point: on the client's original keep-list, removed
Task #146, restored the same day per Task #147. The client has now separately
confirmed the integration itself is genuinely unused — not just off a
keep-list — so it comes back out, following the same "code-only, nothing
dropped" removal shape as the other five vendors in Task #146.

**Scope this time is wider than Task #146's Credeau removal.** That pass
deliberately *kept* `CreditApplicationAllocationService`'s
`credeau-application-allocation` band (`*/30 * * * *`) because it's a
lead-**allocation** job, not a vendor call — it assigns straight-through
leads to credit users and never touched the Credeau API. This time the
client confirmed that band is unused too, so it's removed along with the
vendor integration — a deliberate scope change from the earlier decision,
not an oversight repeating it.

Removed:
- `integrations-api`'s `credeau` module (controller/service/dto/spec) and its
  `AppModule` registration.
- `CredeauLog`/`CredeauDecision`/`CredeauMethod` (`@finance-crm/database`) and the
  barrel export — `ALL_ENTITIES` derives from that export, so no separate
  `forFeature` list needed updating anywhere.
- `CamService.eligibleLoanAmount()`'s Credeau-STP override (the
  `MIN_CREDEAU_OVERRIDE_AMOUNT`/`CREDEAU_STP_CREATION_MODE` constants and the
  `CredeauLog` read) — STP (`creationMode=1`) leads now get the same flat-FOIR
  cap as everyone else. `cam.service.spec.ts`'s three STP-override cases
  become one asserting that flat cap.
- `AuditService.checkStraightThroughEligibility()`'s Credeau approved-amount
  cap and its now-unused `camRepository`/`credeauLogRepository` injections —
  the FOIR cap in `CamService.assertWithinLoanLimits()` is the only ceiling
  left for these leads too. No spec file existed for `AuditService` to update.
- The `credeau-application-allocation` band in
  `CreditApplicationAllocationService.BANDS` (the whole 4th entry) and the
  `stageCodes`/`straightThroughOnly` `CreditBandConfig` fields that existed
  only to serve it — `credit-application-allocation.service.spec.ts`'s two
  `describe('credeau band', ...)` cases removed, the "schedules all four
  bands" case becomes three.
- `.env.example`'s `CREDEAU_CLIENT_ID`/`CREDEAU_AUTH_TOKEN` and
  `CRON_CREDEAU_APPLICATION_ALLOCATION` — the last one was already dead
  documentation: the band's cron expression was hardcoded in
  `CreditApplicationAllocationService.BANDS`, never actually read from that
  env var.

**Not touched, same reasoning as Task #146:**
- `api_credeau_log` — created by `init.sql` (legacy baseline, not one of the
  `mN.sql` additive files), so it's outside this migration's schema-change
  tooling entirely. Table and every row stay.
- `Lead.credeauStatus` and `CifCustomer.credeauApprovedCustomer` — plain
  columns, written from our own `lead.creationMode`, never from vendor data.
  `CamService.assignCifCustomer()` keeps writing `credeauApprovedCustomer`
  exactly as before.
- Provider-agnostic docs: `docs/THIRD-PARTY-INTEGRATIONS.md` is a legacy-code
  inventory (what the PHP app calls), not migration status — every other
  removed vendor is still listed there too, so Credeau's entry stays as-is.

Updated: `CLAUDE.md`'s vendor-list architecture rule, `docs/EXCLUDED.md`
(new dedicated section plus a correction to the stale "restored, still live"
claim in the existing Credeau paragraph), `docs/SCHEMA-MAP.md` (`api_credeau_log`
marked `_entity removed_`, matching the other five), `docs/DETAILS.md`, and
`docs/DEPLOYMENT.md` (env checklist and both security-group vendor-list
comments).

Verified: typecheck clean across all six workspaces, lint/format clean.
Tests all passing: `database` 84, `common` 8, `core-api` 385,
`integrations-api` 191 (down 3 for the deleted `credeau.service.spec.ts`),
`automation-worker` 117 (down 2 for the deleted credeau-band cases),
`reporting-api` 193.

## Task #159 — Dev deployment to EC2, and the AWS-only-config boot bug it exposed (2026-08-09)

The 4 services + gateway now run on the dev EC2 box (`203.0.113.10`) under
`/opt/crm`, reading all 124 config keys from AWS Secrets Manager (`finance-crm/dev`)
via the instance role, behind host nginx doing TLS. Full as-built record,
including every problem hit and how it was fixed, is in
`docs/EC2-DEV-DEPLOYMENT.md`; `docs/DEPLOYMENT-DEV.md` remains the generic
procedure and now points at it.

The one change to application code came out of a real bug this deployment was
the first thing to expose. Every service crash-looped on
`Configuration key "JWT_ACCESS_SECRET" does not exist`, even though the
loader returned all 124 keys when called by hand in the same container. Cause:
Nest resolves providers module by module, and a `useFactory` injecting
`ConfigService` (`SharedAuthModule`) can be instantiated **before**
`ConfigModule.forRoot({ load: [...] })`'s async factories resolve — the boot
log showed `CommonModule` initialising ahead of `ConfigModule`, and
`ConfigModule` completing in 1 ms, far too fast for a round-trip to AWS.

It never reproduces locally because `.env` is parsed synchronously inside
`forRoot()`, so every key is in `process.env` before any factory runs. It only
bites when a key exists **only** in AWS.

Fix: `common/src/config/hydrate-remote-config.ts` exports
`hydrateRemoteConfig()`, which runs `awsSsmLoader` + `awsSecretsLoader` and
copies the merged result into `process.env`. All four services now `await` it
as the first statement of `bootstrap()`, before `NestFactory.create`, so
provider ordering stops mattering. Precedence is unchanged — dotenv does not
overwrite existing `process.env` entries, so AWS still beats `.env`, and SSM
is applied before Secrets Manager so Secrets Manager still wins a clash. The
`load: [...]` arrays are deliberately left in place in every `AppModule`:
redundant, harmless, and they keep the documented resolution chain true if the
bootstrap call is ever removed.

## Task #160 — Real vendor credentials, Cloudflare TLS, and the UAT data load (2026-08-10)

The dev box moved from "boots correctly" to "actually usable end to end".
Full detail in `docs/EC2-DEV-DEPLOYMENT.md` steps 19-22; the parts worth
carrying forward:

**Two supplied tokens were corrupted by autocapitalisation** — `ZEPTOMAIL_TOKEN`
and `VAPIO_API_KEY` each differed from the live legacy value only in the case of
their *second* character (`PHtE`->`PhtE`, `DJhg`->`Djhg`). Settled empirically
rather than by preference: posting an empty body to ZeptoMail returns 400 "Bad
Syntax" (authenticated) for the legacy casing and 500 (rejected) for the pasted
one. Legacy casing stored for both.

**Three URLs were wrong for how the code consumes them.**
`ACCOUNT_AGGREGATOR_NP_URL` is a base that the service appends
`api/generateNetBankingRequest` to, and it held the *bank-analysis* path
(`https://cartbi.com/api/upload`) plus that vendor's token — two different
CartBI endpoints that happen to share a host. `SIGNZY_BASE_URL` needs its
trailing `api/` because paths are `v3/…`, and now points at Signzy
**production**. `ZEPTOMAIL_URL` must stay the bare host: the SDK appends
`v1.1/email` itself.

**TLS is solved by Cloudflare, not Let's Encrypt.** `api.financecrm.com`
resolves to Cloudflare, which serves a publicly trusted certificate to a
self-signed origin. No certificate needs issuing and :80 never has to be opened
to the world. `TRUSTED_PROXY_HOPS` is 3 as a result (Cloudflare -> host nginx ->
gateway).

**Hostinger MySQL is back in use**, and was found holding the bare 149-table
baseline with zero rows and `m1` unapplied — no `user_password_hash`, so auth
could not have worked at all. `m1` applied from a developer machine, then data
loaded from `uat.sql`, the only dump that has any (`dev.sql`/`prod.sql` are
structure-only, 0 inserts — they are where `init.sql` came from). Loaded
data-only rather than reverting `m1` first: the dump has no `DROP TABLE`, so its
`CREATE TABLE`s would collide, and unwinding a migration to load data risks the
schema for nothing.

Three statements failed under `--force` and were repaired: `customer_profile`
lost all 83 rows to a `cp_is_mobile_verified` column the UAT source has and the
dev-derived baseline never did (added back; no entity maps it), and
`master_pincode` lost ~3k rows to unique-key collisions (re-run as
`INSERT IGNORE`, 20,627 of 20,650 loaded).

**`company_login` is empty in the dump on every environment**, while all users
and leads reference `company_id = 1`. `User.company`/`Lead.company` are
non-nullable `@ManyToOne`, which TypeORM loads with an INNER JOIN — so every
list endpoint returns zero rows against real data while sign-in still succeeds
(it queries by email with no relations). Seeding that one row is now part of
loading any environment.

## Task #161 — CORS allow-list for the deployed front ends (2026-08-10)

The CRM moved to `https://crm.financecrm.com` (plus its raw CloudFront
URL), both cross-origin to the API, so CORS became load-bearing for the first
time — the Vite dev proxy had made every call same-origin until now.

`@finance-crm/common`'s new `parseCorsOrigins()` splits `CORS_ORIGIN` as a
comma-separated list, returning an array even for a single entry and falling
back to the dev origin rather than `*` when unset: `credentials: true` forbids
the wildcard, and a forgotten variable must not echo an attacker's `Origin`
back alongside `Access-Control-Allow-Credentials: true`. Covered by
`cors-origins.spec.ts`.

Also found: **only `core-api` called `enableCors` at all.** `reporting-api` and
`integrations-api` had none, so `/api/v1/reporting/*` and
`/api/v1/integrations/*` would have failed in a browser while `/api/v1/leads`
worked — invisible locally because of the proxy. All three now share the
allow-list.

**Known limit, deliberate:** the raw CloudFront URL passes CORS but still
cannot hold a session. `cloudfront.net` is on the Public Suffix List, so it is
a different registrable domain from `financecrm.com` and the
`SameSite=Lax`/`Strict` auth cookies are neither stored nor sent cross-site.
`crm.financecrm.com` is same-site with the API and works fully. Making
the CloudFront URL work would require `SameSite=None`, which removes the only
CSRF defence this API has — a decision to take explicitly, not silently.

## Task #162 — activity log records platform and browser again (2026-08-10)

`user_activity_log.ual_platform` / `ual_browser` were null on every row this
backend wrote, so the CRM's Activity screen showed a blank Platform column next
to legacy rows that had one. `AuthService.recordActivity` saved the raw
`ual_agent` but never derived the two parsed columns beside it.

Legacy filled them with CodeIgniter's user-agent library
(`Admin_Model.php:201-202` — `$this->agent->platform()` and
`$this->agent->browser() . ' ' . $this->agent->version()`), which is why the
existing rows read `Windows 10` / `Chrome 148.0.0.0`. `@finance-crm/common`'s
`parseUserAgent()` reproduces that exact vocabulary and ordering from
`application/config/user_agents.php`, so new rows group with the old ones
instead of forming a parallel set.

Hand-rolled rather than adding a UA-parsing dependency on purpose: a library
returns its own vocabulary (`macOS`, `Microsoft Edge`) and would reintroduce
precisely the mismatch this avoids. Order is load-bearing — Edge, Opera and
Brave all carry a `Chrome/` token, so the checks run most-specific first;
covered by `parse-user-agent.spec.ts`.

Existing null rows are left as they are: the raw agent string was never stored
for most of them either, so there is nothing to backfill from.

## Task #163 — create-user form was unsubmittable (2026-08-10)

The CRM's New User form could never succeed: the API required `companyId`,
`productId` and `mobile`, while the form collected only name/email/password,
typed all three of those as optional, and labelled the field
"Mobile (optional)".

Resolved against the column definitions rather than by preference:

| Column | Nullable | Default | Decision |
|---|---|---|---|
| `users.mobile` | NO | none | **Stays required.** No default to fall back on, and all 184 migrated users have one. |
| `users.company_id` | NO | 1 | Now optional in the DTO, defaulting to 1. |
| `users.product_id` | NO | 1 | Same. |

Requiring company/product in the API while giving the UI no way to choose them
was the actual defect — and with one company and one product in the data, two
single-option dropdowns would have been worse. The service applies
`?? DEFAULT_*` rather than trusting the DTO property initialiser alone, since
that only fires when the key is absent and an explicit `null` would slip past.

Frontend now requires mobile, strips non-digits as you type (a pasted `+91`
prefix or spaces was the common failure), caps at 10, and shows the error
beside the field instead of surfacing the API's doubled message — an absent
value trips both `@IsString` and `@Matches`, which is why one empty field read
as "mobile must be a string, mobile must be 10 digits".

Verified against the deployed API: create without company/product succeeds and
defaults to 1/1, create without mobile still 400s, and an explicit
`companyId: null` is handled.

## Task #164 — every inter-service call was 404ing (2026-08-10)

`IntegrationsApiClient` built its URL as `${INTEGRATIONS_API_URL}${path}`, but
`integrations-api` mounts every route under
`setGlobalPrefix('api/v1/integrations')`. So `core-api` was POSTing to
`/email/password-reset-otp` when the route is
`/api/v1/integrations/email/password-reset-otp`. Proved from inside the
container: the bare path returns 404, the prefixed one 401 (route found,
correctly rejecting an unsigned probe).

**Scope was everything that leaves this system**, not just the password-reset
OTP: all six automation-worker email jobs (repayment reminders, birthday,
re-loan pitch, closed-loan feedback, not-contactable, legal notice), the SMS
jobs, disbursal, and RUNO allocation. Every one of them catches and logs its
own failure, so a 404 presented as "no mail arrived" rather than as a
misconfiguration — which is why it survived this long.

Fixed in the client rather than in `INTEGRATIONS_API_URL`: the prefix is a
property of the service's own routing, not of where it is deployed, so one
change covers local dev, docker-compose and production alike. `buildUrl()`
tolerates a base that already carries the prefix, since a path-routed ALB
target may legitimately be configured that way.

Two existing tests asserted the unprefixed URL — they had encoded the bug, and
were corrected alongside three new ones covering bare/prefixed/trailing-slash
bases. Verified live afterwards: `Password reset OTP email dispatched` where
the same call had logged `Request failed with status code 404` minutes before.

The signed path stays consistent: the client signs `new URL(url).pathname` and
`JwtAuthGuard` verifies against Express's `request.path`, both of which now
include the prefix.

## Task #165 — password-reset OTP email redesigned (2026-08-10)

The email was a faithful port of legacy's `border="1"` grid: every line the
same weight, the OTP sitting in an ordinary table row between "Login User" and
"User IP", and the full raw `User-Agent` string dumped at the reader.

Rebuilt around one idea — the OTP is the only thing the recipient came for, and
the request context is evidence rather than content. The code is now a
letter-spaced monospace block on its own card; IP, device and timestamp are a
small "Request details" footnote. Nothing was dropped: those rows are how a
recipient who did *not* request the reset spots an account takeover, which is
the whole reason legacy included them.

Built to real HTML-email constraints: tables not divs (Outlook's Word engine
has no usable flex/grid), inline styles only (Gmail strips `<style>` in several
clients), no web fonts, and legible with images off — which is the default in
many clients, so no information lives only inside the logo.

The device line now uses `parseUserAgent` (Task #162), which is what the
template's own comment said was missing: legacy split platform/browser via
CodeIgniter's `$this->agent`, and this restores that rather than showing a
120-character header to someone being asked "was this you?".

**Logo hosting.** Served by `integrations-api` itself at
`/api/v1/integrations/assets/`, via `useStaticAssets`. Not from S3: that bucket
holds KYC documents and must never be public. Not from the frontend either —
the email is produced by the backend, so hanging it off a frontend deploy would
break it whenever the frontend moves. The path sits under the gateway's
existing `/api/v1/integrations/` route so it reaches this service, and being
Express middleware it runs ahead of the global `JwtAuthGuard`, which is
required: a mail client fetches it with no session. Converted to PNG at 320px
because Outlook cannot render the app's `.webp` at all.

`PUBLIC_API_URL` is the externally reachable origin, distinct from
`INTEGRATIONS_API_URL` (in-cluster, unreachable from a mail client). Unset
degrades to a text wordmark rather than a broken image — a broken image in a
security email reads as phishing.

Also removed `bun run format` from both repos' husky pre-commit hooks: it
writes files *after* git has staged them, so anything it reformatted landed
outside the commit and needed a follow-up "style:" commit. `lint` still fails
the commit on a real problem.

## Task #166 — Collection Buckets admin page (2026-08-11)

Task #101 shipped `CollectionBucketPermissionService` and its two
`core-api` controllers (`/collection-buckets`, `/collection-bucket-permissions`)
but no frontend ever called them — the DPD-bucket CRUD and grant/revoke UI
was backend-only until now, an oversight rather than a deferred decision
(nothing in `docs/TODO.md` tracked it).

- New `frontend/core-crm/src/lib/collection-buckets.ts` — thin `apiFetch`
  wrappers for both controllers, same shape as `lib/company-holidays.ts`/
  `lib/users.ts`'s role-grant functions.
- New route `/collection-buckets` (`routes/collection-buckets.tsx`,
  `SA`/`CA`-gated via `useHasRole`, same pattern as `roles.tsx`/
  `company-holidays.tsx`): a bucket CRUD table (name + DPD range, add/
  delete — no in-place edit, matching `roles.tsx`'s convention of skipping
  it too) and a permission-grant table (search-then-pick user, same
  `SupervisorPicker` pattern as `users.tsx`, plus bucket and optional role
  selects, list + revoke). Added to the sidebar nav in `__root.tsx`.
- `CollectionBucketPermissionService` had zero test coverage despite real
  branching logic (optional `userRoleId`, the `getVisibleDpdRange`
  MIN/MAX query). New `collection-bucket-permission.service.spec.ts`
  (15 tests) covers bucket CRUD, grant/revoke including the two
  `NotFoundException` paths, and both branches of `getVisibleDpdRange`
  (a range, and no grants → null).
- Verified: `bun run format/lint/typecheck` clean in both repos; core-api
  400 tests pass; frontend `vitest` 21 tests pass, `tsc -b`/`vite build`
  clean (route tree regenerated).

**`getVisibleDpdRange` removed (2026-08-11, Task #167)** — see that task for
why: it was never consumable, since the legacy behavior it ported was
already dead code in production before this migration started.

**Still not done, deliberately** — nothing filters a collection agent's loan
worklist by their granted DPD range (`LeadsService`'s `QUEUE_ROLE_SCOPES` for
`CO1`/`CO3` scopes by stage code only). Wiring that in is a row-level
authorization policy change, not a CRUD gap, and CLAUDE.md is explicit that
this codebase doesn't invent a
role→lead-stage read policy without a client decision — same reasoning as the
open `menu_permissions`-enforcement item. Needs an explicit decision before
being built.

## Task #167 — Two "bucket" reports fixed for real, one new self-service feature (2026-08-11)

Follow-up to Task #166's feature audit. Two of the four bucket reports
(`docs/COMPLETED.md`'s earlier notes) were flagged as "approximated" —
reading the actual live legacy source showed both needed more than a tweak.

- **`bucketWiseSanctionExecutive` (report_id 83) — full rewrite.** The
  previous port invented a DPD-bucket shape (0-30/31-60/61-90/90+ days
  since disbursal) with no basis in what legacy actually runs. Read
  `Report_Model.php:7985` directly: an earlier, real DPD-bucketed query
  (`$query_screener`/`$query_credit_manager`) exists in the file but is
  entirely commented out — the query that actually executes (`$query_agent`)
  is Screener-vs-Credit-Manager fresh/repeat case performance, no DPD
  concept at all. "Bucket-wise" is leftover naming, same numeric-id-drift
  class as report ids 54/55/57/72/73 already documented elsewhere in this
  file. Rewritten field-for-field: fresh/repeat case counts +
  `loan_recommended` sums per active CR1/CR2 user, ranked (CREDIT rows
  first, then repeat count, then total cases), one grand-total row summing
  only CREDIT (legacy does the same, not a bug). The `leads.user_type = 1/2`
  comparison in legacy is a MySQL enum-ordinal comparison
  (`enum('NEW','REPEAT','UNPAID-REPEAT')` compared to an int) — ported as a
  direct string comparison, same class of fix as `VERIFICATION_APPROVED`
  elsewhere in this module. Hardcoded legacy exclude-lists (admin/system
  user ids, including the real screener/credit-branch difference of id 37)
  carried over verbatim rather than guessed at.
- **`currentBucketStatus` (report_id 73) — full rewrite, not just adding the
  missing flag.** The previous port's own comment said only the
  `user_lead_allocation_log` activity flags were omitted; reading
  `Report_Model.php:10779` showed the whole shape was simplified — missing
  the credit-head/supervisor join, the specific in-process status filter,
  the `COALESCE(creditAssign, screenerAssign)` fallback, and the "logged in
  within 3 days" eligibility filter. All ported now, plus the activity-flag
  CTE this table's new entity finally makes possible.
- **New `UserLeadAllocationLog` entity** (`database/src/entities/users/`,
  `ADOPT` in `docs/SCHEMA-MAP.md` — the table already existed in
  `init.sql`, just unmapped). Investigated whether `user_lead_allocation_log`
  should also gate the real automation-worker allocation cron, since
  `CronSanction_Model.php` reads it for exactly that. It doesn't: those
  reads live entirely inside `CronSanctionController.php`, which the
  client-supplied real production crontab (Tasks #89-91) already confirmed
  is not what actually runs — the real cron
  (`Automate::allocateLeadsAndApplication`, ported as
  `AllocateLeadsAndApplicationService`) uses `UserActivityLog`'s
  login-today signal instead, already correctly implemented. So this table
  is wired only into the self-service toggle and the report, not into any
  cron eligibility — building that would mean wiring new behavior onto a
  code path with no real production basis.
- **New self-service endpoint**, `core-api`'s `LeadAllocationModule`
  (`POST /lead-allocation`, `GET /lead-allocation/today`, `@Roles('CR1',
  'CR2')`) — ports `LoginController::leadAllocation()`, the profile-page
  toggle a screener/credit-manager uses to declare "active today, fresh or
  repeat". Each declaration is a new row (legacy inserts, never updates);
  "today's status" is the latest one created today.
- **New frontend control**, `components/lead-allocation-toggle.tsx` — this
  frontend has no profile page yet, so it's surfaced in the header
  (`__root.tsx`, next to the global search bar) instead, visible only to
  CR1/CR2 users via `useHasRole`.
- **Cleanup**: `CollectionBucketPermissionService.getVisibleDpdRange()` (Task
  #166) removed — confirmed dead code with no real consumer (see the note
  above this task), same "delete rather than leave half-built" call as the
  rest of this session's bucket-feature audit. Its two tests removed with
  it (13 remain in that spec file).
- Verified: `bun run format/lint/typecheck` clean across the whole
  monorepo; full test suite passes (946 tests: database 8, common 107,
  core-api 401, integrations-api 193, automation-worker 117, reporting-api
  194); frontend `vitest` 21 tests, `tsc -b`/`vite build` clean.

## Task #168 — Fixed vendor-call status always reading as "failed" in the UI, plus a null-date display bug (found live-testing the deployed frontend, 2026-08-11)

Manual QA pass against `https://crm.financecrm.com/`, logged in as an
`AF`-role user. Two real bugs found and fixed; both verified live in Chrome
before and after.

- **Every vendor-call result in the CRM displayed as failed, regardless of
  the real outcome.** First noticed on the lead-detail page's "Verify PAN"
  button: the inline result badge rendered the bare digit `1` instead of a
  status label, and the toast always said "PAN verification failed" even
  though the underlying call could have succeeded. Root cause: `ApiCallStatus`
  (`database/src/entities/integrations/api-call-status.ts`) is a numeric
  TypeScript enum (`SUCCESS = 1`, etc.), and every one of the ~20
  `api_*_logs` entities maps its status column straight to that type with no
  transform — so TypeORM returns the raw number and `ClassSerializerInterceptor`
  ships it to the frontend as `"status": 1`, not `"status": "SUCCESS"`. Every
  frontend consumer (`frontend/core-crm/src/lib/integrations.ts`, ~20 log
  types) types `status` as the string union and compares `=== 'SUCCESS'` —
  a comparison that can never be true against a number, so every vendor-call
  card (PAN/CRIF bureau/bank verification/UAN/account-aggregator/eKYC/eSign/
  video-KYC/face-match/reverse-geocode/UPI/etc.) always rendered the
  failure/destructive styling. Fixed at the serialization boundary only:
  added `SerializeApiCallStatus()` (a `class-transformer` `@Transform` with
  `toPlainOnly: true`) next to the enum, converting the numeric value to its
  string key on the way out to HTTP responses — the in-memory value TypeORM
  and every service still work with stays numeric, so no internal
  comparison logic changes. Applied to the `status`/`apiStatus` column in
  all 20 affected entities (`account-aggregator-log`, `bank-analysis-log`,
  `bank-verification-log`, `call-management-log`, `disbursement-api-log`,
  `domain-verification-log`, `ekyc-log`, `email-validation-log`,
  `email-verification-log`, `enach-log`, `esign-log`, `face-match-log`,
  `middleware-api-log`, `poi-verification-log`, `reverse-geocode-log`,
  `sms-log`, `uan-verification-log`, `upi-callback-log`,
  `upi-collection-log`, `video-kyc-log`). Left `repayment-log`'s
  `RepaymentApiStatus` and `address-lat-long-log`'s `AddressApiStatus` alone —
  both are already their own separate numeric enums with no frontend
  consumer yet, not the shared bug. Self-check added inline in
  `api-call-status.ts` (`if (require.main === module)`, runnable via
  `bun run src/entities/integrations/api-call-status.ts`) since this file
  has no existing test harness.
- **Collections queue showed "01 Jan 1970" for leads with no real update
  timestamp.** `frontend/core-crm/src/routes/collections.tsx`'s `formatDate`
  did `new Date(value).toLocaleDateString(...)` with no null guard; `Lead
  .updatedAt` (`database`'s `lead.entity.ts`, mapped from legacy
  `updated_on`, `nullable: true`) is genuinely `null` for leads never
  touched since import, and `new Date(null)` is the Unix epoch, not
  `Invalid Date`. Fixed the same way `formatCurrency` already handles a null
  amount on the same page: return `'—'` for a null value. Widened `Lead
  .updatedAt`'s frontend type (`frontend/core-crm/src/lib/leads.ts`) from
  `string` to `string | null` to match reality; no other call site read
  that field.
- **"Rejected leads" header count and pagination were both wrong.** The
  page (`frontend/core-crm/src/routes/rejected-leads.tsx`) called plain
  `GET /leads` (no server-side stage-code filter exists for a cross-role
  view like this — `S8`/`S9` span multiple roles, so it isn't a role-scoped
  `/leads/queue`), then filtered the *current page's* rows down to
  `S8`/`S9` client-side while still showing the *unfiltered* `data.total`
  in the header — so a system with 18 total leads showed "18 rejected
  leads" above a table of the 4 that were actually rejected, and any
  rejected leads sitting on page 2+ of the unfiltered set would never
  surface (or would double-count across "pages" that don't line up).
  Fixed at the actual gap: `ListLeadsQueryDto`/`LeadsService.list()`
  (`core-api`) gained a `stageCode` filter (comma-separated, e.g.
  `S8,S9`) using TypeORM's `In()` — a specific `leadStatusId` still takes
  priority over it when both are given, since selecting one from the
  dropdown already implies a stage code within that set. The frontend now
  passes `stageCode: 'S8,S9'` server-side and reads `data.total`/`data.data`
  directly instead of re-deriving them client-side. Two new
  `leads.service.spec.ts` cases cover the filter and the priority rule.
- **Rejecting a lead through the UI silently left it in its old status.**
  `LeadsService.reject()` (`core-api/src/modules/leads/leads.service.ts`)
  set `rejectionReason`/`rejectedBy`/`rejectedAt` and wrote a followup, but
  never touched `lead.leadStatus` — unlike `changeStatus()`, which is the
  only other place a lead's status actually changes. The UI showed a
  "Lead rejected" success toast and a followup entry, but the status badge
  stayed exactly what it was before (e.g. a lead rejected while
  `LEAD-INPROCESS` stayed `LEAD-INPROCESS` forever) — reproduced live by
  creating a test lead, moving it to `LEAD-INPROCESS`, then rejecting it,
  and confirming after a hard reload that the badge never changed. Fixed
  by having `reject()` look up the `REJECT` (stage `S9`, manual reject —
  `SYSTEM-REJECT`/S8 is reserved for automated rejections per
  `rejected-leads.tsx`'s `REJECTED_STAGE_CODES` comment) `MasterStatus` via
  the existing `findStatusByNameOrFail` helper and set it on the lead, same
  as `changeStatus()` does, and pass it into `writeFollowup()` instead of
  `null` so the followup entry gets the status badge too. Updated
  `leads.service.spec.ts`'s reject test to assert `lead.leadStatus` and the
  followup's `status`.
- **`QUEUE_ROLE_SCOPES.CR2`/`.DS1` (`leads.service.ts`) were missing the
  self-allocate source stage.** `SELF_ALLOCATE_RULES` claims a `CR2`
  self-allocates from `APPLICATION-NEW` (stage `S4`) and a `DS1` from
  `DISBURSAL-NEW` (`S20`), but neither stage code was in that role's queue
  scope, and every self-allocate role's `assigneeRelation` filter means an
  unclaimed (unassigned) lead can never surface in "My queue" regardless —
  so an already-assigned early-stage lead (e.g. via the "Assign" modal
  before the assignee has moved it forward) silently couldn't appear in
  "My queue" either. `CR2` gained `S4`, `DS1` gained `S20`.
- **The "Claim leads" checkbox UI was unreachable in practice.**
  `frontend/core-crm/src/routes/index.tsx`'s `canClaim` required
  `myQueue`, but per the point above, "My queue" is always assignee-scoped
  for every self-allocate role (`CR1`/`CR2`/`DS1`) — an unclaimed lead
  structurally cannot appear there. Reproduced live as a `CR1` screener:
  "My queue" showed 0 leads and a permanently-disabled Claim button.
  Flipped to `canClaim = !myQueue && ...` so the checkboxes/Claim button
  show on "All leads" instead, where `LEAD-NEW`/`APPLICATION-NEW`/
  `DISBURSAL-NEW` leads are actually visible; `selfAllocate()` already
  skips anything not eligible, so this is safe. Verified end-to-end as
  `CR1`: selected a `LEAD-NEW` lead on "All leads", clicked "Claim 1
  lead", got "Claimed 1 lead", and it appeared in "My queue" as
  `LEAD-INPROCESS` immediately after.
- **The Audit queue 500'd for every non-`AH` auditor (`AU`/`AM`).**
  `AuditService.list()` (`core-api/src/modules/audit/audit.service.ts`)
  scoped a non-Audit-Head's queue with
  `lead.auditAssignedToId = :actingUserId` — `auditAssignedToId` is not a
  real column (the FK is `lead_audit_assign_user_id`, mapped as the
  relation `auditAssignedTo`, already left-joined under that exact alias
  two lines above). MySQL rejected it outright
  (`ER_BAD_FIELD_ERROR: Unknown column 'lead.auditAssignedToId' in
  'WHERE'`), which the controller surfaced as a bare 500 — reproduced live
  by assigning the `AU` role and opening `/audit`. Fixed by referencing
  the already-joined alias directly (`auditAssignedTo.id = :actingUserId`),
  the same pattern `LeadsService.listQueue()` already uses for its
  assignee-scoped roles. This module had zero test coverage before now;
  added `audit.service.spec.ts` with a regression test for both branches
  (non-`AH` scoped by the alias, `AH` unscoped) — confirmed it fails
  against the original string and passes against the fix.
- **Creating a new BRE category 500'd, in every environment, since the app
  was first built.** `init.sql`'s phpMyAdmin-style export carries an
  "AUTO_INCREMENT for table" `ALTER` block for every other table with a
  generated single-column PK (confirmed: `master_bre_rule`, its immediate
  neighbor in that section, has one) but is missing
  `master_bre_category`'s entirely — an export gap in the migration file
  itself, not something one database drifted into. `BreCategory` uses
  `@PrimaryGeneratedColumn`, which relies on the database generating the
  id; without `AUTO_INCREMENT` set, every insert that doesn't specify one
  fails. Found live-testing as `CA`: "Could not add category — Internal
  server error." Confirmed directly against Hostinger
  (`SHOW CREATE TABLE master_bre_category` — the column was plain `int
  unsigned NOT NULL`, `SHOW TABLE STATUS`'s `Auto_increment` was `NULL`).
  Rather than assume this was the only one, queried
  `information_schema.COLUMNS`/`STATISTICS` for every numeric
  single-column `PRIMARY KEY` missing `AUTO_INCREMENT` across the whole
  live schema — found exactly one more, `master_visit_status.m_visit_id`
  (no current `@finance-crm/database` entity, so nothing writes to it today, but
  fixed anyway since it's the identical root cause in the same file).
  `database/src/run-sql-migrations.ts`'s runner gained a new `AUTO_INCREMENT
  table.column` `-- TARGET:` kind (checking
  `information_schema.COLUMNS.EXTRA LIKE '%auto_increment%'`), alongside
  the existing `COLUMN`/`TABLE`/`PRIMARY_KEY`/`CONSTRAINT`/`TRIGGER` ones;
  `m1.sql`/`m1.down.sql` each gained two new idempotent blocks (34 → 36).
  Ran `bun run migrate --m1` against Hostinger directly from this machine
  (the same remote-MySQL grant Step 21 established) — all 34 pre-existing
  blocks correctly no-op'd ("already exists"), the 2 new ones applied for
  real; `SHOW TABLE STATUS` confirmed `Auto_increment` went from `NULL` to
  `8`/`6` respectively (MySQL sets it to `MAX(id)+1` automatically when
  the attribute is added to a populated table — no separate `ALTER TABLE
  ... AUTO_INCREMENT = N` needed). Verified end-to-end live: created "QA
  Test Category" through the actual BRE admin UI, got "Category added",
  then deleted it again to leave the real data untouched.
- **`CO2` ("State Collection Manager") saw every lead in the system, not a
  collections queue at all.** `QUEUE_ROLE_SCOPES` (`leads.service.ts`) had
  no entry for `CO2`, so `listQueue()` fell through to the unrestricted
  `list()` — its comment claimed this was deliberate ("no branch/state data
  on the authenticated user yet"), but that was stale: `UserRoleLocation`
  was built for exactly this later, for `FieldVerificationService`'s own
  `CO2` scoping (`coveredStateIds()`, state-typed rows keyed by
  `roleType.code = 'CO2'`). Reproduced live: assigned the test account
  `CO2`, opened `/collections`, and got the exact same 19 leads in the same
  order as the unscoped `/leads` page — including `REJECT`/`SYSTEM-REJECT`
  rows that have nothing to do with collections. Fixed by giving
  `QueueRoleScope` a `stateScoped` flag, adding
  `CO2: { stageCodes: ['S12','S13','S14','S16'], stateScoped: true }`
  (same stage codes as `CO1`/`CO3`), and porting
  `FieldVerificationService.coveredStateIds()` into `LeadsService` (same
  `UserRoleLocation` query, parameterized by role code). A `CO2` with zero
  covered states now gets an explicit empty queue rather than the
  unrestricted list; one with covered states gets `state.id IN (...)`
  ANDed into their stage-code condition inside the existing per-role
  `Brackets` OR. Two new `leads.service.spec.ts` cases cover both branches
  (empty-state short-circuit; the state condition reaching the query
  builder, verified by invoking the captured `Brackets.whereFactory`
  directly, since the existing mock query builder doesn't execute it).
  Deployed to EC2 (`rsync` + `crm build core-api && crm up -d core-api`)
  and re-verified live: `CO2` with no `UserRoleLocation` rows now shows
  "0 leads in collection stages" instead of the unscoped 19; added a
  `State: Andhra Pradesh` location scope through the actual Users→Roles→
  Locations admin UI and confirmed the query still correctly returns 0
  (this dev database's 19 leads are all early lead/application stage, none
  have actually reached a collection `MasterStatus` yet, so the
  non-empty-result branch isn't reachable with today's data — covered
  instead by the `leads.service.spec.ts` case that inspects the built
  query directly).
- **The Users admin page's search box only ever matched `name`, despite
  its own placeholder text reading "Search by name, email, username…".**
  Found live: typing an email substring ("testuser") returned "No
  users match these filters" for a user whose email plainly contained
  it, while the same user's full name matched. `UsersService.list()`
  (`core-api`) only put `name: ILike(...)` in its `where`. Fixed by
  switching to a 3-branch `where` array (`name`/`email`/`username`, each
  `ILike`'d), with the existing `companyId`/`isActive` filters spread
  into every branch so they still AND against whichever field matched
  rather than being dropped. Added `users.service.spec.ts` coverage
  (there was none for `list()` before this) for the 3-way OR, the
  AND-into-every-branch behavior, and the plain-object `where` shape
  when there's no search term at all. Deployed to EC2 and re-verified
  live: searching "testuser" (an email-only substring — no match
  anywhere in the display name "Ansul Agrawal") now correctly returns
  that 1 user instead of "No users match these filters."
- **The client asked for a placeholder-vs-backend search audit across the
  whole app; it found the Users bug's much bigger sibling.** Six pages
  (`/` Leads, Collections, Loans, Sanctions, Rejected leads, Disbursed
  waived) all show "Search by name, mobile, email…", but
  `LeadsService.list()` and `.listQueue()` (`core-api/src/modules/leads/
  leads.service.ts`) only ever matched `firstName` — typing a mobile
  number or email address into any of these six search boxes silently
  returned nothing, even for a lead that plainly had it. First fix
  attempt copied the Users bug's pattern verbatim — a 3-branch `where`
  array (`firstName`/`mobile`/`email`) passed to `findAndCount` — and it
  passed every existing test and typecheck, but **broke lead search in
  production within minutes of deploying**: TypeORM's `findAndCount`
  combines an array `where` with a populated `relations` option (12
  relations here — company/product/state/city/branch/assignees/etc.) by
  routing pagination through a "select distinct ids first" subquery, and
  that path's `skip`/`take` binding came out `NaN`, throwing `Unknown
  column 'NaN' in 'WHERE'` on every search (confirmed via `crm logs
  core-api` on the EC2 box) — caught immediately by manually testing the
  live site right after redeploying, not by any test, since Jest's mock
  repository doesn't reproduce real TypeORM/MySQL pagination behavior.
  Real fix: rewrote `list()` to use a hand-written `QueryBuilder` with
  explicit `leftJoinAndSelect`s instead of `relations`, the same
  approach `listQueue()` already used successfully — extracted the
  shared join chain into `baseLeadQueryBuilder()` and the shared
  `search`/`companyId`/`productId`/`leadStatusId`/assignee/
  `isBlacklisted`/`rejectionReasonId` filter logic into
  `applyLeadFilters()`, used by both methods (also deleting ~50 lines of
  duplication `listQueue()` had against the old `list()`). The 3-way
  `search` match is now a `Brackets`-wrapped `WHERE (firstName LIKE :s
  OR mobile LIKE :s OR email LIKE :s)`. All `list()` test cases were
  rewritten around the `QueryBuilder` mock (same `mockQueryBuilder`
  helper `listQueue()`'s tests already used), including extracting the
  search `Brackets.whereFactory` directly to assert its OR structure,
  since the mock doesn't execute it. Redeployed and re-verified live
  within minutes: mobile search (`9123456781`), email search
  (`lifecycletest@example.com`), and the plain unfiltered/paginated list
  all return correctly — no more 500s. The audit also found two
  placeholders that under-promise relative to what's actually
  searchable (not bugs, just stale copy) and updated both: the global
  top-right search bar (`__root.tsx`, backed by `SearchService.search()`,
  which already matches PAN/aadhaar/CIF/application-no/loan-no/lead-id
  too) now also mentions "email"; `performance.tsx`'s user-search box
  now matches its placeholder to what `UsersService.list()` already
  supports post its own fix (name/email/username/mobile). No backend
  change needed for either of those two — only the copy was wrong.
- **Full lead-lifecycle walkthrough, done live end-to-end for the first
  time this pass: new lead → screener claim → credit/BRE/CAM → sanction
  → disbursal → disbursed loan.** Created a real test lead ("Lifecycle
  Test Lead", #131) via the `CA`-role `New lead` flow, filled KYC/
  employment, self-allocated it as `CR1` ("Claim leads"), moved it to
  `APPLICATION-NEW` via the leads-detail page's `Change status` action
  (confirmed this is the actual production stage-transition mechanism,
  not just an ops shortcut — it sits outside the "Support toolkit"
  box), ran `BRE` (real rule-engine evaluation, mostly `Reject`/`Not
  applicable` as expected since no real vendor eKYC/PAN/bureau calls
  ran against synthetic data), entered a CAM record, sanctioned it
  (generated a real sanction letter PDF via `/leads/:id/sanction-letter`),
  moved to `DISBURSAL-NEW`, created a loan (`LN-QA-131`), and disbursed
  it offline via IMPS — every stage transition, role-gated action, and
  PDF-generation path exercised for real. Found one more real bug along
  the way: **the "Override CAM detail" support-toolkit modal's Save
  button silently stayed disabled with zero explanation.** Its 7
  `NumberInput` fields all display `value ?? 0` for an untouched
  `undefined` state, so the input LOOKS identical whether a user typed
  "0" or never touched it — but the modal's `valid` gate required all 7
  to be non-`null`, so leaving even one field at its displayed default
  left Save permanently, unexplainedly disabled. Reproduced live:
  filled 5 of 7 fields with real values, left `appraisedMonthlyIncome`/
  `appraisedObligations` showing their default `0`, and Save never
  enabled. Fixed by initializing all 7 fields to `0` (matching what's
  already displayed) instead of `undefined` and dropping the now-
  redundant `valid` check — the backend's own `@IsPositive()`-style
  validation now surfaces as a normal toast error for genuinely invalid
  values, which is strictly better than the previous silent dead end.
  Verified via the local dev server pointed at the EC2 API: with the
  fix, Save enabled immediately after touching only the fields that
  mattered, and the override persisted correctly (confirmed via the
  lead's followup log entry and the CAM section showing the saved
  values, which then correctly unlocked the "Sanction" action).
- Verified: `bun run format/lint/typecheck` clean across the whole backend
  monorepo; full backend test suite passes (1031 tests: database 8, common
  107, core-api 412, integrations-api 193, automation-worker 117,
  reporting-api 194);
  frontend `biome lint`/`tsc -b` clean, `vitest` 21 tests pass. Deployed to
  the EC2 dev box (`docs/EC2-DEV-DEPLOYMENT.md`) throughout via `rsync` +
  `crm build`/`up`; the local idle `mysql` container (superseded by
  Hostinger since Step 21) was also removed from that box during this
  pass.

## Task #169 — Cleared out several `docs/TODO.md` items: three decisions made, two confirmed already done (2026-08-12)

Went through the open TODO list item by item at the client's request.

- **`CFE1` never had a Collections "My queue" in legacy — confirmed by
  exhaustive source check, not left as a guess.** `TaskController.php`
  (the file `QUEUE_ROLE_SCOPES` was ported from) has zero references to
  `CFE1` anywhere. `Collection_Model.php` has zero cross-lead list
  methods for any role — every visit query is scoped to one `lead_id`
  (`get_list_collection_visit($lead_id)`, matching the already-ported
  `CollectionService.listVisits(leadId)`). Every `CFE1` reference in the
  legacy codebase is either a per-lead visit-status *update* action
  (`CollectionController.php`, already ported and role-gated) or a
  per-lead visit-history *table-rendering* rule (`Collection_Model.php`'s
  button enable/disable logic — display, not a worklist) or a
  menu-visibility check on the individual lead-detail page. There is no
  `TaskController::index()` branch, no worklist page, no cross-lead
  query — in legacy, `CFE1` only ever acts on a specific lead someone
  hands them (search or direct assignment), never by browsing a queue.
  **Decision: leave `/collections` unscoped for `CFE1`, no code change**
  — matches how every other role with no `QUEUE_ROLE_SCOPES` entry
  already sees that page, and is faithful to legacy rather than an
  invented improvement.
- **`CrmSettingsService`/`crm_settings`: decided to keep**, unused, for
  a future DB-backed setting rather than deleting.
- **Collection DPD-bucket permission enforcement: decided to defer.**
  Legacy never enforced this either, so nothing regresses by leaving it
  unenforced; revisit once there's a real client requirement instead of
  inventing an authorization policy now.
- **Confirmed already done, no action needed:** `bun run migrate`'s m1
  blocks (`disbursal_authorised_users`, `password_reset_requests
  .otpAttemptCount`) are already present on the live Hostinger DB —
  queried `information_schema` directly to check, rather than assuming;
  `TRUSTED_PROXY_HOPS` (`"3"` in the live `finance-crm/dev` secret, `"2"` in the
  local `secret.prod.json` reference file) and `COOKIE_SECURE`
  (`"true"` in both) are both already correctly set — checked via
  `aws secretsmanager get-secret-value` from the EC2 box (IAM instance
  role, no explicit keys) and by reading `secret.prod.json` directly.
- **Answered the client's 2026-08-03 template-content question — no
  usable content exists in prod.** Ran the exact requested query
  against the live Hostinger DB: `master_sms_template` has 2 rows, both
  generic OTP-send templates, not collection-followup content;
  `master_email_template` doesn't exist as a table at all. Found and
  ruled out a decoy: a separate `master_templates` table has 4 rows
  with real-looking content (`smsRepayment`, etc.), but it is never
  referenced anywhere in the legacy PHP codebase (confirmed via a
  repo-wide grep) — dead/vestigial, not a legitimate source. The
  client needs to supply real template copy directly; there is nothing
  further to discover by querying.
- Not touched this pass, still genuinely blocked on the client/an
  external party (see `docs/TODO.md`): vendor webhook token
  configuration on the Signzy/CartBI dashboards, the Razorpay
  live-to-test key swap, the ICICI production private-key rotation
  (confirmed still committed in `old-php-files`'s separate git repo —
  `git ls-files` shows `application/prod_private.key` still tracked;
  the local `secret.dev.json` reference file also still has the real
  key material for `ICICI_UPI_PRIVATE_KEY`/`ICICI_DISBURSAL_PRIVATE_KEY`,
  though the currently-*deployed* `finance-crm/dev` secret has both blanked),
  ICICI sandbox verification, and naming the disbursal-authorised
  staff.

## Task #170 — Fixed sanction-letter PDF 500 on the EC2 dev box: Chrome sandbox can't start on Ubuntu 24.04 (2026-08-12)

Reported bug: viewing "Sanction letter" from a lead's Credit Analysis
Memo (`GET /api/v1/leads/:id/sanction-letter`) returned 500.

- **Root cause**: `common/src/pdf/puppeteer-pdf-renderer.ts` launches
  Chromium with its sandbox on by default (deliberately — see
  `CLAUDE.md`'s PDF-pipeline security note). On this EC2 box, Chromium
  failed to start with `Error: Failed to launch the browser process:
  ... No usable sandbox!`: Ubuntu 24.04 blocks unprivileged user
  namespaces by default
  (`apparmor_restrict_unprivileged_userns=1`), and the container's
  Debian `chromium` package ships no SUID `chrome-sandbox` helper
  binary either — so neither of the two ways Chromium can sandbox
  itself is available on this host.
- **Fix**: set the already-supported, documented escape hatch,
  `PUPPETEER_DISABLE_SANDBOX=true`, in `/opt/crm/.env` on the EC2 box
  (not a code change — the renderer already branches on this env var).
  `escapeHtml` on every template value and the renderer's blocked
  non-`data:` network requests are unaffected and still the real
  mitigation for the "arbitrary HTML through headless Chrome" risk;
  disabling the OS-level sandbox only removes a second, redundant
  layer that this particular host can't provide anyway.
- **Deployment gotcha hit while fixing this**: Docker Compose only
  re-reads a container's `env_file` on recreation
  (`up -d`/`up --force-recreate`), not on a plain `restart` — confirmed
  the hard way, `crm restart core-api` left the running container
  without the new var (`docker exec ... printenv` showed it absent),
  `crm up -d core-api` picked it up.
- Verified via `curl` against the live endpoint with a real session
  cookie: `GET /api/v1/leads/131/sanction-letter` now returns `200`,
  `content-type: application/pdf`, an 8-page/148KB PDF.

## Task #171 — Sanction letter is now generated once and served from storage, not re-rendered on every view (2026-08-12)

Matches legacy behavior, confirmed by reading `old-php-files`:
`sanction_latter.php`'s `PREPARE_KFS_LATTER` (called once, synchronously,
from `TaskController`'s sanction action via
`CommonComponent::call_sanction_latter()`) renders the PDF via mPDF exactly
once, uploads it, and stores the filename on
`credit_analysis_memo.cam_sanction_letter_file_name` — "view sanction
letter" (`DocsController.php`) always serves that stored file, never
regenerates. This rewrite's `SanctionLetterService.generate()` already had
the storage-upload/key-persist half of this (writing to
`CreditAnalysisMemo.sanctionLetterFileName`, the column this schema already
reserved for it) but was calling it unconditionally on every view, so it
re-rendered and re-uploaded a fresh timestamped copy every single click —
wasteful, and a latent correctness bug: a "sanction letter" is meant to be a
fixed record of what the borrower was shown at sanction time, and any CAM
data changed afterward would silently change what later views showed.

Fix: `generate()` now checks `cam.sanctionLetterFileName` first and returns
`storageAdapter.download()` of the already-stored PDF if set, only falling
through to the render/upload/persist path the first time (when the column
is still empty). No schema change needed — the column already existed and
was already being written, just never read back. Added a test asserting the
short-circuit path skips both `pdfRenderer.renderHtmlToPdf` and
`storageAdapter.upload` entirely when a stored key is already present.

## Task #172 — Seeded dev's disbursal-authorised-users whitelist with legacy's 5 named staff (2026-08-12)

At the client's explicit instruction ("add those people in db for dev, for
prod will tell"): checked the dev DB directly for the five legacy user-ids
hardcoded in `payday_disbursement_icici_helper.php:159` (`37, 31, 69, 83,
115`) before touching anything — all five still resolve to real, active
(`user_active=1`), non-deleted staff (Vinay/Vikrant/Shobhna/Soni/Yogesh),
not stale/reassigned ids. Granted all five through the actual
`POST /api/v1/disbursal-authorised-users/:userId` endpoint (signed in as
the `SA`-roled `it@financecrm.com` account), not by writing rows into
`disbursal_authorised_users` directly — confirmed via the `GET` list
endpoint afterward that all five now show `isActive: true, isDeleted:
false`. Prod is explicitly not done — the client will give a separate
answer for prod staff once prod exists; dev's grant is not a stand-in for
it (`docs/TODO.md`).

## Task #173 — Mapped the 9 untested roles' real access; fixed 4 legacy-fidelity gaps found along the way (2026-08-12)

Before live-clicking through the remaining 9 untested roles (`AC1`, `AC2`,
`SA`, `MR`, `OL`, `CC`, `LD1`, `CO4`, `ST`), grepped every backend `@Roles()`
gate and frontend role check that mentions any of them, and checked
`old-php-files` for what each role did in legacy, to know what "correct"
should look like before testing rather than guessing. Confirmed all 9 have
real, currently-active staff on the dev DB (1–10 users each) — not
theoretical.

**Finding: only `AC1` and `CO4` have any rewrite-side wiring at all.**
`AC2`, `MR`, `OL`, `CC` have zero backend gates and zero frontend checks —
legacy itself only ever menu-tagged them (`LoginController.php`'s
per-role dashboard menu filter), never gave them a distinct controller or
feature, so there's nothing to port for `AC2`/`MR`/`CC` beyond the generic
authenticated nav everyone already gets. This is the same already-flagged,
deliberate gap as `docs/TODO.md`'s note that `menu_permissions` is enforced
nowhere — not new work, just confirmation. `ST` and `LD1` looked the same
at first grep, but each turned out to have a real, already-ported feature
that dropped their legacy role from its gate — see below. `OL` also turned
out to have one real, live behavior difference in legacy worth restoring.

**Fixed — `ST` lost access to the eKYC/eSign reset toolkit legacy explicitly
granted it.** `SupportController.php:40,58` checks `agent == 'CA' || agent
== 'ST' || in_array(user_id, [2,33,92,93])` for exactly these two actions
(not the controller's other actions — allocation/personal/employment/
bank/CAM overrides stayed `CA`-only in legacy, and account-aggregator reset
had no role check at all in legacy). The rewrite's `SupportController`
(`support.controller.ts`) gates its entire class `@Roles('SA','CA')`,
dropping `ST` from the two actions legacy actually gave it. Fixed with a
method-level `@Roles('ST')` override on just `resetEkyc`/`resetEsign` —
`RolesGuard`'s handler-metadata-wins-over-class-metadata behavior
(`Reflector.getAllAndOverride`) means `SA`/`CA` still pass via the guard's
own universal admin override, so this only adds `ST`, nothing is removed.
Mirrored on the frontend: `SupportSection` (`leads.$leadId.tsx`) now shows
the eKYC/eSign reset cards to `SA`/`CA`/`ST`, but keeps the AA-reset card
and the 5 override actions `SA`/`CA`-only, via a second `canOverride` check
— matching legacy's exact split, not a blanket unlock. Legacy's third
gate, `user_id in [2,33,92,93]` (a hardcoded named-user override, same
pattern as the disbursal whitelist), was NOT ported — flagged in
`docs/TODO.md` as a possible future ask, not built speculatively.
`searchLeadId()` (`SupportController.php:238`, `ST`-only, a separate
"look up a lead by id with a limited status scope" admin tool) has no
rewrite equivalent at all — also flagged, not built, since nothing asked
for it and it would be new feature work, not a role-list fix.

**Fixed — the KYC-docs zip download had no role gate at all.**
`Admin/KycZipController.php:21,31` strictly requires `agent == 'LD1'`, no
exception, not even `CA`. The rewrite's `KycZipController`
(`kyc-zip.controller.ts`, `GET /leads/:leadId/documents/kyc-zip`) had zero
`@Roles()` — any authenticated user, any role, could download every KYC
document for any lead. Added `@Roles('LD1')` (SA/CA still pass via the
guard's universal override, which is consistent with every other
`@Roles()` gate in this app, not a fidelity break). Frontend: the "Download
all as ZIP" button on the lead detail Documents card (`leads.$leadId.tsx`)
was visible to every authenticated user regardless of role — gated it
behind a new `canDownloadZip = useHasRole('LD1')` check.

**Fixed — `SA`'s sidebar was missing two nav items it can actually use.**
`__root.tsx`'s `NAV_ITEMS` filter used a raw
`item.roles.some(role => user.roles.includes(role))` with no admin-override
fallback, unlike `useHasRole`/the backend `RolesGuard`, both of which let
`SA`/`CA` bypass any role list. Two items (`/field-verification`:
`CO1`/`CO2`/`CO3`/`CFE1`, `/audit`: `AU`/`AM`/`AH`) don't list `SA`/`CA`
themselves, so `SA` couldn't see them in the sidebar at all, despite both
the backend routes and the pages' own in-page checks (`useHasRole`)
already letting `SA` in if navigated to directly by URL — a real, if minor,
UI inconsistency for the one role meant to see everything. Exported
`ADMIN_OVERRIDE_ROLES` from `lib/roles.ts` (was module-private, duplicated
as a literal in the guard/hook already) and added an `isAdmin` check
(computed once, not per-nav-item, since `NAV_ITEMS` is filtered inside a
`.map` where a per-item hook call would violate the rules of hooks) to
`__root.tsx`'s sidebar filter.

**Fixed — search results never masked email/mobile for `OL` like legacy
did.** `SearchController.php:150-151`: `(agent != 'OL') ? $row->email :
str_pad(substr($row->email, -10), 15, 'X', STR_PAD_LEFT)` — `OL` ("Other",
legacy's catch-all label for any role that didn't match a known case) is
the *one* role legacy ever masked PII for in search results; every other
role, including `CA`/`SA`, saw it in full. Not an admin-override case like
every other fix above — `OL` is a *stricter* default, nothing should
bypass it. The rewrite's `SearchService`/`SearchController` had no such
logic and didn't even know the caller's roles. Added `@CurrentUser()` to
`SearchController.search()`, threaded `roles` into `SearchService.search()`,
and masked `lead.email`/`lead.mobile` with the same `slice(-N).padStart(M,
'X')` transform legacy used, only when the caller holds `OL`. 4 new tests
cover masked/unmasked/null-email/no-roles-passed cases.

Not fixed, deliberately: `AC2`'s legacy team-visibility menu filter
(`LoginController.php:102-103`) is exactly the deferred `menu_permissions`
gap, not a distinct feature to build. `field-verification.tsx` having zero
internal role checks is not a security hole (the backend route is properly
`@Roles()`-gated — API calls would just 403) but reachable via direct URL
by anyone; left as-is, a minor UX polish item, not a bug.

Live-verified 3 of the 4 fixes above end-to-end (`LD1`/`OL`/`ST` at the API
level via `curl` — LD1 passes the KYC-zip role gate, OL gets a 403 on it
and masked search results, ST passes the eKYC-reset gate but still gets
403'd on allocation override; `ST`/`SA` also confirmed visually in a real
browser session against a local dev server, with the test account holding
*only* that one role each time, not through `it@financecrm.com`'s all-roles
account which wouldn't isolate anything) — see `docs/TODO.md` for the
`SA`-nav screenshot-equivalent description. `LD1`'s frontend zip button
couldn't be visually confirmed (lead 131 has no documents, and the button
only renders when `documents.length > 0`) but shares the exact
`useHasRole(...)` pattern already confirmed working for `ST`'s Support
toolkit split, so this is an acceptable proxy, not a real gap.

**Bonus fifth bug, found by accident while restoring the test account's
role afterward: `UsersService.assignRole` 500s when re-granting any role a
user previously held.** Re-adding `CFE1` to the test account (after
switching it through `LD1`/`OL`/`ST`/`SA` for the tests above) threw a raw
500. Root cause: `(user_role_type_id, user_role_user_id)` is a real unique
index on the live `user_roles` table (confirmed via `SHOW INDEX`), but
`assignRole` unconditionally `.create()`s a new row — `removeRole` only
soft-deletes (`isActive=false, isDeleted=true`), so the old row is still
physically there, and the DB throws a duplicate-key error the moment
anyone re-grants a role removed earlier for that user. This is a general
bug, not specific to this session's testing — the exact same idempotent
fix already exists one module over
(`DisbursalService.grantDisbursalAuthorisation`'s doc comment literally
describes the pattern this method was missing). Fixed by looking up any
existing row for `(userId, roleTypeId)` regardless of active/deleted state
and reactivating it in place instead of always inserting; only throws
`ConflictException` when that row is *currently* active. Verified live:
re-granting `CFE1` to the test account now reactivates the original row
(`id: 413`) instead of 500ing.

Also live-verified `AC1` and `CO4` at the API level (`curl`, not a full
browser session): `CO4` creating a payment without `remarks` 400s ("SCM
Remarks is required."), succeeds with it; `CO4` attempting to verify a
payment 403s (wrong role, `PAYMENT_VERIFIER_ROLE` is `AC1` only); `AC1`
verifying without `closureRemarks` 400s ("OPs Remarks is required."),
succeeds with it supplied; and the pre-existing
cannot-verify-your-own-payment segregation-of-duties check
(`collection.service.ts`'s `verifyPayment`) held throughout. Used lead 131
(`LN-QA-131`, already `DISBURSED`) with a `PART-PAYMENT` (`status_id: 19`)
repayment type to avoid exercising the separate full-payment/settle/
writeoff reconciliation math, which isn't what this pass was checking.

Still outstanding: an actual browser click-through of `AC2`/`MR`/`OL`/`CC`
— all four confirmed to have no distinct behavior of their own to test
beyond page-loads-without-crashing (`OL`'s one real behavior, search
masking, is already live-verified) — see `docs/TODO.md`.
