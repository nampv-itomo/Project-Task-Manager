"use client";

import { useActionState, useState, useTransition } from "react";
import { addProject, pickFolder } from "@/app/actions";

const input =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:outline-2 focus:outline-blue-500 dark:border-zinc-700";

export function AddProjectForm() {
  const [state, action, pending] = useActionState(addProject, undefined);
  const [folder, setFolder] = useState("");
  const [pickError, setPickError] = useState<string>();
  const [picking, startPick] = useTransition();

  function onPick() {
    setPickError(undefined);
    startPick(async () => {
      const res = await pickFolder();
      if (res.path) setFolder(res.path);
      if (res.error) setPickError(res.error);
    });
  }
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
      <div>
        <label htmlFor="name" className="mb-1 block text-xs text-zinc-500">
          Tên (tuỳ chọn)
        </label>
        <input id="name" name="name" className={input} placeholder="Tên dự án" />
      </div>
      <div>
        <label htmlFor="path" className="mb-1 block text-xs text-zinc-500">
          Đường dẫn dự án
        </label>
        <div className="flex gap-2">
          <input
            id="path"
            name="path"
            required
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className={`${input} font-mono`}
            placeholder="/Users/me/Work/my-project"
          />
          <button
            type="button"
            onClick={onPick}
            disabled={picking}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {picking ? "Đang chọn…" : "Chọn thư mục…"}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Đang thêm…" : "Thêm dự án"}
      </button>
      {pickError && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-3">
          {pickError}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 sm:col-span-3">
          {state.error}
        </p>
      )}
    </form>
  );
}
