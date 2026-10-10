export type ComboSlotSourceType = "CATEGORY" | "ITEM";

export interface ComboDealSlot {
  id: string;
  label: string;
  sortOrder: number;
  quantity: number;
  sourceType: ComboSlotSourceType;
  categorySlug: string | null;
  menuItemId: string | null;
  allowedSizes: string[] | null;
  allowModifiers: boolean;
  menuItem?: {
    id: string;
    name: string;
    slug: string;
    categorySlug: string;
    price: string | number;
    imageUrl: string;
    isActive: boolean;
  } | null;
}

export interface ComboDeal {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  bundlePrice: string | number;
  sortOrder: number;
  isActive: boolean;
  slots: ComboDealSlot[];
}

export interface ComboSelection {
  slotId: string;
  menuItemId: string;
  name: string;
  size?: string;
  crust?: string;
  toppingIds: string[];
  removedIngredients: string[];
}
