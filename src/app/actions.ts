"use server";

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { deleteProject, insertProject } from "@/lib/db";

const execFileAsync = promisify(execFile);

export type AddProjectState = { error?: string } | undefined;

export async function addProject(
  _prev: AddProjectState,
  formData: FormData,
): Promise<AddProjectState> {
  let rawPath = String(formData.get("path") ?? "").trim();
  if (!rawPath) return { error: "Vui lòng nhập đường dẫn dự án." };
  if (rawPath === "~" || rawPath.startsWith("~/")) {
    rawPath = path.join(os.homedir(), rawPath.slice(1));
  }
  if (!path.isAbsolute(rawPath)) {
    return { error: "Đường dẫn phải là đường dẫn tuyệt đối." };
  }
  const projectPath = path.resolve(rawPath);
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    return { error: "Thư mục không tồn tại." };
  }
  const name =
    String(formData.get("name") ?? "").trim() || path.basename(projectPath);
  try {
    insertProject(name, projectPath);
  } catch (e) {
    if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { error: "Đường dẫn này đã được thêm." };
    }
    throw e;
  }
  revalidatePath("/");
}

export async function removeProject(formData: FormData) {
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) deleteProject(id);
  revalidatePath("/");
}

/** Opens the native macOS folder dialog on the machine running the server. */
export async function pickFolder(): Promise<{ path?: string; error?: string }> {
  if (process.platform !== "darwin") {
    return { error: "Chọn thư mục bằng hộp thoại chỉ hỗ trợ macOS." };
  }
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "Chọn thư mục dự án")',
    ]);
    const picked = stdout.trim().replace(/\/$/, "");
    return picked ? { path: picked } : {};
  } catch (e) {
    // User pressed Cancel: osascript exits with "User canceled" (-128).
    if (String((e as Error).message).includes("-128")) return {};
    return { error: "Không mở được hộp thoại chọn thư mục." };
  }
}
