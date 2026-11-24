# src/components — app nav, icons, forms, progress & watch UI

## Astryx migration (all components use Astryx primitives)

Every component here builds UI from `@astryxdesign/core` (see the shell's Astryx
invariants in `src/app/SKILL.md`). Primitives in use: `Button`, `IconButton`,
`TextInput`, `AlertDialog`, `Badge`, `Tooltip`, `ProgressBar`, `Icon`,
`Stack`/`HStack`, `Text`, `Heading`, `List`/`ListItem`, `EmptyState`,
`TabList`/`Tab`, `SideNav*`, `Layout`/`LayoutHeader`/`LayoutContent`/`LayoutPanel`,
`AppShell`, `Breadcrumbs`, `Collapsible`/`CollapsibleGroup`, `Grid`, `Card`.
Where the neutral theme's `IconName` union lacks a semantic name
(`dashboard`/`folder`/`moon`/`sun`/`refresh`/`plus`), `icons.tsx` feeds a
**lucide-react** component into Astryx `Icon`'s `icon` slot (`astryx docs
icons`: a meaning not in the semantic list takes an SVG component directly).

Deliberate **native escape hatches** (Astryx has no equivalent, or one would
regress a documented a11y invariant — `astryx doctor` flags these as warnings,
not failures, and they are intentional):
- `icons.tsx` wraps **lucide-react** glyphs in Astryx `Icon` (no hand-drawn
  `<svg>`, no `className` defaults any more): Lucide owns the artwork, Astryx
  `Icon` owns size/colour, so every glyph follows the active theme and is sized
  by the slot it sits in. These meanings are not Astryx icon definitions, which
  is why they stay wrappers rather than `<Icon icon="folder">`.
- `theme-toggle.tsx` swaps its moon/sun glyph with CSS-driven
  `dark:hidden` / `hidden dark:inline` `<span>`s inside `IconButton`'s `icon`
  slot (the only remaining `className` in the components tree): no React state
  → no flash and no hydration mismatch on a server-rendered page, and the swap
  follows the `.dark` class exactly like the rest of the hand-rolled dark-mode
  parts.
- `watch-status.tsx` keeps native `<section aria-labelledby>` (Astryx `Section`
  exposes no `id`/landmark role, so the labelled region needs native); its
  headings use `Heading`'s `id` prop for the label anchor. Time-pill hints now
  use Astryx `Tooltip` (the old `<span title>` hatch is gone) — `Badge` has no
  `title`/`tooltip` prop, and `Tooltip` also fires on keyboard focus.

Per-component notes below.

## app-nav.tsx (client) — `SideNav` in `AppShell`'s `sideNav` slot
- Collapsed state lives on `<html data-sidebar-collapsed="1|0">`, not in React
  state: `layout.tsx`'s pre-paint script restores it from
  `localStorage["sidebar-collapsed"]` before first paint (no flash, no hydration
  mismatch); `SideNav`'s own collapsible rail renders the width/labels. React
  mirrors the value with `useSyncExternalStore` (document event
  `sidebar-collapsed-change`, server snapshot `false`) only for `aria-expanded`
  and the button label — never `setState` inside an effect (eslint
  `react-hooks/set-state-in-effect`).
- Below `AppShell`'s mobile breakpoint the same items move into the drawer
  `AppShell` builds from the nav slots (focus-trapped, focus returned to the
  toggle) — no hand-rolled drawer/fixed button here any more.
- Menu items: `NAV_ITEMS` = `/` Tổng quan, `/projects` Dự án; `SideNavItem`
  `as={Link}`, `isSelected` from `usePathname()` (`/projects/[id]` keeps
  "Dự án" active). `ThemeToggle` sits in `footerIcons`.

## spec-filter-tabs.tsx (client) — anchor tabs
- A `TabList` strip whose `Tab`s navigate by `href` (`?status=done|pending`) so
  filtering is still a plain URL navigation that deep-links and survives Back —
  the page stays server-rendered. `role` is left unset (nav-landmark mode is the
  only mode where `href` works); `onChange` is a no-op present solely to keep
  the strip keyboard-navigable. Takes only serializable props (`value`, `base`,
  `options`) so a Server Component can render it.

## add-project-form.tsx / remove-project-button.tsx / refresh-button.tsx (client)
- The `<form>` stays native (posts the `addProject` Server Action); `Stack`/
  `HStack` own all spacing — no grid `className`. `TextInput` carries the
  shared `status` error; `pickFolder` runs in a `useTransition`.
- `RemoveProjectButton` confirms with `AlertDialog` before `deleteProject`.
- `RefreshButton` = secondary `Button` + `useTransition` → `router.refresh()`;
  `isLoading` shows the pending state. Server pages read fresh data on refresh.

## progress.tsx (server components, read-only)
- `StatsBadges({ stats })` — done/pending/total pills + `ProgressBar` with the
  `N%` value label for one aggregate (page-level totals).
- `RowProgress({ stats })` — the **row** bar shared by spec rows
  (`/projects/[id]`) and phase rows (`/projects/[id]/specs/[slug]`): stock
  `ProgressBar` (`isLabelHidden`, variants neutral/accent/success by %), always
  called with **full** stats, never a filtered subset. It replaced the old
  bespoke `ProgressFill` (purple→green hue ramp painted behind row text):
  `List`/`ListItem` expose no full-bleed background slot and `ProgressBar`
  exposes no `className`, and stock variants drop the AA-over-pastel-fill
  problem. `%` stays multi-encoded (bar width + `done/total` badge), so colour
  is never the sole channel.
- **Invariant — these stay Server Components, so they must not pass a function
  prop to an Astryx Client Component** (`ProgressBar.formatValueLabel`,
  `Table` renderers, …): React serialises props across the server→client
  boundary and throws `Functions cannot be passed directly to Client
  Components`, which 500s the page and kills `next build` at *Collecting page
  data*. Use the component's default formatting, or precompute a string and
  pass it as a plain prop.

## auto-refresh.tsx (client)
- `AutoRefresh({ intervalMs, enabled })` renders `null`: polls `router.refresh()`
  on the watch job's interval so the server-rendered phase list tracks the
  auto-check tick. `refresh()` re-renders Server Components and merges the
  payload **without** losing scroll position or the open/closed state of native
  `<details>` (uncontrolled DOM state survives the merge).
- Pauses while `document.visibilityState === "hidden"`; a tab returning to
  visible refreshes once immediately, then resumes the interval.
  `enabled=false` (job tắt) or `intervalMs<=0` → no timer at all.
- Mounted only on `/projects/[id]/specs/[slug]` (gated by
  `watchStatus().enabled`). `/projects/[id]` keeps manual `↻ Làm mới` only.

## watch-status.tsx (server-rendered, read-only)
- `AutoCheckLine({ summary, enabled, intervalMs, id, heading, autoRefreshing })`
  — `autoRefreshing` (default `false`) only switches the footnote text to "tự
  làm mới theo cùng chu kỳ" when the page also mounts `AutoRefresh`; job state
  for a project (tracked/active/idle counts) or a single spec
  (`summary.mode` → badge `Đang theo dõi task` / `Đã 100% — chỉ theo dõi
  file`). Empty states: `Auto-check đang tắt (TASK_WATCH_ENABLED=0).` when the
  job is off, `Chưa có snapshot nào…` when nothing is tracked.
- `NotificationLog({ rows, id, heading })` — ≤10 recent `notification_log`
  rows as `List`/`ListItem` (start time pill · kind label + slug · task IDs +
  error/hint notes · status badge). UTC+7 time, full UTC timestamp in the
  `Tooltip`. Kind labels: `Task hoàn thành` = task **trong spec** vừa `[x]`
  (không phải dạng todo.md cũ), `Spec hoàn thành`. Status badge (`Đã gửi`
  success / `Gửi lỗi` error / `Chưa cấu hình Telegram` warning) — always
  text, never colour-only; `error` also shows `Đã thử N lần · <redacted
  error>`. Fixed-height pages scroll it by putting it in `Layout`'s `end` slot
  with `LayoutPanel isScrollable` — the old `className`/`listClassName` flex+
  overflow hooks are gone.
- Status/colour pairings go through Astryx Badge/Icon variants; secondary text
  uses `color="secondary"`.
- **No client JS of its own**: these stay server-rendered snapshots. The only
  client islands they pull in are Astryx's own interactive components
  (`Tooltip` is `'use client'` internally, which is fine from a Server
  Component). Auto-refresh, where it exists, comes from a separate
  `AutoRefresh` mount on the page (spec page only). Other pages: users refresh
  with the `↻ Làm mới` button (`refresh-button.tsx`).
