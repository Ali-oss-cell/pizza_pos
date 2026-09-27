"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, HandCoins, Minus, Plus, Trash2, X } from "lucide-react";
import { formatAud } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartLine, FulfillmentType, QuoteResult } from "@/types/cart";

const FULFILLMENT_OPTIONS: Array<{
  value: FulfillmentType;
  label: string;
}> = [
  { value: "PICKUP", label: "Pickup" },
  { value: "DINE_IN", label: "Dine in" },
  { value: "COUNTER", label: "Counter" },
];

interface CurrentOrderSidebarProps {
  cart: CartLine[];
  quote: QuoteResult | null;
  fulfillmentType: FulfillmentType;
  lastTicket: number | null;
  payError: string | null;
  paying: boolean;
  recoverOrderId?: string | null;
  recoverTicket?: number | null;
  recoverTxnRef?: string | null;
  recovering?: boolean;
  onRecoverCard?: () => void;
  onDismissPayError?: () => void;
  cashEnabled: boolean;
  cardTerminalEnabled: boolean;
  cardProvider?: "LINKLY" | "STRIPE" | "NONE" | "CASH";
  linklyPaired?: boolean;
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  orderNotes: string;
  onOrderNotesChange: (notes: string) => void;
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
  recoverOrderId,
  recoverTicket,
  recoverTxnRef,
  recovering,
  onRecoverCard,
  onDismissPayError,
  cashEnabled,
  cardTerminalEnabled,
  cardProvider,
  linklyPaired = true,
  customerName,
  onCustomerNameChange,
  orderNotes,
  onOrderNotesChange,
  onFulfillmentChange,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onPayStripe,
  onPayCash,
}: CurrentOrderSidebarProps): React.ReactElement {
  const total = quote?.total ?? 0;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const canPay = cart.length > 0 && quote !== null && !paying;
  const linklyNeedsPair =
    cardProvider === "LINKLY" && cardTerminalEnabled && !linklyPaired;
  const cardReady =
    cardTerminalEnabled && (cardProvider !== "LINKLY" || linklyPaired);
  const canPayCard = canPay && cardReady;
  const canPayCash = canPay && cashEnabled;

  return (
    <aside className="glass-panel relative flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="shrink-0 space-y-3 border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">
            Current order
          </h2>
          {cart.length > 0 ? (
            <button
              className="text-xs font-medium text-zinc-400 transition hover:text-rose-300"
              type="button"
              onClick={onClear}
            >
              Clear all
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-black/30 p-1 ring-1 ring-white/10">
          {FULFILLMENT_OPTIONS.map((option) => {
            const active = fulfillmentType === option.value;

            return (
              <button
                key={option.value}
                className={cn(
                  "relative min-h-touch rounded-lg px-1 py-2 text-xs font-semibold tracking-wide",
                  active ? "text-white" : "text-zinc-400 hover:text-zinc-200",
                )}
                type="button"
                onClick={() => onFulfillmentChange(option.value)}
              >
                {active ? (
                  <motion.span
                    layoutId="pos-fulfillment-pill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-rose-500/90 to-violet-500/90 shadow-pay-glow"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                ) : null}
                <span className="relative z-10">{option.label}</span>
              </button>
            );
          })}
        </div>

        {lastTicket ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
            Last ticket #{lastTicket} paid
          </p>
        ) : null}
      </div>

      <div className="pos-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[8rem] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
            <p className="text-sm font-medium text-zinc-400">
              Tap menu items to build the order
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cart.map((line) => (
              <li
                key={line.key}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-zinc-100">
                      {line.name}
                    </p>
                    {line.detail ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                        {line.detail}
                      </p>
                    ) : null}
                    <p className="mt-1 font-mono text-xs tabular-nums text-zinc-500">
                      {formatAud(line.unitPrice)} ea
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-mono text-sm font-semibold tabular-nums text-zinc-100">
                      {formatAud(line.unitPrice * line.quantity)}
                    </p>
                    <button
                      aria-label={`Remove ${line.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                      type="button"
                      onClick={() => onRemove(line.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end">
                  <div className="inline-flex items-center gap-0.5 rounded-full bg-zinc-950/70 p-0.5 ring-1 ring-white/10">
                    <button
                      aria-label={`Decrease ${line.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition active:bg-white/10"
                      type="button"
                      onClick={() => onDecrement(line.key)}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[1.75rem] text-center font-mono text-sm font-semibold tabular-nums">
                      {line.quantity}
                    </span>
                    <button
                      aria-label={`Increase ${line.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition active:bg-white/10"
                      type="button"
                      onClick={() => onIncrement(line.key)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 space-y-3 border-t border-white/10 bg-zinc-950/40 p-4 backdrop-blur-md">
        <AnimatePresence>
          {payError ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5"
              role="status"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <p className="flex-1 text-xs leading-relaxed text-rose-100/90">
                {payError}
              </p>
              {onDismissPayError ? (
                <button
                  aria-label="Dismiss message"
                  className="rounded-md p-1 text-rose-200/70 transition hover:bg-rose-500/20 hover:text-rose-100"
                  type="button"
                  onClick={onDismissPayError}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {recoverOrderId && onRecoverCard ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-100">
              Unresolved card payment
              {recoverTicket != null ? ` · Ticket #${recoverTicket}` : ""}
            </p>
            {recoverTxnRef ? (
              <p className="mt-0.5 font-mono text-[11px] text-amber-200/70">
                TxnRef {recoverTxnRef}
              </p>
            ) : null}
            <button
              className="mt-2.5 min-h-touch w-full rounded-xl bg-amber-400 px-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              disabled={recovering || paying}
              type="button"
              onClick={onRecoverCard}
            >
              {recovering ? "Checking pinpad…" : "Recover card payment"}
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-rose-500/40 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            maxLength={60}
            placeholder="Order for… (customer name)"
            type="text"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
          />
          <textarea
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-rose-500/40 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            maxLength={200}
            placeholder="Order notes"
            rows={2}
            value={orderNotes}
            onChange={(e) => onOrderNotesChange(e.target.value)}
          />
        </div>

        <div className="flex items-end justify-between gap-3 rounded-xl bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/10">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Subtotal
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">
            {formatAud(total)}
          </p>
        </div>

        {linklyNeedsPair ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            Pinpad not paired — ask manager
          </div>
        ) : null}

        <div className="space-y-2">
          {cardTerminalEnabled ? (
            <button
              className={cn(
                "flex min-h-[3.25rem] w-full flex-col items-center justify-center rounded-2xl px-4 text-white",
                "bg-pay-gradient shadow-pay-glow transition active:scale-[0.98]",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
              )}
              disabled={!canPayCard}
              type="button"
              onClick={onPayStripe}
            >
              <span className="text-sm font-semibold tracking-tight">
                {cardProvider === "STRIPE"
                  ? "Pay with card (Stripe)"
                  : "Pay with card / EFTPOS"}
              </span>
              <span className="font-mono text-xs font-medium tabular-nums text-white/85">
                {formatAud(total)}
              </span>
            </button>
          ) : (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-center text-xs text-zinc-500">
              Card terminal disabled for this store
            </p>
          )}

          {cashEnabled ? (
            <button
              className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-40"
              disabled={!canPayCash}
              type="button"
              onClick={onPayCash}
            >
              <HandCoins className="h-4 w-4" />
              Cash payment
            </button>
          ) : (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-center text-xs text-zinc-500">
              Cash disabled for this store
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
