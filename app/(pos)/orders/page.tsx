"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatAud } from "@/lib/format";

interface PosOrder {
  id: string;
  ticketNumber: number | null;
  status: string;
  paymentStatus: string;
  fulfillmentType?: string;
  total: string | number;
  createdAt: string;
}

export default function OrdersPage(): React.ReactElement {
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<PosOrder[]>("/pos/orders/active")
      .then((data) => {
        setOrders(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load orders",
        );
      });
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col">
      <h2 className="text-lg font-bold">Active tickets</h2>
      <p className="mt-0.5 text-sm font-medium text-outline">
        Open POS orders for pickup and counter service.
      </p>

      {error ? <p className="mt-3 text-sm font-medium text-red-300">{error}</p> : null}

      <div className="pos-scrollbar mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {orders.length === 0 ? (
          <p className="text-sm text-outline">No active orders.</p>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container px-4 py-4"
            >
              <div>
                <p className="font-bold">
                  Ticket #{order.ticketNumber ?? "—"}
                </p>
                <p className="text-sm font-medium text-outline">
                  {order.fulfillmentType ?? "PICKUP"} · {order.status} ·{" "}
                  {order.paymentStatus}
                </p>
              </div>
              <p className="text-lg font-bold text-accent">
                {formatAud(order.total)}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
