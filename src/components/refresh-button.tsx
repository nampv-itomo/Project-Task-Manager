"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@astryxdesign/core/Button";
import { RefreshIcon } from "@/components/icons";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      isLoading={pending}
      icon={<RefreshIcon />}
      label={pending ? "Đang làm mới…" : "Làm mới"}
      onClick={() => startTransition(() => router.refresh())}
    />
  );
}
