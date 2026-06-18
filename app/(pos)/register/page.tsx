"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CurrentOrderSidebar } from "@/components/register/current-order-sidebar";
import { ItemModifierModal } from "@/components/register/item-modifier-modal";
import { apiFetch } from "@/lib/api";
import {
  buildCartLineKey,
  buildLineDetail,
  type CartAddPayload,
} from "@/lib/cart-lines";
import {
  categoryHasExtras,
  fetchCrustOptions,
  fetchToppingGroups,
  filterToppingsForItem,
  mapApiCrusts,
} from "@/lib/customizations";
import { formatAud } from "@/lib/format";
import { fetchMenuCategories, fetchMenuItems, getDisplayPrice } from "@/lib/menu";
import { buildLocalQuote, normalizeQuoteResult } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { CartLine, FulfillmentType, QuoteResult } from "@/types/cart";
import type {
  ApiCrustOption,
  CrustOption,
  ToppingCategory,
  ToppingCategoryGroup,
} from "@/types/customizations";
import type { MenuCategory, MenuItem } from "@/types/menu";

interface PosOrder {
  id: string;
  ticketNumber: number | null;
  total: string | number;
}

interface ModifierState {
  item: MenuItem;
  category: MenuCategory | undefined;
  crustOptions: CrustOption[];
  toppingCategories: ToppingCategory[];
}

export default function RegisterPage(): React.ReactElement {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [toppingGroups, setToppingGroups] = useState<ToppingCategoryGroup[]>(
    [],
  );
  const [apiCrusts, setApiCrusts] = useState<ApiCrustOption[]>([]);
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
    void Promise.all([
      fetchMenuCategories(),
      fetchMenuItems(),
      fetchToppingGroups(),
      fetchCrustOptions(),
    ])
      .then(([nextCategories, nextItems, nextToppings, nextCrusts]) => {
        const activeCategories = nextCategories
          .filter((category) => category.isActive)
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
          );

        setCategories(activeCategories);
        setItems(
          nextItems
            .filter((item) => item.isActive)
            .map((item) => ({
              ...item,
              allowedToppingIds: item.allowedToppingIds ?? [],
            })),
        );
        setToppingGroups(nextToppings);
        setApiCrusts(nextCrusts);
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

  const crustOptions = useMemo(
    () => mapApiCrusts(apiCrusts),
    [apiCrusts],
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

    setQuote(buildLocalQuote(lines));

    try {
      const result = await apiFetch<QuoteResult>("/pos/orders/quote", {
        method: "POST",
        body: JSON.stringify({
          items: lines.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            size: line.size,
            crust: line.crust,
            toppingIds: line.toppingIds.length > 0 ? line.toppingIds : undefined,
            removedIngredients:
              line.removedIngredients.length > 0
                ? line.removedIngredients
                : undefined,
          })),
        }),
      });

      setQuote(normalizeQuoteResult(result));
      setPayError(null);
    } catch (error: unknown) {
      setQuote(buildLocalQuote(lines));
      setPayError(
        error instanceof Error
          ? `${error.message} (showing local total)`
          : "Server quote unavailable (showing local total)",
      );
    }
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return;
    }

    setQuote(buildLocalQuote(cart));

    const timer = window.setTimeout(() => {
      void refreshQuote(cart);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [cart, refreshQuote]);

  function openModifier(item: MenuItem) {
    const category = categories.find(
      (entry) => entry.slug === item.categorySlug,
    );
    const showSize = Boolean(category?.supportsSizeOptions && item.sizeOptions);
    const showExtras = categoryHasExtras(item.categorySlug, categories);

    setModifierState({
      item,
      category,
      crustOptions: showSize ? crustOptions : [],
      toppingCategories: showExtras
        ? filterToppingsForItem(toppingGroups, item.allowedToppingIds ?? [])
        : [],
    });
  }

  function addToCart(payload: CartAddPayload) {
    const key = buildCartLineKey({
      menuItemId: payload.menuItemId,
      size: payload.size,
      crust: payload.crust,
      toppingIds: payload.toppingIds,
      removedIngredients: payload.removedIngredients,
    });

    const detail = buildLineDetail({
      crustLabel: payload.crustLabel,
      toppingLabels: payload.toppingLabels,
      removedIngredients: payload.removedIngredients,
    });

    setCart((current) => {
      const existing = current.find((line) => line.key === key);

      if (existing) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + payload.quantity }
            : line,
        );
      }

      return [
        ...current,
        {
          key,
          menuItemId: payload.menuItemId,
          name: payload.name,
          detail,
          quantity: payload.quantity,
          size: payload.size,
          crust: payload.crust,
          toppingIds: payload.toppingIds,
          removedIngredients: payload.removedIngredients,
          unitPrice: payload.unitPrice,
        },
      ];
    });
    setPayError(null);
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
            crust: line.crust,
            toppingIds: line.toppingIds.length > 0 ? line.toppingIds : undefined,
            removedIngredients:
              line.removedIngredients.length > 0
                ? line.removedIngredients
                : undefined,
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
      <section className="grid h-full min-h-0 flex-1 gap-2 md:grid-cols-[1.65fr_1fr] md:gap-2">
        <div className="flex min-h-0 flex-col rounded-xl bg-surface-container p-2">
          <div className="pos-scrollbar mb-2 flex gap-1.5 overflow-x-auto pb-1 sm:gap-2">
            {categories.map((category) => (
              <button
                key={category.slug}
                className={cn(
                  "min-h-category-tab shrink-0 rounded-lg px-3 py-2 text-sm font-bold sm:px-5",
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

          <div className="pos-scrollbar grid flex-1 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 sm:gap-2.5">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                className="flex min-h-item-card flex-col items-center justify-center rounded-xl bg-surface px-2 py-3 text-center transition active:scale-[0.98] active:bg-surface-container-high"
                type="button"
                onClick={() => openModifier(item)}
              >
                <p className="text-pos-item leading-snug">{item.name}</p>
                <p className="mt-1 text-pos-price text-accent">
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
          crustOptions={modifierState.crustOptions}
          category={modifierState.category}
          item={modifierState.item}
          open={Boolean(modifierState)}
          toppingCategories={modifierState.toppingCategories}
          onAdd={addToCart}
          onClose={() => setModifierState(null)}
        />
      ) : null}
    </>
  );
}
