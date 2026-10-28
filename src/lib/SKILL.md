# src/lib — behavior & invariants

- Projects are stored in SQLite at `data/projects.db` (gitignored); `path` is UNIQUE and must be an existing absolute directory.
- A project's specs = sub-directories of `<project>/specs/`. Each spec's tasks come from `<spec>/tasks.md` (missing file → spec shown with "no tasks.md").
- Task line format: `- [ ]|[x]|[X] T### [tags...] title`. `[X]`/`[x]` = done. Leading `[..]` tokens are tags (e.g. `[P]`, `[US2]`). Indented lines below a task are its notes.
- Phases = `## ` headings; tasks before any heading go to a "Tasks" phase.
- Read-only: the app never writes to a project's files.
- `getSpec` only accepts slugs that exist in the `specs/` listing (no path traversal).
