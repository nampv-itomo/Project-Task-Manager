"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon as AstryxIcon } from "@astryxdesign/core/Icon";
import { DashboardIcon, FolderIcon } from "@/components/icons";

const STORAGE_KEY = "sidebar-collapsed";
const CHANGE_EVENT = "sidebar-collapsed-change";

function subscribeCollapsed(onChange: () => void) {
  document.addEventListener(CHANGE_EVENT, onChange);
  return () => document.removeEventListener(CHANGE_EVENT, onChange);
}

function isCollapsed() {
  return document.documentElement.dataset.sidebarCollapsed === "1";
}

export const NAV_ITEMS = [
  { href: "/", label: "Tổng quan", Icon: DashboardIcon },
  { href: "/projects", label: "Dự án", Icon: FolderIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  // Collapsed state lives on <html> (restored by the pre-paint script in
  // layout.tsx, so CSS applies it before first paint). React mirrors it only
  // for aria-expanded/title via an external store — no hydration mismatch.
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    isCollapsed,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const nav = navRef.current;
    const trigger = triggerRef.current;
    nav?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  function toggle() {
    const next = !isCollapsed();
    document.documentElement.dataset.sidebarCollapsed = next ? "1" : "0";
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // storage disabled (private mode): collapse still works for this visit
    }
    document.dispatchEvent(new Event(CHANGE_EVENT));
  }

  function isActive(href: string) {
    return href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label="Mở menu"
        aria-controls="sidebar"
        aria-expanded={open}
        className="fixed left-4 top-4 z-50 grid min-h-[44px] min-w-[44px] cursor-pointer place-items-center rounded-md border border-zinc-300 bg-background text-foreground hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-zinc-700 dark:hover:bg-zinc-800 md:hidden"
      >
        <AstryxIcon icon="menu" />
      </button>

      <aside
        id="sidebar"
        data-open={open}
        aria-label="Thanh menu"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-4 border-r border-zinc-200 bg-zinc-50 transition-transform duration-200 motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900 ${open ? "visible translate-x-0" : "invisible -translate-x-full"} md:visible md:sticky md:top-0 md:h-screen md:w-[var(--sidebar-w)] md:translate-x-0 md:shrink-0`}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-4">
          <span className="sidebar-label truncate text-sm font-semibold">
            Task Manager
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng menu"
            title="Đóng menu"
            className="grid min-h-[44px] min-w-[44px] cursor-pointer place-items-center rounded-md text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 md:hidden"
          >
            <AstryxIcon icon="close" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Mở thanh menu" : "Thu gọn thanh menu"}
            title={collapsed ? "Mở thanh menu" : "Thu gọn thanh menu"}
            aria-controls="sidebar"
            aria-expanded={!collapsed}
            className="hidden min-h-[36px] min-w-[36px] cursor-pointer place-items-center rounded-md text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 md:grid"
          >
            <AstryxIcon icon={collapsed ? "chevronsRight" : "chevronsLeft"} />
          </button>
        </div>

        <nav
          ref={navRef}
          tabIndex={-1}
          aria-label="Điều hướng chính"
          className="flex flex-col gap-1 px-3"
        >
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`sidebar-item flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="sidebar-label truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {open && (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Đóng menu"
          className="fixed inset-0 z-30 cursor-pointer bg-black/40 md:hidden"
        />
      )}
    </>
  );
}
