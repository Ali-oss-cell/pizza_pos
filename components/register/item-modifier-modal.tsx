"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  buildLineDetail,
  buildLineDisplayName,
  resolveDefaultIngredients,
  type CartAddPayload,
} from "@/lib/cart-lines";
import { formatAud } from "@/lib/format";
import { getDisplayPrice } from "@/lib/menu";
import { calculateUnitPrice, normalizeQuoteResult, toMoney } from "@/lib/pricing";
import { hasEnabledSizeOptions } from "@/lib/customizations";
import { cn } from "@/lib/utils";
import type { QuoteResult } from "@/types/cart";
import type { CrustOption, ToppingCategory } from "@/types/customizations";
import type { MenuCategory, MenuItem } from "@/types/menu";

interface ItemModifierModalProps {
  item: MenuItem;
  category: MenuCategory | undefined;
  crustOptions: CrustOption[];
  toppingCategories: ToppingCategory[];
  open: boolean;
  onClose: () => void;
  onAdd: (payload: CartAddPayload) => void;
}

const SIZE_LABELS: Array<{ key: "small" | "large" | "family"; label: string }> =
  [
    { key: "small", label: "Small" },
    { key: "large", label: "Large" },
    { key: "family", label: "Family" },
  ];

export function ItemModifierModal({
  item,
  category,
  crustOptions,
  toppingCategories,
  open,
  onClose,
  onAdd,
}: ItemModifierModalProps): React.ReactElement | null {
  const showSizes = Boolean(
    category?.supportsSizeOptions && hasEnabledSizeOptions(item.sizeOptions),
  );
  const showCrust = showSizes && crustOptions.length > 0;
  const showExtras = toppingCategories.length > 0;
  const canRemoveIngredients = Boolean(
    (category?.supportsSizeOptions || category?.supportsExtras) &&
      (item.ingredients?.length ?? 0) > 0,
  );
  const ingredients = useMemo(
    () => (canRemoveIngredients ? resolveDefaultIngredients(item) : []),
    [canRemoveIngredients, item],
  );
  const includedItems = useMemo(() => {
    if (canRemoveIngredients || !item.description.trim()) {
      return [];
    }
    return item.description
      .split(/[,•\n]/)
      .map((part) => part.replace(/^and\s+/i, "").replace(/\.$/, "").trim())
      .filter(Boolean);
  }, [canRemoveIngredients, item.description]);

  const defaultSize = useMemo(() => {
    const enabled = SIZE_LABELS.find(
      (entry) => item.sizeOptions?.[entry.key]?.enabled,
    );
    return enabled?.label ?? "Large";
  }, [item.sizeOptions]);

  const [size, setSize] = useState(defaultSize);
  const [crustId, setCrustId] = useState(crustOptions[0]?.id ?? "");
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(() => getDisplayPrice(item));
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const quoteRequestRef = useRef(0);

  const clientUnitPrice = useMemo(
    () =>
      calculateUnitPrice({
        item,
        size: showSizes ? size : undefined,
        crustOptions,
        crustId: showCrust && crustId ? crustId : undefined,
        toppingCategories,
        toppingIds,
      }),
    [
      item,
      size,
      crustId,
      toppingIds,
      showSizes,
      showCrust,
      crustOptions,
      toppingCategories,
    ],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setSize(defaultSize);
    setCrustId(crustOptions[0]?.id ?? "");
    setToppingIds([]);
    setRemovedIngredients([]);
    setQuantity(1);
    setUnitPrice(getDisplayPrice(item, defaultSize));
    setQuoteError(null);
  }, [open, item.id, defaultSize, crustOptions, item]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setUnitPrice(clientUnitPrice);
  }, [open, clientUnitPrice]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const requestId = quoteRequestRef.current + 1;
    quoteRequestRef.current = requestId;
    setQuoting(true);
    setQuoteError(null);

    void apiFetch<QuoteResult>("/pos/orders/quote", {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            menuItemId: item.id,
            quantity: 1,
            size: showSizes ? size : undefined,
            crust: showCrust && crustId ? crustId : undefined,
            toppingIds: toppingIds.length > 0 ? toppingIds : undefined,
            removedIngredients:
              removedIngredients.length > 0 ? removedIngredients : undefined,
          },
        ],
      }),
    })
      .then((quote) => {
        if (quoteRequestRef.current !== requestId) {
          return;
        }
        const normalized = normalizeQuoteResult(quote);
        const apiUnitPrice = toMoney(normalized.lines[0]?.unitPrice);
        setUnitPrice(apiUnitPrice > 0 ? apiUnitPrice : clientUnitPrice);
      })
      .catch((error: unknown) => {
        if (quoteRequestRef.current !== requestId) {
          return;
        }
        setUnitPrice(clientUnitPrice);
        setQuoteError(
          error instanceof Error
            ? error.message
            : "Server quote unavailable — using local price.",
        );
      })
      .finally(() => {
        if (quoteRequestRef.current === requestId) {
          setQuoting(false);
        }
      });
  }, [
    open,
    item.id,
    size,
    crustId,
    toppingIds,
    removedIngredients,
    showSizes,
    showCrust,
    item,
    clientUnitPrice,
  ]);

  if (!open) {
    return null;
  }

  const sizeOptions = SIZE_LABELS.filter(
    (entry) => item.sizeOptions?.[entry.key]?.enabled,
  );

  const selectedCrust = crustOptions.find((option) => option.id === crustId);
  const allToppings = toppingCategories.flatMap((group) => group.toppings);
  const selectedToppingLabels = allToppings
    .filter((topping) => toppingIds.includes(topping.id))
    .map((topping) => topping.label);

  function toggleTopping(id: string) {
    setToppingIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  function toggleIngredient(ingredient: string) {
    setRemovedIngredients((current) =>
      current.includes(ingredient)
        ? current.filter((entry) => entry !== ingredient)
        : [...current, ingredient],
    );
  }

  function handleAdd() {
    const payload: CartAddPayload = {
      menuItemId: item.id,
      name: buildLineDisplayName(item, {
        size: showSizes ? size : undefined,
        toppingLabels: selectedToppingLabels,
        removedIngredients,
      }),
      quantity,
      size: showSizes ? size : undefined,
      crust: showCrust && crustId ? crustId : undefined,
      crustLabel: selectedCrust?.label,
      toppingIds,
      toppingLabels: selectedToppingLabels,
      removedIngredients,
      unitPrice,
    };

    onAdd(payload);
    onClose();
  }

  const lineDetail = buildLineDetail({
    crustLabel: selectedCrust?.label,
    toppingLabels: selectedToppingLabels,
    removedIngredients,
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/75 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="glass-panel flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-zinc-950/80">
        <div className="shrink-0 border-b border-white/10 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {showSizes ? "Customize" : "Deal"}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-zinc-50">{item.name}</h3>
          {lineDetail ? (
            <p className="mt-1 text-sm text-zinc-400">{lineDetail}</p>
          ) : null}
        </div>

        <div className="pos-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {showSizes ? (
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-outline">
                Size
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {sizeOptions.map((entry) => (
                  <button
                    key={entry.key}
                    className={cn(
                      "min-h-touch-lg rounded-xl px-2 py-3 text-sm font-bold",
                      size === entry.label
                        ? "bg-accent text-white"
                        : "bg-surface text-on-surface",
                    )}
                    type="button"
                    onClick={() => setSize(entry.label)}
                  >
                    <span className="block">{entry.label}</span>
                    <span className="mt-0.5 block text-xs opacity-90">
                      {formatAud(getDisplayPrice(item, entry.label))}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {showCrust ? (
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-outline">
                Crust
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {crustOptions.map((crust) => (
                  <button
                    key={crust.id}
                    className={cn(
                      "flex min-h-touch-lg items-center justify-between rounded-xl px-4 text-sm font-bold",
                      crustId === crust.id
                        ? "bg-accent text-white"
                        : "bg-surface text-on-surface",
                    )}
                    type="button"
                    onClick={() => setCrustId(crust.id)}
                  >
                    <span>{crust.label}</span>
                    {crust.priceDelta > 0 ? (
                      <span className="text-xs">
                        +{formatAud(crust.priceDelta)}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {includedItems.length > 0 ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                What&apos;s included
              </p>
              <ul className="mt-3 space-y-2">
                {includedItems.map((line) => (
                  <li
                    key={line}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                    <span className="text-base font-medium leading-snug text-zinc-50">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {ingredients.length > 0 ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Remove ingredients
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Tap an item to leave it off.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ingredients.map((ingredient) => {
                  const isRemoved = removedIngredients.includes(ingredient);

                  return (
                    <button
                      key={ingredient}
                      className={cn(
                        "flex min-h-touch items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold",
                        isRemoved
                          ? "border-white/5 bg-white/[0.02] text-zinc-500 line-through"
                          : "border-white/10 bg-white/[0.06] text-zinc-50",
                      )}
                      type="button"
                      onClick={() => toggleIngredient(ingredient)}
                    >
                      <span className="text-left">{ingredient}</span>
                      {isRemoved ? (
                        <Plus className="h-4 w-4 shrink-0" />
                      ) : (
                        <Minus className="h-4 w-4 shrink-0 text-rose-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {showExtras ? (
            <section className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-outline">
                {showSizes ? "Extra toppings" : "Add extras"}
              </p>
              {toppingCategories.map((group) => (
                <div key={group.id}>
                  <p className="mb-2 text-sm font-bold text-on-surface/90">
                    {group.label}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.toppings.map((topping) => {
                      const active = toppingIds.includes(topping.id);

                      return (
                        <button
                          key={topping.id}
                          className={cn(
                            "flex min-h-touch-lg items-center justify-between rounded-xl px-3 text-left text-sm font-semibold",
                            active
                              ? "bg-accent/20 text-on-surface ring-2 ring-accent"
                              : "bg-surface text-on-surface",
                          )}
                          type="button"
                          onClick={() => toggleTopping(topping.id)}
                        >
                          <div>
                            <span className="block">{topping.label}</span>
                            <span className="text-xs text-outline">
                              +{formatAud(topping.priceDelta)}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-md",
                              active ? "bg-accent text-white" : "bg-surface-container-high",
                            )}
                          >
                            {active ? <Check className="h-4 w-4" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-zinc-950/50 p-4 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-400">Quantity</span>
            <div className="inline-flex items-center gap-0.5 rounded-full bg-zinc-950/70 p-0.5 ring-1 ring-white/10">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300"
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2rem] text-center font-mono text-lg font-semibold tabular-nums">
                {quantity}
              </span>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300"
                type="button"
                onClick={() => setQuantity((value) => value + 1)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button
            className="flex min-h-touch-lg w-full flex-col items-center justify-center rounded-2xl bg-pay-gradient px-4 py-3 text-white shadow-pay-glow disabled:opacity-60"
            disabled={quoting}
            type="button"
            onClick={handleAdd}
          >
            <span className="text-base font-semibold">
              Add to order · {formatAud(unitPrice * quantity)}
            </span>
            {quoting ? (
              <span className="text-xs text-white/80">Checking price…</span>
            ) : quoteError ? (
              <span className="text-xs text-white/80">{quoteError}</span>
            ) : (
              <span className="font-mono text-xs text-white/80">
                {formatAud(unitPrice)} each
              </span>
            )}
          </button>

          <button
            className="mt-2 min-h-touch w-full rounded-xl border border-white/10 text-sm font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
