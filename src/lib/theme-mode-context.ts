'use client';

import { createContext, use, useSyncExternalStore } from "react";
import { getThemeModeSnapshot, subscribeThemeMode, type ThemeMode } from "@/lib/theme-mode";

/**
 * The mode `layout.tsx` seeded from the `theme` cookie, published by
 * `Providers`. It is the only mode a server can see, so it is also the mode the
 * markup on screen was rendered with. `undefined` = the reader never chose, so
 * `Theme` stays on `mode="system"` and the reader's preference decides.
 */
export const ThemeModeContext = createContext<ThemeMode | undefined>(undefined);

/**
 * The mode to render from, shared by `Providers` (which renders `<Theme mode>`)
 * and `ThemeToggle` (which names itself by it), so both take the *same*
 * hydration snapshot: `useSyncExternalStore`'s third argument is the snapshot
 * used for SSR **and** for the client's first pass, and two readers disagreeing
 * about it is exactly what React reports as a hydration error — an attribute an
 * effect could not fix afterwards.
 *
 * `seed` is `layout.tsx`'s cookie for `Providers`; consumers read the same seed
 * out of `ThemeModeContext` that `Providers` published. After hydration React
 * compares the store snapshot (`localStorage` → cookie → OS preference) with the
 * seed and re-renders immediately if they differ, so a stale seed self-corrects
 * and `Theme` ends up naming the reader's real scheme.
 */
export function useThemeMode(seed?: ThemeMode): ThemeMode | undefined {
  const hydrationSeed = seed ?? use(ThemeModeContext);
  const stored = useSyncExternalStore(subscribeThemeMode, getThemeModeSnapshot, () => hydrationSeed);
  return stored ?? hydrationSeed;
}
