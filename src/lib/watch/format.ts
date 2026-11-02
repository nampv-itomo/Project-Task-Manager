import type { TaskCounts } from "./types";

/**
 * Hard cap per Telegram message. Telegram rejects longer text (4096); we stay
 * below it so a batch never fails to send.
 */
export const MAX_MESSAGE_CHARS = 3500;

/** Newly done task ids of one spec within one tick. */
export type SpecDelta = { slug: string; taskIds: string[] };

/**
 * One message per project per tick: `ProjA · 12/20 task` header plus one bullet
 * per spec. A spec whose ids exceed the line budget is split into several
 * bullets for the same slug — a task id is never cut in half.
 * Returns [] when there is nothing to report.
 */
export function buildDoneMessages(
  projectName: string,
  stats: TaskCounts,
  deltas: SpecDelta[],
): string[] {
  const header = `${projectName} · ${stats.done}/${stats.total} task`;
  const lineBudget = MAX_MESSAGE_CHARS - header.length - 1;
  const lines = deltas
    .filter((delta) => delta.taskIds.length > 0)
    .flatMap((delta) => specLines(delta.slug, delta.taskIds, lineBudget));
  if (lines.length === 0) return [];

  const messages: string[] = [];
  let current: string[] = [];
  let used = header.length;
  for (const line of lines) {
    if (current.length > 0 && used + 1 + line.length > MAX_MESSAGE_CHARS) {
      messages.push([header, ...current].join("\n"));
      current = [];
      used = header.length;
    }
    current.push(line);
    used += 1 + line.length;
  }
  if (current.length > 0) messages.push([header, ...current].join("\n"));
  return messages;
}

/** Single line for a spec, or several lines when its ids do not fit one line. */
function specLines(slug: string, taskIds: string[], lineBudget: number): string[] {
  const prefix = `• ${slug}: `;
  const lines: string[] = [];
  let chunk: string[] = [];
  for (const id of taskIds) {
    const candidate = chunk.length > 0 ? `${prefix}${chunk.join(", ")}, ${id}` : prefix + id;
    if (chunk.length > 0 && candidate.length > lineBudget) {
      lines.push(`${prefix}${chunk.join(", ")}`);
      chunk = [id];
    } else {
      chunk.push(id);
    }
  }
  if (chunk.length > 0) lines.push(`${prefix}${chunk.join(", ")}`);
  return lines;
}

/** Separate message sent once when a spec reaches zero pending tasks. */
export function buildCompletedMessage(
  projectName: string,
  slug: string,
  total: number,
): string {
  return `✅ ${projectName} / ${slug} — ${total}/${total} task, spec hoàn thành`;
}
