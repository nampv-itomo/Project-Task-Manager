import {
  allNotifications,
  NOTIFICATIONS_PAGE_SIZES,
  NOTIFICATIONS_PER_PAGE,
  normalizeNotificationSize,
} from "@/lib/watch/store";
import { NotificationLog } from "@/components/watch-status";
import { NotificationPagination } from "@/components/notification-pagination";
import { NotificationPageSize } from "@/components/notification-page-size";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutHeader,
} from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/Stack";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

export const dynamic = "force-dynamic";

/**
 * `Lịch sử thông báo` — every Telegram message ever queued, across **all**
 * projects, newest first, `?size=` (default 20) per page.
 *
 * Paging is a plain URL (`?page=N&size=M`) rendered by `NotificationPagination`,
 * so the screen stays a Server Component with no client data fetching: each
 * page re-reads SQLite on the server. A hand-typed or stale `?page=` past the
 * last page falls back to page 1 instead of rendering an empty list.
 *
 * The screen fills the viewport (`height="fill"` under `AppShell height="fill"`,
 * exactly like `/projects/[id]`): the title sits in `LayoutHeader`, the list in
 * a scrolling `LayoutContent`, and the pager + page-size picker in
 * `LayoutFooter`, which therefore stays pinned to the bottom edge instead of
 * scrolling away under a long list.
 */
export default async function NotificationsPage({
  searchParams,
}: PageProps<"/notifications">) {
  const { page: rawPage, size: rawSize } = await searchParams;
  const requested = Number.parseInt(
    Array.isArray(rawPage) ? rawPage[0] ?? "" : rawPage ?? "",
    10,
  );
  const wanted = Number.isNaN(requested) ? 1 : Math.max(1, requested);
  const size = normalizeNotificationSize(
    Array.isArray(rawSize) ? rawSize[0] ?? "" : rawSize ?? "",
  );

  let page = wanted;
  let { rows, total } = allNotifications(page, size);
  if (rows.length === 0 && page !== 1) {
    page = 1;
    ({ rows, total } = allNotifications(page, size));
  }

  const pageCount = Math.max(1, Math.ceil(total / size));
  const first = total === 0 ? 0 : (page - 1) * size + 1;
  const last = (page - 1) * size + rows.length;
  // Kept on every page link so a picked size survives paging; the leading `&`
  // is dropped when the picker is at its default.
  const query = size === NOTIFICATIONS_PER_PAGE ? "" : `&size=${size}`;

  return (
    <Layout
      height="fill"
      contentWidth={960}
      header={
        <LayoutHeader padding={4} hasDivider>
          <Stack gap={1}>
            <Heading level={1}>Lịch sử thông báo</Heading>
            <Text color="secondary">
              Thông báo đã gửi (kèm lỗi và bản ghi bị bỏ qua) của tất cả dự án, mới nhất trước —{" "}
              {size} bản ghi mỗi trang.
            </Text>
          </Stack>
        </LayoutHeader>
      }
      content={
        <LayoutContent padding={4} label="Danh sách thông báo">
          {rows.length === 0 ? (
            <EmptyState
              isCompact
              headingLevel={3}
              title="Chưa có thông báo nào"
              description="Auto-check ghi mọi thông báo Telegram vào đây khi có task vừa hoàn thành."
            />
          ) : (
            <NotificationLog
              rows={rows}
              id="all-notifications"
              heading="Thông báo"
              total={total}
              showProject
            />
          )}
        </LayoutContent>
      }
      footer={
        <LayoutFooter padding={4} hasDivider label="Phân trang lịch sử thông báo">
          <HStack gap={4} vAlign="center" wrap="wrap">
            <Text type="supporting" color="secondary" hasTabularNumbers>
              Trang {page}/{pageCount} · hiển thị {first}–{last}/{total}
            </Text>
            <NotificationPagination
              page={page}
              total={total}
              pageSize={size}
              base="/notifications"
              query={query}
            />
            <NotificationPageSize
              size={size}
              options={NOTIFICATIONS_PAGE_SIZES.map((n) => ({
                value: String(n),
                label: `${n} bản ghi`,
              }))}
            />
          </HStack>
        </LayoutFooter>
      }
    />
  );
}
