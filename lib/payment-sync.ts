import { ApiError, apiFetch } from "@/lib/api";
import {
  getPosPaymentStatus,
  recoverLinklyPayment,
} from "@/lib/linkly-payments";
import type { FulfillmentType } from "@/types/cart";

const QUEUE_KEY = "pos_pending_payments";
export const PENDING_PAYMENTS_CHANGED_EVENT = "pos-pending-payments-changed";
export const LAST_CARD_ORDER_KEY = "pos_last_card_order";
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
  notes?: string;
  customerName?: string;
}

export interface PosOrderResult {
  id: string;
  ticketNumber: number | null;
  paymentStatus: string;
  linklyTxnRef?: string | null;
  linklySessionId?: string | null;
  linklyResponseText?: string | null;
}

/** Thrown when card charge fails after the order was created (so recover is possible). */
export class CardPaymentError extends Error {
  constructor(
    message: string,
    readonly orderId?: string,
    readonly ticketNumber?: number | null,
    readonly linklyTxnRef?: string | null,
    readonly linklyResponseText?: string | null,
    readonly linklyInProgress?: boolean,
  ) {
    super(message);
    this.name = "CardPaymentError";
  }
}

export interface PendingPayment {
  clientRequestId: string;
  payment: "cash" | "card";
  orderId?: string;
  ticketNumber?: number | null;
  linklyTxnRef?: string | null;
  payload: PosOrderPayload;
  createdAt: string;
  lastError?: string;
}

export interface LastCardOrderFocus {
  orderId: string;
  ticketNumber?: number | null;
  linklyTxnRef?: string | null;
  savedAt: string;
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

export function saveLastCardOrderFocus(focus: LastCardOrderFocus): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_CARD_ORDER_KEY, JSON.stringify(focus));
}

export function readLastCardOrderFocus(): LastCardOrderFocus | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_CARD_ORDER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastCardOrderFocus;
  } catch {
    return null;
  }
}

export function clearLastCardOrderFocus(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LAST_CARD_ORDER_KEY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function linklyFieldsFromBody(body: unknown): {
  linklyTxnRef?: string | null;
  linklyResponseText?: string | null;
  linklyInProgress?: boolean;
  orderId?: string;
} {
  if (!body || typeof body !== "object") {
    return {};
  }
  const b = body as Record<string, unknown>;
  // Nest may nest fields under message when exception is an object.
  const nested =
    b.message && typeof b.message === "object"
      ? (b.message as Record<string, unknown>)
      : null;
  const src = nested ?? b;
  return {
    orderId: typeof src.orderId === "string" ? src.orderId : undefined,
    linklyTxnRef:
      typeof src.linklyTxnRef === "string" ? src.linklyTxnRef : null,
    linklyResponseText:
      typeof src.linklyResponseText === "string"
        ? src.linklyResponseText
        : typeof src.message === "string"
          ? src.message
          : null,
    linklyInProgress: src.linklyInProgress === true || src.code === "LINKLY_IN_PROGRESS",
  };
}

async function createPosOrder(payload: PosOrderPayload): Promise<PosOrderResult> {
  const order = await apiFetch<{
    id: string;
    ticketNumber: number | null;
    paymentStatus: string;
  }>("/pos/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    id: order.id,
    ticketNumber: order.ticketNumber,
    paymentStatus: order.paymentStatus,
  };
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

type CardChargeResult = {
  orderId: string;
  ticketNumber?: number | null;
  paymentStatus: string;
  linklyTxnRef?: string | null;
  linklySessionId?: string | null;
  linklyResponseText?: string | null;
};

async function callCardPaymentEndpoint(
  orderId: string,
  inventoryOverrideReason?: string,
): Promise<CardChargeResult> {
  try {
    return await apiFetch<CardChargeResult>("/pos/payments/card", {
      method: "POST",
      body: JSON.stringify({
        orderId,
        ...(inventoryOverrideReason
          ? { inventoryOverrideReason }
          : {}),
      }),
    });
  } catch (error: unknown) {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      error.body &&
      typeof error.body === "object" &&
      (error.body as { code?: string }).code === "INVENTORY_SHORTAGE"
    ) {
      throwIfInventoryShortage(error, orderId);
    }
    if (error instanceof ApiError && error.status === 409) {
      const fields = linklyFieldsFromBody(error.body);
      throw new CardPaymentError(
        error.message ||
          "Card payment is still in progress on the pinpad. Recover instead of retrying.",
        fields.orderId ?? orderId,
        null,
        fields.linklyTxnRef,
        fields.linklyResponseText,
        true,
      );
    }
    // Cloud timeout / 503: VPP may already have approved — recover before failing.
    if (
      error instanceof ApiError &&
      (error.status === 503 || error.status === 502 || error.status >= 500)
    ) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
          await sleep(1500 * attempt);
        }
        try {
          const recovered = await recoverLinklyPayment(orderId);
          if (recovered.paymentStatus === "PAID") {
            return {
              orderId,
              paymentStatus: "PAID",
              linklyTxnRef: recovered.linklyTxnRef,
              linklySessionId: recovered.linklySessionId,
              linklyResponseText: recovered.linklyResponseText,
            };
          }
          if (recovered.linklyInProgress) {
            throw new CardPaymentError(
              "Payment still in progress on the pinpad — wait and recover.",
              orderId,
              null,
              recovered.linklyTxnRef,
              recovered.linklyResponseText,
              true,
            );
          }
          if (
            recovered.paymentStatus === "FAILED" ||
            recovered.linklyNotFound
          ) {
            throw new CardPaymentError(
              recovered.linklyResponseText ||
                recovered.message ||
                error.message,
              orderId,
              null,
              recovered.linklyTxnRef,
              recovered.linklyResponseText,
              false,
            );
          }
        } catch (recoverError: unknown) {
          if (recoverError instanceof CardPaymentError) {
            throw recoverError;
          }
        }
      }
      throw new CardPaymentError(
        error.message || "Card payment timed out — tap Recover.",
        orderId,
        null,
        null,
        null,
        true,
      );
    }
    if (error instanceof ApiError && error.status === 400) {
      const fields = linklyFieldsFromBody(error.body);
      if (
        fields.linklyTxnRef ||
        fields.linklyResponseText ||
        (error.body &&
          typeof error.body === "object" &&
          (error.body as { code?: string }).code === "LINKLY_DECLINED")
      ) {
        throw new CardPaymentError(
          error.message,
          fields.orderId ?? orderId,
          null,
          fields.linklyTxnRef,
          fields.linklyResponseText,
          false,
        );
      }
    }
    throwIfInventoryShortage(error, orderId);
  }
}

