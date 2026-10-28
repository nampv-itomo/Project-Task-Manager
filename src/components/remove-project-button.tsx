"use client";

import { useRef } from "react";
import { removeProject } from "@/app/actions";

export function RemoveProjectButton({ id, name }: { id: number; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
        aria-label={`Gỡ dự án ${name}`}
      >
        Gỡ
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`rm-title-${id}`}
        className="m-auto w-[min(26rem,calc(100vw-20px))] rounded-lg border border-zinc-200 bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40 dark:border-zinc-700"
      >
        <form action={removeProject} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <h3 id={`rm-title-${id}`} className="text-base font-semibold">
            Gỡ dự án?
          </h3>
          <p className="break-words text-sm text-zinc-600 dark:text-zinc-400">
            Dự án <strong>{name}</strong> sẽ bị xoá khỏi danh sách. Thư mục thật
            trên máy không bị ảnh hưởng.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Gỡ dự án
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
