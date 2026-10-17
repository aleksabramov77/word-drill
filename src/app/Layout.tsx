import { BookOpen, Dumbbell, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { cn } from "@/shared/lib/utils";
import { Toaster } from "@/shared/ui/sonner";

const NAV = [
  { to: "/", label: "Тренировка", icon: Dumbbell },
  { to: "/words", label: "Слова", icon: BookOpen },
  { to: "/settings", label: "Настройки", icon: Settings },
] as const;

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Toaster position="top-center" />
    </div>
  );
}
