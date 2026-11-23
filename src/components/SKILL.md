# src/components — sidebar & icons

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

## watch-status.tsx (server components, read-only)

- `AutoCheckLine({ summary, enabled, intervalMs, id, heading })` — job state for a project (tracked/active/idle counts) or a single spec (`summary.mode` → badge `Đang theo dõi task` / `Đã 100% — chỉ theo dõi file`). Empty states: `Auto-check đang tắt (TASK_WATCH_ENABLED=0).` when the job is off, `Chưa có snapshot nào…` when nothing is tracked.
- `NotificationLog({ rows, id, heading, className?, listClassName? })` — ≤10 recent `notification_log` rows: UTC+7 time (`title` holds the full UTC timestamp), kind label (`Task hoàn thành` / `Spec hoàn thành` — `tasks_done` = task **trong spec** vừa `[x]`, không phải dạng todo.md cũ), slug, task IDs (`font-mono`, `break-words`), status badge (`Đã gửi` emerald / `Gửi lỗi` red / `Chưa cấu hình Telegram` amber). Status is always text, never colour-only; `error` also shows `Đã thử N lần · <redacted error>`.
  - `className` (wrapper `<section>`) and `listClassName` (`<ul>`) let a fixed-height page scroll the list in place — `/projects/[id]` passes `listClassName="min-h-0 flex-1 overflow-y-auto"` so the log scrolls within the sidebar column while the heading stays. Both default to the plain stacked layout, so other usages are unchanged.
- Both are `<section aria-labelledby>` regions (`role="list"` lists) so they land in the a11y tree as landmarks; secondary text is `text-zinc-500` + `dark:text-zinc-400` (plain `zinc-500` on `zinc-900` is only 4.1:1 → fails AA).
- Layout: `<li>` is a 1-column grid on mobile and `md:grid-cols-[7.5rem_1fr_auto]` from 48rem — no table component (project has no `Table` pattern and adding one needs explicit authorization).
- **No client JS, no `"use client"`, no auto-refresh**: data is the snapshot taken when the page rendered; users refresh with the existing `↻ Làm mới` button (`refresh-button.tsx`).
