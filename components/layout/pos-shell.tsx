"use client";

import { PaymentSyncBanner } from "@/components/layout/payment-sync-banner";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/register", label: "Register" },
  { href: "/kitchen", label: "Kitchen" },
  { href: "/orders", label: "Orders" },
] as const;

function pageLabel(pathname: string): string {
  return NAV.find((item) => item.href === pathname)?.label ?? "POS";
}

export function PosShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { selectedStore, selectedLocation, clearSelection, stores } =
    useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const brandName = selectedStore?.name ?? "POS";
  const accent = selectedStore?.primaryColor?.trim() || undefined;

  return (
    <div
      className="flex min-h-screen flex-col"
      style={
        accent
          ? ({ ["--color-accent" as string]: accent } as React.CSSProperties)
          : undefined
      }
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 bg-surface-container px-2 sm:px-3">
        <button
          aria-expanded={menuOpen}
          aria-label="Open menu"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-lg bg-surface-container-high text-on-surface"
          type="button"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold tracking-tight">
            {brandName}
          </p>
          <p className="truncate text-xs font-medium text-outline">
            {selectedLocation?.name
              ? `${pageLabel(pathname)} · ${selectedLocation.name}`
              : pageLabel(pathname)}
          </p>
        </div>
      </header>

      <PaymentSyncBanner />

      {menuOpen ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60"
          type="button"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,82vw)] flex-col bg-surface-container shadow-2xl transition-transform duration-200",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-12 items-center justify-between border-b border-white/10 px-3">
          <p className="text-sm font-bold">Menu</p>
          <button
            aria-label="Close menu"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-lg bg-surface-container-high"
            type="button"
            onClick={() => setMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-2 p-3">
          {NAV.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                className={cn(
                  "flex min-h-touch-lg items-center rounded-xl px-4 text-base font-bold",
                  active
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "bg-surface-container-high text-on-surface",
                )}
                href={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {user ? (
          <div className="mt-auto border-t border-white/10 p-3">
            <p className="px-1 text-sm font-semibold text-on-surface">
              {user.firstName} {user.lastName}
            </p>
            <p className="px-1 text-xs text-outline">
              {selectedStore?.name ?? user.role}
            </p>
            {stores.length > 1 ? (
              <button
                className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-outline transition hover:bg-surface-container-high hover:text-on-surface"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  clearSelection();
                  router.push("/select-store");
                }}
              >
                Switch store
              </button>
            ) : null}
            <button
              className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-outline transition hover:bg-surface-container-high hover:text-on-surface"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2">
        {children}
      </main>
    </div>
  );
}
