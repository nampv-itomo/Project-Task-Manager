# Spec: Auto Task Watch + Telegram Notification

Status: **implemented** (backend + UI + docs xong; còn `pm2 reload` production là quyết định của Nam) · Intent đã confirm qua interview (xem "Objective").
Scope check (Phase 0): **1 capability** → không cần capability map.

## Objective

**Problem:** Nam không muốn mở web bấm "↻ Làm mới" để biết task nào vừa xong. Các spec
(`<project>/specs/<slug>/tasks.md`) được cập nhật bên ngoài app (agent/người sửa file), app
không biết cho tới khi có người reload.

**Outcome:** Một job chạy trong server, mỗi 60s đọc lại `tasks.md` của các spec còn pending,
so sánh với snapshot đã lưu trong SQLite, và gửi thông báo Telegram khi có task **mới**
chuyển sang `[x]`.

**User:** Nam — 1 Telegram chat duy nhất, credential trong `.env.local`.

**Success (định tính):** Trong ≤60s kể từ khi một task được tick `[x]` trên đĩa, Nam nhận
được 1 message Telegram gộp theo dự án, ví dụ:

```
ProjA · 12/20 task
• spec-01-us1: T014, T015
• spec-03-us2: T021
```

## Tech Stack

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Framework | Next.js `16.4.3` (App Router, `src/`) | đã có |
| Scheduler | `src/instrumentation.ts` → `register()` + `setInterval().unref()` | Next gọi `register` **1 lần / server instance**; `ecosystem.config.js` đã đặt `instances: 1` → không có race song gửi |
| Storage | SQLite (`better-sqlite3` `^13`) tại `data/projects.db` | thêm 2 bảng, không migration tool |
| Notify | Telegram Bot API qua global `fetch` (Node 24) | **0 dependency mới** |
| Test | `node --test` (Node 24, chạy `.ts` trực tiếp) | 0 dependency mới |
| Runtime guard | `process.env.NEXT_RUNTIME === "nodejs"` | Next gọi `register` ở mọi runtime |

## Commands

```bash
# Dev
npm run dev                       # next dev -p 3600 (watch job vẫn chạy trong dev)

# Production (PM2)
pm2 start ecosystem.config.js
pm2 reload project-task-manager
pm2 logs project-task-manager     # xem log tick / notify

# Test (unit, zero-dep)
node --test --conditions=react-server "tests/**/*.test.ts"

# Lint / build
npm run lint
npm run build
```

`--conditions=react-server` là **bắt buộc**: `src/lib/specs.ts` và `src/lib/db.ts` import
`"server-only"`; với condition này Node resolve `server-only` → `empty.js` (đã verify trên
Node 24.11). Không có condition → test fail với
`This module cannot be imported from a Client Component module`.

## Project Structure

```
src/
  instrumentation.ts                 # MỚI: register() → start watch job (nodejs runtime only)
  lib/
    db.ts                            # sửa: export getDb(), tạo 2 bảng mới
    specs.ts                         # không đổi (re-use parseTasks/listSpecSlugs)
    watch/
      SKILL.md                       # MỚI: business logic + invariants của job
      types.ts                       # SpecSnapshot, WatchDiff, NotifyPayload
      diff.ts                        # PURE: diffSnapshots(prev, current) → newlyDone/reopened/completed
      store.ts                       # CRUD spec_watch + notification_log (server-only)
      telegram.ts                    # sendMessage + hàng đợi flush (server-only)
      runner.ts                      # 1 tick: scan → read → diff → queue → send (server-only)
      start.ts                       # setInterval + singleton guard (server-only)
  app/
    projects/[id]/page.tsx           # sửa: thêm khối "Auto-check" + "Thông báo gần đây"
    projects/[id]/specs/[slug]/page.tsx  # sửa: thêm khối "Auto-check"
components/
  watch-status.tsx                   # MỚI (server component): AutoCheckLine, NotificationLog
.env.local                           # TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (gitignored)
tests/
  diff.test.ts                       # unit test cho diffSnapshots (pure)
tasks/auto-task-watch/
  spec.md                           # file này
  plan.md                           # Phase 2 — implementation plan
  todo.md                           # Phase 3 — task list
```

Quy tắc test/import: test import bằng đường dẫn tương đối có đuôi `.ts`
(`../src/lib/watch/diff.ts`) vì Node không resolve `@/*` của tsconfig. Cần thêm
`"allowImportingTsExtensions": true` vào `tsconfig.json` (đã có `noEmit: true` → hợp lệ).
`package.json` **không** thêm `"type": "module"` (sẽ làm `ecosystem.config.js` CJS hỏng);
warning `MODULE_TYPELESS_PACKAGE_JSON` khi chạy test là benign, chấp nhận.

## Data Model

