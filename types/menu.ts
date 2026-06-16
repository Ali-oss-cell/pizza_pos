export interface MenuCategory {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
  supportsSizeOptions: boolean;
  supportsExtras: boolean;
  isActive: boolean;
}

export interface SizeOptionValue {
  enabled: boolean;
  price: number;
}

export interface SizeOptions {
  small: SizeOptionValue;
  large: SizeOptionValue;
  family: SizeOptionValue;
}

export interface MenuItem {
  id: string;
  slug: string;
  number: number;
  name: string;
  description: string;
  price: string | number;
  categorySlug: string;
  imageUrl: string;
  imageAlt: string;
  ingredients: string[];
  sizeOptions?: SizeOptions | null;
  sizePricing?: {
    small?: number;
    large?: number;
    family?: number;
  } | null;
  isActive: boolean;
}
