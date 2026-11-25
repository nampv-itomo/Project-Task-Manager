// Light/dark mode — the single source of truth the root Astryx `Theme` renders
// from. What actually flips a surface is `html[data-theme]`: the served CSS
// shows the neutral theme's `light-dark()` tokens compiled by Lightning CSS into
// `var(--lightningcss-light, #f1f1f1) var(--lightningcss-dark, #1b1b1b)`, and
// those two switches are set to `initial`/empty by `@layer astryx-theme`'s
// `html[data-theme="light|dark"]` rules (`reset.css` carries `:where(…)` copies).
// With no `data-theme` on `<html>`, `color-scheme: light dark` plus
// `@media (prefers-color-scheme: …)` blocks answer instead — the reader's OS, not
// the button.
//
// `Theme` owns that attribute: its root sync (`@astryxdesign/core/theme` →
// `Theme.js` → `useRootThemeSync`) writes `data-theme` for a forced mode and
// **removes** it for the default `mode="system"`. That is why the old
// `ThemeToggle` looked dead: it hand-wrote `.dark` + `data-theme`, `Theme` —
// still on `system` — stripped the attribute back off on mount, the `--lightningcss-*`
// switches fell back to the OS, and every Astryx surface stayed where it was;
// only the moon/sun glyph moved.
//
// The fix is Astryx's own recipe (`npx astryx docs use-a-theme` → *Dark mode*):
// `Providers` renders `<Theme mode>` from this store, so the **Theme** names the
// scheme, declares `color-scheme` on its wrapper, and `light-dark()` answers the
// button.
//
// Three stores hold the choice, and `setThemeMode` writes all three:
//   localStorage["theme"]  the device's choice — what `themeInitScript` reads;
//   cookie["theme"]        what the server sees, so the next navigation seeds
//                          `Providers` with the same mode and paints it from the
//                          first byte (`layout.tsx` `await cookies()`);
//   <html class="dark"> +  `<html data-theme>` — `applyThemeMode` keeps Tailwind's
//                          `dark:` hook and the browser chrome in step.
// Same external-store shape as `sidebar-collapsed` in `components/app-nav.tsx`:
// React mirrors the value with `useSyncExternalStore` and never `setState`s
// inside an effect (eslint `react-hooks/set-state-in-effect`).

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_COOKIE_KEY = "theme";
export const THEME_CHANGE_EVENT = "theme-mode-change";
/** One year: outlives any session, shorter than a `localStorage` entry's life. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function normalizeMode(value: string | null | undefined): ThemeMode | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

/** The device's explicit choice, or `undefined` = never chosen → follow the OS. */
export function readStoredThemeMode(): ThemeMode | undefined {
  try {
    return normalizeMode(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // storage disabled (private mode / blocked storage)
    return undefined;
  }
}

/** The same choice as the browser sees it — `undefined` when nothing is set. */
export function readThemeCookie(): ThemeMode | undefined {
  for (const pair of document.cookie.split(";")) {
    const [rawName, rawValue] = pair.split("=");
    if (rawName?.trim() === THEME_COOKIE_KEY) {
      return normalizeMode(rawValue);
    }
  }
  return undefined;
}

export function prefersDarkScheme(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Client store snapshot, in the order of authority: an explicit `localStorage`
 * choice, then the cookie (a device whose `localStorage` is blocked still gets
 * its own choice back), then the OS preference. Never `undefined`: once React
 * has hydrated, the `Theme` always names a scheme, which is what makes
 * `light-dark()`, the browser chrome and `.dark` all answer the button.
 */
export function getThemeModeSnapshot(): ThemeMode {
  return readStoredThemeMode() ?? readThemeCookie() ?? (prefersDarkScheme() ? "dark" : "light");
}

/**
 * Records the choice on every store and repaints `<html>` at once, then wakes
 * the external store so `Providers` re-renders `Theme` with the other scheme.
 * No server round-trip: the cookie only matters for the *next* server render.
 */
export function setThemeMode(next: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // storage disabled: the switch still works for this visit
  }
  setThemeCookie(next);
  applyThemeMode(next);
  document.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** The `theme` cookie, readable on purpose: `layout.tsx` seeds from it too. */
export function setThemeCookie(mode: ThemeMode): void {
  document.cookie = `${THEME_COOKIE_KEY}=${mode}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Paints the mode onto `<html>`: `.dark` is the Tailwind `dark:` hook and
 * `data-theme` is what the browser chrome (scrollbars, form controls, date
 * pickers) follows. `Theme` owns `data-theme` in a *layout* effect, so callers
 * from a *passive* effect can re-assert a forced mode but never fight one.
 * `undefined` = follow the reader's preference.
 */
export function applyThemeMode(mode: ThemeMode | undefined): void {
  const dark = mode === "dark" || (mode === undefined && prefersDarkScheme());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** The mode to switch *to* when the current one is `mode` — never ambiguous. */
export function otherThemeMode(mode: ThemeMode): ThemeMode {
  return mode === "dark" ? "light" : "dark";
}

/** The toggle dispatches `THEME_CHANGE_EVENT`; React mirrors it. */
export function subscribeThemeMode(onChange: () => void): () => void {
  document.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => document.removeEventListener(THEME_CHANGE_EVENT, onChange);
}

/**
 * `layout.tsx`'s pre-paint script: `Theme` only syncs `<html>` once it hydrates,
 * so without these two attributes the first paint is the wrong theme whatever
 * the stored choice is. Same precedence as `getThemeModeSnapshot` —
 * `localStorage`, then the cookie, then `prefers-color-scheme` — and `layout.tsx`
 * imports this string, so the keys it names live only in this module.
 */
export const themeInitScript =
  'try{var t=localStorage.getItem("theme"),c=(" "+document.cookie).match(/(?:^|;\\s*theme=([^;]+)/),m=c?decodeURIComponent(c[1]):null,' +
  'd=t==="dark"||(!t&&m==="dark")||(t!=="light"&&m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);' +
  'document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}';
