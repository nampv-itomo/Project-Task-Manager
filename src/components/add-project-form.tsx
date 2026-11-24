"use client";

import { useActionState, useState, useTransition } from "react";
import { addProject, pickFolder } from "@/app/actions";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Stack } from "@astryxdesign/core/Stack";
import { PlusIcon } from "@/components/icons";

/**
 * Add-one-project form. The `<form>` stays native (it posts a Server Action —
 * `addProject`) and is only a wrapper: `Stack`/`HStack` own the spacing, so
 * there is no grid `className` here any more.
 */
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
    <form action={action}>
      <Stack gap={2}>
        <TextInput
          label="Tên (tuỳ chọn)"
          value={name}
          onChange={setName}
          htmlName="name"
          placeholder="Tên dự án"
        />
        <HStack gap={2} align="end">
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
        </HStack>
        <HStack>
          <Button
            type="submit"
            variant="primary"
            isLoading={pending}
            icon={<PlusIcon />}
            label="Thêm dự án"
          />
        </HStack>
      </Stack>
    </form>
  );
}
