import type { MenuCategory, MenuItem } from "@/types/menu";

export type ModifierFlow = "none" | "modal";

export function resolveItemTapFlow(
  item: MenuItem,
  category: MenuCategory | undefined,
): ModifierFlow {
  if (!category) {
    return "none";
  }

  if (category.supportsSizeOptions && item.sizeOptions) {
    return "modal";
  }

  if (category.supportsExtras) {
    return "modal";
  }

  if (item.ingredients.length > 0) {
    return "modal";
  }

  return "none";
}
