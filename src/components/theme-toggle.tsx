"use client";

import { IconButton } from "@astryxdesign/core/IconButton";
import { MoonIcon, SunIcon } from "@/components/icons";

/**
 * Light/dark switch, rendered in `AppNav`'s `footerIcons` bar (no fixed
 * positioning any more: `AppShell` owns the shell, so the toggle travels with
 * the rail and into the mobile drawer).
 *
 * `themeInitScript` in `layout.tsx` sets `.dark` + `data-theme` before paint;
 * this click keeps both in sync — `.dark` is the Tailwind `dark:` variant hook,
 * `data-theme` is what the Astryx theme keys light/dark off. Dropping either
 * breaks one half of the app.
 *
 * Icon choice stays CSS-driven (`dark:hidden` / `hidden dark:inline` spans, the
 * documented escape hatch) so there is no state, no flash and no hydration
 * mismatch on a server-rendered page.
 */
export function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  return (
    <IconButton
      label="Chuyển giao diện sáng/tối"
      onClick={toggle}
      icon={
        <>
          <span className="dark:hidden">
            <MoonIcon />
          </span>
          <span className="hidden dark:inline">
            <SunIcon />
          </span>
        </>
      }
    />
  );
}
