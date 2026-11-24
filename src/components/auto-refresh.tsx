"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls `router.refresh()` on the watch job's interval so the server-rendered
 * phase list follows the 60s auto-check tick. `refresh()` re-renders Server
 * Components and merges the payload without losing scroll position or the
 * open/closed state of native `<details>` rows. Pauses while the tab is hidden
 * and refreshes once when it becomes visible again. Renders no UI.
 */
export function AutoRefresh({
  intervalMs,
  enabled = true,
}: {
  intervalMs: number;
  enabled?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      router.refresh();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalMs, enabled]);

  return null;
}
