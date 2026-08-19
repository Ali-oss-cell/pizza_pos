"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatAud } from "@/lib/format";
import { cn } from "@/lib/utils";

interface OrderItem {
  name: string;
  quantity: number;
  size?: string | null;
}

interface PosOrder {
  id: string;
  ticketNumber: number | null;
  status: string;
  paymentStatus: string;
  fulfillmentType?: string | null;
  notes?: string | null;
  total: string | number;
  createdAt: string;
  items?: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:  "bg-amber-500/15 text-amber-300",
  PREPARING:  "bg-blue-500/15 text-blue-300",
  READY:      "bg-emerald-500/15 text-emerald-300",
  COMPLETED:  "bg-zinc-500/15 text-zinc-400",
  CANCELLED:  "bg-red-500/15 text-red-400",
};

function timeSince(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function OrdersPage(): React.ReactElement {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");

  async function loadOrders() {
    try {
      const data = await apiFetch<PosOrder[]>("/pos/orders/active");
      setOrders(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders");
    }
  }

  useEffect(() => {
    void loadOrders();
    const id = window.setInterval(() => void loadOrders(), 8000);
    return () => window.clearInterval(id);
  }, []);

  async function updateStatus(orderId: string, status: string) {
    if (status === "CANCELLED" && !window.confirm("Cancel this order?")) return;
    setBusyId(orderId);
    try {
      await apiFetch(`/pos/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order");
    } finally {
      setBusyId(null);
    }
  }

  const ACTIVE_STATUSES = ["CONFIRMED", "PREPARING", "READY"];
  const displayed =
    filter === "active"
      ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
      : orders;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Active tickets</h2>
          <p className="text-xs font-medium text-outline">
            {displayed.length} showing · auto-refreshes every 8s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* filter toggle */}
          <div className="flex rounded-lg bg-surface-container-high p-0.5 text-xs font-bold">
            {(["active", "all"] as const).map((f) => (
              <button
                key={f}
                className={cn(
                  "rounded-md px-3 py-1.5 capitalize",
                  filter === f ? "bg-accent text-white shadow" : "text-outline",
                )}
                type="button"
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            className="rounded-lg bg-surface-container px-3 py-1.5 text-xs font-semibold"
            type="button"
            onClick={() => void loadOrders()}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300">
          {error}
        </p>
      ) : null}

      <div className="pos-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto">
        {displayed.length === 0 ? (
          <p className="py-10 text-center text-sm text-outline">
            {filter === "active" ? "No active orders." : "No orders."}
          </p>
        ) : (
          displayed.map((order) => (
            <article
              key={order.id}
              className="rounded-xl border border-white/8 bg-surface-container px-4 py-3"
            >
              {/* top row */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold">
                    #{order.ticketNumber ?? "—"}
                    <span className="ml-2 text-sm font-normal text-outline">
                      {order.fulfillmentType ?? "PICKUP"}
                    </span>
                  </p>
                  <p className="text-xs text-outline">{timeSince(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold",
                      STATUS_COLORS[order.status] ?? "bg-zinc-500/15 text-zinc-400",
                    )}
                  >
                    {order.status}
                  </span>
                  <span className="text-base font-bold text-accent">
                    {formatAud(order.total)}
                  </span>
                </div>
              </div>

              {/* items */}
              {order.items && order.items.length > 0 ? (
                <ul className="mt-2 space-y-0.5 border-t border-white/8 pt-2 text-sm">
                  {order.items.map((item, i) => (
                    <li key={i} className="text-on-surface/80">
                      {item.quantity}× {item.name}
                      {item.size ? <span className="text-outline"> · {item.size}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {/* order note */}
              {order.notes ? (
                <p className="mt-2 rounded-lg bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
                  📝 {order.notes}
                </p>
              ) : null}

              {/* action buttons */}
              {ACTIVE_STATUSES.includes(order.status) ? (
                <div className="mt-3 flex gap-2">
                  {order.status === "READY" ? (
                    <button
                      className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50"
                      disabled={busyId === order.id}
                      type="button"
                      onClick={() => void updateStatus(order.id, "COMPLETED")}
                    >
                      Mark completed
                    </button>
                  ) : null}
                  <button
                    className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-bold text-red-400 disabled:opacity-50"
                    disabled={busyId === order.id}
                    type="button"
                    onClick={() => void updateStatus(order.id, "CANCELLED")}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
