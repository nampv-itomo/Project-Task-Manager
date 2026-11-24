# src/components — sidebar, icons & progress

## Astryx migration (all components use Astryx primitives)

Every component here builds UI from `@astryxdesign/core` (see the shell's Astryx
invariants in `src/app/SKILL.md`). Primitives in use: `Button`, `IconButton`,
`TextInput`, `AlertDialog`, `Badge`, `ProgressBar`, `Icon`, `Stack`/`HStack`,
`Text`. Custom SVGs (in `icons.tsx`) are fed into Astryx `icon` slots where the
neutral theme's icon set lacks a semantic name.

Deliberate **native escape hatches** (Astryx has no equivalent, or one would
regress a documented a11y invariant — `astryx doctor` flags these as warnings,
not failures, and they are intentional):
- `sidebar.tsx` control buttons stay native `<button>`: `IconButton` exposes no
  `ref` (drawer returns focus to the hamburger on close) and no `className`
  (needs `fixed`/`md:hidden`/`md:grid` responsive visibility). The drawer/nav/
  collapse `<html>` machinery is unchanged. Only their glyphs moved to Astryx
  semantic `<Icon>` (`menu`/`close`/`chevronsLeft`/`chevronsRight`).
- `progress.tsx` `ProgressFill` stays an `aria-hidden` native span: Astryx
  `ProgressBar` renders a standalone track, not a full-bleed fill behind row text.
- `watch-status.tsx` keeps native `<section aria-labelledby>` + `<h2 id>` (Astryx
  `Section`/`Heading` expose no `id`, so the landmark + label anchor needs native)
  and the notification `<ul>/<li>` grid (3-col `md:grid-cols-[7.5rem_1fr_auto]` +
  scroll-in-place, no `List` equivalent). Its badges are Astryx `Badge` variants.
- `theme-toggle.tsx` wraps its `IconButton` in a `fixed` div (IconButton has no
  positioning prop).

Per-component notes below.

## sidebar.tsx (client)
- Collapsed state lives on `<html data-sidebar-collapsed="1|0">`, not in React state:
  - `layout.tsx` runs a pre-paint script that restores it from `localStorage["sidebar-collapsed"]` before first paint, so there is no flash and no hydration mismatch.
  - `globals.css` applies width + hides labels only at `min-width: 48rem` (Tailwind `md`), via `--sidebar-w` (15rem → 4rem) and `.sidebar-label { display: none }`.
  - React mirrors the value with `useSyncExternalStore` (document event `sidebar-collapsed-change`) only for `aria-expanded`/title — never `setState` inside an effect (eslint `react-hooks/set-state-in-effect`).
- Two shapes:
  - ≥768px: sticky rail, `w-[var(--sidebar-w)]`; collapsed = icon-only rail, links keep `aria-label` + `title`, icons centred.
  - <768px: off-canvas drawer + hamburger + backdrop; closed drawer is `invisible` so it leaves the a11y tree and tab order. Hamburger is `md:hidden`.
- Menu items: `NAV_ITEMS` = `/` Tổng quan, `/projects` Dự án. `aria-current="page"` on the active item.
- Mobile drawer: Escape closes, focus moves to the nav on open and back to the trigger on close; open state is per-visit (not persisted).
- Icons are inline SVG (`icons.tsx`, Lucide-style stroke), `aria-hidden`; text label carries the accessible name. No emoji icons, no icon dependency.

## progress.tsx (server components, read-only)
- `StatsBadges({ stats })` — done/pending/total pills + a `role="progressbar"`
  bar + `N%` value label (Astryx default) for one aggregate (page-level totals).
- **Invariant — these stay Server Components, so they must not pass a function
  prop to an Astryx client component** (`ProgressBar.formatValueLabel`,
  `Table` renderers, …): React serialises props across the server→client boundary
  and throws `Functions cannot be passed directly to Client Components`, which
  500s the page and kills `next build` at *Collecting page data*. Use the
  component's default formatting, or precompute the string and pass it as a
  plain prop.
