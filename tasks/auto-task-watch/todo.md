# Task List: Auto Task Watch + Telegram Notification

Spec: `tasks/auto-task-watch/spec.md` · Plan: `tasks/auto-task-watch/plan.md`

## Task 1 ✅: Pure diff layer (`types.ts`, `diff.ts`) + unit test + test harness

**Description:** Nền tảng so sánh snapshot task đã xong. Không fs/db/network → test được ngay,
không cần Telegram. Đồng thời dựng harness test 0-dependency cho cả feature.

**Acceptance criteria:** ✅
- [x] `src/lib/watch/types.ts` có `WatchMode`, `SpecSnapshot`, `WatchDiff` (`newlyDone`/`reopened`), `TaskCounts`, `NotifyPayload`, `NotifyStatus`, `NotificationRow` (type-only, không enum).
- [x] `diffSnapshots(prevDone, currentDone)` trả `newlyDone` giữ thứ tự `currentDone`, `reopened` giữ thứ tự `prevDone`, immune reorder.
- [x] `isSpecCompleted(prev, current)` — true chỉ khi pending giảm về 0 trên spec từng có pending.
- [x] `tests/diff.test.ts` cover: normal, reopened-only, both, rỗng, reorder-only, id lặp, task biến mất hết, completed 4 case.
- [x] `package.json` có `"test": "node --test --conditions=react-server \"tests/**/*.test.ts\""`; không thêm dependency.
- [x] `tsconfig.json` có `allowImportingTsExtensions: true` (đã xin phép trong spec, Boundaries → Ask first).

**Verification:** ✅
- [x] `npm test` → 12 pass
- [x] `npm run lint` sạch · `npx tsc --noEmit` sạch
- [x] Manual: `grep -c "test(" tests/diff.test.ts` = 12

**Dependencies:** None
**Files likely touched:** `src/lib/watch/types.ts`, `src/lib/watch/diff.ts`, `tests/diff.test.ts`, `package.json`, `tsconfig.json`
**Estimated scope:** Small (1-2 source + 1 test + 2 config)

---

## Task 2 ✅: Message formatting layer (`format.ts`) + unit test

**Description:** Biến diff thành text message Telegram (gộp theo project, bullet theo spec, cắt
≤3500 ký tự) và message `spec_completed`. Pure → assert được định dạng và giới hạn độ dài.

**Acceptance criteria:** ✅
- [x] `buildDoneMessages(projectName, stats, deltas)` trả đúng format spec (`ProjA · 12/20 task` + `• slug: T014, T015`).
- [x] `buildCompletedMessage(projectName, slug, total)` trả dòng `✅ ProjA / slug — 20/20 task, spec hoàn thành`.
- [x] Message >3500 ký tự được tách thành nhiều message; spec quá nhiều id được tách nhiều bullet, không cắt giữa task id.
- [x] `tests/format.test.ts` assert: 1 spec, nhiều spec, rỗng, split nhiều spec, split 1 spec 600 id, completed.

**Verification:** ✅
- [x] `npm test` pass (18/18)
- [x] Manual: message mẫu khớp mẫu trong `tasks/auto-task-watch/spec.md` (assert trong test)

**Dependencies:** Task 1 ✅
**Files likely touched:** `src/lib/watch/format.ts`, `tests/format.test.ts`
**Estimated scope:** Small

---

## Task 3 ✅: SQLite schema + `getDb()` export

**Description:** Thêm 2 bảng `spec_watch`, `notification_log` vào `db.ts` (idempotent, không
migration tool) và cho phép module khác dùng cùng 1 connection.

**Acceptance criteria:** ✅
- [x] `getDb()` được export từ `src/lib/db.ts` (vẫn `server-only`, vẫn singleton `globalForDb`).
- [x] 2 bảng đúng DDL trong spec, `CREATE TABLE IF NOT EXISTS`, chạy lại nhiều lần không lỗi.
- [x] `deleteProject(id)` xoá kèm `spec_watch` của project đó (1 transaction).
- [x] Không đổi schema bảng `projects`, không xoá dữ liệu cũ.

**Verification:** ✅
- [x] `sqlite3 data/projects.db ".tables"` → `notification_log  projects  spec_watch`
- [x] Test dòng `(project_id, slug)` bị từ chối (PRIMARY KEY) — `tests/db.test.ts`
- [x] `npm run build` pass · `npm test` pass (22/22)

