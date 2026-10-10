import type { CartLine, QuoteItemInput } from "@/types/cart";
import type { ComboSelection } from "@/types/combo-deals";
import type { MenuItem } from "@/types/menu";

export interface CartAddPayload {
  menuItemId: string;
  name: string;
  quantity: number;
  size?: string;
  crust?: string;
  crustLabel?: string;
  toppingIds: string[];
  toppingLabels: string[];
  removedIngredients: string[];
  unitPrice: number;
}

export interface ComboCartAddPayload {
  comboDealId: string;
  name: string;
  unitPrice: number;
  selections: ComboSelection[];
  detail?: string;
}

export function cartLinesToQuoteItems(lines: CartLine[]): QuoteItemInput[] {
  const items: QuoteItemInput[] = [];

  for (const line of lines) {
    if (line.type === "COMBO" && line.comboDealId && line.selections) {
      for (let i = 0; i < line.quantity; i += 1) {
        items.push({
          type: "COMBO",
          comboDealId: line.comboDealId,
          selections: line.selections.map((selection) => ({
            slotId: selection.slotId,
            menuItemId: selection.menuItemId,
            size: selection.size,
            crust: selection.crust,
            toppingIds:
              selection.toppingIds.length > 0
                ? selection.toppingIds
                : undefined,
            removedIngredients:
              selection.removedIngredients.length > 0
                ? selection.removedIngredients
                : undefined,
          })),
        });
      }
      continue;
    }

    items.push({
      menuItemId: line.menuItemId,
      quantity: line.quantity,
      size: line.size,
      crust: line.crust,
      toppingIds: line.toppingIds.length > 0 ? line.toppingIds : undefined,
      removedIngredients:
        line.removedIngredients.length > 0
          ? line.removedIngredients
          : undefined,
    });
  }

  return items;
}

export function buildCartLineKey(payload: {
  menuItemId: string;
  size?: string;
  crust?: string;
  toppingIds?: string[];
  removedIngredients?: string[];
}): string {
  const toppingKey = payload.toppingIds?.length
    ? payload.toppingIds.slice().sort().join("+")
    : "";
  const removedKey = payload.removedIngredients?.length
    ? payload.removedIngredients.slice().sort().join("+")
    : "";

  return [payload.menuItemId, payload.size, payload.crust, toppingKey, removedKey]
    .filter(Boolean)
    .join(":");
}

export function buildLineDisplayName(
  item: MenuItem,
  options: {
    size?: string;
    toppingLabels?: string[];
    removedIngredients?: string[];
  },
): string {
  const parts = [item.name];

  if (options.size) {
    parts.push(`(${options.size})`);
  }

  return parts.join(" ");
}

export function buildLineDetail(options: {
  crustLabel?: string;
  toppingLabels?: string[];
  removedIngredients?: string[];
}): string | undefined {
  const parts: string[] = [];

  if (options.crustLabel) {
    parts.push(`Crust: ${options.crustLabel}`);
  }

  if (options.toppingLabels?.length) {
    parts.push(`+ ${options.toppingLabels.join(", ")}`);
  }

  if (options.removedIngredients?.length) {
    parts.push(`No: ${options.removedIngredients.join(", ")}`);
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

export function resolveDefaultIngredients(item: MenuItem): string[] {
  // Only show removable ingredients when the catalog has explicit entries.
  // Never split the description — that turns deal includes into fake toppings.
  return item.ingredients ?? [];
}
