# Implementation Plan: Auto Task Watch + Telegram Notification

Spec: `tasks/auto-task-watch/spec.md` (đã duyệt). Task list: `tasks/auto-task-watch/todo.md`.

## Overview

Thêm background job chạy trong Next server (`src/instrumentation.ts` → `setInterval` 60s):
scan mọi project trong SQLite, re-read `tasks.md` của các spec còn pending, diff snapshot
done-task (lưu trong bảng `spec_watch`) → message gộp theo project lưu vào `notification_log`
(`pending`) rồi gửi Telegram. Spec đạt 100% chuyển sang mode `idle` (chỉ check `mtime`) và tự
re-arm khi file đổi. UI hiển thị trạng thái auto-check + log thông báo trên trang project/spec.
0 dependency mới, app vẫn read-only với thư mục dự án.

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Scheduler trong `register()` của `src/instrumentation.ts` | Next gọi 1 lần/server instance; PM2 `instances:1` → không cần cron ngoài, không API route + secret. Guard `NEXT_RUNTIME === "nodejs"` + singleton trên `globalThis` (pattern đã dùng ở `db.ts`) để dev hot-reload không nhân đôi interval. |
| Tách `diff.ts` / `format.ts` pure, không fs/db/network | Cho phép unit test bằng `node --test` mà không mock I/O; phần risky nhất của feature (set-diff theo task id) được cover không cần Telegram. |
| Snapshot lưu `done_ids` JSON trong SQLite | Diff theo **tập id**, không theo thứ tự dòng hay hash file → immune với reformat/reorder `tasks.md`; baseline seed im lặng tránh spam khi thêm project. |
| `notification_log` là **hàng đợi** (`pending → sent/error`, retry ≤4) | Không mất thông báo khi Telegram lỗi hoặc server restart giữa tick; có luôn audit log cho UI. |
| 2 mode per spec: `full` (parse+diff) / `idle` (`statSync` mtime) | Đúng yêu cầu "spec còn pending mới check", nhưng spec 100% done vẫn phát hiện được task mới thêm/reopen mà không phải parse mọi file mỗi phút. |
| Message plain text, không `parse_mode` | Không phải escape Markdown/`_`/`*` trong task title; 1 message gộp/dự án/tick + 1 message `spec_completed` riêng. |
| Env `.env.local` cho `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, đọc **trong tick** | Next đã load `.env.local` cho `next start`/`next dev`; đọc trong tick tránh phụ thuộc thứ tự khởi tạo. Thiếu creds → vẫn poll + log `skipped_no_config`. |
| Test bằng `node --test --conditions=react-server`, import `.ts` trực tiếp | Đã verify trên Node 24.11: `--conditions=react-server` làm `server-only` resolve sang `empty.js` → test import được `specs.ts`/`store.ts`. Không thêm jest/vitest. |

## Dependency Graph

```
types.ts ─┬─ diff.ts ──────────┐
          └─ format.ts ────────┤
db.ts (schema, getDb) ── store.ts ─┬─ telegram.ts ─┐
                                   └─ runner.ts ───┴─ start.ts ─ instrumentation.ts
                                                                      │
                                            store.ts (read) ─── UI (project/spec page)
```

Build order (bottom-up + vertical slice ở T6–T7):
`types/diff` → `format` → `db schema` → `store` → `telegram` → `runner` → `instrumentation`
→ **E2E checkpoint** → UI → docs.

## Sequential vs Parallel

- **Bắt buộc tuần tự:** T1→T2 (types), T3 (schema) → T4 (store), T4 → T5/T6, T6 → T7.
- **Song song được:** T1+T2 (2 module pure, không chung file); T8/T9 (2 trang UI, cùng component T8);
  docs T10 luôn song song với code.

## Verification Checkpoints

1. **Sau T1–T3:** `npm test` pass, `npm run build` pass, `sqlite3 data/projects.db ".tables"` có `spec_watch` + `notification_log`.
2. **Sau T7 (E2E):** tick hiện trong log mỗi 60s; tick `[x]` thật trên `tasks.md` → message Telegram
   nhận được ≤65s; restart → không gửi lại; tick đầu project cũ → 0 message.
3. **Sau T10:** UI hiện auto-check + log; `npm run lint && npm run test && npm run build` sạch;
   đối chiếu 10 Success Criteria trong spec.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `register()` chạy lại khi Turbopack hot-reload → 2 interval | Trùng thông báo | singleton `globalThis.__ptmWatch` clearInterval cái cũ trước khi start |
| `better-sqlite3` bị bundle trong instrumentation | Crash lúc start | `next.config.ts` đã có `serverExternalPackages: ["better-sqlite3"]`; dynamic `await import()` trong `register` (theo docs) |
| Chạy 2 process cùng lúc (`next dev` + PM2) | Double-send, WAL contention | invariant ghi rõ trong `src/lib/watch/SKILL.md` + spec: chỉ 1 server instance; dev thì dừng PM2 |
| Task id trùng/nhiều spec cùng id | Diff sai | diff theo `(project_id, slug)` — mỗi spec 1 snapshot row riêng |
| Tick dài hơn 60s (nhiều project/disk chậm) | Chồng tick | in-flight flag bỏ qua tick kế tiếp, log warn `tick-skipped` |
| Telegram 429 / sai token | Mất hoặc spam retry | batch 1 message/project/tick, `attempts` cap 5, backoff theo tick, lỗi hiển thị trong UI log |
| Project bị xoá | Row mồ côi | `deleteProject` xoá kèm `spec_watch` (giữ `notification_log` để lịch sử) |
| Spec không có `tasks.md` | Crash tick | `hasTasks=false` → snapshot 0 task, không notify, mode `idle` |
| Message dài (> Telegram 4096) | Gửi fail | cắt tại 3500 ký tự, gửi nhiều message |

## Task List

### Phase 1 — Foundation (pure + schema)
- [ ] T1 `types.ts` + `diff.ts` + `tests/diff.test.ts` (+ `tsconfig` allowImportingTsExtensions, `package.json` test script)
- [ ] T2 `format.ts` + `tests/format.test.ts`
- [ ] T3 `db.ts`: export `getDb`, tạo `spec_watch` + `notification_log`, cascade delete

### Checkpoint: Foundation
- [ ] `npm test` pass · `npm run build` pass · 2 bảng tồn tại trong SQLite

### Phase 2 — Job path (store → send → tick → start)
- [ ] T4 `store.ts` (snapshot + log CRUD + prune 200)
- [ ] T5 `telegram.ts` (sendMessage + `flushPending`)
- [ ] T6 `runner.ts` (1 tick hoàn chỉnh: scan → mode full/idle → diff → enqueue → flush)
- [ ] T7 `start.ts` + `src/instrumentation.ts`

### Checkpoint: E2E
- [ ] Log tick mỗi 60s · notify Telegram ≤65s · restart không gửi lại · baseline 0 message

### Phase 3 — UI + docs
- [ ] T8 `components/watch-status.tsx` (AutoCheckLine + NotificationLog)
- [ ] T9 Nối UI vào `/projects/[id]` và `/projects/[id]/specs/[slug]`
- [ ] T10 `src/lib/watch/SKILL.md` + cập nhật `src/lib/SKILL.md`, mark spec `implemented`

### Checkpoint: Complete
- [ ] 10 Success Criteria của spec đạt · lint/test/build sạch · sẵn sàng review

## Open Questions còn mở (từ spec)

- `/settings` nhập Telegram token trong UI? (mặc định: không — `.env.local`)
- Log thông báo ở trang `/` Tổng quan? (mặc định: không)
- Emoji `✅` trong message? (mặc định: có)