**Dependencies:** None (parallel-safe với Task 1–2) ✅
**Files likely touched:** `src/lib/db.ts`
**Estimated scope:** Small

---

## Task 4 ✅: Persistence layer (`store.ts`)

**Description:** CRUD snapshot per `(project_id, slug)` + hàng đợi notification + prune. Đây là
chỗ duy nhất chạm SQLite của feature.

**Acceptance criteria:** ✅
- [x] `getSnapshot(projectId, slug)` + `saveSnapshot(snapshot)` upsert theo `(project_id, slug)`.
  *Deviation:* `upsertSnapshot`/`seedSnapshot`/`setMode` gộp thành **1 hàm `saveSnapshot`** — seed
  chỉ là `saveSnapshot` với `seeded: true`, mode nằm trong snapshot → ít API hơn, cùng hành vi.
- [x] Lưu `mode`, `file_mtime_ms`, `last_checked_at`, `last_changed_at`.
- [x] `enqueueNotification(payload)` → row `status='pending'`; `takePendingNotifications(limit)` chỉ
  trả row `pending` **hoặc** `error` với `attempts < MAX_SEND_ATTEMPTS (5)`.
- [x] `markSent(id)`; `markFailed(id, message)` (*deviation:* tên là `markFailed`, không `markError`);
  `markSkipped(id)` → `skipped_no_config`, terminal, không đếm attempts.
- [x] `recentNotifications(projectId, limit=10)` newest-first; `pruneNotifications(NOTIFICATION_HISTORY=200)`.
- [x] `done_ids` JSON an toàn: row corrupt → `[]` + `console.warn`.

**Verification:** ✅
- [x] `tests/store.test.ts` 11 case (RED → GREEN) · `npm test` 33/33
- [x] `npm run lint` + `npx tsc --noEmit` sạch · `npm run build` pass
- [x] Commit `843ff65`

**Dependencies:** Task 1, Task 3 ✅
**Files likely touched:** `src/lib/watch/store.ts`
**Estimated scope:** Medium

---

## Task 5 ✅: Telegram sender + pending flush (`telegram.ts`)

**Description:** Gửi message qua Bot API bằng global `fetch`, kèm flush hàng đợi `pending` với
retry có cap. Không log token.

**Acceptance criteria:** ✅
- [x] `telegramConfig()` đọc env **trong hàm** (server boot không crash khi thiếu creds).
- [x] `sendTelegram(text)` → `POST .../sendMessage`, body `{chat_id, text, disable_web_page_preview: true}`,
  `AbortSignal.timeout(10_000)`, không `parse_mode`.
- [x] `flushPendingNotifications(FLUSH_BATCH=10)`: thiếu creds → `skipped_no_config` (attempts giữ 0);
  HTTP lỗi/network/`ok:false` → `error` + `attempts++` + `last_error`; `ok` → `sent`.
- [x] Không ném exception ra ngoài flush. *Deviation:* `last_error` được **redact** token/chat id.
- [x] Test stub `globalThis.fetch` thay vì manual smoke (máy dev **không có** `.env.local` → chưa có creds thật).

**Verification:** ✅
- [x] `tests/telegram.test.ts` 9 case · `npm test` 42/42 · lint + tsc sạch
- [x] Test assert error không chứa token
- [x] Commit `34c44d3`
- [ ] **Chờ Nam**: manual smoke với creds thật (cần `.env.local`)

**Dependencies:** Task 4 ✅
**Files likely touched:** `src/lib/watch/telegram.ts`
**Estimated scope:** Small–Medium

---

## Task 6 ✅: Tick runner (`runner.ts`)

**Description:** Toàn bộ business logic 1 tick: scan project → chọn mode `full`/`idle` → đọc file →
diff → enqueue message → flush → cập nhật snapshot. Overlap-guard.

**Acceptance criteria:** ✅
- [x] Project path không tồn tại → `skippedPath` + `console.warn`, tick không crash.
- [x] Chưa có snapshot → đọc full, **seed baseline im lặng** (`seeded=1`), 0 notification.
- [x] `pending > 0` → đọc full. `pending == 0` → chỉ `statSync`; mtime không đổi → không đọc file; đổi → re-arm `full`.
- [x] `newlyDone` rỗng & không completed → không enqueue. Reopened chỉ cập nhật snapshot (im lặng).
- [x] Gom `newlyDone` theo project → message `tasks_done` (split >3500 ký tự); mỗi spec completed → 1 `spec_completed`.
- [x] Spec completed → `mode='idle'`. Seed không tính là newlyDone.
- [x] In-flight guard: tick đang chạy → tick sau bỏ + log `tick-skipped`.
- [x] Exception per-spec được catch, không làm hỏng spec khác.
- [x] Log mỗi project 1 dòng + 1 dòng tổng. *Deviation:* dòng per-project dùng `queued=`
  (`[watch] <project> specs=… active=… idle=… newlyDone=… queued=…`) và flush nằm ở **cuối tick**
  với dòng `[watch] tick done sent=… failed=… skippedNoConfig=…` → message mới gửi ngay trong tick.

