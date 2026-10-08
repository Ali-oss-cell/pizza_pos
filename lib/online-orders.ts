"use client";

/** Orders that came from the website (WEB) or were phoned in (PHONE). */
export interface OnlineOrderItem {
  name: string;
  quantity: number;
  price?: number | string | null;
  size?: string | null;
  crust?: string | null;
  notes?: string | null;
  /* Web orders store labels; POS orders store { name } objects. */
  toppings?: Array<string | { name?: string | null }> | null;
  removedIngredients?: string[] | null;
}

export interface OnlineOrder {
  id: string;
  ticketNumber: number | null;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  channel?: string | null;
  fulfillmentType?: string | null;
  deliveryMode?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  deliveryAddressLine1?: string | null;
  deliveryAddressLine2?: string | null;
  deliverySuburb?: string | null;
  deliveryPostcode?: string | null;
  scheduledAt?: string | null;
  notes?: string | null;
  subtotal?: number | string | null;
  deliveryFee?: number | string | null;
  total: number | string;
  createdAt: string;
  updatedAt?: string;
  items: OnlineOrderItem[];
}

/** Orders due more than this far ahead go in the Scheduled lane instead of New. */
export const SCHEDULED_AHEAD_MS = 30 * 60 * 1000;

export function isOnlineOrder(order: { channel?: string | null }): boolean {
  return order.channel === "WEB" || order.channel === "PHONE";
}

export function isDelivery(order: OnlineOrder): boolean {
  return order.fulfillmentType === "DELIVERY" || order.deliveryMode === "DELIVERY";
}

export function isScheduledLater(order: OnlineOrder, now = Date.now()): boolean {
  if (!order.scheduledAt) return false;
  return new Date(order.scheduledAt).getTime() - now > SCHEDULED_AHEAD_MS;
}

/** Paid, not yet accepted, due now: what the counter must act on. */
export function isWaitingForAccept(order: OnlineOrder, now = Date.now()): boolean {
  return (
    isOnlineOrder(order) &&
    order.paymentStatus === "PAID" &&
    order.status === "CONFIRMED" &&
    !isScheduledLater(order, now)
  );
}

export function toppingLabels(item: OnlineOrderItem): string[] {
  return (item.toppings ?? [])
    .map((topping) => (typeof topping === "string" ? topping : topping?.name ?? ""))
    .filter(Boolean);
}

export function formatAddress(order: OnlineOrder): string | null {
  const parts = [
    order.deliveryAddressLine1,
    order.deliveryAddressLine2,
    [order.deliverySuburb, order.deliveryPostcode].filter(Boolean).join(" "),
  ].filter((part) => part && String(part).trim());
  return parts.length > 0 ? parts.join(", ") : null;
}

const timeFormat = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  hour: "numeric",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
  day: "numeric",
  month: "short",
});

function melbourneDay(date: Date): string {
  return dayFormat.format(date);
}

/** "ASAP", "Due 6:30 pm", or "Due Sat 12 Oct, 6:30 pm" for another day. */
export function formatDue(order: OnlineOrder, now = new Date()): string {
  if (!order.scheduledAt) return "ASAP";
  const due = new Date(order.scheduledAt);
  const time = timeFormat.format(due);
  return melbourneDay(due) === melbourneDay(now) ? `Due ${time}` : `Due ${melbourneDay(due)}, ${time}`;
}

/** Minutes until due (negative = late); null for ASAP orders. */
export function minutesUntilDue(order: OnlineOrder, now = Date.now()): number | null {
  if (!order.scheduledAt) return null;
  return Math.round((new Date(order.scheduledAt).getTime() - now) / 60000);
}

export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}

/* ── alert sound ─────────────────────────────────────────────────────────
   Browsers only allow audio after the user has interacted with the page,
   so the AudioContext is created on the first tap anywhere on the POS. */

const ALERTS_KEY = "pos_online_alerts";
let audioCtx: AudioContext | null = null;

export function alertsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ALERTS_KEY) !== "off";
}

export function setAlertsEnabled(enabled: boolean): void {
  localStorage.setItem(ALERTS_KEY, enabled ? "on" : "off");
}

export function unlockAlertAudio(): void {
  if (audioCtx || typeof window === "undefined") return;
  try {
    audioCtx = new AudioContext();
  } catch {
    audioCtx = null;
  }
}

export function playOrderAlert(): void {
  if (!audioCtx || !alertsEnabled()) return;
  const ctx = audioCtx;
  void ctx.resume().catch(() => undefined);
  const beep = (freq: number, start: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + 0.16);
    osc.start(t);
    osc.stop(t + 0.2);
  };
  beep(988, 0);
  beep(1319, 0.18);
  beep(988, 0.36);
  beep(1319, 0.54);
}
