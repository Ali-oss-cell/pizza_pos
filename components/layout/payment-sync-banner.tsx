"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { usePaymentSync } from "@/lib/use-payment-sync";
import { cn } from "@/lib/utils";

export function PaymentSyncBanner(): React.ReactElement | null {
  const { isOnline, pending, syncing, retrySync } = usePaymentSync();

  if (isOnline && pending.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "shrink-0 border-b px-3 py-2 text-sm",
        isOnline
          ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
          : "border-red-500/30 bg-red-500/10 text-red-100",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isOnline ? <WifiOff className="h-4 w-4 shrink-0" /> : null}
          <p>
            {!isOnline
              ? "Offline — payments are saved and will sync when connection returns."
              : `${pending.length} payment${pending.length === 1 ? "" : "s"} waiting to sync.`}
          </p>
        </div>

        {isOnline && pending.length > 0 ? (
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-semibold"
            disabled={syncing}
            type="button"
            onClick={() => void retrySync()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Retry now"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
