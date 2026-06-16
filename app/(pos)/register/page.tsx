"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CurrentOrderSidebar } from "@/components/register/current-order-sidebar";
import { ItemModifierModal } from "@/components/register/item-modifier-modal";
import { apiFetch } from "@/lib/api";
import { formatAud } from "@/lib/format";
import { resolveItemTapFlow } from "@/lib/item-modifiers";
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

interface ModifierState {
  item: MenuItem;
  category: MenuCategory | undefined;
}

export default function RegisterPage(): React.ReactElement {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("PICKUP");
  const [modifierState, setModifierState] = useState<ModifierState | null>(
    null,
  );
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

  function addToCart(item: MenuItem, options?: { size?: string }) {
    const size = options?.size;
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

  function handleMenuItemTap(item: MenuItem) {
    const category = categoryMap.get(item.categorySlug);
    const flow = resolveItemTapFlow(item, category);

    if (flow === "modal") {
      setModifierState({ item, category });
      return;
    }

    addToCart(item);
  }

  function incrementLine(key: string) {
    setCart((current) =>
      current.map((line) =>
        line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
      ),
    );
  }

  function decrementLine(key: string) {
    setCart((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity - 1 }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((current) => current.filter((line) => line.key !== key));
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
      <section className="grid h-full min-h-0 flex-1 gap-2 md:grid-cols-[1.55fr_1fr] md:gap-3">
        <div className="flex min-h-0 flex-col rounded-2xl bg-surface-container p-2 sm:p-3">
          <div className="pos-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category.slug}
                className={cn(
                  "min-h-category-tab shrink-0 rounded-xl px-6 text-base font-bold",
                  activeCategory === category.slug
                    ? "bg-accent text-white shadow-sm shadow-accent/25"
                    : "bg-surface-container-high text-on-surface",
                )}
                type="button"
                onClick={() => setActiveCategory(category.slug)}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="pos-scrollbar grid flex-1 grid-cols-2 gap-2.5 overflow-y-auto sm:gap-3">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                className="flex min-h-item-card flex-col items-center justify-center rounded-2xl bg-surface px-3 py-4 text-center transition active:scale-[0.98] active:bg-surface-container-high"
                type="button"
                onClick={() => handleMenuItemTap(item)}
              >
                <p className="text-pos-item leading-snug">{item.name}</p>
                <p className="mt-2 text-pos-price text-accent">
                  {formatAud(getDisplayPrice(item))}
                </p>
              </button>
            ))}
          </div>
        </div>

        <CurrentOrderSidebar
          cart={cart}
          fulfillmentType={fulfillmentType}
          lastTicket={lastTicket}
          payError={payError}
          paying={paying}
          quote={quote}
          onClear={clearCart}
          onDecrement={decrementLine}
          onFulfillmentChange={setFulfillmentType}
          onIncrement={incrementLine}
          onPayCash={() => void submitOrder("cash")}
          onPayStripe={() => void submitOrder("card")}
          onRemove={removeLine}
        />
      </section>

      {modifierState ? (
        <ItemModifierModal
          category={modifierState.category}
          item={modifierState.item}
          open={Boolean(modifierState)}
          onAdd={(options) => addToCart(modifierState.item, options)}
          onClose={() => setModifierState(null)}
        />
      ) : null}
    </>
  );
}
