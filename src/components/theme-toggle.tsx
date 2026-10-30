"use client";

export function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Chuyển giao diện sáng/tối"
      title="Chuyển giao diện sáng/tối"
      className="fixed right-4 top-4 z-50 rounded-md border border-zinc-300 bg-background px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      <span className="dark:hidden">🌙 Tối</span>
      <span className="hidden dark:inline">☀️ Sáng</span>
    </button>
  );
}
