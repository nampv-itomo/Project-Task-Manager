# src/app — route map & shell

Layout shell (`layout.tsx`): skip link → `Sidebar` → `<main id="main">`. Sidebar owns its own padding; page `main` elements must not add `px-*`/`py-*` (the shell provides `px-4 pb-10 pt-16 md:pt-10`).

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
