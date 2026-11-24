import { formatWatchTime } from "@/lib/watch/time";
import type { ReactNode } from "react";
import type { NotificationRow, WatchMode } from "@/lib/watch/types";
import { Badge as AstryxBadge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";

/** Subset of Astryx Badge variants used here (semantic status + neutral/blue tags). */
type BadgeVariant = "neutral" | "blue" | "success" | "warning" | "error";

/** What the pages know about the watch job for the thing they display. */
export type AutoCheckSummary = {
  /** Specs that already have a snapshot row. */
  tracked: number;
  /** Specs with pending tasks: re-read every tick. */
  active: number;
  /** Specs at 100%: only their file mtime is checked. */
  idle: number;
  lastCheckedAt: string | null;
  lastChangedAt: string | null;
  /** Set on a single-spec page to show that spec's own mode. */
  mode?: WatchMode;
};

const MODE_LABEL: Record<WatchMode, string> = {
  full: "Đang theo dõi task",
  idle: "Đã 100% — chỉ theo dõi file",
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  sent: "success",
  error: "error",
  skipped_no_config: "warning",
};

const STATUS_LABEL: Record<string, string> = {
  sent: "Đã gửi",
  error: "Gửi lỗi",
  skipped_no_config: "Chưa cấu hình Telegram",
};

const KIND_LABEL: Record<string, string> = {
  tasks_done: "Task hoàn thành",
  spec_completed: "Spec hoàn thành",
};

function Badge({
  variant = "neutral",
  title,
  children,
}: {
  variant?: BadgeVariant;
  title?: string;
  children: ReactNode;
}) {
  const badge = <AstryxBadge variant={variant} label={children} />;
  // Astryx Badge has no `title` prop, so the full-ISO timestamp tooltip (the
  // label only shows a short, formatted time) rides on a wrapping native span.
  return title ? <span title={title}>{badge}</span> : badge;
}

/** Status block for the auto-check job. Read-only; it renders no controls. */
export function AutoCheckLine({
  summary,
  enabled,
  intervalMs,
  id = "auto-check",
  heading = "Auto-check",
  autoRefreshing = false,
}: {
  summary: AutoCheckSummary;
  enabled: boolean;
  intervalMs: number;
  id?: string;
  heading?: string;
  /** Set when the page also mounts `AutoRefresh` on the same interval. */
  autoRefreshing?: boolean;
}) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="text-lg font-medium">
        {heading}
      </h2>
      {!enabled ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Auto-check đang tắt (TASK_WATCH_ENABLED=0).
        </p>
      ) : summary.tracked === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Chưa có snapshot nào — job sẽ tạo baseline ở lần kiểm tra kế tiếp và không gửi thông báo
          cho task đã hoàn thành sẵn.
        </p>
      ) : (
        <>
          <HStack gap={2} wrap="wrap">
            <Badge>Chu kỳ: {Math.round(intervalMs / 1000)}s</Badge>
            {summary.mode ? (
              <Badge>{MODE_LABEL[summary.mode]}</Badge>
            ) : (
              <Badge>
                Spec theo dõi: {summary.active} đang chạy · {summary.idle} đã 100%
              </Badge>
            )}
            <Badge title={formatWatchTime(summary.lastCheckedAt, { iso: true })}>
              Kiểm tra lúc: {formatWatchTime(summary.lastCheckedAt)}
            </Badge>
            {summary.lastChangedAt && (
              <Badge
                variant="blue"
                title={formatWatchTime(summary.lastChangedAt, { iso: true })}
              >
                Thay đổi gần nhất: {formatWatchTime(summary.lastChangedAt)}
              </Badge>
            )}
          </HStack>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Job chạy trong server mỗi {Math.round(intervalMs / 1000)}s.{" "}
            {autoRefreshing
              ? "Trang này tự làm mới theo cùng chu kỳ (khi đang xem) — bấm “Làm mới” để đọc ngay."
              : "Trang này chỉ hiển thị dữ liệu đã có — bấm “Làm mới” để đọc lại."}
          </p>
        </>
      )}
    </section>
  );
}

/** Newest notifications for one project. Never contains the bot token. */
export function NotificationLog({
  rows,
  id = "notifications",
  heading = "Thông báo gần đây",
  className,
  listClassName,
}: {
  rows: NotificationRow[];
  id?: string;
  heading?: string;
  /** Extra classes on the wrapping <section> (e.g. flex column for fixed-height pages). */
  className?: string;
  /** Extra classes on the <ul> (e.g. overflow-y-auto to scroll within its own region). */
  listClassName?: string;
}) {
  return (
    <section aria-labelledby={id} className={className ?? "space-y-2"}>
      <h2 id={id} className="shrink-0 text-lg font-medium">
        {heading} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Chưa có thông báo nào.</p>
      ) : (
        <ul
          role="list"
          className={`divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 ${listClassName ?? ""}`}
        >
          {rows.map((row) => (
            <li key={row.id} className="grid gap-2 p-3 md:grid-cols-[7.5rem_1fr_auto] md:items-start md:gap-3">
              <span
                className="font-mono text-xs text-zinc-500 dark:text-zinc-400"
                title={formatWatchTime(row.created_at, { iso: true })}
              >
                {formatWatchTime(row.created_at)}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge>{KIND_LABEL[row.kind] ?? row.kind}</Badge>
                  {row.slug && <span className="font-mono text-xs">{row.slug}</span>}
                </p>
                {row.task_ids.length > 0 && (
                  <p className="font-mono text-xs break-words text-zinc-500 dark:text-zinc-400">
                    {row.task_ids.join(", ")}
                  </p>
                )}
                {row.status === "error" && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    Đã thử {row.attempts} lần · {row.last_error}
                  </p>
                )}
                {row.status === "skipped_no_config" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Thiếu TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID nên message bị bỏ qua.
                  </p>
                )}
              </div>
              <span>
                <Badge variant={STATUS_VARIANT[row.status] ?? "error"}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
