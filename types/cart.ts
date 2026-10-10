import type { ComboSelection } from "@/types/combo-deals";

export interface CartLine {
  key: string;
  type?: "ITEM" | "COMBO";
  menuItemId: string;
  comboDealId?: string;
  selections?: ComboSelection[];
  name: string;
  detail?: string;
  quantity: number;
  size?: string;
  crust?: string;
  toppingIds: string[];
  removedIngredients: string[];
  unitPrice: number;
}

export interface QuoteLine {
  type?: "ITEM" | "COMBO";
  menuItemId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  size?: string;
  crust?: string;
  toppingIds?: string[];
  removedIngredients?: string[];
  comboDealId?: string;
  isComboHeader?: boolean;
}

export interface QuoteResult {
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  lines: QuoteLine[];
}

export type FulfillmentType = "PICKUP" | "DINE_IN" | "COUNTER";

export type QuoteItemInput =
  | {
      type?: "ITEM";
      menuItemId: string;
      quantity: number;
      size?: string;
      crust?: string;
      toppingIds?: string[];
      removedIngredients?: string[];
    }
  | {
      type: "COMBO";
      comboDealId: string;
      selections: Array<{
        slotId: string;
        menuItemId: string;
        size?: string;
        crust?: string;
        toppingIds?: string[];
        removedIngredients?: string[];
      }>;
    };
