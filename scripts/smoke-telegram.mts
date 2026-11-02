/**
 * Manual smoke test cho đường Telegram — không nằm trong `npm test`.
 *
 *   node --conditions=react-server scripts/smoke-telegram.mts
 *   node --conditions=react-server scripts/smoke-telegram.mts --bad-token
 *
 * DB dùng thư mục tạm → không đụng `data/projects.db` thật.
 * Message gửi là text thường, có nhãn "smoke test".
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const badToken = process.argv.includes("--bad-token");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ptm-smoke-"));
process.chdir(tmp);

// Next tự nạp .env.local; script thường thì phải nạp tay.
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}
if (badToken) process.env.TELEGRAM_BOT_TOKEN = "123456:day-la-token-gia";

const store = await import("../src/lib/watch/store.ts");
const { buildCompletedMessage, buildDoneMessages } = await import("../src/lib/watch/format.ts");
const { flushPendingNotifications, telegramConfig } = await import("../src/lib/watch/telegram.ts");

const config = telegramConfig();
if (!config) {
  console.error("Thiếu TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID trong .env.local");
  process.exit(1);
}
console.log(`mode=${badToken ? "bad-token" : "live"} token_len=${config.token.length} chat_id_len=${config.chatId.length}`);

store.enqueueNotification({
  projectId: 1,
  projectName: "SmokeTest",
  slug: null,
  kind: "tasks_done",
  taskIds: ["T014", "T015"],
  message: buildDoneMessages("SmokeTest", { total: 20, done: 12, pending: 8 }, [
    { slug: "spec-01-us1", taskIds: ["T014", "T015"] },
  ])[0],
});
store.enqueueNotification({
  projectId: 1,
  projectName: "SmokeTest",
  slug: "spec-01-us1",
  kind: "spec_completed",
  taskIds: [],
  message: buildCompletedMessage("SmokeTest", "spec-01-us1", 20),
});

const stats = await flushPendingNotifications();
console.log("flush:", stats);

for (const row of store.recentNotifications(1, 10).reverse()) {
  console.log(`#${row.id} ${row.kind} status=${row.status} attempts=${row.attempts} error=${row.last_error ?? "-"}`);
  const tokenLeak = (row.last_error ?? "").includes(config.token) || (row.last_error ?? "").includes(config.chatId);
  if (tokenLeak) {
    console.error("LOI: secret bi ghi ra last_error");
    process.exit(1);
  }
}
