"use client";

import { useActionState, useState, useTransition } from "react";
import { addProject, pickFolder } from "@/app/actions";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { PlusIcon } from "@/components/icons";

/**
 * Add-one-project form. The `<form>` stays native (it posts a Server Action —
 * `addProject`) and is only a wrapper: `HStack` owns the spacing, so there is
 * no grid `className` here any more. **The whole row is one single line** —
 * name, path, `Chọn thư mục…`, `Thêm dự án` — with `align="end"` so the
 * controls share a baseline under the field labels.
 *
 * `wrap="nowrap"` is what keeps them on one line: the path field used to carry
 * `width="100%"`, and a flex item whose basis is the full container width can
 * never share a line, so it dropped onto its own row and pushed both buttons to
 * a third. The path field now grows into the leftover space with
 * `containerClassName="flex-1 min-w-0"` — the flex child is the labelled
 * container (not the input box), `flex-1` absorbs the leftover width and
 * `min-w-0` lets it shrink below its intrinsic width instead of forcing the row
 * to overflow. (`xstyle` is StyleX-typed, so plain style objects are rejected.)
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
      <HStack gap={2} align="end" wrap="nowrap">
        <TextInput
          label="Tên (tuỳ chọn)"
          value={name}
          onChange={setName}
          htmlName="name"
          placeholder="Tên dự án"
          width="14rem"
        />
        <TextInput
          label="Đường dẫn dự án"
          value={folder}
          onChange={setFolder}
          htmlName="path"
          placeholder="/Users/me/Work/my-project"
          containerClassName="flex-1 min-w-0"
          status={error ? { type: "error", message: error } : undefined}
        />
        <Button
          variant="secondary"
          isLoading={picking}
          label={picking ? "Đang chọn…" : "Chọn thư mục…"}
          onClick={onPick}
        />
        <Button
          type="submit"
          variant="primary"
          isLoading={pending}
          icon={<PlusIcon />}
          label="Thêm dự án"
        />
      </HStack>
    </form>
  );
}
