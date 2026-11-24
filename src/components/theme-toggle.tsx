"use client";

import { IconButton } from "@astryxdesign/core/IconButton";
import { MoonIcon, SunIcon } from "@/components/icons";

export function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    // .dark keeps the hand-rolled components working; data-theme is what the
    // Astryx neutral theme keys off (light-dark() + color-scheme). Keep both in
    // sync so Astryx components also switch on click.
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  // Icon choice stays CSS-driven (no state → no hydration flash): moon in light
  // mode (click → dark), sun in dark mode (click → light).
  return (
    <div className="fixed right-4 top-4 z-50">
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
    </div>
  );
}
