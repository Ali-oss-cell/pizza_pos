export interface CrustOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface ToppingOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface ToppingCategory {
  id: string;
  label: string;
  toppings: ToppingOption[];
}

export interface ToppingCategoryGroup {
  id: string;
  label: string;
  toppings: Array<{
    id: string;
    slug: string;
    label: string;
    priceDelta: string | number;
    isActive: boolean;
  }>;
}

export interface ApiCrustOption {
  id: string;
  slug: string;
  label: string;
  priceDelta: string | number;
  /** Optional surcharge override per menu category slug. */
  categoryPriceDeltas?: Record<string, number> | null;
  sortOrder: number;
  isActive: boolean;
}
