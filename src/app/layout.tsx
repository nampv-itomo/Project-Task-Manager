import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@astryxdesign/core/AppShell";
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

// Both keys are written before paint: `.dark` is the Tailwind `dark:` variant
// hook, `data-theme` is what the Astryx theme keys light/dark off. See
// `src/app/SKILL.md` — they must stay in sync (ThemeToggle keeps them in sync).
const themeInitScript = `try{var t=localStorage.getItem("theme");var dark=t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.dataset.theme=dark?"dark":"light"}catch(e){}`;

// Seeds the collapsed rail state so `AppNav`'s external store reads the right
// value as soon as it hydrates (see `src/components/app-nav.tsx`).
const sidebarInitScript = `try{if(localStorage.getItem("sidebar-collapsed")==="1")document.documentElement.dataset.sidebarCollapsed="1"}catch(e){}`;

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
export default function RootLayout({ children }: LayoutProps<"/">) {
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
        <Providers>
          <AppShell height="fill" contentPadding={0} sideNav={<AppNav />}>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
