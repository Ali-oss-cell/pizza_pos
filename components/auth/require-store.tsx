"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store-context";

export function RequireStore({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement | null {
  const { selectedStore, selectedLocation, isReady, stores } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!selectedStore || !selectedLocation) {
      router.replace(
        `/select-store?from=${encodeURIComponent(pathname)}`,
      );
    }
  }, [isReady, selectedStore, selectedLocation, router, pathname]);

  if (!isReady) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-outline">
        Loading store…
      </div>
    );
  }

  if (!selectedStore || !selectedLocation) {
    if (stores.length === 0) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-lg font-semibold">No store access</p>
          <p className="text-sm text-outline">
            Ask a platform admin to assign you to a store before using POS.
          </p>
        </div>
      );
    }

    return null;
  }

  return <>{children}</>;
}
