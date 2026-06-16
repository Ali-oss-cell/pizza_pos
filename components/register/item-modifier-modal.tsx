"use client";

import type { MenuCategory, MenuItem } from "@/types/menu";
import { formatAud } from "@/lib/format";
import { getDisplayPrice } from "@/lib/menu";
import { cn } from "@/lib/utils";

interface ItemModifierModalProps {
  item: MenuItem;
  category: MenuCategory | undefined;
  open: boolean;
  onClose: () => void;
  onAdd: (options: { size?: string }) => void;
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
  open,
  onClose,
  onAdd,
}: ItemModifierModalProps): React.ReactElement | null {
  if (!open) {
    return null;
  }

  const showSizes = Boolean(category?.supportsSizeOptions && item.sizeOptions);
  const showExtrasPlaceholder = Boolean(category?.supportsExtras);
  const showIngredientsPlaceholder = item.ingredients.length > 0;

  const sizeOptions = SIZE_LABELS.filter(
    (entry) => item.sizeOptions?.[entry.key]?.enabled,
  );

  function handleQuickAdd() {
    onAdd({});
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface-container p-5">
        <h3 className="text-center text-xl font-bold">{item.name}</h3>
        <p className="mt-1 text-center text-sm font-medium text-outline">
          {showSizes || showExtrasPlaceholder || showIngredientsPlaceholder
            ? "Customize before adding"
            : "Add to order"}
        </p>

        {showSizes ? (
          <section className="mt-4">
            <p className="text-sm font-bold uppercase tracking-wide text-outline">
              Size
            </p>
            <div className="mt-2 space-y-2">
              {sizeOptions.map((entry) => (
                <button
                  key={entry.key}
                  className="flex min-h-touch-lg w-full items-center justify-between rounded-xl bg-surface px-5 text-base font-bold active:bg-surface-container-high"
                  type="button"
                  onClick={() => {
                    onAdd({ size: entry.label });
                    onClose();
                  }}
                >
                  <span>{entry.label}</span>
                  <span className="text-accent">
                    {formatAud(getDisplayPrice(item, entry.label))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {showExtrasPlaceholder ? (
          <section
            className={cn("mt-4 rounded-xl border border-dashed border-white/10 p-4")}
          >
            <p className="text-sm font-bold">Extra toppings</p>
            <p className="mt-1 text-sm text-outline">
              Modifier picker coming soon. Tap add below to include this item
              without extras for now.
            </p>
          </section>
        ) : null}

        {showIngredientsPlaceholder ? (
          <section
            className={cn(
              "mt-4 rounded-xl border border-dashed border-white/10 p-4",
            )}
          >
            <p className="text-sm font-bold">Remove ingredients</p>
            <p className="mt-1 text-sm text-outline">
              Ingredient removal will open here. For now, add the standard build.
            </p>
          </section>
        ) : null}

        {!showSizes ? (
          <button
            className="mt-4 flex min-h-touch-lg w-full items-center justify-center rounded-xl bg-accent px-4 text-base font-bold text-white"
            type="button"
            onClick={handleQuickAdd}
          >
            Add to order · {formatAud(getDisplayPrice(item))}
          </button>
        ) : null}

        <button
          className="mt-3 min-h-touch w-full rounded-xl border border-white/10 px-4 text-sm font-semibold text-outline"
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
