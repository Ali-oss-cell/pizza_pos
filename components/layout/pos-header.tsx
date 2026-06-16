"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/register", label: "Register" },
  { href: "/kitchen", label: "Kitchen" },
  { href: "/orders", label: "Orders" },
] as const;

export function PosHeader(): React.ReactElement {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-white/10 bg-surface-container px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-outline">
            Marina Pizzas
          </p>
          <h1 className="text-xl font-semibold">Point of Sale</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-2 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                className={cn(
                  "min-h-touch rounded-lg px-4 py-3 font-medium",
                  pathname === item.href
                    ? "bg-accent text-white"
                    : "bg-surface-container-high",
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {user ? (
            <div className="flex items-center gap-2 border-l border-white/10 pl-2">
              <span className="hidden text-sm text-outline sm:inline">
                {user.firstName} · {user.role}
              </span>
              <button
                className="min-h-touch rounded-lg border border-outline px-4 py-3 text-sm font-medium"
                type="button"
                onClick={logout}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
