# src/lib — behavior & invariants

- Projects are stored in SQLite at `data/projects.db` (gitignored); `path` is UNIQUE and must be an existing absolute directory.
- A project's specs = sub-directories of `<project>/specs/`. Each spec's tasks come from `<spec>/tasks.md` (missing file → spec shown with "no tasks.md").
- Task line format: `- [ ]|[x]|[X] T### [tags...] title`. `[X]`/`[x]` = done. Leading `[..]` tokens are tags (e.g. `[P]`, `[US2]`). Indented lines below a task are its notes.
- Phases = `## ` headings; tasks before any heading go to a "Tasks" phase.
- Read-only: the app never writes to a project's files.
- `getSpec` only accepts slugs that exist in the `specs/` listing (no path traversal).
- `getDb()` is exported so other modules (`lib/watch/*`) can use the same singleton connection.
- Three extra tables own the auto-watch job: `spec_watch` (PK `project_id,slug`; last known completed task IDs + mode `full`/`idle`), `task_watch` (PK `project_id,slug`; last known completed task items + mode `full`/`idle`), and `notification_log` (persistent Telegram send queue + history). `deleteProject()` removes the project and its `spec_watch`/`task_watch` rows in one transaction; `notification_log` rows are kept as history.
- Watch job behavior/invariants live in `src/lib/watch/SKILL.md`.
