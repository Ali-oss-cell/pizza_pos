"use client";

import { useEffect, useMemo, useState } from "react";
import { comboBundlePrice } from "@/lib/combo-deals";
import type { ComboCartAddPayload } from "@/lib/cart-lines";
import type { ComboDeal, ComboSelection } from "@/types/combo-deals";
import type { MenuItem } from "@/types/menu";
import { getDisplayPrice } from "@/lib/menu";

interface PickStep {
  slotId: string;
  label: string;
  allowedSizes: string[];
  allowModifiers: boolean;
  sourceType: "CATEGORY" | "ITEM";
  categorySlug: string | null;
  fixedMenuItemId: string | null;
}

interface ComboConfiguratorModalProps {
  deal: ComboDeal;
  menuItems: MenuItem[];
  open: boolean;
  onClose: () => void;
  onAdd: (payload: ComboCartAddPayload) => void;
}

function expandSteps(deal: ComboDeal): PickStep[] {
  const steps: PickStep[] = [];
  const slots = [...deal.slots].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const slot of slots) {
    const sizes = Array.isArray(slot.allowedSizes)
      ? slot.allowedSizes.map(String)
      : [];
    for (let i = 0; i < slot.quantity; i += 1) {
      steps.push({
        slotId: slot.id,
        label:
          slot.quantity > 1 ? `${slot.label} (${i + 1}/${slot.quantity})` : slot.label,
        allowedSizes: sizes,
        allowModifiers: slot.allowModifiers,
        sourceType: slot.sourceType,
        categorySlug: slot.categorySlug,
        fixedMenuItemId: slot.menuItemId,
      });
    }
  }
  return steps;
}

export function ComboConfiguratorModal({
  deal,
  menuItems,
  open,
  onClose,
  onAdd,
}: ComboConfiguratorModalProps): React.ReactElement | null {
  const steps = useMemo(() => expandSteps(deal), [deal]);
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState<ComboSelection[]>([]);
  const [pickedItemId, setPickedItemId] = useState<string | null>(null);
  const [pickedSize, setPickedSize] = useState<string | undefined>();

  if (!open) return null;

  const step = steps[stepIndex];
  const price = comboBundlePrice(deal);

  const eligibleItems = useMemo(() => {
    if (!step) return [];
    return menuItems.filter((item) => {
      if (!item.isActive) return false;
      if (step.sourceType === "ITEM") {
        return item.id === step.fixedMenuItemId;
      }
      return item.categorySlug === step.categorySlug;
    });
  }, [menuItems, step]);

  const activeItem = eligibleItems.find((item) => item.id === pickedItemId);

  useEffect(() => {
    if (!open || !step) return;
    if (step.sourceType === "ITEM" && step.fixedMenuItemId) {
      setPickedItemId(step.fixedMenuItemId);
      return;
    }
    if (eligibleItems.length === 1) {
      setPickedItemId(eligibleItems[0].id);
    }
  }, [open, stepIndex, step?.slotId, step?.fixedMenuItemId, step?.sourceType, eligibleItems.length]);

  function resetPick(): void {
    setPickedItemId(null);
    setPickedSize(undefined);
  }

  function confirmStep(): void {
    if (!step || !activeItem) return;
    if (step.allowedSizes.length > 0 && !pickedSize) return;

    const next: ComboSelection = {
      slotId: step.slotId,
      menuItemId: activeItem.id,
      name: activeItem.name,
      size: pickedSize,
      toppingIds: [],
      removedIngredients: [],
    };
    const nextSelections = [...selections, next];

    if (stepIndex + 1 >= steps.length) {
      const detail = nextSelections
        .map((s) => (s.size ? `${s.name} (${s.size})` : s.name))
        .join(" · ");
      onAdd({
        comboDealId: deal.id,
        name: deal.name,
        unitPrice: price,
        selections: nextSelections,
        detail,
      });
      setSelections([]);
      setStepIndex(0);
      resetPick();
      onClose();
      return;
    }

    setSelections(nextSelections);
    setStepIndex(stepIndex + 1);
    resetPick();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/75 p-3 backdrop-blur-sm sm:items-center">
      <div className="glass-panel flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">{deal.name}</h2>
            <p className="text-sm text-rose-300">${price.toFixed(2)} bundle</p>
            <p className="mt-1 text-xs text-zinc-400">
              Step {stepIndex + 1} of {steps.length}: {step?.label}
            </p>
          </div>
          <button
            className="text-sm text-zinc-400"
            type="button"
            onClick={() => {
              setSelections([]);
              setStepIndex(0);
              resetPick();
              onClose();
            }}
          >
            Close
          </button>
        </div>

        <div className="pos-scrollbar mt-3 flex-1 space-y-2 overflow-y-auto">
          {eligibleItems.map((item) => {
            const selected = (pickedItemId ?? activeItem?.id) === item.id;
            return (
              <button
                key={item.id}
                className={`w-full rounded-xl border px-3 py-3 text-left ${
                  selected
                    ? "border-rose-400/60 bg-rose-500/15"
                    : "border-white/10 bg-white/5"
                }`}
                type="button"
                onClick={() => setPickedItemId(item.id)}
              >
                <span className="font-semibold text-zinc-100">{item.name}</span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  list ${getDisplayPrice(item).toFixed(2)}
                </span>
              </button>
            );
          })}
          {eligibleItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No matching menu items for this slot.
            </p>
          ) : null}
        </div>

        {step.allowedSizes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {step.allowedSizes.map((size) => (
              <button
                key={size}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${
                  pickedSize === size
                    ? "bg-rose-500 text-white"
                    : "bg-white/10 text-zinc-300"
                }`}
                type="button"
                onClick={() => setPickedSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          {stepIndex > 0 ? (
            <button
              className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-zinc-300"
              type="button"
              onClick={() => {
                setSelections((prev) => prev.slice(0, -1));
                setStepIndex((i) => Math.max(0, i - 1));
                resetPick();
              }}
            >
              Back
            </button>
          ) : null}
          <button
            className="flex-[2] rounded-xl bg-pay-gradient px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            disabled={
              !activeItem ||
              (step.allowedSizes.length > 0 && !pickedSize)
            }
            type="button"
            onClick={confirmStep}
          >
            {stepIndex + 1 >= steps.length ? "Add combo" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
