"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardIcon, BellIcon, FolderIcon } from "@/components/icons";

const STORAGE_KEY = "sidebar-collapsed";
const CHANGE_EVENT = "sidebar-collapsed-change";

export const NAV_ITEMS = [
  { href: "/", label: "Tổng quan", Icon: DashboardIcon },
  { href: "/projects", label: "Dự án", Icon: FolderIcon },
  { href: "/notifications", label: "Lịch sử thông báo", Icon: BellIcon },
];

function subscribeCollapsed(onChange: () => void) {
  document.addEventListener(CHANGE_EVENT, onChange);
  return () => document.removeEventListener(CHANGE_EVENT, onChange);
}

function isCollapsed() {
  return document.documentElement.dataset.sidebarCollapsed === "1";
}

/**
 * The app's left navigation: Astryx `SideNav` inside `AppShell`'s sideNav slot.
 * Collapsed state still lives on `<html>` (not in React state) so the pre-paint
 * script in `layout.tsx` can restore it from `localStorage` before first paint —
 * no flash, no hydration mismatch. React mirrors the value through
 * `useSyncExternalStore` (server snapshot `false`) only so `SideNav` can render
 * its rail/label width and `aria-expanded` correctly after hydration.
 * Below `AppShell`'s mobile breakpoint the same items move into the drawer that
 * `AppShell` builds from the nav slots (focus-trapped, focus returned to the
 * toggle) — no hand-rolled drawer here any more.
 */
export function AppNav() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, isCollapsed, () => false);

  function onCollapsedChange(next: boolean) {
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
    <SideNav
      aria-label="Thanh menu"
      header={
        <SideNavHeading
          heading="Task Manager"
          headingHref="/"
          headerEndContent={<ThemeToggle />}
        />
      }
      // `headerEndContent` is hidden when the rail collapses, so the switch
      // falls back to the footer icon bar — otherwise the theme could not be
      // changed from a collapsed sidebar.
      footerIcons={collapsed ? <ThemeToggle /> : undefined}
      collapsible={{
        isCollapsed: collapsed,
        onCollapsedChange,
        hasButton: true,
        buttonLabel: collapsed ? "Mở thanh menu" : "Thu gọn thanh menu",
      }}
    >
      <SideNavSection title="Điều hướng" isHeaderHidden>
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <SideNavItem
            key={href}
            label={label}
            href={href}
            as={Link}
            isSelected={isActive(href)}
            icon={Icon}
          />
        ))}
      </SideNavSection>
    </SideNav>
  );
}
