"use client";

import { HandCoins, Minus, Plus, Trash2 } from "lucide-react";
import { formatAud } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartLine, FulfillmentType, QuoteResult } from "@/types/cart";

const FULFILLMENT_OPTIONS: Array<{
  value: FulfillmentType;
  label: string;
  activeClass: string;
}> = [
  {
    value: "PICKUP",
    label: "PICKUP",
    activeClass: "bg-accent text-white shadow-md shadow-accent/40 ring-2 ring-white/20",
  },
  {
    value: "DINE_IN",
    label: "DINE IN",
    activeClass: "bg-blue-500 text-white shadow-md shadow-blue-500/40 ring-2 ring-white/20",
  },
  {
    value: "COUNTER",
    label: "COUNTER",
    activeClass: "bg-emerald-500 text-white shadow-md shadow-emerald-500/40 ring-2 ring-white/20",
  },
];

interface CurrentOrderSidebarProps {
  cart: CartLine[];
  quote: QuoteResult | null;
  fulfillmentType: FulfillmentType;
  lastTicket: number | null;
  payError: string | null;
  paying: boolean;
  onFulfillmentChange: (type: FulfillmentType) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onPayStripe: () => void;
  onPayCash: () => void;
}

export function CurrentOrderSidebar({
  cart,
  quote,
  fulfillmentType,
  lastTicket,
  payError,
  paying,
  onFulfillmentChange,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onPayStripe,
  onPayCash,
}: CurrentOrderSidebarProps): React.ReactElement {
  const total = quote?.total ?? 0;
  const canPay = cart.length > 0 && quote !== null && !paying;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-surface-container">
      <div className="shrink-0 p-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Current order</h2>
          {cart.length > 0 ? (
            <button
              className="text-xs font-semibold text-outline underline-offset-2 hover:text-red-200 hover:underline"
              type="button"
              onClick={onClear}
            >
              Clear all
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {FULFILLMENT_OPTIONS.map((option) => {
            const active = fulfillmentType === option.value;

            return (
              <button
                key={option.value}
                className={cn(
                  "min-h-touch-lg rounded-xl px-2 text-xs font-bold tracking-wide sm:text-sm",
                  active
                    ? option.activeClass
                    : "bg-surface text-on-surface/80",
                )}
                type="button"
                onClick={() => onFulfillmentChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {lastTicket ? (
          <p className="mt-2 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-green-200">
            Last ticket #{lastTicket} paid
          </p>
        ) : null}
      </div>

      <div className="pos-scrollbar min-h-0 flex-1 overflow-y-auto px-3">
        <div className="space-y-3 rounded-xl bg-surface p-3">
          {cart.length === 0 ? (
            <p className="py-6 text-center text-sm font-medium text-outline">
              Tap menu items to add them here.
            </p>
          ) : (
            cart.map((line) => (
              <div
                key={line.key}
                className="border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug">{line.name}</p>
                    {line.detail ? (
                      <p className="mt-0.5 text-xs font-medium text-outline">
                        {line.detail}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-sm font-medium text-outline">
                      {formatAud(line.unitPrice)} each
                    </p>
                  </div>
                  <button
                    aria-label={`Remove ${line.name}`}
                    className="flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl text-red-300 transition active:bg-red-500/10"
                    type="button"
                    onClick={() => onRemove(line.key)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    aria-label={`Decrease ${line.name}`}
                    className="flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-xl bg-surface-container-high active:bg-surface-container"
                    type="button"
                    onClick={() => onDecrement(line.key)}
                  >
                    <Minus className="h-6 w-6" />
                  </button>
                  <span className="min-w-[2rem] text-center text-lg font-bold">
                    {line.quantity}
                  </span>
                  <button
                    aria-label={`Increase ${line.name}`}
                    className="flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-xl bg-surface-container-high active:bg-surface-container"
                    type="button"
                    onClick={() => onIncrement(line.key)}
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-surface-container p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        {payError ? (
          <p className="mb-2 text-sm font-medium text-red-300">{payError}</p>
        ) : null}

        <p className="mb-2 text-center text-sm font-semibold text-outline">
          Pay total:{" "}
          <span className="text-lg font-bold text-on-surface">
            {formatAud(total)}
          </span>
        </p>

        <button
          className="flex min-h-[3.75rem] w-full flex-col items-center justify-center rounded-2xl bg-[#635BFF] px-4 text-white shadow-lg shadow-[#635BFF]/30 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canPay}
          type="button"
          onClick={onPayStripe}
        >
          <span className="text-base font-bold tracking-tight">
            Pay with Stripe / Tap
          </span>
          <span className="mt-0.5 text-sm font-semibold text-white/90">
            {formatAud(total)}
          </span>
        </button>

        <button
          className="mt-2 flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface px-4 text-sm font-bold text-on-surface disabled:opacity-50"
          disabled={!canPay}
          type="button"
          onClick={onPayCash}
        >
          <HandCoins className="h-4 w-4" />
          Cash payment
        </button>
      </div>
    </aside>
  );
}
