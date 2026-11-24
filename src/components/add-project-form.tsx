"use client";

import { useActionState, useState, useTransition } from "react";
import { addProject, pickFolder } from "@/app/actions";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { PlusIcon } from "@/components/icons";

export function AddProjectForm() {
  const [state, action, pending] = useActionState(addProject, undefined);
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [pickError, setPickError] = useState<string>();
  const [picking, startPick] = useTransition();

  const error = pickError ?? state?.error;

  function onPick() {
    setPickError(undefined);
    startPick(async () => {
      const res = await pickFolder();
      if (res.path) setFolder(res.path);
      if (res.error) setPickError(res.error);
    });
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
      <TextInput
        label="Tên (tuỳ chọn)"
        value={name}
        onChange={setName}
        htmlName="name"
        placeholder="Tên dự án"
      />
      <div className="flex items-end gap-2">
        <TextInput
          label="Đường dẫn dự án"
          value={folder}
          onChange={setFolder}
          htmlName="path"
          placeholder="/Users/me/Work/my-project"
          width="100%"
          status={error ? { type: "error", message: error } : undefined}
        />
        <Button
          variant="secondary"
          isLoading={picking}
          label={picking ? "Đang chọn…" : "Chọn thư mục…"}
          onClick={onPick}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        isLoading={pending}
        icon={<PlusIcon />}
        label="Thêm dự án"
      />
    </form>
  );
}
