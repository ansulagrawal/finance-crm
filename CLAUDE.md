# CLAUDE.md

This file provides guidance to Claude Code when working in this monorepo. It
covers both the `backend/` (NestJS microservices) and `frontend/` (React CRM
apps) workspaces. All documentation lives in `docs/`, with backend docs named
`be-*.md` and frontend docs named `fe-*.md`.

## Approach
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

---

# Backend (`backend/`)

## What this is

The Finance CRM backend — a migration of a legacy PHP CRM (the internal
staff-facing CodeIgniter install) to NestJS. Scope is the **internal CRM + its
automation** — explicitly excludes the legacy app's separate customer-facing
`api/` install (Android/iOS/website) and the marketing site/blog/news.

`backend/` is a **bun workspaces monorepo** with 5 deployable units, not a single NestJS app. See `docs/be-todo.md` for what's still open and `docs/be-completed.md` for the full migration history.

## Layout

Every service/package is a direct child of `backend/` (no `apps/`/`packages/` wrapper):

```
core-api/            # loan-lifecycle CRUD/workflow: leads, CAM, BRE, disbursal, collection,
                     # verification, feedback, users/roles/auth, company, geography, audit,
                     # menu/permissions, search. Public HTTP API, JWT-guarded by default.
reporting-api/       # MIS reports + CSV exports. Read-only, permission-gated per report/export type.
integrations-api/    # every third-party vendor call (bureau/eKYC/eSign/eNACH/face-match, payment
                     # gateways, SMS/email). One module per vendor, each an adapter gated behind
                     # env-var credentials — functional the moment real keys are supplied, never
                     # mocked. (docs/be-excluded.md lists vendors removed on client instruction —
                     # don't re-add one without asking.)
automation-worker/   # cron/background jobs (allocation, reminders, campaigns, doc housekeeping,
                     # attribution pushes). No public routes. Calls into core-api/integrations-api
                     # over HTTP using env-var service URLs.
gateway/             # nginx reverse proxy, pure routing/CORS/cookie-forwarding — no app code here.
database/            # @finance-crm/database — every TypeORM entity (grouped by domain folder) + a shared
                     # DataSource factory + migrations. Every service imports only the entities it uses.
common/              # @finance-crm/common — JwtAuthGuard/RolesGuard/@Public/@Roles/@CurrentUser, pagination
                     # DTOs, findOrFail(), the file-storage adapter, the PDF library, the pluggable
                     # job-runner interface.
```

## Architecture decisions (don't relitigate these without asking)