**Verification:** ✅
- [x] `tests/runner.test.ts` 12 case trên thư mục project thật (temp dir) · `npm test` 53/53
- [x] Cover: seed im lặng, batch 1 message/2 spec, 2 spec completed = 1 batch + 2 message,
  idle gate (mtime đổi/new), reopened im lặng, path mất, thiếu `tasks.md`, overlap guard, `sent`
- [x] `npm run lint` + `npx tsc --noEmit` sạch · `npm run build` pass · commit `48fd6ba`

**Dependencies:** Task 1, 2, 3, 4, 5 ✅
**Files likely touched:** `src/lib/watch/runner.ts`
**Estimated scope:** Medium

---

## Task 7 ✅: Start job in Next (`start.ts` + `src/instrumentation.ts`)

**Description:** Bật `setInterval` 60s khi server khởi tạo, nodejs-runtime-only, singleton chống
hot-reload nhân đôi, `unref()` để không giữ process.

**Acceptance criteria:** ✅
- [x] `src/instrumentation.ts` export `register()`, gate `NEXT_RUNTIME === "nodejs"`, dynamic `await import()`.
- [x] Singleton `globalThis.__ptmWatch`: đã có interval → `startWatch()` trả `false`, **không tạo** interval thứ hai.
  *Deviation:* thay vì `clearInterval` cái cũ rồi tạo mới, job **giữ interval đang chạy** (idempotent).
- [x] `TASK_WATCH_ENABLED=0` → không start. `TASK_WATCH_INTERVAL_MS` override, default 60000, floor 5000.
- [x] `interval.unref()`; tick đầu chạy ngay khi start.
- [x] `stopWatch()` + `watchStatus()` cho test/UI. Tick lỗi → `console.error`, interval vẫn chạy.

**Verification:** ✅
- [x] `tests/watch-start.test.ts` 8 case · `npm test` 61/61 · lint + tsc + build sạch · commit `c4d6283`
- [x] Manual `next start -p 3699` (interval 10s): `[watch] started interval=10000ms telegram=missing …`, log lặp đúng chu kỳ
- [ ] **Chờ Nam**: `pm2 reload` trên instance 3600 (đang chạy build cũ)

**Dependencies:** Task 6 ✅
**Files likely touched:** `src/lib/watch/start.ts`, `src/instrumentation.ts`
**Estimated scope:** Medium

---

## Task 8: `components/watch-status.tsx` (server components)

**Description:** 2 presentational component: `AutoCheckLine` (mode + giờ kiểm tra + chu kỳ) và
`NotificationLog` (bảng ≤10 row: time, slug, task ids, status). Follow `src/components/SKILL.md`.

**Acceptance criteria:**
- [ ] Server component, không `"use client"`, không fetch client-side.
- [ ] Status hiển thị bằng tiếng Việt, màu theo `status` (`sent` emerald, `error` red, `skipped_no_config` amber); không dùng màu làm tín hiệu duy nhất (có text).
- [ ] Bảng log có `<caption>`/heading liên kết, đọc ổn trên mobile (stack card < 48rem), dark mode ok.
- [ ] Empty state rõ: "Chưa có thông báo nào." và "Auto-check đang tắt."
- [ ] Time render theo UTC+7.

**Verification:**
- [ ] `npm run build` pass · `npm run lint` sạch
- [ ] Playwright (localhost:3600): screenshot desktop + 375px, kiểm tra dark mode và empty state

**Dependencies:** Task 4 (read API), Task 3 (data)
**Files likely touched:** `src/components/watch-status.tsx`
**Estimated scope:** Small

---

## Task 9: Gắn UI vào trang project và trang spec

**Description:** Thêm khối "Auto-check" + "Thông báo gần đây" vào `/projects/[id]` và khối
"Auto-check" cho riêng spec vào `/projects/[id]/specs/[slug]`. Không đổi route/API/business logic.