/**
 * Recover-before-retry for an existing order. Never starts a new Linkly
 * purchase while a session may still be approved on the pinpad.
 */
export async function safeStartCardPayment(
  orderId: string,
  options?: {
    inventoryOverrideReason?: string;
    ticketNumber?: number | null;
  },
): Promise<PosOrderResult> {
  const ticketNumber = options?.ticketNumber ?? null;

  try {
    const status = await getPosPaymentStatus(orderId);
    if (status.paymentStatus === "PAID") {
      return {
        id: orderId,
        ticketNumber,
        paymentStatus: "PAID",
        linklyTxnRef: status.linklyTxnRef,
        linklySessionId: status.linklySessionId,
      };
    }

    if (status.paymentStatus === "PROCESSING" && status.linklySessionId) {
      const recovered = await recoverLinklyPayment(orderId);

      if (recovered.paymentStatus === "PAID") {
        return {
          id: orderId,
          ticketNumber,
          paymentStatus: "PAID",
          linklyTxnRef: recovered.linklyTxnRef,
          linklySessionId: recovered.linklySessionId,
          linklyResponseText: recovered.linklyResponseText,
        };
      }

      if (recovered.linklyInProgress) {
        throw new CardPaymentError(
          "Payment still in progress on the pinpad — wait a few seconds and recover.",
          orderId,
          ticketNumber,
          recovered.linklyTxnRef ?? status.linklyTxnRef,
          recovered.linklyResponseText,
          true,
        );
      }

      // notFound / FAILED — fall through to a new card charge
    }
  } catch (error: unknown) {
    if (error instanceof CardPaymentError) {
      throw error;
    }
    // If status/recover fails (network), still attempt card endpoint —
    // the API guard will recover-before-retry server-side.
  }

  const paid = await callCardPaymentEndpoint(
    orderId,
    options?.inventoryOverrideReason,
  );

  return {
    id: paid.orderId ?? orderId,
    ticketNumber: paid.ticketNumber ?? ticketNumber,
    paymentStatus: paid.paymentStatus ?? "PAID",
    linklyTxnRef: paid.linklyTxnRef,
    linklySessionId: paid.linklySessionId,
    linklyResponseText: paid.linklyResponseText,
  };
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

    saveLastCardOrderFocus({
      orderId: order.id,
      ticketNumber: order.ticketNumber,
      savedAt: new Date().toISOString(),
    });

    const paid = await safeStartCardPayment(order.id, {
      inventoryOverrideReason: options?.inventoryOverrideReason,
      ticketNumber: order.ticketNumber,
    });

    if (paid.linklyTxnRef) {
      pending.linklyTxnRef = paid.linklyTxnRef;
      upsertPending(pending);
      saveLastCardOrderFocus({
        orderId: order.id,
        ticketNumber: order.ticketNumber,
        linklyTxnRef: paid.linklyTxnRef,
        savedAt: new Date().toISOString(),
      });
    }

    removePending(payload.clientRequestId);
    clearLastCardOrderFocus();
    return {
      ...order,
      paymentStatus: paid.paymentStatus ?? "PAID",
      ticketNumber: paid.ticketNumber ?? order.ticketNumber,
      linklyTxnRef: paid.linklyTxnRef,
      linklySessionId: paid.linklySessionId,
      linklyResponseText: paid.linklyResponseText,
    };
  } catch (error: unknown) {
    if (error instanceof InventoryShortageError) {
      pending.lastError = error.message;
      upsertPending(pending);
      throw error;
    }
    if (error instanceof CardPaymentError) {
      pending.lastError = error.message;
      if (error.linklyTxnRef) {
        pending.linklyTxnRef = error.linklyTxnRef;
      }
      upsertPending(pending);
      if (error.orderId ?? order?.id) {
        saveLastCardOrderFocus({
          orderId: error.orderId ?? order!.id,
          ticketNumber: error.ticketNumber ?? order?.ticketNumber,
          linklyTxnRef: error.linklyTxnRef ?? pending.linklyTxnRef,
          savedAt: new Date().toISOString(),
        });
      }
      throw new CardPaymentError(
        error.message,
        error.orderId ?? order?.id ?? pending.orderId,
        error.ticketNumber ?? order?.ticketNumber ?? pending.ticketNumber,
        error.linklyTxnRef ?? pending.linklyTxnRef,
        error.linklyResponseText,
        error.linklyInProgress,
      );
    }
    const lastError =
      error instanceof Error ? error.message : "Card payment failed";
    pending.lastError = lastError;
    upsertPending(pending);
    if (order?.id) {
      saveLastCardOrderFocus({
        orderId: order.id,
        ticketNumber: order.ticketNumber,
        savedAt: new Date().toISOString(),
      });
    }
    throw new CardPaymentError(
      lastError,
      order?.id ?? pending.orderId,
      order?.ticketNumber ?? pending.ticketNumber,
      pending.linklyTxnRef,
    );
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
        removePending(entry.clientRequestId);
        synced += 1;
        continue;
      }

      // Card: recover only in background — never auto-start a new charge.
      try {
        const status = await getPosPaymentStatus(orderId);
        if (status.paymentStatus === "PAID") {
          removePending(entry.clientRequestId);
          clearLastCardOrderFocus();
          synced += 1;
          continue;
        }
        if (status.paymentStatus === "PROCESSING" && status.linklySessionId) {
          const recovered = await recoverLinklyPayment(orderId);
          if (recovered.paymentStatus === "PAID") {
            removePending(entry.clientRequestId);
            clearLastCardOrderFocus();
            synced += 1;
            continue;
          }
          if (recovered.linklyInProgress) {
            entry.lastError =
              "Payment still in progress on pinpad — waiting to recover.";
            upsertPending(entry);
            failed += 1;
            continue;
          }
          // Failed / not found — clear queue; staff starts a new sale manually.
          removePending(entry.clientRequestId);
          clearLastCardOrderFocus();
          synced += 1;
          continue;
        }
        // Already FAILED / UNPAID — stop retrying in the background.
        removePending(entry.clientRequestId);
        clearLastCardOrderFocus();
        synced += 1;
      } catch (cardError: unknown) {
        entry.lastError =
          cardError instanceof Error ? cardError.message : "Card sync failed";
        upsertPending(entry);
        failed += 1;
      }
    } catch (error: unknown) {
      if (error instanceof InventoryShortageError) {
        entry.lastError = error.message;
        upsertPending(entry);
        failed += 1;
        continue;
      }
      if (error instanceof CardPaymentError && error.linklyInProgress) {
        entry.lastError = error.message;
        if (error.linklyTxnRef) {
          entry.linklyTxnRef = error.linklyTxnRef;
        }
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
