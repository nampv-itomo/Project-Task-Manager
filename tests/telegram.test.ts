import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate the SQLite file for this suite (db.ts resolves against cwd).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ptm-telegram-"));
process.chdir(tmp);

const store = await import("../src/lib/watch/store.ts");
const { telegramConfig, sendTelegram, flushPendingNotifications } = await import(
  "../src/lib/watch/telegram.ts"
);

type Call = { url: string; body: Record<string, unknown> };
const calls: Call[] = [];
const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string) => { status: number; body: unknown }) {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
    const result = handler(url);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function enqueue(projectId: number, text = "ProjA · 3/5 task\n• spec-01: T004") {
  store.enqueueNotification({
    projectId,
    projectName: `Proj-${projectId}`,
    slug: "spec-01",
    kind: "tasks_done",
    taskIds: ["T004"],
    message: text,
  });
}

function onlyLog(projectId: number) {
  return store.recentNotifications(projectId, 10)[0];
}

beforeEach(() => {
  calls.length = 0;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("telegramConfig is null when bot credentials are absent", () => {
  assert.equal(telegramConfig(), null);
  process.env.TELEGRAM_BOT_TOKEN = "123:abc";
  assert.equal(telegramConfig(), null);
});

test("telegramConfig reads token and chat id from the environment", () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  assert.deepEqual(telegramConfig(), { token: "123456:abcdef", chatId: "987654" });
});

test("sendTelegram posts chat_id and text to the bot sendMessage endpoint", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  stubFetch(() => ({ status: 200, body: { ok: true, result: {} } }));

  const result = await sendTelegram("hello");

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].url, "https://api.telegram.org/bot123456:abcdef/sendMessage");
  assert.deepEqual(calls[0].body, {
    chat_id: "987654",
    text: "hello",
    disable_web_page_preview: true,
  });
  assert.ok(!("parse_mode" in calls[0].body), "parse_mode must not be sent");
});

test("a rejected send returns the API description as the error", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  stubFetch(() => ({ status: 400, body: { ok: false, description: "chat not found" } }));

  const result = await sendTelegram("hello");

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "HTTP 400: chat not found");
});

test("flushPendingNotifications marks an accepted message as sent", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  stubFetch(() => ({ status: 200, body: { ok: true, result: {} } }));
  enqueue(10);

  const stats = await flushPendingNotifications();

  assert.deepEqual(stats, { sent: 1, failed: 0, skipped: 0 });
  assert.equal(onlyLog(10).status, "sent");
  assert.equal(store.takePendingNotifications(10).length, 0);
});

test("a failed send stores the error and consumes one attempt", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  stubFetch(() => ({ status: 429, body: { ok: false, description: "Too Many Requests" } }));
  enqueue(11);

  const stats = await flushPendingNotifications();

  assert.deepEqual(stats, { sent: 0, failed: 1, skipped: 0 });
  const row = onlyLog(11);
  assert.equal(row.status, "error");
  assert.equal(row.attempts, 1);
  assert.equal(row.last_error, "HTTP 429: Too Many Requests");
});

test("without credentials the message is skipped and keeps its attempts", async () => {
  enqueue(12);

  const stats = await flushPendingNotifications();

  assert.equal(stats.sent, 0);
  assert.equal(stats.failed, 0);
  const row = onlyLog(12);
  assert.equal(row.status, "skipped_no_config");
  assert.equal(row.attempts, 0);
  assert.equal(calls.length, 0, "no request may be attempted without credentials");
});

test("a network failure is recorded and does not break the flush", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  globalThis.fetch = (async () => {
    throw new Error("fetch failed");
  }) as typeof fetch;
  enqueue(13);

  const stats = await flushPendingNotifications();

  assert.deepEqual(stats, { sent: 0, failed: 1, skipped: 0 });
  assert.equal(onlyLog(13).status, "error");
});

test("the stored error never contains the bot token", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "SECRET123456:abcdef";
  process.env.TELEGRAM_CHAT_ID = "987654";
  globalThis.fetch = (async () => {
    throw new Error("connect ECONNREFUSED api.telegram.org:443");
  }) as typeof fetch;
  enqueue(14);

  await flushPendingNotifications();

  const row = onlyLog(14);
  assert.ok(!row.last_error?.includes("SECRET123456"), `token leaked: ${row.last_error}`);
  assert.ok(!row.message.includes("SECRET123456"));
});
