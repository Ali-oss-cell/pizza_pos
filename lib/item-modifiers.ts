import type { MenuCategory, MenuItem } from "@/types/menu";

/** Every menu item opens the full customization sheet (same as the website). */
export function resolveItemTapFlow(
  _item: MenuItem,
  _category: MenuCategory | undefined,
): "modal" {
  return "modal";
}
