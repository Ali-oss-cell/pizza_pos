import { apiFetch } from "@/lib/api";
import type { MenuCategory, MenuItem, SizeOptions } from "@/types/menu";

export function fetchMenuCategories(): Promise<MenuCategory[]> {
  return apiFetch<MenuCategory[]>("/menu/categories");
}

export function fetchMenuItems(): Promise<MenuItem[]> {
  return apiFetch<MenuItem[]>("/menu");
}

export function getDisplayPrice(item: MenuItem, size?: string): number {
  const options = normalizeSizeOptions(item.sizeOptions);

  if (size && options) {
    const key = normalizeSizeKey(size);
    const option = options[key];

    if (option?.enabled) {
      return option.price;
    }
  }

  if (options) {
    const enabled = [options.small, options.large, options.family].find(
      (option) => option?.enabled,
    );

    if (enabled) {
      return enabled.price;
    }
  }

  return Number(item.price);
}

/** Accept legacy UPPERCASE keys from bad imports (SMALL/LARGE/FAMILY). */
function normalizeSizeOptions(
  value: SizeOptions | null | undefined,
): SizeOptions | null {
  if (!value) {
    return null;
  }
  const raw = value as SizeOptions & Record<string, { enabled?: boolean; price?: number }>;
  const small = raw.small ?? raw.SMALL;
  const large = raw.large ?? raw.LARGE;
  const family = raw.family ?? raw.FAMILY;
  if (!small && !large && !family) {
    return value;
  }
  return {
    small: {
      enabled: small?.enabled ?? true,
      price: Number(small?.price ?? 0),
    },
    large: {
      enabled: large?.enabled ?? true,
      price: Number(large?.price ?? 0),
    },
    family: {
      enabled: family?.enabled ?? true,
      price: Number(family?.price ?? 0),
    },
  };
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
