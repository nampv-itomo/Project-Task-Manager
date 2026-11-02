# Task List: Auto Task Watch + Telegram Notification

Spec: `tasks/auto-task-watch/spec.md` · Plan: `tasks/auto-task-watch/plan.md`

## Task 1: Pure diff layer (`types.ts`, `diff.ts`) + unit test + test harness

**Description:** Nền tảng so sánh snapshot task đã xong. Không fs/db/network → test được ngay,
không cần Telegram. Đồng thời dựng harness test 0-dependency cho cả feature.

**Acceptance criteria:**
- [ ] `src/lib/watch/types.ts` có `WatchMode`, `SpecSnapshot`, `WatchDiff`, `NotifyPayload` (type erasable, không enum).
- [ ] `diffSnapshots(prevDone, currentDone)` trả `newlyDone` giữ thứ tự `currentDone`, `reopened` giữ thứ tự `prevDone`, immune reorder.
- [ ] `tests/diff.test.ts` cover: normal, reopened-only, both, rỗng, 0 task, id lặp, reorder-only (=> newlyDone rỗng).
- [ ] `package.json` có `"test": "node --test --conditions=react-server \"tests/**/*.test.ts\""`; không thêm dependency.
- [ ] `tsconfig.json` có `allowImportingTsExtensions: true` (đã xin phép trong spec, Boundaries → Ask first).

**Verification:**
- [ ] `npm test` → all pass
- [ ] `npm run lint` sạch
- [ ] Manual: `grep -c "test(" tests/diff.test.ts` ≥ 6

**Dependencies:** None
**Files likely touched:** `src/lib/watch/types.ts`, `src/lib/watch/diff.ts`, `tests/diff.test.ts`, `package.json`, `tsconfig.json`
**Estimated scope:** Small (1-2 source + 1 test + 2 config)

---

## Task 2: Message formatting layer (`format.ts`) + unit test

**Description:** Biến diff thành text message Telegram (gộp theo project, bullet theo spec, cắt
≤3500 ký tự) và message `spec_completed`. Pure → assert được định dạng và giới hạn độ dài.

**Acceptance criteria:**
- [ ] `buildDoneMessage(projectName, stats, perSpec)` trả đúng format spec (`ProjA · 12/20 task` + `• slug: T014, T015`).
- [ ] `buildCompletedMessage(projectName, slug, total)` trả dòng `✅ ProjA / slug — 20/20 task, spec hoàn thành`.
- [ ] Message >3500 ký tự được tách thành nhiều message, không cắt giữa một task id.
- [ ] `tests/format.test.ts` assert: 1 spec, nhiều spec, 1 project nhiều spec + 1 completed, case 5000 ký tự.

**Verification:**
- [ ] `npm test` pass
- [ ] Manual: in ra message mẫu, eyeball khớp mẫu trong `tasks/auto-task-watch/spec.md`

**Dependencies:** Task 1
**Files likely touched:** `src/lib/watch/format.ts`, `tests/format.test.ts`
**Estimated scope:** Small

---

## Task 3: SQLite schema + `getDb()` export

**Description:** Thêm 2 bảng `spec_watch`, `notification_log` vào `db.ts` (idempotent, không
migration tool) và cho phép module khác dùng cùng 1 connection.

**Acceptance criteria:**
- [ ] `getDb()` được export từ `src/lib/db.ts` (vẫn `server-only`, vẫn singleton `globalForDb`).
- [ ] 2 bảng đúng DDL trong spec, `CREATE TABLE IF NOT EXISTS`, chạy lại nhiều lần không lỗi.
- [ ] `deleteProject(id)` xoá kèm `spec_watch` của project đó (1 transaction).
- [ ] Không đổi schema bảng `projects`, không xoá dữ liệu cũ.

**Verification:**
- [ ] `sqlite3 data/projects.db ".tables"` → có `spec_watch`, `notification_log`
- [ ] `sqlite3 data/projects.db "select sql from sqlite_master where name in ('spec_watch','notification_log')"` khớp DDL
- [ ] `npm run build` pass · `npm test` pass

**Dependencies:** None (parallel-safe với Task 1–2)
**Files likely touched:** `src/lib/db.ts`
**Estimated scope:** Small

---

## Task 4: Persistence layer (`store.ts`)

**Description:** CRUD snapshot per `(project_id, slug)` + hàng đợi notification + prune. Đây là
chỗ duy nhất chạm SQLite của feature.

**Acceptance criteria:**
- [ ] `getSnapshot(projectId, slug)`, `upsertSnapshot(...)`, `seedSnapshot(...)` (baseline, `seeded=1`).
- [ ] `setMode(projectId, slug, mode)` + lưu `file_mtime_ms`, `last_checked_at`, `last_changed_at`.
- [ ] `enqueueNotification(payload)` tạo row `status='pending'`; `takePendingNotifications(limit)`;
  `markSent(id)`; `markError(id, message)`; `markSkipped(id)`.
- [ ] `recentNotifications(projectId, limit=10)` cho UI; `pruneNotifications(keep=200)` mỗi tick.
- [ ] `done_ids` serialize/deserialize JSON an toàn (corrupt row → coi như rỗng + log warn).

**Verification:**
- [ ] `npm test` pass (store được import qua `--conditions=react-server` trong test kế tiếp hoặc smoke test)
- [ ] Manual smoke: chạy 1 script tạm import `store.ts` bằng `node --test --conditions=react-server`, upsert + read lại khớp
- [ ] `npm run build` pass

**Dependencies:** Task 1, Task 3
**Files likely touched:** `src/lib/watch/store.ts`
**Estimated scope:** Medium

---

## Task 5: Telegram sender + pending flush (`telegram.ts`)

