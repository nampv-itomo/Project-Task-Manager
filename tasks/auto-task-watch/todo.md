# Task List: Auto Task Watch + Telegram Notification

Spec: `tasks/auto-task-watch/spec.md` · Plan: `tasks/auto-task-watch/plan.md`

## Task 1 ✅: Pure diff layer (`types.ts`, `diff.ts`) + unit test + test harness

**Description:** Nền tảng so sánh snapshot task đã xong. Không fs/db/network → test được ngay,
không cần Telegram. Đồng thời dựng harness test 0-dependency cho cả feature.

**Acceptance criteria:** ✅
- [x] T001 `src/lib/watch/types.ts` có `WatchMode`, `SpecSnapshot`, `WatchDiff` (`newlyDone`/`reopened`), `TaskCounts`, `NotifyPayload`, `NotifyStatus`, `NotificationRow` (type-only, không enum).
- [x] T002 `diffSnapshots(prevDone, currentDone)` trả `newlyDone` giữ thứ tự `currentDone`, `reopened` giữ thứ tự `prevDone`, immune reorder.
- [x] T003 `isSpecCompleted(prev, current)` — true chỉ khi pending giảm về 0 trên spec từng có pending.
- [x] T004 `tests/diff.test.ts` cover: normal, reopened-only, both, rỗng, reorder-only, id lặp, task biến mất hết, completed 4 case.
- [x] T005 `package.json` có `"test": "node --test --conditions=react-server \"tests/**/*.test.ts\""`; không thêm dependency.
- [x] T006 `tsconfig.json` có `allowImportingTsExtensions: true` (đã xin phép trong spec, Boundaries → Ask first).

**Verification:** ✅
- [x] T007 `npm test` → 12 pass
- [x] T008 `npm run lint` sạch · `npx tsc --noEmit` sạch
- [x] T009 Manual: `grep -c "test(" tests/diff.test.ts` = 12

**Dependencies:** None
**Files likely touched:** `src/lib/watch/types.ts`, `src/lib/watch/diff.ts`, `tests/diff.test.ts`, `package.json`, `tsconfig.json`
**Estimated scope:** Small (1-2 source + 1 test + 2 config)

---

## Task 2 ✅: Message formatting layer (`format.ts`) + unit test

**Description:** Biến diff thành text message Telegram (gộp theo project, bullet theo spec, cắt
≤3500 ký tự) và message `spec_completed`. Pure → assert được định dạng và giới hạn độ dài.

**Acceptance criteria:** ✅
- [x] T010 `buildDoneMessages(projectName, stats, deltas)` trả đúng format spec (`ProjA · 12/20 task` + `• slug: T014, T015`).
- [x] T011 `buildCompletedMessage(projectName, slug, total)` trả dòng `✅ ProjA / slug — 20/20 task, spec hoàn thành`.
- [x] T012 Message >3500 ký tự được tách thành nhiều message; spec quá nhiều id được tách nhiều bullet, không cắt giữa task id.
- [x] T013 `tests/format.test.ts` assert: 1 spec, nhiều spec, rỗng, split nhiều spec, split 1 spec 600 id, completed.

**Verification:** ✅
- [x] T014 `npm test` pass (18/18)
- [x] T015 Manual: message mẫu khớp mẫu trong `tasks/auto-task-watch/spec.md` (assert trong test)

**Dependencies:** Task 1 ✅
**Files likely touched:** `src/lib/watch/format.ts`, `tests/format.test.ts`
**Estimated scope:** Small

---

## Task 3 ✅: SQLite schema + `getDb()` export

**Description:** Thêm 2 bảng `spec_watch`, `notification_log` vào `db.ts` (idempotent, không
migration tool) và cho phép module khác dùng cùng 1 connection.

**Acceptance criteria:** ✅
- [x] T016 `getDb()` được export từ `src/lib/db.ts` (vẫn `server-only`, vẫn singleton `globalForDb`).
- [x] T017 2 bảng đúng DDL trong spec, `CREATE TABLE IF NOT EXISTS`, chạy lại nhiều lần không lỗi.
- [x] T018 `deleteProject(id)` xoá kèm `spec_watch` của project đó (1 transaction).
- [x] T019 Không đổi schema bảng `projects`, không xoá dữ liệu cũ.

**Verification:** ✅
- [x] T020 `sqlite3 data/projects.db ".tables"` → `notification_log  projects  spec_watch`
- [x] T021 Test dòng `(project_id, slug)` bị từ chối (PRIMARY KEY) — `tests/db.test.ts`
- [x] T022 `npm run build` pass · `npm test` pass (22/22)

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
- [x] T037 `tests/store.test.ts` 11 case (RED → GREEN) · `npm test` 33/33
- [x] T038 `npm run lint` + `npx tsc --noEmit` sạch · `npm run build` pass
- [x] T039 Commit `843ff65`