```sql
CREATE TABLE IF NOT EXISTS spec_watch (
  project_id     INTEGER NOT NULL,
  slug           TEXT    NOT NULL,
  mode           TEXT    NOT NULL DEFAULT 'full',  -- 'full' | 'idle'
  done_ids       TEXT    NOT NULL DEFAULT '[]',    -- JSON array task id đang [x]
  total          INTEGER NOT NULL DEFAULT 0,
  done           INTEGER NOT NULL DEFAULT 0,
  pending        INTEGER NOT NULL DEFAULT 0,
  seeded         INTEGER NOT NULL DEFAULT 0,       -- 0 = baseline chưa có, tick này chỉ seed
  file_mtime_ms  INTEGER,
  last_checked_at TEXT,
  last_changed_at TEXT,
  PRIMARY KEY (project_id, slug)
);

CREATE TABLE IF NOT EXISTS notification_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  project_id   INTEGER,
  project_name TEXT NOT NULL,
  slug         TEXT,                    -- NULL nếu message gộp nhiều spec
  kind         TEXT NOT NULL,          -- 'tasks_done' | 'spec_completed'
  task_ids     TEXT NOT NULL DEFAULT '[]',
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | sent | skipped_no_config | error
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT
);
```

`spec_watch` bị xoá row khi project bị xoá (`deleteProject` → `DELETE FROM spec_watch WHERE project_id = ?`).
`notification_log` giữ 200 row gần nhất (prune mỗi tick).

## Behavior (business logic)

Per tick (60s, mặc định, có overlap-guard):

1. Load `projects`. Project có path không tồn tại → skip, ghi log warn.
2. Với mỗi spec (`listSpecSlugs`), quyết định mode:
   - **Chưa có snapshot row** → read full, parse, **seed baseline im lặng** (`seeded=1`), **không notify**.
   - **`pending > 0`** (job "active") → read full `tasks.md`.
   - **`pending == 0`** (job "idle") → chỉ `fs.statSync` so `mtime`; không đổi → bỏ qua; đổi → read full và re-arm sang `full`.
3. Diff (set task id, so theo **id** không theo thứ tự dòng):
   - `newlyDone = currentDone \ prevDone`
   - `reopened   = prevDone \ currentDone`
   - `completed  = prev.pending > 0 && current.pending == 0 && current.total > 0`
4. Hàng đợi message:
   - `newlyDone` rỗng và không `completed` → không gửi gì (kể cả khi có `reopened`: **im lặng**, chỉ cập nhật snapshot).
   - Gom **toàn bộ `newlyDone` trong 1 tick theo dự án** → 1 message `kind='tasks_done'`, các spec liệt kê dạng bullet.
   - Mỗi spec `completed` → 1 message riêng `kind='spec_completed'`.
   - Message > 3500 ký tự → cắt thành nhiều message (cap an toàn < Telegram limit 4096).
5. Persist message vào `notification_log` với `status='pending'` **trước khi gửi** → gửi; update
   `sent` / `skipped_no_config` / `error`. Đầu mỗi tick, flush các row `pending` (retry,
   `attempts < 5`) → không mất thông báo khi server restart hoặc Telegram lỗi/mạng chập.
6. Cập nhật `spec_watch` (done_ids, stats, mtime, mode, `last_checked_at`).

Message format (plain text, **không** `parse_mode` → không phải escape Markdown):

```
ProjA · 12/20 task
• spec-01-us1: T014, T015
• spec-03-us2: T021
```

```
✅ ProjA / spec-01-us1 — 20/20 task, spec hoàn thành
```

Telegram: `POST https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
body `{ chat_id, text, disable_web_page_preview: true }`. HTTP `result:false` / network error →
`status='error'`, `last_error=<description>` (token **không** được log).

Đầu mỗi tick in 1 dòng log: `[watch] <project> specs=<n> active=<n> idle=<n> newlyDone=<n> sent=<n>`.

### Env

| Var | Bắt buộc | Default | Ý nghĩa |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | để gửi | — | bot token |
| `TELEGRAM_CHAT_ID` | để gửi | — | chat nhận (user id hoặc `-100...` group) |
| `TASK_WATCH_INTERVAL_MS` | không | `60000` | chu kỳ tick |
| `TASK_WATCH_ENABLED` | không | `1` | `0` → không start job |

Thiếu token/chat → job **vẫn poll + vẫn ghi log**, message lưu `status='skipped_no_config'`
(chỉ bước gửi bị tắt) → bật token sau không mất baseline.

### UI (read-only, không thêm nút mới)

- `/projects/[id]`: dòng `Auto-check: đang theo dõi · kiểm tra lúc 10:32 (mỗi 60s)` + bảng
  "Thông báo gần đây" (≤10 row `notification_log` của project: time, slug, task ids, status).
- `/projects/[id]/specs/[slug]`: dòng Auto-check cho riêng spec (mode active/idle, last checked).
- Không auto-refresh UI: vẫn dùng nút `↻ Làm mới` hiện có. Trang đã `force-dynamic` → đọc DB each request.
- Không đổi sidebar/nav (không thêm route mới).

## Code Style

```ts
// src/lib/watch/diff.ts — pure, không fs/db/network → test được bằng node --test
export type WatchDiff = {
  newlyDone: string[];
  reopened: string[];
  completed: boolean;
};

