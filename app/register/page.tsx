"use client";

import { CreditCard, HandCoins, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function RegisterPage(): React.ReactElement {
  const [cartLines] = useState<string[]>([]);

  return (
    <section className="grid min-h-[70vh] gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-2xl bg-surface-container p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {["Pizza", "Pasta", "Sides", "Drinks"].map((category) => (
            <button
              key={category}
              className="min-h-touch rounded-lg bg-surface-container-high px-5 py-3 font-medium"
              type="button"
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <button
              key={index}
              className="min-h-[96px] rounded-xl border border-dashed border-white/15 bg-surface px-4 py-6 text-left"
              type="button"
            >
              <p className="text-sm text-outline">Menu item</p>
              <p className="mt-1 text-lg font-semibold">Coming soon</p>
            </button>
          ))}
        </div>
      </div>

      <aside className="flex flex-col rounded-2xl bg-surface-container p-4">
        <h2 className="text-xl font-semibold">Current order</h2>
        <p className="mt-1 text-sm text-outline">Ticket # — · Pickup</p>

        <div className="mt-4 flex-1 space-y-2 rounded-xl bg-surface p-4">
          {cartLines.length === 0 ? (
            <p className="text-sm text-outline">Add items from the menu grid.</p>
          ) : null}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Total</span>
            <span>$0.00</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-3 font-semibold"
              type="button"
            >
              <HandCoins className="h-5 w-5" />
              Cash
            </button>
            <button
              className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-white"
              type="button"
            >
              <CreditCard className="h-5 w-5" />
              Card
            </button>
            <button
              className={cn(
                "min-h-touch rounded-xl border border-white/10 px-4 py-3 font-medium",
              )}
              type="button"
            >
              Hold
            </button>
            <button
              className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/40 px-4 py-3 font-medium text-red-200"
              type="button"
            >
              <Trash2 className="h-5 w-5" />
              Clear
            </button>
          </div>
        </div>
      </aside>
    </section>
  );
}
