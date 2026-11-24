import { formatWatchTime } from "@/lib/watch/time";
import type { ReactNode } from "react";
import type { NotificationRow, WatchMode } from "@/lib/watch/types";
import { Badge as AstryxBadge } from "@astryxdesign/core/Badge";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Tooltip } from "@astryxdesign/core/Tooltip";

/** Subset of Astryx Badge variants used here (semantic status + neutral pills). */
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
  // Astryx Badge has no `title`/`tooltip` prop, so the full-ISO timestamp hint
  // (the pill only shows a short, formatted time) rides on Astryx `Tooltip`
  // instead of the old native `<span title>` — no raw element, and the hint
  // also fires on keyboard focus, which native `title` never did.
  return title ? (
    <Tooltip content={title} hasHoverIndication={false}>
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}

/** A note line whose meaning is carried by text + a semantic glyph, never colour alone. */
function Note({ icon, color, children }: { icon: "warning" | "error"; color: "warning" | "error"; children: ReactNode }) {
  return (
    <HStack gap={1.5} align="center">
      <Icon icon={icon} color={color} size="sm" />
      <Text type="supporting" color="secondary">
        {children}
      </Text>
    </HStack>
  );
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
    // Native `<section aria-labelledby>`: `Section` has no `id`, so the labelled
    // landmark cannot be an Astryx component (documented escape hatch).
    <section aria-labelledby={id}>
      <Stack gap={2}>
        <Heading level={2} id={id}>
          {heading}
        </Heading>
        {!enabled ? (
          <Note icon="warning" color="warning">
            Auto-check đang tắt (TASK_WATCH_ENABLED=0).
          </Note>
        ) : summary.tracked === 0 ? (
          <Text color="secondary">
            Chưa có snapshot nào — job sẽ tạo baseline ở lần kiểm tra kế tiếp và không gửi
            thông báo cho task đã hoàn thành sẵn.
          </Text>
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
            <Text type="supporting" color="secondary">
              Job chạy trong server mỗi {Math.round(intervalMs / 1000)}s.{" "}
              {autoRefreshing
                ? "Trang này tự làm mới theo cùng chu kỳ (khi đang xem) — bấm “Làm mới” để đọc ngay."
                : "Trang này chỉ hiển thị dữ liệu đã có — bấm “Làm mới” để đọc lại."}
            </Text>
          </>
        )}
      </Stack>
    </section>
  );
}

/**
 * Newest notifications for one project. Never contains the bot token.
 * Rows are `List`/`ListItem` (time · kind+slug · task ids + hints · status), so
 * a fixed-height page scrolls them by putting this in `Layout`'s `end` slot with
 * `LayoutPanel isScrollable` — the old `className`/`listClassName` flex+overflow
 * hooks are gone.
 */
export function NotificationLog({
  rows,
  id = "notifications",
  heading = "Thông báo gần đây",
}: {
  rows: NotificationRow[];
  id?: string;
  heading?: string;
}) {
  return (
    <section aria-labelledby={id}>
      <List
        hasDividers
        density="compact"
        header={
          <Heading level={2} id={id}>
            {heading} ({rows.length})
          </Heading>
        }
      >
        {rows.map((row) => (
          <ListItem
            key={row.id}
            align="start"
            startContent={
              <Badge title={formatWatchTime(row.created_at, { iso: true })}>
                <Text type="code" size="2xs" hasTabularNumbers>
                  {formatWatchTime(row.created_at)}
                </Text>
              </Badge>
            }
            label={
              <HStack gap={2} align="center" wrap="wrap">
                <Badge>{KIND_LABEL[row.kind] ?? row.kind}</Badge>
                {row.slug && (
                  <Text type="code" size="2xs">
                    {row.slug}
                  </Text>
                )}
              </HStack>
            }
            description={
              row.task_ids.length > 0 || row.status === "error" || row.status === "skipped_no_config" ? (
                <Stack gap={1}>
                  {row.task_ids.length > 0 && (
                    <Text type="code" size="2xs" color="secondary" wordBreak="break-word">
                      {row.task_ids.join(", ")}
                    </Text>
                  )}
                  {row.status === "error" && (
                    <Note icon="error" color="error">
                      Đã thử {row.attempts} lần · {row.last_error}
                    </Note>
                  )}
                  {row.status === "skipped_no_config" && (
                    <Note icon="warning" color="warning">
                      Thiếu TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID nên message bị bỏ qua.
                    </Note>
                  )}
                </Stack>
              ) : undefined
            }
            endContent={
              <Badge variant={STATUS_VARIANT[row.status] ?? "error"}>
                {STATUS_LABEL[row.status] ?? row.status}
              </Badge>
            }
          />
        ))}
      </List>
      {rows.length === 0 && (
        <EmptyState isCompact headingLevel={4} title="Chưa có thông báo nào" />
      )}
    </section>
  );
}
