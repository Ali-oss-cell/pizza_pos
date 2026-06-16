"use client";

import { CreditCard, HandCoins, Minus, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SizePickerDialog } from "@/components/register/size-picker-dialog";
import { apiFetch } from "@/lib/api";
import { formatAud } from "@/lib/format";
import {
  buildCartLineKey,
  fetchMenuCategories,
  fetchMenuItems,
  getDisplayPrice,
} from "@/lib/menu";
import { cn } from "@/lib/utils";
import type { CartLine, FulfillmentType, QuoteResult } from "@/types/cart";
import type { MenuCategory, MenuItem } from "@/types/menu";

interface PosOrder {
  id: string;
  ticketNumber: number | null;
  total: string | number;
}

export default function RegisterPage(): React.ReactElement {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("PICKUP");
  const [sizePickerItem, setSizePickerItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [lastTicket, setLastTicket] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([fetchMenuCategories(), fetchMenuItems()])
      .then(([nextCategories, nextItems]) => {
        const activeCategories = nextCategories
          .filter((category) => category.isActive)
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
          );

        setCategories(activeCategories);
        setItems(nextItems.filter((item) => item.isActive));
        setActiveCategory(activeCategories[0]?.slug ?? "");
        setLoadError(null);
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Could not load menu",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.slug, category])),
    [categories],
  );

  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => item.categorySlug === activeCategory)
        .sort((a, b) => a.number - b.number),
    [items, activeCategory],
  );

  const refreshQuote = useCallback(async (lines: CartLine[]) => {
    if (lines.length === 0) {
      setQuote(null);
      return;
    }

    const result = await apiFetch<QuoteResult>("/pos/orders/quote", {
      method: "POST",
      body: JSON.stringify({
        items: lines.map((line) => ({
          menuItemId: line.menuItemId,
          quantity: line.quantity,
          size: line.size,
        })),
      }),
    });

    setQuote(result);
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshQuote(cart).catch((error: unknown) => {
        setPayError(
          error instanceof Error ? error.message : "Could not price order",
        );
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [cart, refreshQuote]);

  function addToCart(item: MenuItem, size?: string) {
    const key = buildCartLineKey(item.id, size);
    const unitPrice = getDisplayPrice(item, size);

    setCart((current) => {
      const existing = current.find((line) => line.key === key);

      if (existing) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }

      return [
        ...current,
        {
          key,
          menuItemId: item.id,
          name: size ? `${item.name} (${size})` : item.name,
          quantity: 1,
          size,
          unitPrice,
        },
      ];
    });
    setPayError(null);
  }

  function handleItemClick(item: MenuItem) {
    const category = categoryMap.get(item.categorySlug);

    if (category?.supportsSizeOptions && item.sizeOptions) {
      setSizePickerItem(item);
      return;
    }

    addToCart(item);
  }

  function updateQuantity(key: string, delta: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + delta }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function clearCart() {
    setCart([]);
    setQuote(null);
    setPayError(null);
  }

  async function submitOrder(payment: "cash" | "card") {
    if (cart.length === 0 || !quote) {
      return;
    }

    setPaying(true);
    setPayError(null);

    try {
      const order = await apiFetch<PosOrder>("/pos/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            size: line.size,
          })),
          fulfillmentType,
        }),
      });

      if (payment === "cash") {
        await apiFetch("/pos/payments/cash", {
          method: "POST",
          body: JSON.stringify({ orderId: order.id }),
        });
      } else {
        await apiFetch("/pos/payments/card", {
          method: "POST",
          body: JSON.stringify({ orderId: order.id }),
        });
      }

      setLastTicket(order.ticketNumber);
      clearCart();
    } catch (error: unknown) {
      setPayError(
        error instanceof Error ? error.message : "Payment failed",
      );
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-outline">
        Loading menu…
      </div>
    );
  }

  if (loadError) {
    return <p className="text-red-300">{loadError}</p>;
  }

  return (
    <>
      <section className="grid min-h-[70vh] gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl bg-surface-container p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.slug}
                className={cn(
                  "min-h-touch rounded-lg px-5 py-3 font-medium",
                  activeCategory === category.slug
                    ? "bg-accent text-white"
                    : "bg-surface-container-high",
                )}
                type="button"
                onClick={() => setActiveCategory(category.slug)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                className="min-h-[96px] rounded-xl bg-surface px-4 py-4 text-left transition hover:bg-surface-container-high"
                type="button"
                onClick={() => handleItemClick(item)}
              >
                <p className="text-sm text-outline">#{item.number}</p>
                <p className="mt-1 text-lg font-semibold">{item.name}</p>
                <p className="mt-1 text-sm text-outline">
                  {formatAud(getDisplayPrice(item))}
                </p>
              </button>
            ))}
          </div>
        </div>

        <aside className="flex flex-col rounded-2xl bg-surface-container p-4">
          <h2 className="text-xl font-semibold">Current order</h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["PICKUP", "DINE_IN", "COUNTER"] as const).map((type) => (
              <button
                key={type}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  fulfillmentType === type
                    ? "bg-accent text-white"
                    : "bg-surface",
                )}
                type="button"
                onClick={() => setFulfillmentType(type)}
              >
                {type.replace("_", " ")}
              </button>
            ))}
          </div>

          {lastTicket ? (
            <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-green-200">
              Last ticket #{lastTicket} paid
            </p>
          ) : null}

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-xl bg-surface p-4">
            {cart.length === 0 ? (
              <p className="text-sm text-outline">
                Tap menu items to add them here.
              </p>
            ) : (
              cart.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-2 border-b border-white/5 pb-2"
                >
                  <div>
                    <p className="font-medium">{line.name}</p>
                    <p className="text-sm text-outline">
                      {formatAud(line.unitPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="min-h-touch min-w-touch rounded-lg bg-surface-container-high"
                      type="button"
                      onClick={() => updateQuantity(line.key, -1)}
                    >
                      <Minus className="mx-auto h-4 w-4" />
                    </button>
                    <span className="w-6 text-center">{line.quantity}</span>
                    <button
                      className="min-h-touch min-w-touch rounded-lg bg-surface-container-high"
                      type="button"
                      onClick={() => updateQuantity(line.key, 1)}
                    >
                      <Plus className="mx-auto h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatAud(quote?.total ?? 0)}</span>
            </div>

            {payError ? (
              <p className="mt-2 text-sm text-red-300">{payError}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-3 font-semibold disabled:opacity-50"
                type="button"
                disabled={paying || cart.length === 0}
                onClick={() => void submitOrder("cash")}
              >
                <HandCoins className="h-5 w-5" />
                Cash
              </button>
              <button
                className="min-h-touch inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50"
                type="button"
                disabled={paying || cart.length === 0}
                onClick={() => void submitOrder("card")}
              >
                <CreditCard className="h-5 w-5" />
                Card
              </button>
              <button
                className="min-h-touch col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/40 px-4 py-3 font-medium text-red-200"
                type="button"
                disabled={cart.length === 0}
                onClick={clearCart}
              >
                <Trash2 className="h-5 w-5" />
                Clear
              </button>
            </div>
          </div>
        </aside>
      </section>

      {sizePickerItem ? (
        <SizePickerDialog
          item={sizePickerItem}
          open={Boolean(sizePickerItem)}
          onClose={() => setSizePickerItem(null)}
          onSelect={(size) => addToCart(sizePickerItem, size)}
        />
      ) : null}
    </>
  );
}
