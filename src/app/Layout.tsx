import { Link, Outlet } from "react-router-dom";
import { useTheme } from "./theme";
import { PwaStatus } from "./PwaStatus";
import { Moon, Sun } from "lucide-react";

export function Layout() {
  const { theme, toggle } = useTheme();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap font-bold text-brand-700 dark:text-brand-500">
            <img src="/icons/icon.svg" alt="" className="size-8" />
            کتاب تعاملی
          </Link>
          <nav className="flex items-center gap-1 whitespace-nowrap text-sm">
            <Link className="rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" to="/">کتاب‌ها</Link>
            <button
              onClick={toggle}
              className="rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={theme === "dark" ? "حالت روشن" : "حالت تیره"}
            >
              {theme === "dark" ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6">
        <Outlet />
      </main>
      <PwaStatus />
    </div>
  );
}
