# src/app — route map & shell

Layout shell (`layout.tsx`): skip link → `Sidebar` → `<main id="main">`. Sidebar owns its own padding; page `main` elements must not add `px-*`/`py-*` (the shell provides `px-4 pb-10 pt-16 md:px-[100px] md:pt-10`).

| Route | Screen | In left menu |
|---|---|---|
| `/` | Tổng quan: KPI toàn cục + tiến độ từng dự án | yes |
| `/projects` | Dự án: thêm dự án + danh sách | yes |
| `/projects/[id]` | Detail của một dự án (danh sách spec) | no (breadcrumb → `/projects`) |
| `/projects/[id]/specs/[slug]` | Spec + tasks | no (breadcrumb → project) |

Invariants:
- Menu active item is derived from `usePathname()`; `/projects/[id]` keeps "Dự án" active.
- Menu links are `<Link>` only — no client data fetching, no mutation.
- Detail routes are not menu items; they navigate back through breadcrumbs.
- Thống kê chỉ lấy từ chuẩn Spec Kit (`listSpecs()` đọc `specs/<slug>/tasks.md`). Không còn route `/projects/[id]/tasks/[slug]`, không có screen nào hiển thị số liệu `tasks/<slug>/todo.md`; `/projects` chỉ render `specCount` + `StatsBadges` của spec.

- `/projects/[id]` is a **fixed-height dashboard from `md` up**: `<main>` is a flex column with `md:h-[var(--content-h)]` — `--content-h` is defined in `globals.css` as `calc(100dvh − shell pt+pb)` (`md:pt-10 + pb-10` → `5rem`; mobile `pt-16 + pb-10` → `6.5rem`). `ThemeToggle` is `position:fixed` so it does not consume height. Below `md` the main has auto height and the page scrolls normally.
  - The body is a 2-column grid (`md:grid-cols-3`, `min-h-0 flex-1`): left `md:col-span-2` = the Specs section only (`flex min-h-0 flex-col`, `<ul>` `flex flex-col gap-2 overflow-y-auto` → fixed row spacing, scrolls in place; do NOT use `grid` here — grid's default `align-content: stretch` stretches rows to fill `flex-1`, so spacing would grow when there are few specs). Each spec is a **single-line row** — a `<Link>` (`relative overflow-hidden`) with `flex items-center gap-3`: slug left (`truncate`) + `done/total` right (`tabular-nums`, `—` when no `tasks.md`). The row carries a **background progress fill**: an `aria-hidden` `<span class="spec-fill absolute inset-y-0 left-0">` whose **width = done/total %** and whose `--fill-hue` ramps **purple (0%) → green (100%)** (`HUE_FROM=275 → HUE_TO=145`, computed in `specFill()`); slug + count are `relative` so they sit above the fill. Fill hue only — lightness is theme-specific in `globals.css` (`--spec-fill-l` 86% light / 24% dark) so text stays AA over the fill; count text is `text-zinc-700 dark:text-zinc-200` (the pastel tint drops `zinc-500` to ~3.2:1 → fails AA). % is triple-encoded (fill width + hue + `done/total` label), so colour is never the sole channel. **Specs are the only progress source on every screen** — this page imports `listSpecs` only; the old `<project>/tasks/<slug>/todo.md` feature and its `/projects/[id]/tasks/[slug]` route are removed. Right `md:col-span-1` = `<aside>` with `AutoCheckLine` (compact, fixed at top) then `NotificationLog` (`className="flex min-h-0 flex-1 flex-col gap-2"`, `listClassName="min-h-0 flex-1 overflow-y-auto"` → its `<ul>` scrolls, heading stays). Nav / header / `StatsBadges` are fixed rows above the grid.
  - `NotificationLog` accepts optional `className` (wrapper `<section>`) and `listClassName` (`<ul>`) for this; defaults keep the plain stacked layout so other usages are unchanged.

- `/projects/[id]/specs/[slug]` phases render as native `<details>`/`<summary>`:
  collapsed by default, expand on click (no client JS). Each phase header line
  shows the phase title plus a `done/total` badge (badge uses the phase's full
  task stats, not the filtered list). When the "Chưa xong" filter is active the
  badge switches to `pending/total`. Keep the summary line the only clickable
  affordance; the `<details>` element drives open/closed state.