**Dependencies:** Task 1, Task 3 ✅
**Files likely touched:** `src/lib/watch/store.ts`
**Estimated scope:** Medium

---

## Task 5 ✅: Telegram sender + pending flush (`telegram.ts`)

**Description:** Gửi message qua Bot API bằng global `fetch`, kèm flush hàng đợi `pending` với
retry có cap. Không log token.

**Acceptance criteria:** ✅
- [x] T040 `telegramConfig()` đọc env **trong hàm** (server boot không crash khi thiếu creds).
- [x] T041 `sendTelegram(text)` → `POST .../sendMessage`, body `{chat_id, text, disable_web_page_preview: true}`,
  `AbortSignal.timeout(10_000)`, không `parse_mode`.
- [x] T042 `flushPendingNotifications(FLUSH_BATCH=10)`: thiếu creds → `skipped_no_config` (attempts giữ 0);
  HTTP lỗi/network/`ok:false` → `error` + `attempts++` + `last_error`; `ok` → `sent`.
- [x] T043 Không ném exception ra ngoài flush. *Deviation:* `last_error` được **redact** token/chat id.

**Verification:** ✅
- [x] T044 `tests/telegram.test.ts` 9 case · lint + tsc sạch · commit `34c44d3`
- [x] T045 Manual smoke với creds thật (`.env.local`): `scripts/smoke-telegram.mts` → `flush: { sent: 2, failed: 0, skipped: 0 }`, 2 row `sent`
- [x] T046 Manual token sai (`--bad-token`): `status=error`, `attempts=1`, `last_error="HTTP 401: Unauthorized"` → không lộ token/chat id
- [x] T047 Script dùng DB thư mục tạm → không đụng `data/projects.db`; `npm test` thêm `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`

**Dependencies:** Task 4 ✅
**Files likely touched:** `src/lib/watch/telegram.ts`
**Estimated scope:** Small–Medium

---

## Task 6 ✅: Tick runner (`runner.ts`)

**Description:** Toàn bộ business logic 1 tick: scan project → chọn mode `full`/`idle` → đọc file →
diff → enqueue message → flush → cập nhật snapshot. Overlap-guard.

**Acceptance criteria:** ✅
- [x] T048 Project path không tồn tại → `skippedPath` + `console.warn`, tick không crash.
- [x] T049 Chưa có snapshot → đọc full, **seed baseline im lặng** (`seeded=1`), 0 notification.
- [x] T050 `pending > 0` → đọc full. `pending == 0` → chỉ `statSync`; mtime không đổi → không đọc file; đổi → re-arm `full`.
- [x] T051 `newlyDone` rỗng & không completed → không enqueue. Reopened chỉ cập nhật snapshot (im lặng).
- [x] T052 Gom `newlyDone` theo project → message `tasks_done` (split >3500 ký tự); mỗi spec completed → 1 `spec_completed`.
- [x] T053 Spec completed → `mode='idle'`. Seed không tính là newlyDone.
- [x] T054 In-flight guard: tick đang chạy → tick sau bỏ + log `tick-skipped`.
- [x] T055 Exception per-spec được catch, không làm hỏng spec khác.
- [x] T056 Log mỗi project 1 dòng + 1 dòng tổng. *Deviation:* dòng per-project dùng `queued=`
  (`[watch] <project> specs=… active=… idle=… newlyDone=… queued=…`) và flush nằm ở **cuối tick**
  với dòng `[watch] tick done sent=… failed=… skippedNoConfig=…` → message mới gửi ngay trong tick.

**Verification:** ✅
- [x] T057 `tests/runner.test.ts` 12 case trên thư mục project thật (temp dir) · `npm test` 53/53
- [x] T058 Cover: seed im lặng, batch 1 message/2 spec, 2 spec completed = 1 batch + 2 message,
  idle gate (mtime đổi/new), reopened im lặng, path mất, thiếu `tasks.md`, overlap guard, `sent`
- [x] T059 `npm run lint` + `npx tsc --noEmit` sạch · `npm run build` pass · commit `48fd6ba`

**Dependencies:** Task 1, 2, 3, 4, 5 ✅
**Files likely touched:** `src/lib/watch/runner.ts`
**Estimated scope:** Medium

---

## Task 7 ✅: Start job in Next (`start.ts` + `src/instrumentation.ts`)

**Description:** Bật `setInterval` 60s khi server khởi tạo, nodejs-runtime-only, singleton chống
hot-reload nhân đôi, `unref()` để không giữ process.

