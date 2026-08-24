# Finance CRM — Frontend Details

Internal CRM frontend for Finance CRM's instant paperless personal loan business — leads, sanctions/KYC screening, and loan lifecycle management.

## Layout

A bun workspace with two CRM apps:

- `core-crm/` — the CRM app itself (React 19 + Vite + Tailwind CSS v4 + TanStack Router/Form/Table/Virtual). See `../CLAUDE.md` for architecture and conventions.
- `crm-redesign/` — a redesigned CRM app on the same stack, with a tabbed lead-detail layout.

## Stack

- React + TypeScript, built with Vite (Bun as package manager/runtime)
- [Biome](https://biomejs.dev) for linting and formatting
- Husky for git hooks (`pre-commit` runs `lint`+`format`+`typecheck`; `commit-msg` enforces Conventional Commits)

## Getting started

```sh
bun install
bun dev
```

## Scripts (run from the repo root)

| Script         | Description                          |
| -------------- | ------------------------------------ |
| `bun dev`      | Start the dev server (`core-crm`)    |
| `bun run build`| Type-check and build `core-crm` for production |
| `bun preview`  | Preview `core-crm`'s production build |
| `bun lint`     | Lint with Biome (whole workspace)    |
| `bun format`   | Format with Biome (whole workspace)  |
| `bun check`    | Lint + format + organize imports     |

## Commit messages

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Component library

`core-crm/src/components/ui/` holds every UI primitive used across the app. There is no all-in-one kit (no shadcn CLI, no HeroUI, no Ant Design) — each component is hand-built and fully owned, following one of three patterns below. Read this before adding a new component so it matches the rest.

### Conventions

- **Styling**: Tailwind CSS v4. All colors reference the theme tokens in `core-crm/src/index.css` (`primary`, `secondary`, `destructive`, `muted`, `background`, `foreground`, `border`, plus `-foreground` pairs) — never hardcode a color. Changing a token in `core-crm/src/index.css` updates every component that uses it.
- **Class merging**: always merge `className` through `cn()` (`core-crm/src/lib/utils.ts`, `clsx` + `tailwind-merge`), so consumers can override any class safely.
- **Path alias**: import via `@/components/ui/...`, `@/lib/utils`, not relative paths.
- **Icons**: `lucide-react` for anything that needs a real icon (e.g. `Eye`/`EyeOff`, `Upload`, `MoveLeft`). Simple glyphs that are really just typography (`✓`, `✕`, `▾`, `−`/`+`) stay as plain characters — no need to swap those to lucide equivalents.

### The three component patterns

1. **Static** — plain HTML element + Tailwind classes + `cn()`. No variants, no state. Examples: `Input`, `Textarea`, `Table`.
2. **Variant-based** — `class-variance-authority` (`cva`) defines named variants, classes reference theme tokens. Examples: `Button`, `Badge`, `Alert`.
3. **Complex/interactive** — wrap a `@radix-ui/react-*` primitive for behavior and accessibility (focus trap, keyboard nav, ARIA), style it ourselves. Only reach for Radix when the behavior is genuinely non-trivial to hand-roll (dialogs, dropdowns, selects) — not for things a plain styled element already handles. Examples: `Modal`, `Select`, `Checkbox`, `Label`, `Toast`.

### Components

| Component | File | Pattern | Notes |
|---|---|---|---|
| `Button` | `button.tsx` | variant | `type`: `primary`/`secondary`/`destructive`/`ghost`, `size`: `sm`/`md`/`lg`. `htmlType` sets the native `button[type]` (default `button`) — `type` is reserved for the visual variant. |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | `table.tsx` | static | Semantic table primitives, horizontally scrollable wrapper. |
| `DataTable` | `data-table.tsx` | — | Generic `<DataTable columns={ColumnDef[]} data={T[]} />` built on `@tanstack/react-table` — sortable headers, Prev/Next pagination. Define columns, pass data, done. |
| `Input` | `input.tsx` | static | Standard text input. |
| `Textarea` | `textarea.tsx` | static | Multiline input. |
| `NumberInput` | `number-input.tsx` | static | Controlled (`value`/`onChange: (n: number) => void`), `min`/`max`/`step`, with −/+ stepper buttons, native spinner hidden. |
| `DatePicker` | `date-picker.tsx` | static | Native `input[type=date]`, styled to match `Input`. No calendar-popover dependency — add `react-day-picker` only if a fancier UI is actually needed later. |
| `Label` | `label.tsx` | complex | Wraps `@radix-ui/react-label`. Always pair with `htmlFor`/`id`, including for Radix-based controls (`Checkbox`, `Select`) which aren't native `<input>`s and won't auto-associate with a plain `<label>`. |
| `Badge` | `badge.tsx` | variant | `variant`: `default`/`success`/`warning`/`destructive`/`muted`. Used for status pills (e.g. lead status). |
| `Alert`, `AlertTitle`, `AlertDescription` | `alert.tsx` | variant | `variant`: `info`/`success`/`warning`/`destructive`. Static — no Radix needed. |
| `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel` | `select.tsx` | complex | Wraps `@radix-ui/react-select`. `SelectLabel` is an unstyled heading for a `SelectGroup` (e.g. grouping status options by lifecycle stage). |
| `Checkbox` | `checkbox.tsx` | complex | Wraps `@radix-ui/react-checkbox`. `checked`/`onCheckedChange`, not `value`/`onChange`. |
| `Modal`, `ModalTrigger`, `ModalContent`, `ModalHeader`, `ModalTitle`, `ModalDescription`, `ModalFooter`, `ModalClose` | `modal.tsx` | complex | Wraps `@radix-ui/react-dialog`. Use `asChild` on `ModalTrigger`/`ModalClose` to render your own `Button` as the trigger/close element (relies on `Button` forwarding `ref` — see below). |
| `toast`, `useToast`, `Toaster` | `toast.tsx` | complex | Wraps `@radix-ui/react-toast`. Call `toast({ title, description, variant })` from anywhere (no context/provider needed at the call site) — it's a module-level store. `<Toaster />` is mounted once in `core-crm/src/routes/__root.tsx`. |
| `Sidebar`, `SidebarHeader`, `SidebarItem` | `sidebar.tsx` | — | App-specific nav shell. `SidebarItem` wraps TanStack Router's `Link` directly (not framework-agnostic on purpose) and highlights the active route via `activeProps`. |
| `VirtualList` | `virtual-list.tsx` | — | Generic `<VirtualList items={T[]} itemHeight={n} height={n} renderItem={(item) => ...} />` built on `@tanstack/react-virtual`, for long lists (thousands of rows) without rendering everything at once. |
| `OtpInput` | `otp-input.tsx` | static | Segmented multi-box numeric input (`length`/`value`/`onChange`), handles per-box focus advance, backspace, and paste-splitting. |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `tabs.tsx` | complex | Wraps `@radix-ui/react-tabs`. Use for any multi-section workspace (e.g. a lead's lifecycle: Application/Documents/Banking/Verification/...). |
| `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` | `accordion.tsx` | complex | Wraps `@radix-ui/react-accordion`. `type="single"` (with `collapsible`) or `type="multiple"` on the root. Open/close height animation uses the `--animate-collapsible-down`/`-up` tokens in `core-crm/src/index.css`, driven by Radix's `--radix-accordion-content-height` CSS var. |
| `MultiSelect` | `multi-select.tsx` | complex | Wraps `@radix-ui/react-popover` + checkbox-style items for multi-value selection (`options`/`value: string[]`/`onChange`) — `Select` (Radix Select) only supports a single value, so reach for this instead when more than one option can be picked (e.g. role/tag pickers). |
| `FileUpload` | `file-upload.tsx` | static | Styled `input[type=file]` (label + hidden input), shows selected filename(s). `accept`/`multiple`/`value`/`onChange: (files: File[]) => void`. |
| `Spinner` | `spinner.tsx` | variant | `size`: `sm`/`md`/`lg`. Plain CSS spin, for inline loading states (e.g. during an async export/submit). |
| `PasswordInput` | `password-input.tsx` | static | `Input`-styled password field with a show/hide toggle button (`lucide-react` `Eye`/`EyeOff`). |

### Radix + `asChild` gotcha

Any Radix primitive using `asChild` (e.g. `ModalTrigger asChild><Button/></ModalTrigger>`) clones its child and passes it a `ref`. Our components accept `ref` as a plain prop (React 19 style — no `forwardRef` needed), e.g. `Button`'s signature includes `ref?: Ref<HTMLButtonElement>` and forwards it to the underlying `<button>`. Any new component meant to be used inside `asChild` must do the same, or focus management/positioning can silently misbehave.

### Adding a new component

1. Pick the pattern (static / variant / complex) from above.
2. Put it in `core-crm/src/components/ui/your-component.tsx`, styled with theme tokens + `cn()`.
3. If it needs real interactive behavior (not just styling), check if a `@radix-ui/react-*` primitive already covers it before writing focus/keyboard/ARIA logic by hand.
4. Run `bunx biome check --write .` (formats + sorts Tailwind classes) and `bun run typecheck`.
