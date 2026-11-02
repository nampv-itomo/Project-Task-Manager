import "server-only";
import { markFailed, markSent, markSkipped, takePendingNotifications } from "./store.ts";

const TELEGRAM_API_TIMEOUT_MS = 10_000;

/** Messages flushed per tick. The queue is persistent, so leftovers retry next tick. */
export const FLUSH_BATCH = 10;

export type TelegramConfig = { token: string; chatId: string };

export type SendResult = { ok: true } | { ok: false; error: string };

export type FlushStats = { sent: number; failed: number; skipped: number };

/** Read lazily (per call) so a missing .env.local never breaks server startup. */
export function telegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

/** Keep secrets out of anything we persist or log. */
function redact(text: string, config: TelegramConfig): string {
  return text.split(config.token).join("***").split(config.chatId).join("***");
}

/** One plain-text message. No parse_mode: task titles are never Markdown-escaped. */
export async function sendTelegram(text: string): Promise<SendResult> {
  const config = telegramConfig();
  if (!config) return { ok: false, error: "Thiếu TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID" };

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      cache: "no-store",
    });

    const payload: unknown = await response.json().catch(() => null);
    const description =
      payload && typeof payload === "object" && "description" in payload
        ? String((payload as { description: unknown }).description)
        : response.statusText;

    if (!response.ok || (payload && typeof payload === "object" && "ok" in payload && payload.ok === false)) {
      return { ok: false, error: redact(`HTTP ${response.status}: ${description}`, config) };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: redact(`Gửi thất bại: ${message}`, config) };
  }
}

/**
 * Drain the persistent send queue. Never throws: a broken tick would stop the
 * job, while these rows are retried automatically on later ticks.
 */
export async function flushPendingNotifications(limit = FLUSH_BATCH): Promise<FlushStats> {
  const stats: FlushStats = { sent: 0, failed: 0, skipped: 0 };
  const rows = takePendingNotifications(limit);

  for (const row of rows) {
    if (!telegramConfig()) {
      markSkipped(row.id);
      stats.skipped += 1;
      continue;
    }
    const result = await sendTelegram(row.message);
    if (result.ok) {
      markSent(row.id);
      stats.sent += 1;
    } else {
      markFailed(row.id, result.error);
      stats.failed += 1;
    }
  }
  return stats;
}