**Acceptance criteria:**
- [ ] `npm run lint` sạch
- [ ] Render trong 1 request server, không thêm `"use client"`, không thêm nút mới, không auto-refresh.
- [ ] Trang project: AutoCheckLine tổng hợp (active/idle count) + NotificationLog ≤10 row của project.
- [ ] Trang spec: AutoCheckLine riêng cho slug (mode, last checked, "không theo dõi" nếu chưa có row).
- [ ] Không phá layout shell (không thêm `px-*`/`py-*` lên `<main>`), không đổi sidebar/NAV_ITEMS.

**Verification:**
- [ ] Playwright: mở `/projects/<id>` và `/projects/<id>/specs/<slug>` → thấy 2 khối, console sạch
- [ ] Sửa 1 task `[x]` → reload → tick → UI hiện row `sent`; responsive 375px ok
- [ ] `npm run build` pass

**Dependencies:** Task 8 (component), Task 6 (dữ liệu thật)
**Files likely touched:** `src/app/projects/[id]/page.tsx`, `src/app/projects/[id]/specs/[slug]/page.tsx`
**Estimated scope:** Small

---

## Task 10: Docs & invariants

**Description:** Ghi lại business logic của job theo quy tắc AGENTS.md (`SKILL.md` per directory).

**Acceptance criteria:**
- [ ] `src/lib/watch/SKILL.md`: tick algorithm, mode `full`/`idle`, baseline seed im lặng, reopened im lặng, hàng đợi retry, env vars, invariant "duy nhất 1 server instance".
- [ ] `src/lib/SKILL.md`: thêm 2 dòng về `spec_watch`/`notification_log` và `getDb()` export.
- [ ] `tasks/auto-task-watch/spec.md` chuyển status `implemented`, append mục "Implemented" ghi lệch so với spec (nếu có).
- [ ] `README.md`: cách bật Telegram (`.env.local`), cách test, cách tắt job.

**Verification:**
- [ ] Diff review: file mới không chứa secret/token mẫu
- [ ] Cross-check từng Success Criteria 1–10 của spec với hành vi thật, ghi kết quả vào spec

**Dependencies:** Task 7, 8, 9
**Files likely touched:** `src/lib/watch/SKILL.md`, `src/lib/SKILL.md`, `tasks/auto-task-watch/spec.md`, `README.md`
**Estimated scope:** Small

---

## Checkpoint: Foundation (sau Task 1–3) ✅

- [x] `npm test` pass (22/22)
- [x] `npm run build` pass
- [x] `spec_watch` + `notification_log` tồn tại trong `data/projects.db`
- [x] Review với Nam → Nam duyệt làm tiếp Phase 2

## Checkpoint: E2E (sau Task 7) ✅ *(không có Telegram creds)*

Chạy thật: `next start -p 3699` + `TASK_WATCH_INTERVAL_MS=10000`, fixture `ProjE2E` (4 task),
theo dõi thêm 3 project thật (read-only).

- [x] Log tick đúng chu kỳ 10s, mỗi project 1 dòng + `tick done`
- [x] Baseline seed im lặng trên data thật: 3 project có sẵn 93/56/24 task `[x]` → tick đầu `newlyDone=0 queued=0`
- [x] `[ ] T002` → `[x] T002` → tick kế: `newlyDone=1 queued=1`, row `tasks_done` `ProjE2E · 2/4 task • spec-01-us1: T002`
- [x] Spec đạt 100% → row `spec_completed` + `spec_watch.mode = idle` (`active=0 idle=1`)
- [x] Restart server → 0 notification mới (hàng đợi + snapshot bền trên SQLite)
- [x] Reopen `[x] → [ ]` → `newlyDone=0 queued=0`, mode về `full`, 0 row mới
- [~] Telegram ≤65s: **chưa verify được** — máy dev không có `.env.local`, row ở status `skipped_no_config`
- [x] Dọn fixture: xoá project `ProjE2E` + row liên quan (DB hiện 3 project, 0 notification, 4 snapshot)
- [ ] Review với Nam trước khi làm UI (cần quyết `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`)

## Checkpoint: Complete (sau Task 10)

- [ ] 10 Success Criteria trong `tasks/auto-task-watch/spec.md` đạt (hoặc ghi rõ cái nào defer)
- [ ] `npm run lint && npm test && npm run build` sạch
- [ ] Không file nào ghi vào thư mục project được theo dõi
- [ ] Sẵn sàng review/commit
