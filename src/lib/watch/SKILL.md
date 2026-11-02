# src/lib/watch — auto task watch job

Job nền trong server: mỗi 60s đọc lại `<project>/specs/<slug>/tasks.md`, so sánh tập task ID
đã xong với snapshot trong SQLite, gửi Telegram message khi có task **vừa** hoàn thành.
Spec: `tasks/auto-task-watch/spec.md` · Plan: `tasks/auto-task-watch/plan.md`.

## Modules

| File | Vai trò | Loại |
| --- | --- | --- |
| `types.ts` | `WatchMode`, `SpecSnapshot`, `WatchDiff`, `NotifyPayload`, `NotificationRow` | types |
| `diff.ts` | `diffSnapshots(prev, current)`, `isSpecCompleted(prev, current)` | pure |
| `format.ts` | `buildDoneMessages()`, `buildCompletedMessage()`, `MAX_MESSAGE_CHARS = 3500` | pure |
| `time.ts` | `formatWatchTime()` render timestamp UTC → UTC+7 cho UI (`—` khi thiếu) | pure |
| `store.ts` | CRUD `spec_watch`, hàng đợi `notification_log`, `projectSnapshots()`, `getSnapshot()`, `recentNotifications()` | DB |
| `telegram.ts` | `sendTelegram()`, `flushPendingNotifications()` | mạng |
| `runner.ts` | 1 tick: scan → diff → queue → flush | fs + DB + mạng |
| `start.ts` | `startWatch()`, `stopWatch()`, `watchStatus()` (singleton `globalThis.__ptmWatch`) | runtime |

## Tick algorithm (`runTick`)

1. `listProjects()`; với mỗi project: `statSync(path)` — folder biến mất → log `skippedPath`, không crash tick.
2. `listSpecs(path)` với spec còn pending; spec nào không còn trong `specs/` → xoá snapshot (`forgetSpec`).
3. Với mỗi spec:
   - **chưa có snapshot** → `saveSnapshot(..., seeded: true)` im lặng (baseline, **không gửi** thông báo cho task đã `[x]` sẵn).
   - `mode === "idle"` (spec đã 100%) → chỉ `statSync`; nếu `mtime` không đổi thì bỏ qua (không đọc file); nếu đổi → về `mode: "full"`.
   - `mode === "full"` → đọc `tasks.md`, `computeStats`, `diffSnapshots`.
4. `newlyDone` → gom lại thành **1 message `tasks_done` / project / tick**; mỗi spec vừa đạt 100% → **1 message `spec_completed` riêng** và snapshot chuyển `mode: "idle"`.
5. `queued = 0` → update `last_checked_at` (idle spec giữ `last_changed_at`).
6. Cuối tick: `flushPendingNotifications()` — message vừa queue được gửi ngay trong tick.
7. Exception của 1 spec được catch (log `[watch] error <project>/<slug>`) và không ảnh hưởng spec khác.
8. Guard: tick trước chưa xong → tick mới bị bỏ, log `[watch] tick-skipped`.

## Invariants

- **App không bao giờ ghi** vào thư mục project được theo dõi — chỉ `readFileSync` / `statSync`.
- **Chỉ gửi task mới hoàn thành**: baseline seed im lặng; `pending` giảm mới gửi; reopened (`[x] → [ ]`) chỉ cập nhật snapshot, **im lặng**.
- Diff theo **tập ID** (`done_ids` JSON), không theo thứ tự dòng → đổi thứ tự/format `tasks.md` không gây thông báo giả.
- `spec_watch` PK `(project_id, slug)`; `deleteProject()` xoá kèm snapshot trong 1 transaction.
- `notification_log` là hàng đợi bền: `pending → sent | error | skipped_no_config`. Retry tối đa `MAX_SEND_ATTEMPTS = 5` (`attempts < 5` mới được lấy); `skipped_no_config` là terminal, `attempts` không tăng. Thiếu `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` → message vẫn được log và bị skip, không gửi.
- Lịch sử notification giữ `NOTIFICATION_HISTORY = 200` row gần nhất (`pruneNotifications`).
- `last_error` đã redact: không chứa token hay chat id. Log/console không in secret.
- JSON `done_ids` hỏng → degrade về `[]` + warning, không crash tick.
- **Duy nhất 1 server instance**: `ecosystem.config.js` `instances: 1`. Job gắn với `instrumentation register()` + `setInterval`, không cron/API route riêng. Singleton qua `globalThis.__ptmWatch` để hot-reload dev không chồng interval; `startWatch()` idempotent (đang chạy → trả `false`).
- `register()` chỉ chạy ở Node runtime (`process.env.NEXT_RUNTIME === "nodejs"`); interval `.unref()` + tick đầu chạy ngay khi start.

## Env vars

| Var | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | bắt buộc để gửi | đọc lazy mỗi lần gửi (đổi env không cần rebuild) |
| `TASK_WATCH_INTERVAL_MS` | `60000` | chu kỳ tick; production ép tối thiểu `5000` |
| `TASK_WATCH_ENABLED` | bật | `=0` → log `[watch] disabled`, không chạy tick |

Telegram: `POST https://api.telegram.org/bot<token>/sendMessage`, body `{ chat_id, text, disable_web_page_preview: true }`, plain text (không `parse_mode`), `AbortSignal.timeout(10_000)`.

## UI contract

`/projects/[id]` hiển thị `AutoCheckLine` (tổng hợp tracked/active/idle) + `NotificationLog` (10 row gần nhất của project); `/projects/[id]/specs/[slug]` hiển thị `AutoCheckLine` riêng cho slug. Dữ liệu chỉ là ảnh chụp lúc render — UI **không auto-refresh**, muốn mới hơn phải bấm "↻ Làm mới".

## Test

`npm test` (`node --test --conditions=react-server`) — `diff`/`format`/`time` pure, `store`/`db` dùng cwd tạm, `telegram` với `fetch` giả, `runner` với thư mục project tạm, `watch-start` với tick + interval giả. Gửi Telegram thật chỉ qua `scripts/smoke-telegram.mts` (manual).
