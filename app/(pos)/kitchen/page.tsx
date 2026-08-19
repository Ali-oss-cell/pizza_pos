"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface KitchenItem {
  name: string;
  quantity: number;
  size?: string | null;
  crust?: string | null;
  notes?: string | null;
  toppings?: Array<{ name: string }> | null;
  removedIngredients?: string[] | null;
}

interface PosOrder {
  id: string;
  ticketNumber: number | null;
  status: string;
  paymentStatus: string;
  fulfillmentType?: string | null;
  notes?: string | null;
  createdAt: string;
  items: KitchenItem[];
}

const COLUMNS: Array<{ key: "CONFIRMED" | "PREPARING" | "READY"; label: string; color: string }> = [
  { key: "CONFIRMED", label: "New", color: "bg-amber-500/15 border-amber-400/30 text-amber-300" },
  { key: "PREPARING", label: "Preparing", color: "bg-blue-500/15 border-blue-400/30 text-blue-300" },
  { key: "READY", label: "Ready", color: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300" },
];

const NEXT_STATUS: Record<string, string> = {
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
};

const ADVANCE_LABEL: Record<string, string> = {
  CONFIRMED: "Start preparing",
  PREPARING: "Mark ready",
};

/* ── time since order was placed ── */
function TimeSince({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = window.setInterval(tick, 10000);
    return () => window.clearInterval(id);
  }, [createdAt]);

  const mins = Math.floor(elapsed / 60);
  const isLate = mins >= 15;

  return (
    <span className={cn("text-xs font-semibold", isLate ? "text-red-400" : "text-outline")}>
      {mins < 1 ? "just now" : `${mins}m ago`}
      {isLate ? " ⚠" : ""}
    </span>
  );
}

/* ── single order card ── */
function OrderCard({
  order,
  columnKey,
  onAdvance,
}: {
  order: PosOrder;
  columnKey: string;
  onAdvance: (id: string, status: string) => void;
}) {
  return (
    <article className="rounded-xl border border-white/8 bg-surface p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold leading-none">#{order.ticketNumber ?? "—"}</p>
          <p className="mt-0.5 text-xs font-medium text-outline">
            {order.fulfillmentType ?? "PICKUP"}
          </p>
        </div>
        <TimeSince createdAt={order.createdAt} />
      </div>

      <ul className="mt-2.5 space-y-2 border-t border-white/8 pt-2.5">
        {order.items.map((item, idx) => (
          <li key={idx} className="text-sm">
            <p className="font-bold">
              {item.quantity}× {item.name}
              {item.size ? <span className="ml-1 font-normal text-outline">· {item.size}</span> : null}
              {item.crust ? <span className="ml-1 font-normal text-outline">· {item.crust}</span> : null}
            </p>
            {item.toppings && item.toppings.length > 0 ? (
              <p className="mt-0.5 text-xs text-emerald-400">
                + {item.toppings.map((t) => t.name).join(", ")}
              </p>
            ) : null}
            {item.removedIngredients && item.removedIngredients.length > 0 ? (
              <p className="mt-0.5 text-xs text-red-400">
                − {item.removedIngredients.join(", ")}
              </p>
            ) : null}
            {item.notes ? (
              <p className="mt-0.5 text-xs italic text-yellow-300">📝 {item.notes}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {order.notes ? (
        <p className="mt-2 rounded-lg bg-yellow-500/10 px-2 py-1.5 text-xs font-medium text-yellow-300">
          📝 Order note: {order.notes}
        </p>
      ) : null}

      {NEXT_STATUS[columnKey] ? (
        <button
          className="mt-3 flex min-h-touch w-full items-center justify-center rounded-xl bg-surface-container-high px-3 text-sm font-bold transition active:scale-[0.98]"
          type="button"
          onClick={() => onAdvance(order.id, NEXT_STATUS[columnKey])}
        >
          {ADVANCE_LABEL[columnKey]}
        </button>
      ) : null}
    </article>
  );
}

/* ══════════════════════════════════════ MAIN PAGE ══ */

export default function KitchenPage(): React.ReactElement {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newFlash, setNewFlash] = useState(false);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    /* Simple beep via Web Audio API — no file needed */
    try {
      const ctx = new AudioContext();
      const beep = (freq: number, dur: number, delay = 0) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + delay + 0.01);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + dur);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + dur + 0.05);
      };

      audioRef.current = {
        play: () => {
          beep(880, 0.12, 0);
          beep(1100, 0.12, 0.15);
          beep(880, 0.12, 0.30);
          return Promise.resolve();
        },
      } as unknown as HTMLAudioElement;
    } catch {
      /* AudioContext blocked — silent fallback */
    }
  }, []);

  async function loadOrders() {
    try {
      const data = await apiFetch<PosOrder[]>("/pos/orders/active");
      const paid = data.filter((o) => o.paymentStatus === "PAID");

      /* detect genuinely new orders */
      const currentIds = new Set(paid.map((o) => o.id));
      const hasNew = paid.some((o) => !prevIdsRef.current.has(o.id));

      if (hasNew && prevIdsRef.current.size > 0) {
        /* flash header */
        setNewFlash(true);
        setTimeout(() => setNewFlash(false), 2500);
        /* beep */
        audioRef.current?.play().catch(() => undefined);
      }

      prevIdsRef.current = currentIds;
      setOrders(paid);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
    }
  }

  useEffect(() => {
    void loadOrders();
    const id = window.setInterval(() => void loadOrders(), 5000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function advanceStatus(orderId: string, status: string) {
    await apiFetch(`/pos/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setOrders((current) =>
      current.map((o) => (o.id === orderId ? { ...o, status } : o)),
    );
  }

  const totalActive = orders.filter((o) => o.status !== "READY").length;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "mb-3 flex items-center justify-between rounded-xl px-4 py-2 transition-colors duration-500",
          newFlash
            ? "bg-amber-500/20 ring-2 ring-amber-400/40"
            : "bg-surface-container",
        )}
      >
        <div>
          <h2 className="text-lg font-bold">
            Kitchen display
            {newFlash ? (
              <span className="ml-3 animate-pulse text-amber-400">🔔 New order!</span>
            ) : null}
          </h2>
          <p className="text-xs font-medium text-outline">
            {totalActive} active · updates every 5s
          </p>
        </div>
        <button
          className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold"
          type="button"
          onClick={() => void loadOrders()}
        >
          Refresh
        </button>
      </div>

      {error ? <p className="mb-3 text-sm font-medium text-red-300">{error}</p> : null}

      <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-3 md:gap-3">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.key);
          return (
            <div key={col.key} className="flex min-h-0 flex-col rounded-2xl bg-surface-container p-3">
              <div className={cn("mb-3 flex items-center justify-between rounded-lg border px-3 py-1.5", col.color)}>
                <h3 className="text-sm font-bold uppercase tracking-wide">{col.label}</h3>
                <span className="text-sm font-bold">{colOrders.length}</span>
              </div>
              <div className="pos-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto">
                {colOrders.length === 0 ? (
                  <p className="py-6 text-center text-xs text-outline">Empty</p>
                ) : (
                  colOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      columnKey={col.key}
                      order={order}
                      onAdvance={(id, status) => void advanceStatus(id, status)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
