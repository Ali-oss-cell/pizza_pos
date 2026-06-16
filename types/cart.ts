export interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  quantity: number;
  size?: string;
  unitPrice: number;
}

export interface QuoteLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  size?: string;
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
