"use client";

import { IconButton } from "@astryxdesign/core/IconButton";
import { MoonIcon, SunIcon } from "@/components/icons";
import { otherThemeMode, setThemeMode } from "@/lib/theme-mode";
import { useThemeMode } from "@/lib/theme-mode-context";

/**
 * Light/dark switch. `AppNav` puts it at the **top-right of the sidebar** via
 * `SideNavHeading`'s `headerEndContent` slot, and again in `footerIcons` only
 * while the rail is collapsed — that slot is hidden then, so the footer copy
 * keeps the switch reachable. No fixed positioning: `AppShell` owns the shell,
 * so the toggle travels with the rail and into the mobile drawer.
 *
 * It does **not** write `<html>` by itself — that was the bug. Hand-setting
 * `.dark` / `data-theme` only ever moved the glyph, because the root Astryx
 * `Theme` sat on `mode="system"`, stripped `data-theme` on mount, and let every
 * `light-dark()` token keep following the OS preference. The click now goes
 * through `setThemeMode` (`src/lib/theme-mode.ts`), which records the choice and
 * wakes the external store `Providers` renders `<Theme mode>` from, so `Theme`
 * declares the scheme and the whole UI follows — no server round-trip.
 *
 * The glyph stays CSS-driven (`dark:hidden` / `hidden dark:inline` `<span>`s,
 * the documented escape hatch): `applyThemeMode` + `layout.tsx`'s pre-paint
 * script write `.dark`, so there is no state, no flash and no mismatch in the
 * icon. `label`/`tooltip` do read the mode, and both this button and `Theme`
 * hydrate from the same seed (`useThemeMode`) so they cannot disagree with the
 * markup the server sent.
 */
export function ThemeToggle() {
  const mode = useThemeMode() ?? "light";
  const toDark = mode !== "dark";
  const label = toDark ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng";

  return (
    <IconButton
      label={label}
      tooltip={label}
      onClick={() => setThemeMode(otherThemeMode(mode))}
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
