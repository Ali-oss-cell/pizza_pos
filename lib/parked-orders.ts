"use client";

import type { CartLine, FulfillmentType } from "@/types/cart";

export interface ParkedOrder {
  id: string;
  label: string;
  createdAt: string;
  locationId: string;
  cart: CartLine[];
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  orderNotes: string;
  tableNumber: string;
  pagerNumber: string;
  discountType?: "PERCENT" | "AMOUNT" | "COMP" | null;
  discountValue?: number;
  discountReason?: string;
}

const KEY = "pos_parked_orders_v1";

function readAll(): ParkedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParkedOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(orders: ParkedOrder[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(orders));
}

export function listParkedOrders(locationId: string): ParkedOrder[] {
  return readAll()
    .filter((o) => o.locationId === locationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function parkOrder(
  locationId: string,
  payload: Omit<ParkedOrder, "id" | "createdAt" | "locationId">,
): ParkedOrder {
  const entry: ParkedOrder = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    locationId,
  };
  const next = [entry, ...readAll()];
  writeAll(next);
  return entry;
}

export function removeParkedOrder(id: string): void {
  writeAll(readAll().filter((o) => o.id !== id));
}

export function getParkedOrder(id: string): ParkedOrder | null {
  return readAll().find((o) => o.id === id) ?? null;
}
