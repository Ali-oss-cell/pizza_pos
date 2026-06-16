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
  const showSizes = Boolean(category?.supportsSizeOptions && item.sizeOptions);
  const showCrust = showSizes && crustOptions.length > 0;
  const showExtras = toppingCategories.length > 0;
  const ingredients = useMemo(() => resolveDefaultIngredients(item), [item]);

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
  const quoteRequestRef = useRef(0);

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
  }, [open, item.id, defaultSize, crustOptions, item]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const requestId = quoteRequestRef.current + 1;
    quoteRequestRef.current = requestId;
    setQuoting(true);

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
        setUnitPrice(quote.lines[0]?.unitPrice ?? getDisplayPrice(item, size));
      })
      .catch(() => {
        if (quoteRequestRef.current !== requestId) {
          return;
        }
        setUnitPrice(getDisplayPrice(item, size));
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface-container">
        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <h3 className="text-lg font-bold">{item.name}</h3>
          {lineDetail ? (
            <p className="mt-1 text-sm font-medium text-outline">{lineDetail}</p>
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

          {ingredients.length > 0 ? (
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-outline">
                Remove ingredients
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ingredients.map((ingredient) => {
                  const isRemoved = removedIngredients.includes(ingredient);

                  return (
                    <button
                      key={ingredient}
                      className={cn(
                        "flex min-h-touch items-center justify-between rounded-xl px-3 text-sm font-semibold",
                        isRemoved
                          ? "bg-surface text-outline line-through"
                          : "bg-surface text-on-surface",
                      )}
                      type="button"
                      onClick={() => toggleIngredient(ingredient)}
                    >
                      <span className="text-left">{ingredient}</span>
                      {isRemoved ? (
                        <Plus className="h-4 w-4 shrink-0" />
                      ) : (
                        <Minus className="h-4 w-4 shrink-0 text-accent" />
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

        <div className="shrink-0 border-t border-white/10 bg-surface-container p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-outline">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                className="flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-xl bg-surface"
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="min-w-[2rem] text-center text-lg font-bold">
                {quantity}
              </span>
              <button
                className="flex min-h-touch-lg min-w-touch-lg items-center justify-center rounded-xl bg-surface"
                type="button"
                onClick={() => setQuantity((value) => value + 1)}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <button
            className="flex min-h-touch-lg w-full flex-col items-center justify-center rounded-2xl bg-accent px-4 py-3 text-white disabled:opacity-60"
            disabled={quoting}
            type="button"
            onClick={handleAdd}
          >
            <span className="text-base font-bold">
              Add to order · {formatAud(unitPrice * quantity)}
            </span>
            {quoting ? (
              <span className="text-xs text-white/80">Updating price…</span>
            ) : (
              <span className="text-xs text-white/80">
                {formatAud(unitPrice)} each
              </span>
            )}
          </button>

          <button
            className="mt-2 min-h-touch w-full rounded-xl border border-white/10 text-sm font-semibold text-outline"
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
