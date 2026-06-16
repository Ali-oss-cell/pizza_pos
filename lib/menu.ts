import { apiFetch } from "@/lib/api";
import type { MenuCategory, MenuItem, SizeOptions } from "@/types/menu";

export function fetchMenuCategories(): Promise<MenuCategory[]> {
  return apiFetch<MenuCategory[]>("/menu/categories");
}

export function fetchMenuItems(): Promise<MenuItem[]> {
  return apiFetch<MenuItem[]>("/menu");
}

export function getDisplayPrice(item: MenuItem, size?: string): number {
  if (size && item.sizeOptions) {
    const key = normalizeSizeKey(size);
    const option = item.sizeOptions[key];

    if (option?.enabled) {
      return option.price;
    }
  }

  if (item.sizeOptions) {
    const enabled = [
      item.sizeOptions.small,
      item.sizeOptions.large,
      item.sizeOptions.family,
    ].find((option) => option.enabled);

    if (enabled) {
      return enabled.price;
    }
  }

  return Number(item.price);
}

function normalizeSizeKey(size: string): keyof SizeOptions {
  const normalized = size.toLowerCase();

  if (normalized.startsWith("s")) {
    return "small";
  }

  if (normalized.startsWith("f")) {
    return "family";
  }

  return "large";
}
