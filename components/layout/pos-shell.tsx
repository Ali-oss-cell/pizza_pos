"use client";

import { PaymentSyncBanner } from "@/components/layout/payment-sync-banner";
import { ArrowLeft, LogOut, Menu, X } from "lucide-react";
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
  const pinpadOk = Boolean(linklyPaired && cardTerminalEnabled);
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
      <header className="glass-header sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-3 sm:px-4">
        <button
          aria-expanded={menuOpen}
          aria-label="Open menu"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-100 transition hover:bg-white/10"
          type="button"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        {pathname !== "/register" ? (
          <button
            className="inline-flex min-h-touch items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-zinc-100"
            type="button"
            onClick={() => router.push("/register")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-tight text-zinc-50 sm:text-lg">
            {brandName}
          </p>
          <p className="truncate text-xs font-medium text-zinc-400">
            {selectedLocation?.name
              ? `${pageLabel(pathname)} · ${selectedLocation.name}`
              : pageLabel(pathname)}
          </p>
        </div>

        {pinpadLabel ? (
          <span
            className={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex",
              pinpadOk
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
                : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                pinpadOk ? "bg-emerald-400" : "bg-amber-400",
              )}
            />
            {pinpadLabel}
          </span>
        ) : null}
        <a
          className="hidden rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/5 sm:inline"
          href="/customer-display"
          rel="noreferrer"
          target="_blank"
        >
          Customer display
        </a>
        <button
          className="inline-flex min-h-touch items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-zinc-100"
          type="button"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Log out</span>
        </button>
      </header>

      <PaymentSyncBanner />

      {menuOpen ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-zinc-950/70 backdrop-blur-sm"
          type="button"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,82vw)] flex-col border-r border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl transition-transform duration-200",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <p className="text-sm font-semibold text-zinc-100">Menu</p>
          <button
            aria-label="Close menu"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-xl bg-white/5"
            type="button"
            onClick={() => setMenuOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 p-3">
          {NAV.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                className={cn(
                  "flex min-h-touch-lg items-center rounded-xl px-4 text-base font-semibold transition",
                  active
                    ? "bg-gradient-to-r from-rose-500 to-violet-500 text-white shadow-pay-glow"
                    : "text-zinc-300 hover:bg-white/5",
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
            <p className="px-1 text-sm font-semibold text-zinc-100">
              {user.firstName} {user.lastName}
            </p>
            <p className="px-1 text-xs text-zinc-400">
              {selectedStore?.name ?? user.role}
              {selectedLocation?.name ? ` · ${selectedLocation.name}` : ""}
            </p>
            {pinpadLabel ? (
              <p
                className={cn(
                  "mt-1 px-1 text-xs font-medium",
                  pinpadOk ? "text-emerald-300" : "text-amber-200",
                )}
              >
                {pinpadLabel}
              </p>
            ) : null}
            {stores.length > 1 ||
            (selectedStore && selectedStore.locations.length > 1) ? (
              <button
                className="mt-3 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
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
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
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

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 lg:p-5">
        {children}
      </main>
    </div>
  );
}