/** Diff two done-id snapshots. Order-insensitive; ids are compared as a set. */
export function diffSnapshots(prevDone: string[], currentDone: string[]): WatchDiff {
  const prev = new Set(prevDone);
  const current = new Set(currentDone);
  return {
    newlyDone: currentDone.filter((id) => !prev.has(id)),
    reopened: prevDone.filter((id) => !current.has(id)),
    completed: false, // caller sets from pending counts
  };
}
```

Quy ước: `camelCase` cho hàm/biến, `UPPER_SNAKE` cho const config; JSDoc 1 dòng cho mỗi exported
function giải thích *invariant*; không `enum` / không parameter property (Node type-stripping
chỉ nhận erasable syntax); mọi I/O nằm ngoài module pure (`diff.ts`); parse error → `try/catch`
rồi log warn, **không** làm chết tick.

## Testing Strategy

| Level | Ở đâu | COVER | Lệnh |
|---|---|---|---|
| Unit (pure) | `tests/diff.test.ts` | `diffSnapshots`: newlyDone, reopened, rỗng, id thêm/mất hàng loạt, spec 0 task, id trùng | `npm test` (script mới) |
| Unit (format) | `tests/format.test.ts` | message ≤3500 ký tự, grouping theo spec, spec completed | `npm test` |
| Manual E2E | `next start` + sửa thật `tasks.md` | luồng đĩa → tick → Telegram/UI | xem Success Criteria |
| Build gate | — | type + lint sạch | `npm run lint && npm run build` |

Không thêm test framework/dev dependency mới. Script mới:
`"test": "node --test --conditions=react-server \"tests/**/*.test.ts\""`.

Verification thực tế (browser) chỉ khi cần xem UI: playwright MCP trên `http://localhost:3600`.

## Boundaries

**Always**
- Chạy `npm run lint` + `npm run build` (và `npm test` khi có test) trước khi báo xong.
- App **read-only** với thư mục dự án: chỉ `readFileSync` / `statSync`, không bao giờ ghi file dự án.
- Guard `NEXT_RUNTIME === "nodejs"` trong `register()`; singleton guard qua `globalThis` (như `db.ts`) để hot-reload dev không nhân đôi interval.
- `setInterval(...).unref()`, tick async có in-flight flag (không chồng tick).
- Giữ invariant `instances: 1` trong `ecosystem.config.js` (SQLite + anti double-send).
- Update `src/lib/SKILL.md` / tạo `src/lib/watch/SKILL.md` khi business logic đổi.

**Ask first**
- Thêm dependency mới (kể cả dev dependency).
- Thêm/sửa bảng SQLite ngoài 2 bảng ở trên; xoá dữ liệu `spec_watch`/`notification_log`.
- Sửa `ecosystem.config.js` (số instance, cron, PM2 cluster).
- Sửa `tsconfig.json` (`allowImportingTsExtensions`) — spec này xin phép 1 lần.
- Thêm route mới (`/settings`, `/api/...`) hoặc UI nhập Telegram token.

**Never**
- Commit secret: `.env*` đã gitignored; không hardcode token; không log token/chat id.
- Gửi Telegram hàng loạt lần đầu (baseline luôn seed im lặng).
- Ghi/mửa/sửa `tasks.md` hay bất kỳ file nào của project được theo dõi.
- Bắt `register()` await toàn bộ work blocking (server phải ready nhanh).

## Success Criteria

1. `next start` chạy liên tục: log tick xuất hiện mỗi 60s ±5s, kèm số liệu
   `specs/active/idle/newlyDone/sent`.
2. Sửa `- [ ] T001 ...` → `- [x] T001 ...` trong `tasks.md` của spec còn pending → **≤65s** sau
   Telegram nhận 1 message chứa tên project, slug, `T001`, tỉ lệ `done/total`; UI hiện row
   `status=sent`.
3. Spec chạm 100% → có thêm message `spec_completed`, và row `spec_watch.mode` chuyển `idle`
   (verify bằng `sqlite3 data/projects.db "select slug,mode,pending from spec_watch"`).
4. Thêm 1 task pending mới vào spec đang `idle` → tick kế tiếp re-arm `mode=full` (nhờ mtime)
   và task đó được thông báo khi tick sau nó `[x]`.
