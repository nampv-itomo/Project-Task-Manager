<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## CodeGraph

- If `.codegraph/` exists at the repo root, use it BEFORE grep/find/Read to understand or locate code:
  - MCP: `codegraph_explore` (load via ToolSearch if deferred) — symbol source + call paths in one call. Name files/symbols in the query for line-numbered source.
  - Shell: `codegraph explore "<symbols or question>"`.
- No `.codegraph/` → skip CodeGraph. Never index; that is Nam's decision.

## SKILL.md (Business Logic)

- Before editing a file, read the `SKILL.md` in the same directory if one exists.
- When business logic is added or changed, create/update `SKILL.md` in that directory with the current behavior and invariants.
- Never put project-specific business logic in `AGENTS.md`.

<!-- END:nextjs-agent-rules -->
