# Finance CRM Backend — Details

NestJS microservices backend for Finance CRM's internal CRM (loan origination, credit appraisal, disbursal, collection, KYC/verification, reporting, and automation) — migrated from a legacy PHP/CodeIgniter application. See `../CLAUDE.md` for architecture and conventions, `TODO.md` for open items, `COMPLETED.md` for full migration history.

This is a fresh rewrite (`docs/COMPLETED.md` Tasks #105-#110) against the legacy schema — all 5 services (`core-api`, `integrations-api`, `automation-worker`, `reporting-api`, `gateway`) plus the shared `database`/`common` packages are rebuilt. The prior backend is archived at `backend/old/` (gitignored, kept on disk as reference); its `docs/DETAILS.md` still describes that state if useful for comparison. This file documents what's actually built in `backend/` right now.

## Layout

A bun workspaces monorepo, direct children of the repo root:

- `database` — shared TypeORM entities + migrations (`@finance-crm/database`), typed directly against the legacy schema. Every entity's table/column names/types are verified against `database/legacy-baseline/legacy-schema.sql`; the full table-by-table mapping is `docs/SCHEMA-MAP.md`.
- `common` — shared NestJS library (`@finance-crm/common`): JWT auth guards/decorators, pagination DTOs, the pluggable job-runner, PDF/storage adapters, `find-or-fail`.
- `core-api` — loan-lifecycle CRUD/workflow: leads, CAM, BRE, disbursal, collection, verification, field-verification, feedback, documents, users/roles/auth, company, geography, audit, menu/permissions, search, performance, support. Public HTTP API, JWT-guarded by default (`app/api/v1/core/docs` for Swagger).
- `integrations-api` — every third-party vendor call, one module per vendor: bureau/BRE (CRIF via Surepass, plus a Signzy-bridged CRIF path), eKYC/eSign/face-match/bank verification/UAN/domain-verification/video-KYC (mostly Signzy, DigiTap as PAN/Aadhaar OCR alternate), Account Aggregator and bank-analysis (both CartBI), payments (Razorpay, ICICI UPI, ICICI eNACH), SMS (Vapio)/email (SMTP/ZeptoMail/SES), call-management (RUNO), reverse-geocode/address-distance/address-lat-long (Signzy + Google Maps fallback). Credeau, Finbox, Adjust, AppsFlyer, TinyURL and the whole WhatsApp category were removed on client instruction — see `EXCLUDED.md`. No global JWT guard registered (matches `backend/old`) — vendor webhooks/callbacks are `@Public()`, everything else assumes core-api already authenticated the caller (`app/api/v1/integrations/docs` for Swagger).
- `automation-worker` — 19 cron/background jobs (allocation, reminders, birthday/reloan-pitch/legal-notice campaigns, hold redistribution, doc housekeeping), no public HTTP routes. Reads/writes the shared database directly via TypeORM (same `ALL_ENTITIES` pattern as the other services) rather than through `core-api`'s HTTP API, and calls `integrations-api` over real HTTP (`IntegrationsApiClient`, `INTEGRATIONS_API_URL`) for vendor sends. Every job is registered through `@finance-crm/common`'s `JOB_RUNNER` token, not the static `@Cron()` decorator — cron timing/on-off state is overridable per job via `CRON_<NAME>` env vars.
- `reporting-api` — MIS reports + CSV exports, 11 modules (credit/disbursal/lead/collection reports and exports, financial exports, field-visit reports, report catalogs). Read-only, permission-gated per report/export type via `MisPermissionGuard`/`ExportPermissionGuard` (`app/api/v1/reporting/docs` for Swagger).
- `gateway` — nginx reverse proxy, pure routing/CORS/cookie-forwarding, no app code. Path-prefix routes `/api/v1/integrations/` and `/api/v1/reporting/` to those services, everything else (including `core-api`'s unprefixed auth routes) falls through to `core-api`. `automation-worker` has no public routes, so it isn't proxied.

## Setup

```bash
bun install
cp .env.example .env   # DB credentials, JWT secret, storage/PDF config, vendor credentials
```

**Secrets are validated at boot.** `@finance-crm/common`'s `assertStrongSecrets()`
runs in every HTTP service's `bootstrap()` and **refuses to start** if
`JWT_ACCESS_SECRET` (or `INTERNAL_SERVICE_SECRET`, for `core-api`/
`integrations-api`) is a known placeholder or shorter than 32 characters.
Generate real ones with `openssl rand -hex 32`. `NODE_ENV=development`
downgrades this to a warning, so a freshly copied `.env.example` still runs
locally.

Other security-relevant settings, all with safe defaults (see
`.env.example` for the full commentary): `COOKIE_SECURE` (secure unless
explicitly `false`), `TRUSTED_PROXY_HOPS` (how many reverse proxies sit in
front, so audit logs record the client IP and not the gateway's),
`THROTTLE_TTL_MS`/`THROTTLE_LIMIT` (baseline rate limit; credential routes
have much tighter per-handler budgets), `SWAGGER_ENABLED` (off by default —
the Swagger handlers bypass the auth guard), `VENDOR_CALLBACK_TOKEN`
(**required** for the four unsigned vendor webhooks — Signzy video-KYC and
eSign, CartBI bank-analysis and account-aggregator — which reject every
request while it is unset), and `AUTH_OTP_DEBUG_LOG` (local-only; the
password-reset OTP is never logged otherwise).

Every service needs a running MySQL (see below) and `.env` populated —
`bun run --cwd <service> start:dev` to run one locally (`core-api`,
`integrations-api`, `automation-worker`, `reporting-api`).
`integrations-api` vendor adapters are real HTTP clients, not mocks —
each one simply won't function until its real credentials are supplied
in `.env` (expected, not a bug). `automation-worker` additionally needs
`CORE_API_URL`/`INTEGRATIONS_API_URL` set (and `REDIS_URL` if you want
`BullMqJobRunner` instead of the in-process default).

## Database

Create the database with an explicit `utf8mb4` charset — MySQL's server
default varies by version/distro (older installs default to `latin1` or
`utf8mb3`):

```sql
CREATE DATABASE finance_crm_backend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

`docker-compose.yml` brings up all 6: `mysql`, `core-api`,
`integrations-api`, `automation-worker`, `reporting-api`, and
`gateway` (nginx on port 8080, in front of the other 3 public
services). Schema is managed via plain `.sql` files in
`database/sql-migrations/`, not TypeORM migrations or `synchronize` —
every file there is also valid to paste directly into phpMyAdmin/any
MySQL client, not just run through the CLI below. On a brand-new empty
database, from `database`:

```bash
bun run migrate --init   # legacy baseline schema (149 tables)
bun run migrate --m1     # brings it forward to match the current entities
                         # (m1 is the only migration file today, and is what
                         # bare `bun run migrate` defaults to; pass the
                         # latest --mN explicitly once there is more than one)
```

Against a database that already has real data (e.g. UAT/prod) and
therefore already has its own baseline, skip `--init` and just run
`bun run migrate` directly — see `database/src/run-sql-migrations.ts`'s
doc comment for the full flag reference and how failure-recovery works.

### Verifying the entity layer against legacy

Two scripts prove the entity layer is honest about the legacy schema it
adopts (see each file's own doc comment for the full rationale):

```bash
bun run --cwd database check:schema-map   # every legacy table + every entity appears exactly once in docs/SCHEMA-MAP.md
bun run --cwd database check:drift        # every mapped entity column matches the real database column it claims (against DB_DATABASE)
```

`check:drift` is the one to run after adding or changing an entity — point
`DB_DATABASE` at a fresh restore of `database/legacy-baseline/legacy-schema.sql`
plus the additive migration applied, and it must report zero drift.

## Testing & quality

```bash
bun run format
bun run lint
bun run typecheck
bun run test                   # every package; also runs in the pre-commit hook
bun run --cwd <package> test   # one package
```

Suite sizes as of Task #157: `core-api` 387, `integrations-api` 194,
`reporting-api` 193, `automation-worker` 119, `common` 84 (76 jest + 8 bun).
977 total. `database` has no tests — its scripts are verified by running them
against a real MySQL instead (`check:drift`, `check:schema-map`, and the
migration runner).

Every service runs jest with `--runInBand` (Task #157). Jest's forked
worker processes intermittently died with SIGSEGV under Bun's runtime —
roughly 1 run in 20, taking a random suite's results with them (the suite
varied run to run; every test that executed still passed). `--runInBand`
forks no workers, so the crash cannot happen. Costs ~5s on a full run.
Don't drop the flag to get that back without first confirming the
underlying crash is gone.

`common`'s `test` script runs jest and then `bun test` for two spec files
written against `bun:test` (whose `mock` has no jest equivalent) — before
Task #144 that package had no `test` script at all, so none of its specs
were being executed by anything.

## Deployment

See `DEPLOYMENT.md` for the full AWS setup runbook — written for the
5-service target architecture, which is now fully rebuilt.
