import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@astryxdesign/core/AppShell";
import { THEME_COOKIE_KEY, themeInitScript, type ThemeMode } from "@/lib/theme-mode";
import "./globals.css";
import { AppNav } from "@/components/app-nav";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Task Manager",
  description: "Theo dõi task Spec Kit của các dự án local",
};

// `viewport-fit=cover` lets AppShell draw under the phone status bar and keep
// its header items + the end of the content inside the device safe area.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// `themeInitScript` (the string lives in `src/lib/theme-mode.ts`, next to the
// keys it reads) seeds `.dark` + `data-theme` **before** paint, because `Theme`
// only syncs them once it hydrates.

// Seeds the collapsed rail state so `AppNav`'s external store reads the right
// value as soon as it hydrates (see `src/components/app-nav.tsx`).
const sidebarInitScript = `try{if(localStorage.getItem("sidebar-collapsed")==="1")document.documentElement.dataset.sidebarCollapsed="1"}catch(e){}`;

/**
 * The light/dark mode the server renders `Theme` with — the `theme` cookie is
 * the only mode a server can see (`localStorage` never reaches it). Seeding it
 * matters because of what `useSyncExternalStore` does during hydration: the
 * snapshot it is given for SSR is also the one used for the client's first
 * pass, so `Theme` and the toggle must render from *this* value to agree with
 * the markup already on screen; the store's real value lands on the next pass.
 * Reading `cookies()` opts the route into dynamic rendering, which every page
 * here already chose with `export const dynamic = "force-dynamic"`.
 */
async function seedThemeMode(): Promise<ThemeMode | undefined> {
  try {
    const value = (await cookies()).get(THEME_COOKIE_KEY)?.value;
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    // no request cookies to read (build-time prerender): follow the preference
    return undefined;
  }
}

/**
 * Shell = `AppShell` (skip link + `<main>` landmark + mobile nav drawer are
 * built in) with `AppNav` in the `sideNav` slot. `height="fill"` makes the
 * shell 100dvh with independent scroll containers, so `/projects/[id]` can be
 * a fixed-height dashboard without a hand-rolled `--content-h` measurement.
 * `contentPadding` stays 0: every page pads its own region (token `padding`
 * prop), which is what let the old `md:px-[100px]` shell padding go away.
 * `Providers` must wrap `AppShell` — `Theme` + `LinkProvider` style the shell
 * and its navigation, not just the page content.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialMode = await seedThemeMode();
  // The only `className` left in the shell: `next/font` **requires** its
  // variable classes on `<html>` (no component prop can carry them), and
  // `AppShell height="fill"` sizes itself with `100dvh`, so the old
  // `h-full` / `min-h-full` / `antialiased` utilities are gone —
  // `core/reset.css` already antialiases. `./globals.css` stays because Next.js
  // only allows global CSS in a root layout.
  return (
    <html lang="vi" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarInitScript }} />
        <Providers initialMode={initialMode}>
          <AppShell height="fill" contentPadding={0} sideNav={<AppNav />}>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