**Acceptance criteria:** ✅
- [x] T060 `src/instrumentation.ts` export `register()`, gate `NEXT_RUNTIME === "nodejs"`, dynamic `await import()`.
- [x] T061 Singleton `globalThis.__ptmWatch`: đã có interval → `startWatch()` trả `false`, **không tạo** interval thứ hai.
  *Deviation:* thay vì `clearInterval` cái cũ rồi tạo mới, job **giữ interval đang chạy** (idempotent).
- [x] T062 `TASK_WATCH_ENABLED=0` → không start. `TASK_WATCH_INTERVAL_MS` override, default 60000, floor 5000.
- [x] T063 `interval.unref()`; tick đầu chạy ngay khi start.
- [x] T064 `stopWatch()` + `watchStatus()` cho test/UI. Tick lỗi → `console.error`, interval vẫn chạy.

**Verification:** ✅
- [x] T065 `tests/watch-start.test.ts` 8 case · `npm test` 61/61 · lint + tsc + build sạch · commit `c4d6283`
- [x] T066 Manual `next start -p 3699` (interval 10s): `[watch] started interval=10000ms telegram=missing …`, log lặp đúng chu kỳ
- [ ] T067 **Chờ Nam**: `pm2 reload` trên instance 3600 (đang chạy build cũ)

**Dependencies:** Task 6 ✅
**Files likely touched:** `src/lib/watch/start.ts`, `src/instrumentation.ts`
**Estimated scope:** Medium

---

## Task 8: `components/watch-status.tsx` (server components)

**Description:** 2 presentational component: `AutoCheckLine` (mode + giờ kiểm tra + chu kỳ) và
`NotificationLog` (bảng ≤10 row: time, slug, task ids, status). Follow `src/components/SKILL.md`.

**Acceptance criteria:**
- [x] T068 Server component, không `"use client"`, không fetch client-side.
- [x] T069 Status hiển thị bằng tiếng Việt, màu theo `status` (`sent` emerald, `error` red, `skipped_no_config` amber); không dùng màu làm tín hiệu duy nhất (có text).
- [x] T070 Log có heading liên kết (`aria-labelledby`), đọc ổn trên mobile (grid 1 cột < 48rem → 3 cột từ `md`), dark mode ok.
- [x] T071 Empty state rõ: "Chưa có thông báo nào." / "Auto-check đang tắt (TASK_WATCH_ENABLED=0)." / "Chưa có snapshot nào…".
- [x] T072 Time render theo UTC+7 (`src/lib/watch/time.ts`), `<span title="…">` giữ timestamp UTC đầy đủ.

**Verification:**
- [x] T073 `npm run build` pass · `npm run lint` sạch · `npx tsc --noEmit` sạch
- [x] T074 Playwright (`next start -p 3699`, build production): đo tại 1280×900 (light + dark) và 375×812 → `scrollWidth 361 ≤ 375`, 0 phần tử tràn; contrast WCAG mọi text trong 2 khối: light ≥ 4.83, dark ≥ 6.85 (nâng `text-zinc-500` → thêm `dark:text-zinc-400` vì `zinc-500` trên `zinc-900` chỉ 4.1)
- [x] T075 Empty state đã verify trên `/projects/3` (0 snapshot, 0 notification); disabled state verify với `TASK_WATCH_ENABLED=0`
- [x] T076 Console: 0 error (chỉ 1 warning từ script đo contrast của agent)

**Deviation:** thay `<table>`/`<caption>` bằng `role="list"` + heading `aria-labelledby` (project không có table pattern; `AGENTS.md` yêu cầu authorization trước khi thêm `Table`). Row = grid 3 cột, id task `break-words`, status badge có text nên không dựa màu.
**Omitted:** screenshot PNG không lưu trong repo (model không đọc được ảnh; verify bằng accessibility snapshot + số đo DOM/contrast).

**Dependencies:** Task 4 (read API), Task 3 (data)
**Files likely touched:** `src/components/watch-status.tsx`
**Estimated scope:** Small

---

## Task 9: Gắn UI vào trang project và trang spec

**Description:** Thêm khối "Auto-check" + "Thông báo gần đây" vào `/projects/[id]` và khối
"Auto-check" cho riêng spec vào `/projects/[id]/specs/[slug]`. Không đổi route/API/business logic.

**Acceptance criteria:**
- [x] T077 `npm run lint` sạch
- [x] T078 Render trong 1 request server, không thêm `"use client"`, không thêm nút mới, không auto-refresh (vẫn dùng nút "↻ Làm mới" sẵn có).
- [x] T079 Trang project: AutoCheckLine tổng hợp (tracked/active/idle + last checked + last changed) + NotificationLog 10 row của project.
- [x] T080 Trang spec: AutoCheckLine riêng cho slug (mode badge `Đang theo dõi task` / `Đã 100% — chỉ theo dõi file`, last checked, empty "Chưa có snapshot nào" khi chưa có row).
- [x] T081 Không phá layout shell (không thêm `px-*`/`py-*` lên `<main>`), không đổi sidebar/NAV_ITEMS/route/actions.

