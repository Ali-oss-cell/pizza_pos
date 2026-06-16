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
    <section>
      <h2 className="text-2xl font-semibold">Active tickets</h2>
      <p className="mt-1 text-sm text-outline">
        Open POS orders for pickup and counter service.
      </p>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 space-y-3">
        {orders.length === 0 ? (
          <p className="text-sm text-outline">No active orders.</p>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container px-4 py-4"
            >
              <div>
                <p className="font-semibold">
                  Ticket #{order.ticketNumber ?? "—"}
                </p>
                <p className="text-sm text-outline">
                  {order.fulfillmentType ?? "PICKUP"} · {order.status} ·{" "}
                  {order.paymentStatus}
                </p>
              </div>
              <p className="text-lg font-semibold">
                {formatAud(order.total)}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
