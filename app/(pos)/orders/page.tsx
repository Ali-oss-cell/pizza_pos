"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAud } from "@/lib/format";
import {
  recoverLinklyPayment,
  refundCardPayment,
  runLinklySettlement,
} from "@/lib/linkly-payments";
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
  paymentMethod?: string | null;
  fulfillmentType?: string | null;
  notes?: string | null;
  total: string | number;
  createdAt: string;
  items?: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-amber-500/15 text-amber-300",
  PREPARING: "bg-blue-500/15 text-blue-300",
  READY: "bg-emerald-500/15 text-emerald-300",
  COMPLETED: "bg-zinc-500/15 text-zinc-400",
  CANCELLED: "bg-red-500/15 text-red-400",
};

const PAYMENT_COLORS: Record<string, string> = {
  PAID: "bg-emerald-500/15 text-emerald-300",
  UNPAID: "bg-zinc-500/15 text-zinc-400",
  PROCESSING: "bg-amber-500/15 text-amber-300",
  FAILED: "bg-red-500/15 text-red-400",
  REFUNDED: "bg-purple-500/15 text-purple-300",
};

function timeSince(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function OrdersPage(): React.ReactElement {
  const { user } = useAuth();
  const canManagePayments =
    user?.role === "MANAGER" || user?.role === "ADMIN";

  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
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
    setInfo(null);
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

  async function handleRecover(orderId: string) {
    setBusyId(orderId);
    setError(null);
    setInfo(null);
    try {
      const result = await recoverLinklyPayment(orderId);
      if (result.paymentStatus === "PAID") {
        setInfo(`Ticket recovered — payment confirmed PAID.`);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, paymentStatus: "PAID", paymentMethod: "CARD_TERMINAL" }
              : o,
          ),
        );
      } else if (result.linklyInProgress) {
        setInfo("Still in progress on pinpad — try Recover again shortly.");
      } else if (result.linklyNotFound) {
        setInfo(
          result.message ??
            "No Linkly session found — safe to retry card on register.",
        );
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, paymentStatus: "FAILED" } : o,
          ),
        );
      } else {
        setInfo(
          result.linklyResponseText ||
            `Status: ${result.paymentStatus}`,
        );
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, paymentStatus: result.paymentStatus }
              : o,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recover failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRefund(order: PosOrder) {
    if (
      !window.confirm(
        `Refund card payment for ticket #${order.ticketNumber ?? "—"} (${formatAud(order.total)})? Customer must complete the refund on the pinpad.`,
      )
    ) {
      return;
    }
    setBusyId(order.id);
    setError(null);
    setInfo(null);
    try {
      const result = await refundCardPayment(order.id);
      setInfo(
        result.alreadyRefunded
          ? "Already refunded."
          : `Refund approved${result.linklyResponseText ? ` — ${result.linklyResponseText}` : ""}.`,
      );
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, paymentStatus: "REFUNDED" } : o,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSettlement() {
    if (
      !window.confirm(
        "Run Linkly settlement on the paired pinpad / VPP? This is usually done at end of day.",
      )
    ) {
      return;
    }
    setSettling(true);
    setError(null);
    setInfo(null);
    try {
      const result = await runLinklySettlement("S");
      setInfo(
        `Settlement OK — ${result.linklyResponseText || result.linklyResponseCode}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settlement failed");
    } finally {
      setSettling(false);
    }
  }

  const ACTIVE_STATUSES = ["CONFIRMED", "PREPARING", "READY"];
  const displayed =
    filter === "active"
      ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
      : orders;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Active tickets</h2>
          <p className="text-xs font-medium text-outline">
            {displayed.length} showing · auto-refreshes every 8s
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {canManagePayments ? (
            <button
              className="rounded-lg bg-surface-container px-3 py-1.5 text-xs font-semibold text-amber-200 disabled:opacity-50"
              disabled={settling}
              type="button"
              onClick={() => void handleSettlement()}
            >
              {settling ? "Settling…" : "Linkly settlement"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200">
          {info}
        </p>
      ) : null}

      <div className="pos-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto">
        {displayed.length === 0 ? (
          <p className="py-10 text-center text-sm text-outline">
            {filter === "active" ? "No active orders." : "No orders."}
          </p>
        ) : (
          displayed.map((order) => {
            const canRecover =
              order.paymentStatus === "PROCESSING" ||
              order.paymentStatus === "FAILED";
            const canRefund =
              canManagePayments &&
              order.paymentStatus === "PAID" &&
              order.paymentMethod === "CARD_TERMINAL";

            return (
              <article
                key={order.id}
                className="rounded-xl border border-white/8 bg-surface-container px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold">
                      #{order.ticketNumber ?? "—"}
                      <span className="ml-2 text-sm font-normal text-outline">
                        {order.fulfillmentType ?? "PICKUP"}
                      </span>
                    </p>
                    <p className="text-xs text-outline">
                      {timeSince(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        STATUS_COLORS[order.status] ??
                          "bg-zinc-500/15 text-zinc-400",
                      )}
                    >
                      {order.status}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        PAYMENT_COLORS[order.paymentStatus] ??
                          "bg-zinc-500/15 text-zinc-400",
                      )}
                    >
                      {order.paymentStatus}
                    </span>
                    <span className="text-base font-bold text-accent">
                      {formatAud(order.total)}
                    </span>
                  </div>
                </div>

                {order.items && order.items.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 border-t border-white/8 pt-2 text-sm">
                    {order.items.map((item, i) => (
                      <li key={i} className="text-on-surface/80">
                        {item.quantity}× {item.name}
                        {item.size ? (
                          <span className="text-outline"> · {item.size}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {order.notes ? (
                  <p className="mt-2 rounded-lg bg-yellow-500/10 px-2 py-1 text-xs text-yellow-300">
                    {order.notes}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {canRecover ? (
                    <button
                      className="rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-50"
                      disabled={busyId === order.id}
                      type="button"
                      onClick={() => void handleRecover(order.id)}
                    >
                      Recover card
                    </button>
                  ) : null}
                  {canRefund ? (
                    <button
                      className="rounded-lg bg-purple-500/20 px-3 py-2 text-xs font-bold text-purple-200 disabled:opacity-50"
                      disabled={busyId === order.id}
                      type="button"
                      onClick={() => void handleRefund(order)}
                    >
                      Refund card
                    </button>
                  ) : null}
                  {ACTIVE_STATUSES.includes(order.status) ? (
                    <>
                      {order.status === "READY" ? (
                        <button
                          className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50"
                          disabled={busyId === order.id}
                          type="button"
                          onClick={() =>
                            void updateStatus(order.id, "COMPLETED")
                          }
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
                    </>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
