"use client";

import { useState, useTransition } from "react";
import { Button } from "@astryxdesign/core/Button";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { removeProject } from "@/app/actions";

export function RemoveProjectButton({ id, name }: { id: number; name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, start] = useTransition();

  function onAction() {
    start(async () => {
      const fd = new FormData();
      fd.set("id", String(id));
      await removeProject(fd);
      setIsOpen(false);
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        label={`Gỡ dự án ${name}`}
        children="Gỡ"
        onClick={() => setIsOpen(true)}
      />
      <AlertDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        title="Gỡ dự án?"
        description={`Dự án ${name} sẽ bị xoá khỏi danh sách. Thư mục thật trên máy không bị ảnh hưởng.`}
        actionLabel="Gỡ dự án"
        actionVariant="destructive"
        cancelLabel="Huỷ"
        isActionLoading={pending}
        onAction={onAction}
      />
    </>
  );
}
