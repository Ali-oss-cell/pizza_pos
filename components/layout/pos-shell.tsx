"use client";

import { PaymentSyncBanner } from "@/components/layout/payment-sync-banner";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
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
  const [linklyPaired, setLinklyPaired] = useState<boolean | null>(null);
  const [cardTerminalEnabled, setCardTerminalEnabled] = useState(false);

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

  useEffect(() => {
    if (!selectedStore || !selectedLocation) {
      setLinklyPaired(null);
      setCardTerminalEnabled(false);
      return;
    }

    let cancelled = false;
    void apiFetch<{
      cardTerminalEnabled: boolean;
      linklyPaired?: boolean;
      provider: string;
    }>("/pos/payment-methods")
      .then((methods) => {
        if (cancelled) return;
        setCardTerminalEnabled(methods.cardTerminalEnabled);
        setLinklyPaired(
          methods.provider === "LINKLY"
            ? Boolean(methods.linklyPaired)
            : methods.cardTerminalEnabled,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setLinklyPaired(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStore?.slug, selectedLocation?.id]);

  const brandName = selectedStore?.name ?? "POS";
  const accent = selectedStore?.primaryColor?.trim() || undefined;
  const pinpadLabel =
    linklyPaired === null
      ? null
      : !cardTerminalEnabled
        ? "Card off"
        : linklyPaired
          ? "Pinpad paired"
          : "Pinpad not paired";

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
          <p className="truncate font-display text-base font-bold tracking-tight sm:text-lg">
            {brandName}
          </p>
          <p className="truncate text-xs font-semibold text-outline sm:text-sm">
            {selectedLocation?.name
              ? `${pageLabel(pathname)} · ${selectedLocation.name}`
              : pageLabel(pathname)}
            {pinpadLabel ? ` · ${pinpadLabel}` : ""}
          </p>
        </div>

        {pinpadLabel ? (
          <span
            className={cn(
              "hidden shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline",
              linklyPaired && cardTerminalEnabled
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-200",
            )}
          >
            {pinpadLabel}
          </span>
        ) : null}
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
              {selectedLocation?.name ? ` · ${selectedLocation.name}` : ""}
            </p>
            {pinpadLabel ? (
              <p
                className={cn(
                  "mt-1 px-1 text-xs font-semibold",
                  linklyPaired && cardTerminalEnabled
                    ? "text-emerald-300"
                    : "text-amber-200",
                )}
              >
                {pinpadLabel}
              </p>
            ) : null}
            {stores.length > 1 ||
            (selectedStore && selectedStore.locations.length > 1) ? (
              <button
                className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-outline transition hover:bg-surface-container-high hover:text-on-surface"
                type="button"
                onClick={() => {
                  const currentName = selectedStore?.name ?? "this store";
                  const confirmed = window.confirm(
                    `Switch away from ${currentName}? You will pick another store before taking orders.`,
                  );
                  if (!confirmed) {
                    return;
                  }
                  setMenuOpen(false);
                  clearSelection();
                  router.push("/select-store");
                }}
              >
                Switch store / location
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
