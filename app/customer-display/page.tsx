"use client";

import { useEffect, useState } from "react";
import { formatAud } from "@/lib/format";
import type { CartLine, QuoteResult } from "@/types/cart";

interface DisplayState {
  storeName: string;
  cart: CartLine[];
  quote: QuoteResult | null;
  customerName: string;
}

export default function CustomerDisplayPage(): React.ReactElement {
  const [state, setState] = useState<DisplayState>({
    storeName: "POS",
    cart: [],
    quote: null,
    customerName: "",
  });

  useEffect(() => {
    const channel = new BroadcastChannel("pos-customer-display");
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as DisplayState & { type?: string };
      if (data?.type === "cart" || data?.cart) {
        setState({
          storeName: data.storeName ?? "POS",
          cart: data.cart ?? [],
          quote: data.quote ?? null,
          customerName: data.customerName ?? "",
        });
      }
    };
    return () => channel.close();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 p-8 text-zinc-50">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
          Your order
        </p>
        <h1 className="mt-2 text-4xl font-semibold">{state.storeName}</h1>
        {state.customerName ? (
          <p className="mt-2 text-xl text-zinc-300">Hi {state.customerName}</p>
        ) : null}
      </header>

      <ul className="flex-1 space-y-4">
        {state.cart.length === 0 ? (
          <li className="text-2xl text-zinc-500">Waiting for items…</li>
        ) : (
          state.cart.map((line) => (
            <li
              key={line.key}
              className="flex items-start justify-between border-b border-white/10 pb-3 text-2xl"
            >
              <div>
                <span className="font-semibold">
                  {line.quantity}× {line.name}
                </span>
                {line.detail ? (
                  <p className="mt-1 text-base text-zinc-400">{line.detail}</p>
                ) : null}
              </div>
              <span className="font-mono">
                {formatAud(line.unitPrice * line.quantity)}
              </span>
            </li>
          ))
        )}
      </ul>

      <div className="mt-8 flex items-end justify-between rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
        <span className="text-xl text-zinc-400">Total</span>
        <span className="font-mono text-5xl font-semibold">
          {formatAud(state.quote?.total ?? 0)}
        </span>
      </div>
    </div>
  );
}