**Verification:**
- [x] T082 Playwright: `/projects/4`, `/projects/4/specs/002-fe-nextjs-migration` (mode full), `/projects/4/specs/001-monorepo-foundation` (mode idle), `/projects/3` (empty) → đủ 2 khối, console sạch
- [x] T083 Row `sent` hiện sau tick thật: `T062`, `T070` (project 4) xuất hiện trong log ở lần mở trang kế tiếp
- [x] T084 Responsive 375px ok (không tràn ngang)
- [x] T085 `npm run build` pass · `npm test` 67/67 · `npx tsc --noEmit` sạch

**Note:** dữ liệu log là ảnh chụp tại thời điểm render server; muốn số mới hơn phải bấm "↻ Làm mới" (job 60s chạy nền, UI không tự reload). Row trạng thái `error` hiển thị "Đã thử N lần · <error đã redact>".

**Dependencies:** Task 8 (component), Task 6 (dữ liệu thật)
**Files likely touched:** `src/app/projects/[id]/page.tsx`, `src/app/projects/[id]/specs/[slug]/page.tsx`
**Estimated scope:** Small

---

## Task 10: Docs & invariants

**Description:** Ghi lại business logic của job theo quy tắc AGENTS.md (`SKILL.md` per directory).

**Acceptance criteria:**
- [ ] T086 `src/lib/watch/SKILL.md`: tick algorithm, mode `full`/`idle`, baseline seed im lặng, reopened im lặng, hàng đợi retry, env vars, invariant "duy nhất 1 server instance".
- [x] T087 `src/lib/watch/SKILL.md`: tick algorithm, mode `full`/`idle`, baseline seed im lặng, reopened im lặng, hàng đợi retry, env vars, invariant "duy nhất 1 server instance".
- [x] T088 `src/lib/SKILL.md`: thêm dòng về `spec_watch`/`notification_log` và `getDb()` export.
- [x] T089 `tasks/auto-task-watch/spec.md` chuyển status `implemented`, append mục "Implemented" (bảng 10 Success Criteria + mục Lệch so với spec).
- [x] T090 `README.md`: cách bật Telegram (`.env.local`), cách tune/tắt job, cách verify.
- [x] T091 `src/components/SKILL.md`: thêm mục `watch-status.tsx` (server component, không auto-refresh,AA contrast).

**Verification:**
- [x] T092 Diff review: không file nào chứa token/chat id mẫu hay secret (README/SKILL chỉ ghi tên env)
- [x] T093 Cross-check từng Success Criteria 1–10 với hành vi thật → đã ghi trong `spec.md` → "Implemented"

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
- [x] Telegram thật ≤ 65s: sửa file 15:00:20 → tick 15:00:38 `queued=1 sent=1` (interval 15s), row `sent`
- [x] Spec 100% (fixture): `tasks_done` `ProjE2E · 4/4 task • spec-01-us1: T003, T010` + `spec_completed` `✅ ProjE2E / spec-01-us1 — 4/4 task, spec hoàn thành`, `mode → idle`, `sent=2`
- [x] **Hit thật trên data thật**: `DEPLOY SERVER MONOREPO / 002-fe-nextjs-migration` done 56 → 63 (7 task Nam vừa hoàn thành giữa 2 lần chạy) → 1 message `sent`, `last_changed_at` cập nhật
- [x] Dọn fixture: xoá project `ProjE2E` + row liên quan (DB: 3 project, 1 notification thật, 4 snapshot)
- [x] Review với Nam trước khi làm UI → đã duyệt (Telegram creds đã có, E2E green), UI Task 8–9 đã làm

## Checkpoint: Complete (sau Task 10) ✅

- [x] 10/10 Success Criteria trong `tasks/auto-task-watch/spec.md` đạt — kết quả + bằng chứng ở mục "Implemented"
- [x] `npm run lint && npm test && npm run build` sạch (`npm test` 67/67, `npx tsc --noEmit` 0 error)
- [x] Không file nào ghi vào thư mục project được theo dõi — job chỉ `readFileSync`/`statSync`; UI không có action ghi file (`src/app/actions.ts` không đổi)
- [x] Sẵn sàng review/commit

**Còn lại (quyết định của Nam):** `pm2 reload project-task-manager` để build mới chạy trên port 3600 với job 60s.
