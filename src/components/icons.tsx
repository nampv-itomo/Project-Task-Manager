import { Icon } from "@astryxdesign/core/Icon";
import {
  Bell,
  Folder,
  LayoutDashboard,
  Moon,
  Plus,
  RefreshCw,
  Sun,
} from "lucide-react";

/**
 * The app's named glyphs. Lucide owns the artwork; Astryx `Icon` owns size and
 * colour (`astryx docs icons`: a meaning not in the semantic list takes an SVG
 * component directly), so every glyph here follows the active theme and is
 * sized by the slot it sits in (`Button`/`IconButton`/`SideNavItem` ask for
 * `sm`/`md` contextually) — no hand-drawn `<svg>`, no `className` defaults.
 *
 * None of these meanings is an Astryx icon definition (the neutral theme has no
 * `dashboard`/`folder`/`moon`/`sun`/`refresh`/`plus`), which is why they stay
 * wrappers rather than `<Icon icon="folder">`.
 */
export function DashboardIcon() {
  return <Icon icon={LayoutDashboard} />;
}

export function FolderIcon() {
  return <Icon icon={Folder} />;
}

export function BellIcon() {
  return <Icon icon={Bell} />;
}

// Menu / close / panel-collapse use Astryx semantic icons
// (`<Icon icon="menu" | "close" | "chevronsLeft" | "chevronsRight" />`) in the
// sidebar, so they need no wrapper here.

export function MoonIcon() {
  return <Icon icon={Moon} />;
}

export function SunIcon() {
  return <Icon icon={Sun} />;
}

export function RefreshIcon() {
  return <Icon icon={RefreshCw} />;
}

export function PlusIcon() {
  return <Icon icon={Plus} />;
}
