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
  if (item.ingredients.length > 0) {
    return item.ingredients;
  }

  return item.description
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
