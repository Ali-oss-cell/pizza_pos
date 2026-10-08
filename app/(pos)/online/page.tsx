"use client";

import { Bike, Bell, BellOff, CalendarClock, MapPin, Phone, Printer, RefreshCw, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  alertsEnabled,
  formatAddress,
  formatDue,
  formatMoney,
  isDelivery,
  isOnlineOrder,
  isScheduledLater,
  minutesUntilDue,
  setAlertsEnabled,
  toppingLabels,
  unlockAlertAudio,
  type OnlineOrder,
} from "@/lib/online-orders";
import { printKitchenTicket } from "@/lib/print";
import { useStore } from "@/lib/store-context";
import { cn } from "@/lib/utils";

const POLL_MS = 10_000;

type LaneKey = "new" | "scheduled" | "kitchen" | "ready";

const LANES: Array<{ key: LaneKey; label: string; hint: string; tone: string }> = [
  { key: "new", label: "New", hint: "Accept to send to the kitchen", tone: "border-sky-400/40 bg-sky-500/15 text-sky-200" },
  { key: "scheduled", label: "Scheduled", hint: "Due later — start when it's time", tone: "border-violet-400/40 bg-violet-500/15 text-violet-200" },
  { key: "kitchen", label: "In the kitchen", hint: "Being made", tone: "border-amber-400/40 bg-amber-500/15 text-amber-200" },
  { key: "ready", label: "Ready / on the way", hint: "Waiting for pickup or out with the driver", tone: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" },
];

function laneFor(order: OnlineOrder, now: number): LaneKey | null {
  switch (order.status) {
    case "CONFIRMED":
      return isScheduledLater(order, now) ? "scheduled" : "new";
    case "PREPARING":
      return "kitchen";
    case "READY":
    case "OUT_FOR_DELIVERY":
      return "ready";
    default:
      return null;
  }
}

/** The one next step for an order, labelled the way staff say it. */
function nextAction(order: OnlineOrder): { status: string; label: string } | null {
  const delivery = isDelivery(order);
  switch (order.status) {
    case "CONFIRMED":
      return { status: "PREPARING", label: "Accept & start" };
    case "PREPARING":
      return { status: "READY", label: delivery ? "Ready for driver" : "Ready for pickup" };
    case "READY":
      return delivery
        ? { status: "OUT_FOR_DELIVERY", label: "Out for delivery" }
        : { status: "COMPLETED", label: "Picked up" };
    case "OUT_FOR_DELIVERY":
      return { status: "COMPLETED", label: "Delivered" };
    default:
      return null;
  }
}

function sortForLane(orders: OnlineOrder[]): OnlineOrder[] {
  const due = (order: OnlineOrder) =>
    order.scheduledAt ? new Date(order.scheduledAt).getTime() : new Date(order.createdAt).getTime();
  /* Soonest due (or oldest ASAP) first: the order they should be made in. */
  return [...orders].sort((a, b) => due(a) - due(b));
}

function AgeBadge({ order, now }: { order: OnlineOrder; now: number }): React.ReactElement {
  const untilDue = minutesUntilDue(order, now);
  if (untilDue !== null) {
    const late = untilDue < 0;
    return (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-bold",
          late ? "bg-red-500/20 text-red-300" : untilDue <= 15 ? "bg-amber-500/20 text-amber-200" : "bg-white/10 text-zinc-300",
        )}
      >
        {late ? `${Math.abs(untilDue)}m late` : untilDue === 0 ? "due now" : `in ${untilDue}m`}
      </span>
    );
  }
  const mins = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60000));
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-bold",
        mins >= 20 ? "bg-red-500/20 text-red-300" : mins >= 10 ? "bg-amber-500/20 text-amber-200" : "bg-white/10 text-zinc-300",
      )}
    >
      {mins < 1 ? "just now" : `${mins}m ago`}
    </span>
  );
}

