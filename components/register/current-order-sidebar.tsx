"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  HandCoins,
  Minus,
  Pause,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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

export type DiscountType = "PERCENT" | "AMOUNT" | "COMP" | null;

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
  customerPhone: string;
  onCustomerPhoneChange: (phone: string) => void;
  tableNumber: string;
  onTableNumberChange: (value: string) => void;
  pagerNumber: string;
  onPagerNumberChange: (value: string) => void;
  orderNotes: string;
  onOrderNotesChange: (notes: string) => void;
  discountType: DiscountType;
  discountValue: number;
  onDiscountChange: (type: DiscountType, value: number) => void;
  onRequestDiscount: () => void;
  onPark: () => void;
  onOpenRecall: () => void;
  parkedCount: number;
  onLookupPhone: () => void;
  onFulfillmentChange: (type: FulfillmentType) => void;
  onIncrement: (key: string) => void;
  onDecrement: (key: string) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onPayStripe: () => void;
  onPayCash: () => void;
  trainingMode?: boolean;
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
  customerPhone,
  onCustomerPhoneChange,
  tableNumber,
  onTableNumberChange,
  pagerNumber,
  onPagerNumberChange,
  orderNotes,
  onOrderNotesChange,
  discountType,
  discountValue,
  onDiscountChange,
  onRequestDiscount,
  onPark,
  onOpenRecall,
  parkedCount,
  onLookupPhone,
  onFulfillmentChange,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onPayStripe,
  onPayCash,
  trainingMode,
}: CurrentOrderSidebarProps): React.ReactElement {
  const total = quote?.total ?? 0;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const canPay = cart.length > 0 && quote !== null && !paying;
  const linklyNeedsPair =
    cardProvider === "LINKLY" && cardTerminalEnabled && !linklyPaired;
  const cardReady =
    cardTerminalEnabled && (cardProvider !== "LINKLY" || linklyPaired);
  const canPayCard = canPay && cardReady && !trainingMode;
  const canPayCash = canPay && cashEnabled;

  return (
    <aside className="glass-panel relative flex min-h-0 flex-col overflow-hidden rounded-2xl">
      {trainingMode ? (
        <div className="bg-amber-400 px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-950">
          Training mode — no live charges
        </div>
      ) : null}

      <div className="shrink-0 space-y-3 border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight text-zinc-50">
            Current order
          </h2>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-100"
              type="button"
              onClick={onOpenRecall}
            >
              Recall{parkedCount ? ` (${parkedCount})` : ""}
            </button>
            {cart.length > 0 ? (
              <>
                <button
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-white/5"
                  type="button"
                  onClick={onPark}
                >
                  <Pause className="h-3 w-3" /> Park
                </button>
                <button
                  className="text-xs font-medium text-zinc-400 hover:text-rose-300"
                  type="button"
                  onClick={onClear}
                >
                  Clear
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-black/30 p-1 ring-1 ring-white/10">
          {FULFILLMENT_OPTIONS.map((option) => {
            const active = fulfillmentType === option.value;
            return (
              <button
                key={option.value}
                className={cn(
                  "relative min-h-touch rounded-lg px-1 py-2 text-xs font-semibold",
                  active ? "text-white" : "text-zinc-400 hover:text-zinc-200",
                )}
                type="button"
                onClick={() => onFulfillmentChange(option.value)}
              >
                {active ? (
                  <motion.span
                    layoutId="pos-fulfillment-pill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-rose-500/90 to-violet-500/90"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                ) : null}
                <span className="relative z-10">{option.label}</span>
              </button>
            );
          })}
        </div>

        {fulfillmentType === "DINE_IN" ? (
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              placeholder="Table #"
              value={tableNumber}
              onChange={(e) => onTableNumberChange(e.target.value)}
            />
            <input
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              placeholder="Pager #"
              value={pagerNumber}
              onChange={(e) => onPagerNumberChange(e.target.value)}
            />
          </div>
        ) : null}

        {lastTicket ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
            Last ticket #{lastTicket} paid
          </p>
        ) : null}
      </div>

      <div className="pos-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {cart.length === 0 ? (
          <div className="flex h-full min-h-[8rem] items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-center text-sm text-zinc-400">
            Tap menu items to build the order
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
                    <p className="text-sm font-semibold text-zinc-100">
                      {line.name}
                    </p>
                    {line.detail ? (
                      <p className="mt-0.5 text-xs text-zinc-400">{line.detail}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {formatAud(line.unitPrice * line.quantity)}
                    </p>
                    <button
                      aria-label={`Remove ${line.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-rose-300"
                      type="button"
                      onClick={() => onRemove(line.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <div className="inline-flex items-center rounded-full bg-zinc-950/70 p-0.5 ring-1 ring-white/10">
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-full"
                      type="button"
                      onClick={() => onDecrement(line.key)}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[1.75rem] text-center font-mono text-sm font-semibold">
                      {line.quantity}
                    </span>
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-full"
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
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <p className="flex-1 text-xs text-rose-100/90">{payError}</p>
              {onDismissPayError ? (
                <button
                  aria-label="Dismiss"
                  className="rounded-md p-1 text-rose-200/70"
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
              Unresolved card
              {recoverTicket != null ? ` · #${recoverTicket}` : ""}
            </p>
            {recoverTxnRef ? (
              <p className="mt-0.5 font-mono text-[11px] text-amber-200/70">
                {recoverTxnRef}
              </p>
            ) : null}
            <button
              className="mt-2.5 min-h-touch w-full rounded-xl bg-amber-400 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              disabled={recovering || paying}
              type="button"
              onClick={onRecoverCard}
            >
              {recovering ? "Checking…" : "Recover card payment"}
            </button>
          </div>
        ) : null}

        <div className="grid gap-2">
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
            maxLength={60}
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => onCustomerNameChange(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
              maxLength={24}
              placeholder="Phone"
              value={customerPhone}
              onChange={(e) => onCustomerPhoneChange(e.target.value)}
            />
            <button
              className="rounded-xl border border-white/10 px-3 text-xs font-semibold text-zinc-300"
              type="button"
              onClick={onLookupPhone}
            >
              Recall
            </button>
          </div>
          <textarea
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
            maxLength={200}
            placeholder="Order notes"
            rows={2}
            value={orderNotes}
            onChange={(e) => onOrderNotesChange(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300"
            type="button"
            onClick={onRequestDiscount}
          >
            Discount
          </button>
          {discountType ? (
            <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs text-violet-200">
              {discountType === "COMP"
                ? "COMP"
                : discountType === "PERCENT"
                  ? `${discountValue}% off`
                  : `${formatAud(discountValue)} off`}
              <button
                className="ml-1"
                type="button"
                onClick={() => onDiscountChange(null, 0)}
              >
                ×
              </button>
            </span>
          ) : null}
        </div>

        <div className="flex items-end justify-between rounded-xl bg-white/[0.04] px-3.5 py-3 ring-1 ring-white/10">
          <div>
            <p className="text-xs uppercase tracking-wider text-zinc-500">
              {quote?.discountAmount ? "Total after discount" : "Subtotal"}
            </p>
            <p className="text-xs text-zinc-400">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
              {quote?.discountAmount
                ? ` · −${formatAud(quote.discountAmount)}`
                : ""}
            </p>
          </div>
          <p className="font-mono text-2xl font-semibold tabular-nums">
            {formatAud(total)}
          </p>
        </div>

        {linklyNeedsPair ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Pinpad not paired
          </div>
        ) : null}

        <div className="space-y-2">
          {cardTerminalEnabled ? (
            <button
              className="flex min-h-[3.25rem] w-full flex-col items-center justify-center rounded-2xl bg-pay-gradient px-4 text-white shadow-pay-glow transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
              disabled={!canPayCard}
              type="button"
              onClick={onPayStripe}
            >
              <span className="text-sm font-semibold">
                {trainingMode
                  ? "Training — card disabled"
                  : cardProvider === "STRIPE"
                    ? "Pay with card (Stripe)"
                    : "Pay with card / EFTPOS"}
              </span>
              <span className="font-mono text-xs text-white/85">
                {formatAud(total)}
              </span>
            </button>
          ) : null}

          {cashEnabled ? (
            <button
              className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold disabled:opacity-40"
              disabled={!canPayCash}
              type="button"
              onClick={onPayCash}
            >
              <HandCoins className="h-4 w-4" />
              {trainingMode ? "Record training cash" : "Cash payment"}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
