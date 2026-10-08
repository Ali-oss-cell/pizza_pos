"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  isWaitingForAccept,
  playOrderAlert,
  unlockAlertAudio,
  type OnlineOrder,
} from "@/lib/online-orders";

const POLL_MS = 15_000;
/** Keep reminding while an online order sits unaccepted: kitchens are loud. */
const REMIND_MS = 30_000;

/**
 * Runs on every POS screen so a web order is never missed while staff are on
 * the register. Returns how many paid online orders are waiting to be accepted.
 */
export function useOnlineOrderAlerts(enabled: boolean): number {
  const [waiting, setWaiting] = useState(0);
  const seenRef = useRef<Set<string> | null>(null);
  const lastBeepRef = useRef(0);

  useEffect(() => {
    const unlock = () => unlockAlertAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const check = async () => {
      try {
        const orders = await apiFetch<OnlineOrder[]>("/pos/orders/active");
        if (cancelled) return;
        const now = Date.now();
        const waitingOrders = orders.filter((order) => isWaitingForAccept(order, now));
        setWaiting(waitingOrders.length);

        const ids = new Set(waitingOrders.map((order) => order.id));
        const firstLoad = seenRef.current === null;
        const hasNew = !firstLoad && waitingOrders.some((order) => !seenRef.current!.has(order.id));
        seenRef.current = ids;

        const remindDue = waitingOrders.length > 0 && now - lastBeepRef.current >= REMIND_MS;
        if (hasNew || (firstLoad && waitingOrders.length > 0) || remindDue) {
          lastBeepRef.current = now;
          playOrderAlert();
        }
      } catch {
        /* Network blips: keep the last count; the next poll retries. */
      }
    };

    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  return waiting;
}
