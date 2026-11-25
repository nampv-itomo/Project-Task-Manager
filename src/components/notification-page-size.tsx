"use client";

import { useRouter } from "next/navigation";
import { Selector } from "@astryxdesign/core/Selector";

/**
 * `Số bản ghi / trang` picker sitting in the notification history footer.
 *
 * It is a Client Component because `Selector`'s `onChange` is a function, and a
 * function prop may not cross the server→client boundary — so the page hands it
 * only serializable values (`size` + a plain option list) and the navigation is
 * created **here**.
 *
 * Picking a size is a plain URL change (`?size=N`, `page` dropped → back to
 * page 1, since the old page number no longer means anything at a new size), so
 * the choice deep-links, survives Back, and the server still owns the query.
 */
export function NotificationPageSize({
  size,
  options,
}: {
  size: number;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();

  return (
    <Selector
      label="Số bản ghi mỗi trang"
      isLabelHidden
      width={150}
      options={options}
      value={String(size)}
      onChange={(next) => {
        if (!next || next === String(size)) return;
        router.push(`/notifications?size=${next}`);
      }}
    />
  );
}
