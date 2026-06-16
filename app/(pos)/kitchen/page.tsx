"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PosOrder {
  id: string;
  ticketNumber: number | null;
  status: string;
  paymentStatus: string;
  items: Array<{
    name: string;
    quantity: number;
    size?: string | null;
    toppings?: unknown;
    removedIngredients?: string[];
  }>;
}

const COLUMNS = ["CONFIRMED", "PREPARING", "READY"] as const;

export default function KitchenPage(): React.ReactElement {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        const data = await apiFetch<PosOrder[]>("/pos/orders/active");
        if (active) {
          setOrders(data.filter((order) => order.paymentStatus === "PAID"));
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load kitchen orders",
          );
        }
      }
    }

    void loadOrders();
    const interval = window.setInterval(() => {
      void loadOrders();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function advanceStatus(orderId: string, status: string) {
    await apiFetch(`/pos/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status } : order,
      ),
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <h2 className="text-lg font-bold">Kitchen display</h2>
      <p className="mt-0.5 text-sm font-medium text-outline">
        Paid POS orders only. Updates every 5 seconds.
      </p>

      {error ? <p className="mt-3 text-sm font-medium text-red-300">{error}</p> : null}

      <div className="mt-3 grid min-h-0 flex-1 gap-2 md:grid-cols-3 md:gap-3">
        {COLUMNS.map((column) => (
          <div
            key={column}
            className="flex min-h-0 flex-col rounded-2xl bg-surface-container p-3"
          >
            <h3 className="text-base font-bold">{column}</h3>
            <div className="pos-scrollbar mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
              {orders
                .filter((order) => order.status === column)
                .map((order) => (
                  <article
                    key={order.id}
                    className="rounded-xl bg-surface p-4"
                  >
                    <p className="text-sm font-bold">
                      Ticket #{order.ticketNumber ?? "—"}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm font-medium">
                      {order.items.map((item, index) => (
                        <li key={`${order.id}-${index}`}>
                          {item.quantity}× {item.name}
                          {item.size ? ` · ${item.size}` : ""}
                        </li>
                      ))}
                    </ul>
                    {column !== "READY" ? (
                      <button
                        className={cn(
                          "mt-3 flex min-h-touch-lg w-full items-center justify-center rounded-xl bg-surface-container-high px-3 text-sm font-bold",
                        )}
                        type="button"
                        onClick={() =>
                          void advanceStatus(
                            order.id,
                            column === "CONFIRMED" ? "PREPARING" : "READY",
                          )
                        }
                      >
                        Mark {column === "CONFIRMED" ? "preparing" : "ready"}
                      </button>
                    ) : null}
                  </article>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
