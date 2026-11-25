import { allNotifications, NOTIFICATIONS_PER_PAGE } from "@/lib/watch/store";
import { NotificationLog } from "@/components/watch-status";
import { NotificationPagination } from "@/components/notification-pagination";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout } from "@astryxdesign/core/Layout";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

export const dynamic = "force-dynamic";

/**
 * `Lịch sử thông báo` — every Telegram message ever queued, across **all**
 * projects, newest first, `NOTIFICATIONS_PER_PAGE` (20) per page.
 *
 * Paging is a plain URL (`?page=N`) rendered by `NotificationPagination`, so the
 * screen stays a Server Component with no client data fetching: each page
 * re-reads SQLite on the server. A hand-typed or stale `?page=` past the last
 * page falls back to page 1 instead of rendering an empty list.
 */
export default async function NotificationsPage({
  searchParams,
}: PageProps<"/notifications">) {
  const { page: rawPage } = await searchParams;
  const requested = Number.parseInt(
    Array.isArray(rawPage) ? rawPage[0] ?? "" : rawPage ?? "",
    10,
  );
  const wanted = Number.isNaN(requested) ? 1 : Math.max(1, requested);

  let page = wanted;
  let { rows, total } = allNotifications(page, NOTIFICATIONS_PER_PAGE);
  if (rows.length === 0 && page !== 1) {
    page = 1;
    ({ rows, total } = allNotifications(page, NOTIFICATIONS_PER_PAGE));
  }

  const pageCount = Math.max(1, Math.ceil(total / NOTIFICATIONS_PER_PAGE));
  const first = (page - 1) * NOTIFICATIONS_PER_PAGE + 1;
  const last = (page - 1) * NOTIFICATIONS_PER_PAGE + rows.length;

  return (
    <Layout padding={4} contentWidth={960}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1}>Lịch sử thông báo</Heading>
          <Text color="secondary">
            Thông báo đã gửi (kèm lỗi và bản ghi bị bỏ qua) của tất cả dự án, mới nhất trước —{" "}
            {NOTIFICATIONS_PER_PAGE} bản ghi mỗi trang.
          </Text>
        </Stack>

        {rows.length === 0 ? (
          <EmptyState
            isCompact
            headingLevel={3}
            title="Chưa có thông báo nào"
            description="Auto-check ghi mọi thông báo Telegram vào đây khi có task vừa hoàn thành."
          />
        ) : (
          <Stack gap={4}>
            <NotificationLog
              rows={rows}
              id="all-notifications"
              heading="Thông báo"
              total={total}
              showProject
            />
            <Text type="supporting" color="secondary" hasTabularNumbers>
              Trang {page}/{pageCount} · hiển thị {first}–{last}/{total}
            </Text>
            <NotificationPagination
              page={page}
              total={total}
              pageSize={NOTIFICATIONS_PER_PAGE}
              base="/notifications"
            />
          </Stack>
        )}
      </Stack>
    </Layout>
  );
}