- `ProgressFill({ stats })` — the **row** progress bar shared by the spec rows on
  `/projects/[id]` and the phase rows on `/projects/[id]/specs/[slug]`: an
  `aria-hidden` `<span class="progress-fill absolute inset-y-0 left-0">` whose
  width = `done/total %` and whose `--fill-hue` ramps purple (`HUE_FROM=275`) →
  green (`HUE_TO=145`). Hue only; saturation/lightness come from
  `--progress-fill-*` in `globals.css` (86% light / 24% dark) so row text stays
  AA over the fill. Callers must give the row `relative overflow-hidden` and put
  their text in `relative` spans; the row's `done/total` text is the readable
  channel (fill is never the only encoding). Always called with **full** stats,
  not a filtered subset.

## auto-refresh.tsx (client)
- `AutoRefresh({ intervalMs, enabled })` renders `null`: polls `router.refresh()` on the watch job's interval so the server-rendered phase list tracks the auto-check tick. `refresh()` re-renders Server Components and merges the payload **without** losing scroll position or the open/closed state of native `<details>` (uncontrolled DOM state survives the merge).
- Pauses while `document.visibilityState === "hidden"`; a tab returning to visible refreshes once immediately, then resumes the interval. `enabled=false` (job tắt) or `intervalMs<=0` → no timer at all.
- Mounted only on `/projects/[id]/specs/[slug]` (gated by `watchStatus().enabled`). `/projects/[id]` keeps manual `↻ Làm mới` only.

## watch-status.tsx (server components, read-only)

- `AutoCheckLine({ summary, enabled, intervalMs, id, heading, autoRefreshing })` — `autoRefreshing` (default `false`) only switches the footnote text to "tự làm mới theo cùng chu kỳ" when the page also mounts `AutoRefresh`; job state for a project (tracked/active/idle counts) or a single spec (`summary.mode` → badge `Đang theo dõi task` / `Đã 100% — chỉ theo dõi file`). Empty states: `Auto-check đang tắt (TASK_WATCH_ENABLED=0).` when the job is off, `Chưa có snapshot nào…` when nothing is tracked.
- `NotificationLog({ rows, id, heading, className?, listClassName? })` — ≤10 recent `notification_log` rows: UTC+7 time (`title` holds the full UTC timestamp), kind label (`Task hoàn thành` / `Spec hoàn thành` — `tasks_done` = task **trong spec** vừa `[x]`, không phải dạng todo.md cũ), slug, task IDs (`font-mono`, `break-words`), status badge (`Đã gửi` emerald / `Gửi lỗi` red / `Chưa cấu hình Telegram` amber). Status is always text, never colour-only; `error` also shows `Đã thử N lần · <redacted error>`.
  - `className` (wrapper `<section>`) and `listClassName` (`<ul>`) let a fixed-height page scroll the list in place — `/projects/[id]` passes `listClassName="min-h-0 flex-1 overflow-y-auto"` so the log scrolls within the sidebar column while the heading stays. Both default to the plain stacked layout, so other usages are unchanged.
- Both are `<section aria-labelledby>` regions (`role="list"` lists) so they land in the a11y tree as landmarks; secondary text is `text-zinc-500` + `dark:text-zinc-400` (plain `zinc-500` on `zinc-900` is only 4.1:1 → fails AA).
- Layout: `<li>` is a 1-column grid on mobile and `md:grid-cols-[7.5rem_1fr_auto]` from 48rem — no table component (project has no `Table` pattern and adding one needs explicit authorization).
- **No client JS, no `"use client"`**: these components stay server-rendered snapshots. Auto-refresh, where it exists, comes from a separate `AutoRefresh` mount on the page (spec page only) — never from inside `watch-status.tsx`. Other pages: users refresh with the `↻ Làm mới` button (`refresh-button.tsx`).
