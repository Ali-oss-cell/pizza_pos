"use client";

import { useCallback, useEffect, useState } from "react";
import {
  flushPendingPayments,
  listPendingPayments,
  PENDING_PAYMENTS_CHANGED_EVENT,
  type PendingPayment,
} from "@/lib/payment-sync";

export function usePaymentSync(): {
  isOnline: boolean;
  pending: PendingPayment[];
  syncing: boolean;
  refreshPending: () => void;
  retrySync: () => Promise<void>;
} {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(() => {
    setPending(listPendingPayments());
  }, []);

  const retrySync = useCallback(async () => {
    if (!navigator.onLine || syncing) {
      return;
    }

    setSyncing(true);

    try {
      await flushPendingPayments();
    } finally {
      refreshPending();
      setSyncing(false);
    }
  }, [refreshPending, syncing]);

  useEffect(() => {
    refreshPending();

    const handleOnline = (): void => {
      setIsOnline(true);
      void retrySync();
    };

    const handleOffline = (): void => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(PENDING_PAYMENTS_CHANGED_EVENT, refreshPending);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(PENDING_PAYMENTS_CHANGED_EVENT, refreshPending);
    };
  }, [refreshPending, retrySync]);

  useEffect(() => {
    if (!isOnline || pending.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void retrySync();
    }, 20000);

    return () => window.clearInterval(timer);
  }, [isOnline, pending.length, retrySync]);

  return {
    isOnline,
    pending,
    syncing,
    refreshPending,
    retrySync,
  };
}