5. Restart server (`pm2 reload`) **không** gửi lại thông báo cũ (snapshot nằm trong SQLite).
6. Tick đầu tiên trên project đã có sẵn task `[x]` → **0** message (baseline seed).
7. Task reopen `[x]` → `[ ]` → snapshot cập nhật, **0** message.
8. Chưa cấu hình `TELEGRAM_*` → job vẫn chạy, `notification_log.status='skipped_no_config'`, UI vẫn hiện log.
9. Telegram lỗi (token sai) → `status='error'` + `last_error`, retry tối đa 4 lần qua các tick, không crash job, token không xuất hiện trong log.
10. `npm run lint`, `npm run build`, `npm test` đều pass.

## Open Questions

1. `tsconfig.json`: thêm `allowImportingTsExtensions` để test chạy được — **ok?** (nếu không, bỏ unit test, chỉ manual verify).
2. Có muốn 1 trang `/settings` để nhập Telegram token/chat id trong UI (thay vì `.env.local`)? Spec hiện tại: **không**.
3. Nội dung message tiếng Việt + emoji `✅` như mẫu — **ok?**, hay muốn gọn hơn (không emoji)?
4. Trang `/` (Tổng quan) có cần hiện "Thông báo gần đây" toàn cục không? Spec hiện tại: **không** (chỉ trang project + spec).
5. Job có cần chạy trong `npm run dev` không, hay chỉ production? Spec hiện tại: **chạy cả dev** (để test dễ), có `TASK_WATCH_ENABLED=0` để tắt.

## Implemented (kết quả thực tế)

**Success Criteria** — tất cả đã verify (`tasks/auto-task-watch/todo.md` → Checkpoint E2E, 02/11/2026):

| # | Kết quả | Bằng chứng |
| --- | --- | --- |
| 1 | ✅ | log `[watch] started interval=…`, tick mỗi chu kỳ, kèm `specs/active/idle/newlyDone/queued` + `tick done sent=…` |
| 2 | ✅ | fixture `ProjE2E`: `[ ] T002` → `[x]` lúc 15:00:20 → `queued=1 sent=1` lúc 15:00:38 (18s); UI `/projects/[id]` hiện row `sent` |
| 3 | ✅ | spec đạt 4/4 → message `spec_completed` riêng, `spec_watch.mode` → `idle` (`sqlite3 select slug,mode,pending`) |
| 4 | ✅ | sửa `tasks.md` của spec `idle` → `statSync` thấy `mtime` đổi → re-arm `full`, task mới được thông báo |
| 5 | ✅ | restart server không gửi lại message cũ (snapshot + queue trong SQLite); project thật `002-fe-nextjs-migration` 56→63 chỉ gửi 1 message |
| 6 | ✅ | spec mới thấy lần đầu → `seeded`, 0 message (unit test `runner.test.ts`) |
| 7 | ✅ | reopened `[x]`→`[ ]` chỉ cập nhật snapshot, 0 message (unit test) |
| 8 | ✅ | thiếu `TELEGRAM_*` → `skipped_no_config`, job vẫn chạy, UI vẫn hiện log + hint amber |
| 9 | ✅ | token sai → `status=error`, `last_error="HTTP 401: Unauthorized"`, không lộ token/chat id (smoke `--bad-token`) |
| 10 | ✅ | `npm test` 67/67 · `npm run lint` sạch · `npx tsc --noEmit` sạch · `npm run build` sạch |

**Lệch so với spec** (ghi chi tiết ở `todo.md`):

- `MAX_SEND_ATTEMPTS = 5` (spec viết "retry tối đa 4 lần") → tổng 5 lần gửi cho 1 message.
- `store.ts` dùng 1 API `saveSnapshot()` thay vì `upsertSnapshot` / `seedSnapshot` / `setMode`.
- Runner flush hàng đợi ngay cuối mỗi tick (message vừa queue được gửi trong cùng tick).
- UI dùng `role="list"` + heading `aria-labelledby`, không dùng `<table>`/`<caption>` (project không có table pattern).
- Secondary text thêm `dark:text-zinc-400` vì `zinc-500` trên `zinc-900` chỉ 4.1:1 (fail AA).
- Log tách 2 dòng: per-project `queued=` và per-tick `sent= failed= skippedNoConfig=`.

**Open Questions — đã chốt:** (1) thêm `allowImportingTsExtensions` ✅ đã thêm; (2) trang `/settings` ❌ không làm (token trong `.env.local`); (3) message tiếng Việt + emoji `✅` cho `spec_completed` ✅ giữ; (4) không có khối notification toàn cục ở `/` ✅ giữ nguyên; (5) job chạy cả trong `npm run dev` ✅, tắt bằng `TASK_WATCH_ENABLED=0`.