- **Service split — 5 deployable units**: `core-api` (all loan-lifecycle CRUD/workflow + audit + menu/permissions + search), `reporting-api` (MIS reports + CSV exports), `integrations-api` (every third-party vendor call, one module per vendor), `automation-worker` (cron/background jobs, no public HTTP routes), `gateway` (nginx reverse proxy, routing/CORS/cookie forwarding only, no business logic). One internal ALB in front of per-service EC2 instances in production, path/host-based routing rules per service (see `docs/be-deployment.md`).
- **Shared database, service-owned modules** — all services connect to the same MySQL DB; there is no per-service database or event-sourcing sync. Cross-entity joins (Lead → CAM → BRE → Loan → Collection) work exactly as they do in a single app; services just each register a subset of `@finance-crm/database`'s entities via `TypeOrmModule.forFeature`. **Gotcha**: if a module registers an entity that has `@ManyToOne` relations, every related entity must *also* be registered via `forFeature` somewhere in the same app, or TypeORM's `autoLoadEntities` fails at boot with `Entity metadata for X#y was not found`. Each service that touches `Lead`/`User` should have one small shared module (see `core-api`'s `CommonModule`, `integrations-api`'s `common/common.module.ts`) registering that full transitively-referenced set once.
- **Env-var-driven service URLs, always** — never hardcode `http://core-api:3000`-style hostnames. Every inter-service call reads its target from an env var (`CORE_API_URL`, `INTEGRATIONS_API_URL`, etc.). This lets the same code run under `docker-compose` or across separate EC2 instances behind an internal ALB with zero code changes.
- **Job execution is pluggable, not hardcoded** — `@finance-crm/common`'s `JobRunnerModule` exports a `JOB_RUNNER` DI token. Defaults to `InProcessJobRunner`; auto-upgrades to `BullMqJobRunner` (Redis-backed) when `REDIS_URL` is configured. Inject `JOB_RUNNER` and call `.schedule()` — don't hardcode a choice in a new cron job. `automation-worker` reads/writes the shared database directly via TypeORM rather than through `core-api`'s HTTP API, and calls `integrations-api` over real HTTP (`IntegrationsApiClient`) for vendor actions.
- **Service-to-service calls are HMAC-signed, not unauthenticated** — inter-service HTTP traffic is signed via `@finance-crm/common`'s `internal-service-auth.util.ts` (`INTERNAL_SERVICE_SECRET`) and verified by `JwtAuthGuard`'s internal-request path. `IntegrationsApiClient` is the only sanctioned way to make one of these calls — don't hand-roll a second unsigned HTTP client.
- **Config/secrets resolution is a 2-stage chain over `.env`, restart-only** — every NestJS service bootstraps `ConfigModule.forRoot({ load: [awsSsmLoader, awsSecretsLoader] })` (`@finance-crm/common`'s `config/aws-ssm-loader.ts` / `config/aws-secrets-loader.ts`). Both use the AWS SDK's default credential provider chain (IAM instance-role, no explicit access keys) and both no-op to `{}` (never throw) when their env var is unset, so local dev with no AWS access falls straight through. Values from `load` factories win over `.env` on a key clash (Secrets Manager listed after SSM). **Nothing is read from the database.** All restart-only by design. Don't reintroduce a DB-backed config stage without a new explicit decision.
- **Third-party integrations are real adapters, not mocks** — `integrations-api` modules match each vendor's actual request/response shape. They read credentials from env vars and simply won't function until real keys are supplied — that's expected, not a bug to "fix" with a mock.
- **File storage and PDF generation are shared libraries, not services** — storage defaults to local disk, S3 is a drop-in behind the same interface.
- **No raw string-concatenated SQL** — every port uses parameterized TypeORM queries, everywhere.
- **Never add a column to model a relation legacy doesn't already have** — express relations at the entity level with `@ManyToOne(...) @JoinColumn({ name, referencedColumnName })` over existing columns; never add a new FK column. See `docs/be-schema-map.md` and `database/src/additive-schema-changes.ts`.
- **Schema migrations are plain numbered `.sql` files, not TypeORM** — `database/sql-migrations/init.sql` plus `mN.sql`/`mN.down.sql` pairs, run via `bun run migrate`. Every file is also valid to paste into phpMyAdmin. Every item in an `mN.sql` is idempotent (checks `information_schema` before acting); each `mN.sql` has a reverse-order `mN.down.sql` of equal block count. No tracking table records what's applied — a fully-idempotent file is safe to re-run.
- **IaC scope: Dockerfiles + `docker-compose.yml` + env-var contract only, no Terraform.** `docs/be-deployment.md` is a step-by-step manual AWS runbook.
- **Security posture** (set by a full security review) — five load-bearing rules:
  - Every inbound vendor webhook must authenticate and fail closed (`VendorCallbackTokenGuard` rejects while `VENDOR_CALLBACK_TOKEN` is unset). Correlate a vendor `requestId` to the log row written when *we* made the outbound call — never trust the lead from the payload.
  - Anything rendered by the PDF pipeline must escape through `@finance-crm/common`'s `escapeHtml` (there is exactly one). The renderer keeps Chrome's sandbox — don't reintroduce `--no-sandbox`.
  - A `@Public()` route must never return an entity with relations attached — return an explicit narrow shape.
  - An unauthenticated endpoint must not report *why* it rejected something (avoid padding/parse oracles).
  - Secrets are validated at boot: `assertStrongSecrets()` refuses to start on a placeholder or sub-32-char `JWT_ACCESS_SECRET`/`INTERNAL_SERVICE_SECRET`. Rate limiting (`@nestjs/throttler`), `helmet()`, and `trust proxy` are set; Swagger is behind `SWAGGER_ENABLED`.
  - **Still open, deliberately:** there is no per-lead authorization model and `menu_permissions` is enforced nowhere — needs a client decision (see `docs/be-todo.md`).
- **Monorepo tooling: bun workspaces only, no Nx/Turborepo.**

## Conventions established across all services

- `findOrFail<T>(repository, id, label)` (`@finance-crm/common`) for every FK-or-404 lookup.
- Thin controllers, business logic in services. `UpdateXDto extends PartialType(CreateXDto)`.
- List endpoints take a `ListXQueryDto extends PaginationQueryDto` and return `PaginatedResult<T>`.
- Every route is guarded by default (global `JwtAuthGuard` + `RolesGuard`). Mark a handler `@Public()` only for genuinely pre-auth routes. Admin-only resources get `@Roles('SA','CA')`.
- Workflow-changing actions write to the relevant audit-trail entity — don't silently mutate state without a trail entry.
- Biome for lint/format (not eslint/prettier) — `unsafeParameterDecoratorsEnabled: true` is required in `biome.json` for NestJS's constructor-injection to parse.
- **`ConfigService.get<T>()` never casts** — every env var is a string at runtime. Always wrap `config.get(...)` in `Number(...)` when the value feeds a non-arithmetic API (this broke JWT expiry and bcrypt salt rounds until fixed).
- Husky pre-commit runs `bun run lint && bun run format && bun run typecheck`; commit messages follow Conventional Commits.

---

# Frontend (`frontend/`)

## What this is

Internal CRM frontend for Finance CRM's instant paperless personal loan business — leads, sanctions/KYC screening, and loan lifecycle management. Web-only, no mobile app. All frontend HTTP calls go through the backend `gateway` (nginx, path-routed to the right service) — see the Backend section above for the service split and `docs/be-completed.md`/`docs/be-todo.md` for what's implemented.

## Layout

A bun workspace with two CRM apps:

```
core-crm/       # the CRM app itself (React 19 + Vite + Tailwind CSS v4 + TanStack Router/Form/Table/Virtual)
crm-redesign/   # redesigned CRM app (same stack), with a tabbed lead-detail layout
```

All commands run from `frontend/` and operate on `core-crm` (except `lint`/`format`/`check`, which cover the whole workspace since Biome recurses).

## Commands

Bun is the package manager and runtime — use `bun`/`bunx`, not `npm`/`npx`.

```sh
bun install          # install deps
bun dev              # start dev server (Vite, core-crm)
bun run build        # typecheck (tsc -b) + production build, core-crm
bun preview          # preview core-crm's production build
bun run typecheck    # tsc -b only, core-crm
bun lint             # biome lint .
bun format           # biome format --write .
bun check            # biome check --write .  (lint + format + organize imports)
```

There is no test runner configured yet.

### Git hooks (Husky)

- `pre-commit` runs `bun run lint && bun run format && bun run typecheck` (no `lint-staged`).
- `commit-msg` enforces Conventional Commits via a hand-written shell script (`.husky/commit-msg`).

## Architecture

**Stack**: React 19 + TypeScript, Vite, Tailwind CSS v4, TanStack Router/Form/Table/Virtual, Radix UI primitives, Biome.

### No UI kit — hand-built component library

There is deliberately no shadcn/ui, HeroUI, Ant Design, etc. Every component in `core-crm/src/components/ui/` is hand-built and fully owned. **Read `docs/fe-details.md`'s Component library section before adding or modifying any component** — it documents the three build patterns (static / `cva`-variant / Radix-wrapped), the full component table, and a Radix `asChild` + `ref`-forwarding gotcha.

Key building blocks:
- `core-crm/src/lib/utils.ts` — `cn()` (`clsx` + `tailwind-merge`).
- `core-crm/src/index.css` — Tailwind v4 `@theme` block defining all design tokens (sourced from financecrm.com's brand colors). Change a color here, not per-component. Light theme only. Also defines the animation-token system; a global `prefers-reduced-motion: reduce` override collapses animation durations.
- `biome.json` — `css.parser.tailwindDirectives: true` is required to parse `@theme`/`@import "tailwindcss"`. `useSortedClasses` auto-sorts Tailwind classes.
- `core-crm/src/components/` (outside `ui/`) — page/feature-level shared layout components (e.g. `auth-layout.tsx`). Atomic primitives stay in `components/ui/`.
- `core-crm/src/routes/components.tsx` — a `/components` showcase route (dev reference, not linked from the sidebar).

### Routing (TanStack Router, file-based)

`core-crm/src/routes/` — file-based routing via `@tanstack/router-plugin` (must load before `@vitejs/plugin-react` in `vite.config.ts`). `routeTree.gen.ts` is **generated** — never hand-edit it; it's excluded from git and Biome.

- `__root.tsx` — app shell: `Sidebar` + `Outlet` + `Toaster` unless the pathname is in `BARE_ROUTES` (`/login`, `/forgot-password`), where it renders a bare `Outlet`. Add future chrome-less routes to `BARE_ROUTES`.
- one file per top-level nav section behind the sidebar.
- `login.tsx`, `forgot-password.tsx` — auth pages using the shared `AuthLayout`.

### Path alias

`@/*` → `./src/*`, configured in **both** `tsconfig.app.json` (`paths`) and `vite.config.ts` (`resolve.alias`). Both must stay in sync.

### Forms

`@tanstack/react-form` (`useForm` + `form.Field`) is the pattern for any form with validation.

### Backend numeric enums

Many legacy-adopted backend enums (`@finance-crm/database`) serialize as raw numbers, not string keys — e.g. `BreDecision`, `CamStatus`, `LoanPaymentMode`. Don't assume a backend enum is a string union — verify against the actual entity. The established pattern in `lib/*.ts`: type the field as a numeric literal union, export a `*_LABEL: Record<N, string>` for display, and a `const` object of named values for equality checks.

### Adding new libraries

**Add a dependency only when a concrete need appears**, not preemptively. Follow this rather than pulling in a broader kit.
