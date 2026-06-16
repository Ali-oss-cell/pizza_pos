import { apiFetch } from "@/lib/api";
import type {
  ApiCrustOption,
  CrustOption,
  ToppingCategory,
  ToppingCategoryGroup,
} from "@/types/customizations";

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

  return category.supportsExtras || category.supportsSizeOptions;
}
