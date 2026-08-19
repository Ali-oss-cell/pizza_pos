"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CurrentOrderSidebar } from "@/components/register/current-order-sidebar";
import { ItemModifierModal } from "@/components/register/item-modifier-modal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
import {
  createClientRequestId,
  InventoryShortageError,
  listPendingPayments,
  submitCardPayment,
  submitCashPayment,
  type InventoryShortage,
  type PosOrderPayload,
} from "@/lib/payment-sync";
import { cn } from "@/lib/utils";
import type { CartLine, FulfillmentType, QuoteResult } from "@/types/cart";
import type {
  ApiCrustOption,
  CrustOption,
  ToppingCategory,
  ToppingCategoryGroup,
} from "@/types/customizations";
import type { MenuCategory, MenuItem } from "@/types/menu";

interface ModifierState {
  item: MenuItem;
  category: MenuCategory | undefined;
  crustOptions: CrustOption[];
  toppingCategories: ToppingCategory[];
}

interface ShortageDialogState {
  payment: "cash" | "card";
  payload: PosOrderPayload;
  shortages: InventoryShortage[];
  message: string;
}

export default function RegisterPage(): React.ReactElement {
  const { user } = useAuth();
  const canOverrideInventory =
    user?.role === "MANAGER" || user?.role === "ADMIN";

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
  const [cardPayingStripe, setCardPayingStripe] = useState(false);
  const [lastTicket, setLastTicket] = useState<number | null>(null);
  const [orderNotes, setOrderNotes] = useState("");
  const [cashEnabled, setCashEnabled] = useState(true);
  const [cardTerminalEnabled, setCardTerminalEnabled] = useState(false);
  const [cardProvider, setCardProvider] = useState<"LINKLY" | "STRIPE" | "NONE" | "CASH">("NONE");
  const [shortageDialog, setShortageDialog] =
    useState<ShortageDialogState | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      fetchMenuCategories(),
      fetchMenuItems(),
      fetchToppingGroups(),
      fetchCrustOptions(),
      apiFetch<{
        cashEnabled: boolean;
        cardTerminalEnabled: boolean;
        provider: "LINKLY" | "STRIPE" | "NONE" | "CASH";
      }>("/pos/payment-methods"),
    ])
      .then(([nextCategories, nextItems, nextToppings, nextCrusts, methods]) => {
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
        setCashEnabled(methods.cashEnabled);
        setCardTerminalEnabled(methods.cardTerminalEnabled);
        setCardProvider(methods.provider ?? "NONE");
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
    setOrderNotes("");
  }

  async function runPayment(
    payment: "cash" | "card",
    payload: PosOrderPayload,
    inventoryOverrideReason?: string,
  ) {
    setPaying(true);
    setPayError(null);
    setOverrideError(null);

    if (payment === "card" && cardProvider === "STRIPE") {
      setCardPayingStripe(true);
    }

    try {
      const order =
        payment === "cash"
          ? await submitCashPayment(payload, { inventoryOverrideReason })
          : await submitCardPayment(payload, { inventoryOverrideReason });

      setLastTicket(order.ticketNumber);
      setShortageDialog(null);
      setOverrideReason("");

      const stillPending = listPendingPayments().some(
        (entry) => entry.clientRequestId === payload.clientRequestId,
      );

      if (stillPending) {
        setPayError(
          payment === "cash"
            ? `Ticket #${order.ticketNumber ?? "?"} saved — cash payment will sync when connection is stable.`
            : `Ticket #${order.ticketNumber ?? "?"} saved — card payment will retry automatically.`,
        );
      }

      clearCart();
    } catch (error: unknown) {
      if (error instanceof InventoryShortageError) {
        setShortageDialog({
          payment,
          payload,
          shortages: error.shortages,
          message: error.message,
        });
        setPayError(error.message);
        return;
      }

      setPayError(
        error instanceof Error ? error.message : "Payment failed",
      );
    } finally {
      setPaying(false);
      setCardPayingStripe(false);
    }
  }

  async function submitOrder(payment: "cash" | "card") {
    if (cart.length === 0 || !quote) {
      return;
    }

    const payload: PosOrderPayload = {
      clientRequestId: createClientRequestId(),
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
      notes: orderNotes.trim() || undefined,
    };

    await runPayment(payment, payload);
  }

  async function confirmInventoryOverride() {
    if (!shortageDialog) {
      return;
    }

    const reason = overrideReason.trim();
    if (!reason) {
      setOverrideError("Enter a reason to override.");
      return;
    }

    await runPayment(
      shortageDialog.payment,
      shortageDialog.payload,
      reason,
    );
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
          cardTerminalEnabled={cardTerminalEnabled}
          cardProvider={cardProvider}
          orderNotes={orderNotes}
          onOrderNotesChange={setOrderNotes}
          cashEnabled={cashEnabled}
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

      {shortageDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-4 shadow-xl">
            <h2 className="text-lg font-bold text-on-surface">
              Insufficient stock
            </h2>
            <p className="mt-1 text-sm text-outline">{shortageDialog.message}</p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
              {shortageDialog.shortages.map((row) => (
                <li
                  key={row.stockItemId}
                  className="rounded-lg bg-surface-container px-3 py-2"
                >
                  <span className="font-semibold text-on-surface">
                    {row.name}
                  </span>
                  <span className="mt-0.5 block text-outline">
                    need {row.required}
                    {row.unit ? ` ${row.unit}` : ""} · on hand {row.onHand}
                    {row.unit ? ` ${row.unit}` : ""} · short {row.shortfall}
                    {row.unit ? ` ${row.unit}` : ""}
                  </span>
                </li>
              ))}
            </ul>

            {canOverrideInventory ? (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-on-surface">
                  Manager override reason
                  <textarea
                    className="mt-1 w-full rounded-lg border border-outline/30 bg-surface-container px-3 py-2 text-sm text-on-surface"
                    rows={2}
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    placeholder="Why continue with low stock?"
                  />
                </label>
                {overrideError ? (
                  <p className="text-sm text-red-400">{overrideError}</p>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold"
                    disabled={paying}
                    onClick={() => {
                      setShortageDialog(null);
                      setOverrideReason("");
                      setOverrideError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
                    disabled={paying}
                    onClick={() => void confirmInventoryOverride()}
                  >
                    {paying ? "Processing…" : "Override & continue"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-outline">
                  Ask a manager to override, or restock before paying.
                </p>
                <button
                  type="button"
                  className="mt-3 w-full rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold"
                  onClick={() => setShortageDialog(null)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Stripe Terminal "present card" overlay ── */}
      {cardPayingStripe ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex w-[min(92vw,22rem)] flex-col items-center gap-5 rounded-2xl bg-surface-container p-8 text-center shadow-2xl">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/15">
              <svg
                className="h-10 w-10 text-accent"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold text-on-surface">
                Present card to reader
              </p>
              <p className="mt-1 text-sm text-outline">
                Tap, insert, or swipe on the Stripe Terminal reader.
              </p>
            </div>
            <div className="flex gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
            </div>
            <p className="text-xs text-outline">
              Do not close this screen — payment is processing.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
