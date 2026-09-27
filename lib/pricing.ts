import { getDisplayPrice } from "@/lib/menu";
import type { CrustOption, ToppingCategory } from "@/types/customizations";
import type { CartLine, QuoteLine, QuoteResult } from "@/types/cart";
import type { MenuItem } from "@/types/menu";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toMoney(value: number | string | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value ?? 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateUnitPrice(options: {
  item: MenuItem;
  size?: string;
  crustOptions: CrustOption[];
  crustId?: string;
  toppingCategories: ToppingCategory[];
  toppingIds: string[];
}): number {
  let price = getDisplayPrice(options.item, options.size);

  if (options.crustId) {
    const crust = options.crustOptions.find(
      (entry) => entry.id === options.crustId,
    );
    price += crust?.priceDelta ?? 0;
  }

  const toppings = options.toppingCategories.flatMap((group) => group.toppings);

  for (const toppingId of options.toppingIds) {
    const topping = toppings.find((entry) => entry.id === toppingId);
    price += topping?.priceDelta ?? 0;
  }

  return roundMoney(price);
}

export function buildLocalQuote(
  lines: CartLine[],
  discount?: {
    type: "PERCENT" | "AMOUNT" | "COMP";
    value?: number;
  },
): QuoteResult {
  const quoteLines: QuoteLine[] = lines.map((line) => {
    const unitPrice = toMoney(line.unitPrice);
    const quantity = line.quantity;

    return {
      menuItemId: line.menuItemId,
      name: line.name,
      quantity,
      unitPrice,
      lineTotal: roundMoney(unitPrice * quantity),
      size: line.size,
      crust: line.crust,
      toppingIds: line.toppingIds,
      removedIngredients: line.removedIngredients,
    };
  });

  const subtotal = roundMoney(
    quoteLines.reduce((sum, line) => sum + line.lineTotal, 0),
  );

  let discountAmount = 0;
  if (discount?.type === "COMP") {
    discountAmount = subtotal;
  } else if (discount?.type === "PERCENT") {
    discountAmount = roundMoney((subtotal * (discount.value ?? 0)) / 100);
  } else if (discount?.type === "AMOUNT") {
    discountAmount = roundMoney(Math.min(subtotal, discount.value ?? 0));
  }

  return {
    subtotal,
    deliveryFee: 0,
    discountAmount,
    taxAmount: 0,
    total: roundMoney(Math.max(0, subtotal - discountAmount)),
    lines: quoteLines,
  };
}

export function normalizeQuoteResult(quote: QuoteResult): QuoteResult {
  const lines = quote.lines.map((line) => {
    const unitPrice = toMoney(line.unitPrice);
    const quantity = line.quantity;

    return {
      ...line,
      unitPrice,
      lineTotal: roundMoney(unitPrice * quantity),
    };
  });

  const subtotal = roundMoney(toMoney(quote.subtotal));
  const deliveryFee = roundMoney(toMoney(quote.deliveryFee));
  const discountAmount = roundMoney(toMoney(quote.discountAmount));
  const taxAmount = roundMoney(toMoney(quote.taxAmount));
  const total = roundMoney(toMoney(quote.total));

  return {
    subtotal,
    deliveryFee,
    discountAmount,
    taxAmount,
    total,
    lines,
  };
}
