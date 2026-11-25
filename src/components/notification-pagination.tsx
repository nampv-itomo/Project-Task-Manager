"use client";

import Link from "next/link";
import { Pagination } from "@astryxdesign/core/Pagination";

/**
 * Page strip for the global notification history.
 *
 * Pagination is a Client Component, so the server page may only hand it
 * serializable props (`page`, `total`, `pageSize`, `base`): the `onChange`
 * callback is created **here**, never in the page — a function prop crossing the
 * server→client boundary throws `Functions cannot be passed directly to Client
 * Components` and 500s the route at "Collecting page data".
 *
 * Navigation stays a plain URL change: `getPageHref` renders real `<Link>`s, so
 * every page deep-links and survives Back, and `onChange` is intentionally a
 * no-op (per Astryx: don't navigate in `onChange` when `getPageHref` is set).
 */
export function NotificationPagination({
  page,
  total,
  pageSize,
  base,
  query,
}: {
  page: number;
  total: number;
  pageSize: number;
  base: string;
  /** Extra query string appended to every page link, e.g. `&size=50`. */
  query?: string;
}) {
  // Nothing to paginate when everything fits on one page (Astryx best practice).
  if (total <= pageSize) return null;

  return (
    <Pagination
      page={page}
      onChange={() => {}}
      getPageHref={(next) =>
        next <= 1 ? `${base}?${query ?? ""}` : `${base}?page=${next}${query ?? ""}`
      }
      as={Link}
      totalItems={total}
      pageSize={pageSize}
      variant="pages"
      size="sm"
      label="Phân trang lịch sử thông báo"
    />
  );
}
