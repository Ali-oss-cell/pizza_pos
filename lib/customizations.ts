import { apiFetch } from "@/lib/api";
import type {
  ApiCrustOption,
  CrustOption,
  ToppingCategory,
  ToppingCategoryGroup,
} from "@/types/customizations";
import type { SizeOptions } from "@/types/menu";

export function fetchToppingGroups(): Promise<ToppingCategoryGroup[]> {
  return apiFetch<ToppingCategoryGroup[]>("/customizations/toppings");
}

export function fetchCrustOptions(): Promise<ApiCrustOption[]> {
  return apiFetch<ApiCrustOption[]>("/customizations/crusts");
}

export function mapApiToppings(groups: ToppingCategoryGroup[]): ToppingCategory[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    toppings: group.toppings
      .filter((topping) => topping.isActive)
      .map((topping) => ({
        id: topping.slug,
        label: topping.label,
        priceDelta: Number(topping.priceDelta),
      })),
  }));
}

export function filterToppingsForItem(
  groups: ToppingCategoryGroup[],
  allowedToppingIds: string[],
): ToppingCategory[] {
  const mapped = mapApiToppings(groups);

  if (allowedToppingIds.length === 0) {
    return mapped.filter((group) => group.toppings.length > 0);
  }

  return mapped
    .map((group) => ({
      ...group,
      toppings: group.toppings.filter((topping) =>
        allowedToppingIds.includes(topping.id),
      ),
    }))
    .filter((group) => group.toppings.length > 0);
}

export function mapApiCrusts(crusts: ApiCrustOption[]): CrustOption[] {
  return crusts
    .filter((crust) => crust.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((crust) => ({
      id: crust.slug,
      label: crust.label,
      priceDelta: Number(crust.priceDelta),
    }));
}

export function categoryHasExtras(
  categorySlug: string,
  categories: Array<{
    slug: string;
    supportsExtras: boolean;
    supportsSizeOptions: boolean;
  }>,
): boolean {
  const category = categories.find((entry) => entry.slug === categorySlug);

  if (!category) {
    return false;
  }

  // Paid extras only when the category explicitly allows them (not every sized item).
  return category.supportsExtras;
}

export function categoryHasSizes(
  categorySlug: string,
  categories: Array<{
    slug: string;
    supportsSizeOptions: boolean;
  }>,
): boolean {
  const category = categories.find((entry) => entry.slug === categorySlug);
  return Boolean(category?.supportsSizeOptions);
}

export function hasEnabledSizeOptions(
  sizeOptions: SizeOptions | null | undefined,
): boolean {
  if (!sizeOptions) {
    return false;
  }
  const raw = sizeOptions as SizeOptions &
    Record<string, { enabled?: boolean; price?: number } | undefined>;
  const small = raw.small ?? raw.SMALL;
  const large = raw.large ?? raw.LARGE;
  const family = raw.family ?? raw.FAMILY;
  return Boolean(small?.enabled || large?.enabled || family?.enabled);
}
