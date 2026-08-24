# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Approach
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## What this is

Internal CRM frontend for Finance CRM's instant paperless personal loan business — leads, sanctions/KYC screening, and loan lifecycle management. Web-only, no mobile app. This repo is the frontend; the NestJS backend lives in a sibling git repo (`../backend`) under the same parent folder, not in this repo — it's a **bun-workspaces microservices monorepo** with 5 deployable units (`core-api`, `reporting-api`, `integrations-api`, `automation-worker`, `gateway`), not a monolith. All frontend HTTP calls go through `gateway` (nginx, path-routed to the right service) — see `backend/CLAUDE.md` for the full service split and `backend/docs/COMPLETED.md`/`TODO.md` for what's implemented. As of the backend's Task #64, the migration (including an internal ops-support toolkit, an Account Aggregator vendor integration, and several MIS reports) is functionally complete for the frontend to build against.

## Layout

A bun workspace, all direct children of the repo root:

```
core-crm/       # the CRM app itself (React 19 + Vite + Tailwind CSS v4 + TanStack Router/Form/Table/Virtual)
crm-redesign/   # redesigned CRM app (same stack), with a tabbed lead-detail layout
docs/           # TODO.md (task list), DETAILS.md (stack/scripts/component-library detail)
```

All commands below run from the repo root and operate on `core-crm` (except `lint`/`format`/`check`, which cover the whole workspace since Biome already recurses).

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
bun check            # biome check --write .  (lint + format + organize imports — run this after any edit)
```

There is no test runner configured yet.

### Git hooks (Husky)

- `pre-commit` runs `bun run lint && bun run format && bun run typecheck` directly (no `lint-staged` — deliberately removed; these run against the whole project, not just staged files).
- `commit-msg` enforces Conventional Commits via a hand-written shell script (`.husky/commit-msg`, plain regex check) — not the `commitlint` package. Format: `<type>(<scope>): <subject>`, types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Architecture

**Stack**: React 19 + TypeScript, Vite, Tailwind CSS v4, TanStack Router/Form/Table/Virtual, Radix UI primitives, Biome (lint/format, replaces ESLint+Prettier).

### No UI kit — hand-built component library

There is deliberately no shadcn/ui, HeroUI, Ant Design, etc. Every component in `core-crm/src/components/ui/` is hand-built and fully owned. **Read `docs/DETAILS.md`'s Component library section before adding or modifying any component** — it documents the three build patterns in use (static / `cva`-variant / Radix-wrapped), the full component table, and a Radix `asChild` + `ref`-forwarding gotcha that affects any component meant to be used as a Trigger/Close child (e.g. `Button`).

Key building blocks components rely on:
- `core-crm/src/lib/utils.ts` — `cn()` (`clsx` + `tailwind-merge`), used by every component to merge classes.
- `core-crm/src/index.css` — Tailwind v4 `@theme` block defining all design tokens (`primary`, `secondary`, `destructive`, `muted`, `background`, `foreground`, `border`, plus `-foreground` pairs, all sourced from financecrm.com's actual brand colors). Change a color here, not per-component. Light theme only (no dark-mode media query). Also defines the animation-token system (`--animate-fade-in`, `fade-in-up`, `draw`, `drift-1`, `drift-2`) — reuse these `animate-*` classes for new entrance/ambient motion rather than writing new keyframes; a global `prefers-reduced-motion: reduce` override already collapses all animation/transition durations to ~0, so individual components don't need their own reduced-motion handling.
- `biome.json` — `css.parser.tailwindDirectives: true` is required for Biome to parse `@theme`/`@import "tailwindcss"` without erroring. `linter.rules.nursery.useSortedClasses` auto-sorts Tailwind classes in `class`/`className` and inside `clsx`/`cva`/`tw` calls.
- `core-crm/src/components/` (outside `ui/`) — page/feature-level shared layout components that aren't atomic UI primitives live directly here, e.g. `auth-layout.tsx` (shared shell for the login/forgot-password pages). Atomic primitives stay in `components/ui/` per `docs/DETAILS.md`'s Component library section.
- `core-crm/src/routes/components.tsx` — a `/components` showcase route rendering every `components/ui/` primitive in one page, for visually checking the library. Deliberately not linked from `Sidebar` in `__root.tsx` — it's a dev reference, not a CRM feature, reachable by typing the URL directly.

### Routing (TanStack Router, file-based)

`core-crm/src/routes/` — file-based routing via `@tanstack/router-plugin` (configured in `vite.config.ts`, must load before `@vitejs/plugin-react`). `core-crm/src/routeTree.gen.ts` is **generated** on every dev/build run — never hand-edit it, and it's excluded from both git and Biome.

- `__root.tsx` — the app shell: renders `Sidebar` + `Outlet` + `Toaster` (global toast viewport) + router devtools *unless* the current pathname is in the `BARE_ROUTES` list (currently `/login`, `/forgot-password`), in which case it renders a bare `Outlet` + `Toaster` with no CRM chrome. Add any future chrome-less route (signup, password-reset confirmation, etc.) to `BARE_ROUTES`. Sidebar nav items (`SidebarItem`) are directly coupled to `@tanstack/react-router`'s `Link` (not framework-agnostic — this is intentional, `Sidebar` is app-specific).
- `index.tsx`, `sanctions.tsx`, `loans.tsx`, `collections.tsx` — one file per top-level nav section (behind the sidebar). `loans.tsx` demos `VirtualList` with a 10k-row dataset; `sanctions.tsx` demos `Alert`.
- `login.tsx`, `forgot-password.tsx` — auth pages, listed in `__root.tsx`'s `BARE_ROUTES`. Both use the shared `AuthLayout` (`core-crm/src/components/auth-layout.tsx`, split-screen brand panel + form panel). `login.tsx` renders a Lottie animation (`@lottiefiles/dotlottie-react`, `.lottie` files live in `public/` and are referenced by root-relative path, e.g. `/login.lottie`) as the `AuthLayout`'s `illustration` prop; `forgot-password.tsx` uses the default hand-drawn SVG illustration and demos the `OtpInput` component in its two-step (email → OTP + new password) flow.

### Path alias

`@/*` → `./src/*`, configured in **both** `tsconfig.app.json` (`paths`, no `baseUrl` — deprecated in this TS version) and `vite.config.ts` (`resolve.alias`, using `import.meta.dirname` since this is an ESM config file). Both must stay in sync if changed.

### Forms

`@tanstack/react-form` (`useForm` + `form.Field`) is the pattern for any form with validation — see `NewLeadForm` in `core-crm/src/routes/index.tsx` for the reference implementation (field-level `validators`, controlled `Input`/`NumberInput`/`Select`/`DatePicker`/`Checkbox`/`Textarea`, submit closes a controlled `Modal` and fires a `toast()`).

### Backend numeric enums

Many legacy-adopted backend enums (`@finance-crm/database`) serialize as raw numbers, not string keys — e.g. `BreDecision` (`1=>APPROVE, 2=>REFER, 3=>REJECT`), `CamStatus` (`0=>DRAFT, 1=>SANCTION`), `LoanPaymentMode`/`LoanPaymentType`, `UserActivityType`, `UserRoleLocationType`. Don't assume a backend enum is a string union — verify against the actual `../backend/database/src/entities/**` entity before typing it. The established pattern in `lib/*.ts` (see `bre.ts`, `cam.ts`, `disbursal.ts`, `users.ts`) is: type the field as a numeric literal union (e.g. `1 | 2 | 3`), export a `*_LABEL: Record<N, string>` for display, and export a `const` object of named values (e.g. `USER_ROLE_LOCATION_TYPE.CITY`) for equality checks in route code instead of bare numbers. `Select` components then use `String(n)`/`Number(value)` to bridge the string-only Radix API.

### Adding new libraries

The working philosophy throughout this project is **add a dependency only when a concrete need appears**, not preemptively — e.g. `@tanstack/react-table` was added only once a real table was needed, individual `@radix-ui/react-*` primitives are added one at a time per component. Follow this rather than pulling in a broader kit.