**Description:** Gửi message qua Bot API bằng global `fetch`, kèm flush hàng đợi `pending` với
retry có cap. Không log token.

**Acceptance criteria:**
- [ ] `telegramConfig()` đọc `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` **trong hàm** (không top-level).
- [ ] `sendTelegram(text)` → `POST https://api.telegram.org/bot<token>/sendMessage`, body
  `{chat_id, text, disable_web_page_preview: true}`, timeout 10s, không `parse_mode`.
- [ ] `flushPendingNotifications()` duyệt row `pending` (`attempts < 5`): thiếu creds → `skipped_no_config`
  (không đếm attempts); lỗi HTTP/network/`ok:false` → `status='error'`, `attempts++`, `last_error` =
  mô tả lỗi **không chứa token/chat id**; thành công → `sent`.
- [ ] Không bao giờ ném exception ra ngoài `flushPendingNotifications` (tick phải sống).

**Verification:**
- [ ] Manual, có creds: `TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node --test --conditions=react-server tests/smoke-telegram.test.ts` → nhận tin nhắn trên Telegram, row thành `sent`
- [ ] Manual, sai token: row thành `error` + `last_error` không lộ token
- [ ] `npm run lint` sạch

**Dependencies:** Task 4
**Files likely touched:** `src/lib/watch/telegram.ts`
**Estimated scope:** Small–Medium

---

## Task 6: Tick runner (`runner.ts`)

**Description:** Toàn bộ business logic 1 tick: scan project → chọn mode `full`/`idle` → đọc file →
diff → enqueue message → flush → cập nhật snapshot. Overlap-guard.

**Acceptance criteria:**
- [ ] Project path không tồn tại → skip + log warn, không crash tick.
- [ ] Chưa có snapshot row → đọc full, **seed baseline im lặng** (`seeded=1`), 0 notification.
- [ ] `pending > 0` → đọc full. `pending == 0` → chỉ `statSync`; `mtime` không đổi → không đọc file; đổi → re-arm `full`.
- [ ] `newlyDone` rỗng và không completed → không enqueue (reopened chỉ cập nhật snapshot, im lặng).
- [ ] Gom mọi `newlyDone` trong tick theo project → 1 message `tasks_done`; mỗi spec completed → 1 message `spec_completed`.
- [ ] Spec completed → snapshot `mode='idle'`. Kết quả seed baseline không được tính là newlyDone.
- [ ] In-flight guard: tick đang chạy → tick kế tiếp bị bỏ + log `tick-skipped`.
- [ ] Mỗi tick in 1 dòng: `[watch] <project> specs=… active=… idle=… newlyDone=… sent=…`
- [ ] Exception per-spec được catch: spec lỗi không làm hỏng các spec còn lại.

**Verification:**
- [ ] `npm test` pass
- [ ] Manual: gọi `runWatchTick()` 2 lần liên tiếp trong test/script — lần 1 seed (0 message), lần 2 không đổi (0 message)
- [ ] `npm run build` pass

**Dependencies:** Task 1, 2, 3, 4, 5
**Files likely touched:** `src/lib/watch/runner.ts`
**Estimated scope:** Medium

---

## Task 7: Start job in Next (`start.ts` + `src/instrumentation.ts`)

**Description:** Bật `setInterval` 60s khi server khởi tạo, nodejs-runtime-only, singleton chống
hot-reload nhân đôi, `unref()` để không giữ process.

**Acceptance criteria:**
- [ ] `src/instrumentation.ts` export `register()`, gate `process.env.NEXT_RUNTIME === "nodejs"`, dynamic `await import()` (theo Next docs).
- [ ] Singleton `globalThis.__ptmWatch`: nếu đã có interval → `clearInterval` cái cũ rồi tạo mới (dev hot-reload an toàn).
- [ ] `TASK_WATCH_ENABLED=0` → không start. `TASK_WATCH_INTERVAL_MS` override chu kỳ, default 60000, floor 5000.
- [ ] Interval dùng `.unref()`; tick đầu chạy ngay khi start (không chờ 60s).
- [ ] `pm2 reload` → job tự start lại, không gửi lại notification cũ.

**Verification:**
- [ ] Manual `npm run dev`: thấy log `[watch] …` ngay khi boot và lặp lại mỗi ~60s; reload file → **không** xuất hiện 2 interval
- [ ] E2E: `- [ ] T001` → `- [x] T001` trong `tasks.md` của spec đang pending → Telegram nhận message ≤65s
- [ ] E2E baseline: thêm project mới có sẵn task `[x]` → tick đầu 0 message
- [ ] E2E idle: spec đạt 100% → message `spec_completed`, `sqlite3 data/projects.db "select slug,mode from spec_watch"` hiện `idle`; thêm task mới vào file → tick sau re-arm `full`
- [ ] `npm run build` pass

**Dependencies:** Task 6
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

## Checkpoint: Foundation (sau Task 1–3)

- [ ] `npm test` pass
- [ ] `npm run build` pass
- [ ] `spec_watch` + `notification_log` tồn tại trong `data/projects.db`
- [ ] Review với Nam trước khi đi tiếp

## Checkpoint: E2E (sau Task 7)

- [ ] Log tick mỗi 60s ±5s
- [ ] Task `[x]` → Telegram ≤65s, 1 message gộp/project
- [ ] Restart server không gửi lại notification cũ
- [ ] Baseline project có sẵn `[x]` → 0 message
- [ ] Review với Nam trước khi làm UI

## Checkpoint: Complete (sau Task 10)

- [ ] 10 Success Criteria trong `tasks/auto-task-watch/spec.md` đạt (hoặc ghi rõ cái nào defer)
- [ ] `npm run lint && npm test && npm run build` sạch
- [ ] Không file nào ghi vào thư mục project được theo dõi
- [ ] Sẵn sàng review/commit
