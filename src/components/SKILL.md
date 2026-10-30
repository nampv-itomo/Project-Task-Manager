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
