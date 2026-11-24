import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
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

const themeInitScript = `try{var t=localStorage.getItem("theme");var dark=t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.dataset.theme=dark?"dark":"light"}catch(e){}`;

const sidebarInitScript = `try{if(localStorage.getItem("sidebar-collapsed")==="1")document.documentElement.dataset.sidebarCollapsed="1"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarInitScript }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm dark:border-zinc-700"
        >
          Bỏ qua tới nội dung chính
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <div id="main" className="min-w-0 flex-1 px-4 pb-10 pt-16 md:px-[100px] md:pt-10">
            <ThemeToggle />
            <Providers>{children}</Providers>
          </div>
        </div>
      </body>
    </html>
  );
}
