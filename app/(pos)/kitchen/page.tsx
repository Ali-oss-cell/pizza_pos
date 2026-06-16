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
    <section>
      <h2 className="text-2xl font-semibold">Kitchen display</h2>
      <p className="mt-1 text-sm text-outline">
        Paid POS orders only. Updates every 5 seconds.
      </p>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => (
          <div key={column} className="rounded-2xl bg-surface-container p-4">
            <h3 className="text-lg font-semibold">{column}</h3>
            <div className="mt-4 space-y-3">
              {orders
                .filter((order) => order.status === column)
                .map((order) => (
                  <article
                    key={order.id}
                    className="rounded-xl bg-surface p-4"
                  >
                    <p className="text-sm text-outline">
                      Ticket #{order.ticketNumber ?? "—"}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
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
                          "mt-3 min-h-touch w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm font-medium",
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