function OnlineOrderCard({
  order,
  now,
  busy,
  onAdvance,
  onPrint,
}: {
  order: OnlineOrder;
  now: number;
  busy: boolean;
  onAdvance: (order: OnlineOrder, status: string) => void;
  onPrint: (order: OnlineOrder) => void;
}): React.ReactElement {
  const delivery = isDelivery(order);
  const address = delivery ? formatAddress(order) : null;
  const action = nextAction(order);
  const waiting = order.status === "CONFIRMED" && !isScheduledLater(order, now);

  return (
    <article
      className={cn(
        "rounded-2xl border bg-surface p-3.5 shadow-sm",
        waiting ? "border-sky-400/50 ring-1 ring-sky-400/30" : "border-white/8",
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-bold leading-none">#{order.ticketNumber ?? "—"}</p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                delivery ? "bg-violet-500/20 text-violet-200" : "bg-emerald-500/20 text-emerald-200",
              )}
            >
              {delivery ? <Bike className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
              {delivery ? "Delivery" : "Pickup"}
            </span>
            {order.channel === "PHONE" ? (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase text-zinc-300">Phone</span>
            ) : null}
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold text-zinc-100">{order.guestName || "Online customer"}</p>
        </div>
        <AgeBadge now={now} order={order} />
      </header>

      <div className="mt-2 space-y-1 text-xs text-zinc-300">
        <p className="flex items-center gap-1.5 font-semibold">
          <CalendarClock className="h-3.5 w-3.5 text-outline" />
          {formatDue(order, new Date(now))}
        </p>
        {order.guestPhone ? (
          <a className="flex items-center gap-1.5 hover:text-white" href={`tel:${order.guestPhone.replace(/\s+/g, "")}`}>
            <Phone className="h-3.5 w-3.5 text-outline" />
            {order.guestPhone}
          </a>
        ) : null}
        {address ? (
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-outline" />
            <span>{address}</span>
          </p>
        ) : null}
      </div>

      <ul className="mt-2.5 space-y-1.5 border-t border-white/8 pt-2.5">
        {order.items.map((item, idx) => {
          const extras = toppingLabels(item);
          return (
            <li className="text-sm" key={`${item.name}-${idx}`}>
              <p className="font-bold">
                {item.quantity}× {item.name}
                {item.size ? <span className="ml-1 font-normal text-outline">· {item.size}</span> : null}
                {item.crust ? <span className="ml-1 font-normal text-outline">· {item.crust}</span> : null}
              </p>
              {extras.length > 0 ? <p className="text-xs text-emerald-400">+ {extras.join(", ")}</p> : null}
              {item.removedIngredients && item.removedIngredients.length > 0 ? (
                <p className="text-xs text-red-400">− {item.removedIngredients.join(", ")}</p>
              ) : null}
              {item.notes ? <p className="text-xs italic text-yellow-300">Note: {item.notes}</p> : null}
            </li>
          );
        })}
      </ul>

      {order.notes ? (
        <p className="mt-2 rounded-lg bg-yellow-500/10 px-2 py-1.5 text-xs font-medium text-yellow-300">
          Customer note: {order.notes}
        </p>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between border-t border-white/8 pt-2.5 text-sm">
        <span className="text-xs font-semibold text-emerald-300">Paid online</span>
        <span className="font-bold">{formatMoney(order.total)}</span>
      </div>

      <div className="mt-3 flex gap-2">
        {action ? (
          <button
            className={cn(
              "flex min-h-touch flex-1 items-center justify-center rounded-xl px-3 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50",
              waiting ? "bg-sky-500 text-white" : "bg-surface-container-high text-zinc-50",
            )}
            disabled={busy}
            type="button"
            onClick={() => onAdvance(order, action.status)}
          >
            {busy ? "Saving…" : action.label}
          </button>
        ) : null}
        <button
          aria-label={`Print ticket #${order.ticketNumber ?? ""}`}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200"
          type="button"
          onClick={() => onPrint(order)}
        >
          <Printer className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export default function OnlineOrdersPage(): React.ReactElement {
  const { selectedStore, selectedLocation } = useStore();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "done">("active");
  const [now, setNow] = useState(() => Date.now());
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setSoundOn(alertsEnabled());
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<OnlineOrder[]>("/pos/orders/active");
      setOrders(data.filter((order) => isOnlineOrder(order) && order.paymentStatus === "PAID"));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load online orders");
    } finally {
      setLoaded(true);
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  async function advance(order: OnlineOrder, status: string) {
    setBusyId(order.id);
    setActionError(null);
    try {
      await apiFetch(`/pos/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders((current) => current.map((o) => (o.id === order.id ? { ...o, status } : o)));
    } catch (advanceError) {
      setActionError(
        `#${order.ticketNumber ?? ""}: ${advanceError instanceof Error ? advanceError.message : "Could not update order"}`,
      );
    } finally {
      setBusyId(null);
    }
  }

  function print(order: OnlineOrder) {
    const delivery = isDelivery(order);
    printKitchenTicket({
      storeName: selectedStore?.name ?? "",
      locationName: selectedLocation?.name,
      ticketNumber: order.ticketNumber,
      fulfillmentType: delivery ? "DELIVERY" : "PICKUP",
      channelLabel: order.channel === "PHONE" ? "PHONE ORDER" : "ONLINE ORDER",
      customerName: order.guestName,
      customerPhone: order.guestPhone,
      deliveryAddress: delivery ? formatAddress(order) : null,
      dueLabel: formatDue(order),
      notes: order.notes,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        size: item.size,
        crust: item.crust,
        detail: [
          toppingLabels(item).length ? `+ ${toppingLabels(item).join(", ")}` : "",
          item.removedIngredients?.length ? `NO ${item.removedIngredients.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" / "),
        notes: item.notes,
      })),
      total: Number(order.total),
      createdAt: order.createdAt,
    });
  }

  function toggleSound() {
    unlockAlertAudio();
    const next = !soundOn;
    setAlertsEnabled(next);
    setSoundOn(next);
  }

  const lanes = useMemo(() => {
    const grouped: Record<LaneKey, OnlineOrder[]> = { new: [], scheduled: [], kitchen: [], ready: [] };
    for (const order of orders) {
      const lane = laneFor(order, now);
      if (lane) grouped[lane].push(order);
    }
    for (const key of Object.keys(grouped) as LaneKey[]) {
      grouped[key] = sortForLane(grouped[key]);
    }
    return grouped;
  }, [orders, now]);

  const completed = useMemo(
    () =>
      orders
        .filter((order) => order.status === "COMPLETED")
        .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()),
    [orders],
  );

  const activeCount = lanes.new.length + lanes.scheduled.length + lanes.kitchen.length + lanes.ready.length;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 transition-colors",
          lanes.new.length > 0 ? "bg-sky-500/15 ring-2 ring-sky-400/40" : "bg-surface-container",
        )}
      >
        <div>
          <h2 className="text-lg font-bold">
            Online orders
            {lanes.new.length > 0 ? (
              <span className="ml-3 text-sky-300">{lanes.new.length} waiting to accept</span>
            ) : null}
          </h2>
          <p className="text-xs font-medium text-outline">
            {activeCount} active · website & phone orders · updates every {POLL_MS / 1000}s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-surface p-1 text-xs font-semibold">
            <button
              className={cn("rounded-lg px-3 py-1.5", view === "active" ? "bg-white/10 text-white" : "text-outline")}
              type="button"
              onClick={() => setView("active")}
            >
              Active
            </button>
            <button
              className={cn("rounded-lg px-3 py-1.5", view === "done" ? "bg-white/10 text-white" : "text-outline")}
              type="button"
              onClick={() => setView("done")}
            >
              Completed today ({completed.length})
            </button>
          </div>
          <button
            aria-label={soundOn ? "Turn order alerts off" : "Turn order alerts on"}
            className={cn(
              "flex min-h-touch min-w-touch items-center justify-center rounded-xl border",
              soundOn ? "border-sky-400/40 bg-sky-500/15 text-sky-200" : "border-white/10 bg-white/5 text-outline",
            )}
            type="button"
            onClick={toggleSound}
          >
            {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
          <button
            aria-label="Refresh"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-xl border border-white/10 bg-white/5"
            type="button"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error ? <p className="mb-2 text-sm font-medium text-red-300">{error}</p> : null}
      {actionError ? (
        <p className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300">{actionError}</p>
      ) : null}

      {view === "done" ? (
        <div className="pos-scrollbar min-h-0 flex-1 overflow-y-auto rounded-2xl bg-surface-container p-3">
          {completed.length === 0 ? (
            <p className="py-10 text-center text-sm text-outline">No completed online orders in the last 12 hours.</p>
          ) : (
            <ul className="divide-y divide-white/8">
              {completed.map((order) => (
                <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" key={order.id}>
                  <span className="font-bold">#{order.ticketNumber ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-300">
                    {order.guestName || "Online customer"} · {isDelivery(order) ? "Delivery" : "Pickup"}
                  </span>
                  <span className="font-semibold">{formatMoney(order.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-4">
          {LANES.map((lane) => {
            const laneOrders = lanes[lane.key];
            return (
              <div className="flex min-h-0 flex-col rounded-2xl bg-surface-container p-3" key={lane.key}>
                <div className={cn("mb-3 rounded-lg border px-3 py-1.5", lane.tone)}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wide">{lane.label}</h3>
                    <span className="text-sm font-bold">{laneOrders.length}</span>
                  </div>
                  <p className="text-[11px] opacity-80">{lane.hint}</p>
                </div>
                <div className="pos-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {!loaded ? (
                    <p className="py-6 text-center text-xs text-outline">Loading…</p>
                  ) : laneOrders.length === 0 ? (
                    <p className="py-6 text-center text-xs text-outline">Nothing here</p>
                  ) : (
                    laneOrders.map((order) => (
                      <OnlineOrderCard
                        busy={busyId === order.id}
                        key={order.id}
                        now={now}
                        order={order}
                        onAdvance={(o, status) => void advance(o, status)}
                        onPrint={print}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
