import { ApiError, apiFetch } from "@/lib/api";
import type { FulfillmentType } from "@/types/cart";

const QUEUE_KEY = "pos_pending_payments";
export const PENDING_PAYMENTS_CHANGED_EVENT = "pos-pending-payments-changed";
const MAX_ATTEMPTS = 5;
const RETRY_MS = [0, 1500, 3000, 5000, 8000];

export interface InventoryShortage {
  stockItemId: string;
  name: string;
  unit?: string;
  required: string;
  onHand: string;
  shortfall: string;
}

export class InventoryShortageError extends Error {
  readonly code = "INVENTORY_SHORTAGE";

  constructor(
    message: string,
    readonly shortages: InventoryShortage[],
    readonly orderId?: string,
  ) {
    super(message);
    this.name = "InventoryShortageError";
  }
}

function throwIfInventoryShortage(error: unknown, orderId?: string): never {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    error.body &&
    typeof error.body === "object" &&
    (error.body as { code?: string }).code === "INVENTORY_SHORTAGE"
  ) {
    const shortages = Array.isArray(
      (error.body as { shortages?: InventoryShortage[] }).shortages,
    )
      ? ((error.body as { shortages: InventoryShortage[] }).shortages ?? [])
      : [];
    throw new InventoryShortageError(error.message, shortages, orderId);
  }
  throw error instanceof Error ? error : new Error(String(error));
}

export interface PosOrderPayload {
  clientRequestId: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    size?: string;
    crust?: string;
    toppingIds?: string[];
    removedIngredients?: string[];
  }>;
  fulfillmentType: FulfillmentType;
}

export interface PosOrderResult {
  id: string;
  ticketNumber: number | null;
  paymentStatus: string;
}

export interface PendingPayment {
  clientRequestId: string;
  payment: "cash" | "card";
  orderId?: string;
  ticketNumber?: number | null;
  payload: PosOrderPayload;
  createdAt: string;
  lastError?: string;
}

function readQueue(): PendingPayment[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(QUEUE_KEY);

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as PendingPayment[];
  } catch {
    return [];
  }
}

function writeQueue(entries: PendingPayment[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PENDING_PAYMENTS_CHANGED_EVENT));
  }
}

export function listPendingPayments(): PendingPayment[] {
  return readQueue();
}

export function upsertPending(entry: PendingPayment): void {
  const queue = readQueue().filter(
    (item) => item.clientRequestId !== entry.clientRequestId,
  );
  writeQueue([...queue, entry]);
}

export function removePending(clientRequestId: string): void {
  writeQueue(
    readQueue().filter((item) => item.clientRequestId !== clientRequestId),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function createPosOrder(payload: PosOrderPayload): Promise<PosOrderResult> {
  return apiFetch<PosOrderResult>("/pos/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function markCashPaid(
  orderId: string,
  inventoryOverrideReason?: string,
): Promise<void> {
  try {
    await apiFetch("/pos/payments/cash", {
      method: "POST",
      body: JSON.stringify({
        orderId,
        ...(inventoryOverrideReason
          ? { inventoryOverrideReason }
          : {}),
      }),
    });
  } catch (error: unknown) {
    throwIfInventoryShortage(error, orderId);
  }
}

async function startCardPayment(
  orderId: string,
  inventoryOverrideReason?: string,
): Promise<PosOrderResult> {
  try {
    return await apiFetch<PosOrderResult>("/pos/payments/card", {
      method: "POST",
      body: JSON.stringify({
        orderId,
        ...(inventoryOverrideReason
          ? { inventoryOverrideReason }
          : {}),
      }),
    });
  } catch (error: unknown) {
    throwIfInventoryShortage(error, orderId);
  }
}

export async function submitCashPayment(
  payload: PosOrderPayload,
  options?: { inventoryOverrideReason?: string },
): Promise<PosOrderResult> {
  const pending: PendingPayment = {
    clientRequestId: payload.clientRequestId,
    payment: "cash",
    payload,
    createdAt: new Date().toISOString(),
  };

  upsertPending(pending);

  let order: PosOrderResult | null = null;
  let lastError = "Payment failed";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(RETRY_MS[attempt] ?? 8000);
    }

    try {
      if (!order) {
        order = await createPosOrder(payload);
        pending.orderId = order.id;
        pending.ticketNumber = order.ticketNumber;
        upsertPending(pending);
      }

      if (order.paymentStatus !== "PAID") {
        await markCashPaid(order.id, options?.inventoryOverrideReason);
      }

      removePending(payload.clientRequestId);
      return { ...order, paymentStatus: "PAID" };
    } catch (error: unknown) {
      if (error instanceof InventoryShortageError) {
        // Keep pending so the same clientRequestId can retry with override;
        // flush will surface the error until manager overrides or stock is fixed.
        pending.lastError = error.message;
        upsertPending(pending);
        throw error;
      }
      lastError =
        error instanceof Error ? error.message : "Payment sync failed";
      pending.lastError = lastError;
      upsertPending(pending);
    }
  }

  if (order) {
    return order;
  }

  throw new Error(lastError);
}

export async function submitCardPayment(
  payload: PosOrderPayload,
  options?: { inventoryOverrideReason?: string },
): Promise<PosOrderResult> {
  const pending: PendingPayment = {
    clientRequestId: payload.clientRequestId,
    payment: "card",
    payload,
    createdAt: new Date().toISOString(),
  };

  upsertPending(pending);

  let order: PosOrderResult | null = null;

  try {
    order = await createPosOrder(payload);
    pending.orderId = order.id;
    pending.ticketNumber = order.ticketNumber;
    upsertPending(pending);

    const paid = await startCardPayment(
      order.id,
      options?.inventoryOverrideReason,
    );
    removePending(payload.clientRequestId);
    return {
      ...order,
      paymentStatus: paid.paymentStatus ?? "PAID",
      ticketNumber: paid.ticketNumber ?? order.ticketNumber,
    };
  } catch (error: unknown) {
    if (error instanceof InventoryShortageError) {
      pending.lastError = error.message;
      upsertPending(pending);
      throw error;
    }
    const lastError =
      error instanceof Error ? error.message : "Card payment failed";
    pending.lastError = lastError;
    upsertPending(pending);
    throw new Error(lastError);
  }
}

export async function flushPendingPayments(): Promise<{
  synced: number;
  failed: number;
}> {
  const queue = readQueue();
  let synced = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      let orderId = entry.orderId;

      if (!orderId) {
        const order = await createPosOrder(entry.payload);
        orderId = order.id;
        entry.orderId = order.id;
        entry.ticketNumber = order.ticketNumber;
        upsertPending(entry);
      }

      if (entry.payment === "cash") {
        await markCashPaid(orderId);
      } else {
        await startCardPayment(orderId);
      }

      removePending(entry.clientRequestId);
      synced += 1;
    } catch (error: unknown) {
      if (error instanceof InventoryShortageError) {
        entry.lastError = error.message;
        upsertPending(entry);
        failed += 1;
        continue;
      }
      entry.lastError =
        error instanceof Error ? error.message : "Sync failed";
      upsertPending(entry);
      failed += 1;
    }
  }

  return { synced, failed };
}

export function createClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
