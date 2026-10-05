"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CategoryPillNav } from "@/components/register/category-pill-nav";
import { CurrentOrderSidebar } from "@/components/register/current-order-sidebar";
import { ItemModifierModal } from "@/components/register/item-modifier-modal";
import { ManagerPinModal } from "@/components/register/manager-pin-modal";
import { ProductCard } from "@/components/register/product-card";
import {
  listParkedOrders,
  parkOrder,
  removeParkedOrder,
  type ParkedOrder,
} from "@/lib/parked-orders";
import {
  buildEscPosText,
  printKitchenTicket,
  printReceipt,
  type PrintOrderPayload,
} from "@/lib/print";
import { useStaffPin } from "@/lib/staff-pin-context";
import { useStore } from "@/lib/store-context";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  buildCartLineKey,
  buildLineDetail,
  type CartAddPayload,
} from "@/lib/cart-lines";
import {
  categoryHasExtras,
  fetchCrustOptions,
  fetchToppingGroups,
  filterToppingsForItem,
  hasEnabledSizeOptions,
  mapApiCrusts,
} from "@/lib/customizations";
import { fetchMenuCategories, fetchMenuItems } from "@/lib/menu";
import { buildLocalQuote, normalizeQuoteResult } from "@/lib/pricing";
import {
  CardPaymentError,
  clearLastCardOrderFocus,
  createClientRequestId,
  InventoryShortageError,
  listPendingPayments,
  readLastCardOrderFocus,
  removePending,
  submitCardPayment,
  submitCashPayment,
  type InventoryShortage,
  type PosOrderPayload,
} from "@/lib/payment-sync";
import {
  listUnresolvedCardPayments,
  recoverLinklyPayment,
} from "@/lib/linkly-payments";
import { formatCardOutcomeMessage } from "@/lib/linkly-messages";
import type { CartLine, FulfillmentType, QuoteResult } from "@/types/cart";
import type {
  ApiCrustOption,
  CrustOption,
  ToppingCategory,
  ToppingCategoryGroup,
} from "@/types/customizations";
import type { MenuCategory, MenuItem } from "@/types/menu";

interface ModifierState {
  item: MenuItem;
  category: MenuCategory | undefined;
  crustOptions: CrustOption[];
  toppingCategories: ToppingCategory[];
}

interface ShortageDialogState {
  payment: "cash" | "card";
  payload: PosOrderPayload;
  shortages: InventoryShortage[];
  message: string;
}

export default function RegisterPage(): React.ReactElement {
  const { user } = useAuth();
  const { selectedLocation, selectedStore } = useStore();
  const { managerActionToken, clearManagerToken } = useStaffPin();
  const canOverrideInventory =
    user?.role === "MANAGER" || user?.role === "ADMIN";

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [toppingGroups, setToppingGroups] = useState<ToppingCategoryGroup[]>(
    [],
  );
  const [apiCrusts, setApiCrusts] = useState<ApiCrustOption[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [fulfillmentType, setFulfillmentType] =
    useState<FulfillmentType>("PICKUP");
  const [modifierState, setModifierState] = useState<ModifierState | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [cardPaying, setCardPaying] = useState(false);
  const [lastTicket, setLastTicket] = useState<number | null>(null);
  const [recoverOrderId, setRecoverOrderId] = useState<string | null>(null);
  const [recoverTicket, setRecoverTicket] = useState<number | null>(null);
  const [recoverTxnRef, setRecoverTxnRef] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [pagerNumber, setPagerNumber] = useState("");
  const [discountType, setDiscountType] = useState<
    "PERCENT" | "AMOUNT" | "COMP" | null
  >(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [pendingDiscount, setPendingDiscount] = useState<{
    type: "PERCENT" | "AMOUNT" | "COMP";
    value: number;
  } | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountDraftType, setDiscountDraftType] = useState<
    "PERCENT" | "AMOUNT" | "COMP"
  >("PERCENT");
  const [discountDraftValue, setDiscountDraftValue] = useState("10");
  const [recallOpen, setRecallOpen] = useState(false);
  const [parkOpen, setParkOpen] = useState(false);
  const [parkLabel, setParkLabel] = useState("");
  const [parked, setParked] = useState<ParkedOrder[]>([]);
  const [search, setSearch] = useState("");
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [trainingMode, setTrainingMode] = useState(false);
  const [cashEnabled, setCashEnabled] = useState(true);
  const [cardTerminalEnabled, setCardTerminalEnabled] = useState(false);
  const [linklyPaired, setLinklyPaired] = useState(true);
  const [cardProvider, setCardProvider] = useState<"LINKLY" | "STRIPE" | "NONE" | "CASH">("NONE");
  const [cardOverlayTicket, setCardOverlayTicket] = useState<number | null>(null);
  const [cardOverlayTxnRef, setCardOverlayTxnRef] = useState<string | null>(null);
  const [shortageDialog, setShortageDialog] =
    useState<ShortageDialogState | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      fetchMenuCategories(),
      fetchMenuItems(),
      fetchToppingGroups(),
      fetchCrustOptions(),
      apiFetch<{
        cashEnabled: boolean;
        cardTerminalEnabled: boolean;
        provider: "LINKLY" | "STRIPE" | "NONE" | "CASH";
        linklyPaired?: boolean;
      }>("/pos/payment-methods"),
    ])
      .then(([nextCategories, nextItems, nextToppings, nextCrusts, methods]) => {
        const activeCategories = nextCategories
          .filter((category) => category.isActive)
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
          );

        setCategories(activeCategories);
        setItems(
          nextItems
            .filter((item) => item.isActive)
            .map((item) => ({
              ...item,
              allowedToppingIds: item.allowedToppingIds ?? [],
            })),
        );
        setToppingGroups(nextToppings);
        setApiCrusts(nextCrusts);
        setActiveCategory(activeCategories[0]?.slug ?? "");
        setCashEnabled(methods.cashEnabled);
        setCardTerminalEnabled(methods.cardTerminalEnabled);
        setCardProvider(methods.provider ?? "NONE");
        setLinklyPaired(methods.linklyPaired ?? false);
        setLoadError(null);
        if (selectedLocation?.id) {
          setParked(listParkedOrders(selectedLocation.id));
        }
        void apiFetch<{ posTrainingMode: boolean }>("/pos/settings")
          .then((s) => setTrainingMode(s.posTrainingMode))
          .catch(() => undefined);
        void apiFetch<Array<{ menuItemId: string }>>("/pos/favourites")
          .then((rows) => setFavouriteIds(rows.map((r) => r.menuItemId)))
          .catch(() => undefined);
      })
      .catch((error: unknown) => {
        setLoadError(
          error instanceof Error ? error.message : "Could not load menu",
        );
      })
      .finally(() => setLoading(false));
  }, [selectedLocation?.id]);

  const focusRecover = useCallback(
    (orderId: string, ticket?: number | null, txnRef?: string | null) => {
      setRecoverOrderId(orderId);
      setRecoverTicket(ticket ?? null);
      setRecoverTxnRef(txnRef ?? null);
    },
    [],
  );

  const applyRecoverResult = useCallback(
    async (orderId: string): Promise<"paid" | "in_progress" | "done_failed"> => {
      const result = await recoverLinklyPayment(orderId);
      if (result.linklyTxnRef) {
        setRecoverTxnRef(result.linklyTxnRef);
      }

      if (result.paymentStatus === "PAID") {
        setLastTicket(recoverTicket);
        for (const entry of listPendingPayments()) {
          if (entry.orderId === orderId) {
            removePending(entry.clientRequestId);
          }
        }
        clearLastCardOrderFocus();
        setRecoverOrderId(null);
        setRecoverTicket(null);
        setRecoverTxnRef(null);
        setPayError(
          formatCardOutcomeMessage({
            kind: "paid",
            txnRef: result.linklyTxnRef,
            ticketNumber: recoverTicket,
          }),
        );
        return "paid";
      }

      if (result.linklyInProgress) {
        setPayError(
          formatCardOutcomeMessage({
            kind: "in_progress",
            txnRef: result.linklyTxnRef ?? recoverTxnRef,
            ticketNumber: recoverTicket,
          }),
        );
        return "in_progress";
      }

      if (result.linklyNotFound) {
        setPayError(
          formatCardOutcomeMessage({
            kind: "not_found",
            detail: result.message,
            txnRef: result.linklyTxnRef ?? recoverTxnRef,
            ticketNumber: recoverTicket,
          }),
        );
        setRecoverOrderId(null);
        clearLastCardOrderFocus();
        return "done_failed";
      }

      setPayError(
        formatCardOutcomeMessage({
          kind: "failed",
          detail: result.linklyResponseText || `Payment status: ${result.paymentStatus}`,
          txnRef: result.linklyTxnRef ?? recoverTxnRef,
          ticketNumber: recoverTicket,
        }),
      );
      if (result.paymentStatus === "FAILED") {
        setRecoverOrderId(null);
        clearLastCardOrderFocus();
      }
      return "done_failed";
    },
    [recoverTicket, recoverTxnRef],
  );

  // Startup / power-fail: surface unresolved card payments.
  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    async function loadUnresolved() {
      try {
        const [apiUnresolved, pending, lastFocus] = await Promise.all([
          listUnresolvedCardPayments().catch(() => []),
          Promise.resolve(listPendingPayments()),
          Promise.resolve(readLastCardOrderFocus()),
        ]);

        if (cancelled) return;

        const pendingCard = pending.find(
          (entry) => entry.payment === "card" && entry.orderId,
        );

        const primary =
          apiUnresolved[0] ??
          (pendingCard
            ? {
                id: pendingCard.orderId!,
                ticketNumber: pendingCard.ticketNumber ?? null,
                linklyTxnRef: pendingCard.linklyTxnRef ?? null,
              }
            : null) ??
          (lastFocus
            ? {
                id: lastFocus.orderId,
                ticketNumber: lastFocus.ticketNumber ?? null,
                linklyTxnRef: lastFocus.linklyTxnRef ?? null,
              }
            : null);

        if (primary) {
          focusRecover(
            primary.id,
            primary.ticketNumber,
            primary.linklyTxnRef ?? null,
          );
          setPayError(
            formatCardOutcomeMessage({
              kind: "timeout",
              txnRef: primary.linklyTxnRef,
              ticketNumber: primary.ticketNumber,
            }),
          );
        }
      } catch {
        // Non-fatal — register still usable.
      }
    }

    void loadUnresolved();
    return () => {
      cancelled = true;
    };
  }, [loading, focusRecover]);

  // Auto-poll recover while an unresolved card payment is focused.
  useEffect(() => {
    if (!recoverOrderId) return;

    let cancelled = false;
    let attempt = 0;
    const maxMs = 3 * 60 * 1000;
    const started = Date.now();
    let timer: number | undefined;

    async function poll() {
      if (cancelled || !recoverOrderId) return;
      setRecovering(true);
      try {
        const outcome = await applyRecoverResult(recoverOrderId);
        if (outcome === "paid") {
          clearCart({ keepPayError: true });
          return;
        }
        if (outcome !== "in_progress") {
          return;
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setPayError(
            error instanceof Error
              ? error.message
              : "Could not recover payment",
          );
        }
      } finally {
        if (!cancelled) {
          setRecovering(false);
        }
      }

      if (cancelled || Date.now() - started > maxMs) {
        return;
      }
      attempt += 1;
      const delay = Math.min(2000 * 2 ** Math.min(attempt - 1, 3), 15000);
      timer = window.setTimeout(() => {
        void poll();
      }, delay);
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll when recover target changes
  }, [recoverOrderId]);

  // Show ticket / TxnRef on the waiting overlay once the order exists.
  useEffect(() => {
    if (!cardPaying) return;
    const focus = readLastCardOrderFocus();
    if (focus) {
      setCardOverlayTicket(focus.ticketNumber ?? null);
      setCardOverlayTxnRef(focus.linklyTxnRef ?? null);
    }
    const timer = window.setInterval(() => {
      const next = readLastCardOrderFocus();
      if (next) {
        setCardOverlayTicket(next.ticketNumber ?? null);
        setCardOverlayTxnRef(next.linklyTxnRef ?? null);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [cardPaying]);

  const crustOptions = useMemo(
    () => mapApiCrusts(apiCrusts),
    [apiCrusts],
  );

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((item) => item.categorySlug === activeCategory);
    if (q) {
      list = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          String(item.number).includes(q) ||
          (item as MenuItem & { sku?: string }).sku?.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.number - b.number);
  }, [items, activeCategory, search]);

  const favouriteItems = useMemo(
    () => items.filter((item) => favouriteIds.includes(item.id)).slice(0, 12),
    [items, favouriteIds],
  );

  const discountPayload = useMemo(
    () =>
      discountType
        ? { type: discountType, value: discountValue }
        : undefined,
    [discountType, discountValue],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "/") {
        event.preventDefault();
        const el = document.querySelector<HTMLInputElement>(
          'input[placeholder^="Search menu"]',
        );
        el?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = new BroadcastChannel("pos-customer-display");
    channel.postMessage({
      type: "cart",
      storeName: selectedStore?.name ?? "POS",
      cart,
      quote,
      customerName,
    });
    return () => channel.close();
  }, [cart, quote, customerName, selectedStore?.name]);

  const refreshQuote = useCallback(async (lines: CartLine[]) => {
    if (lines.length === 0) {
      setQuote(null);
      return;
    }

    setQuote(buildLocalQuote(lines, discountPayload));

    try {
      const result = await apiFetch<QuoteResult>("/pos/orders/quote", {
        method: "POST",
        body: JSON.stringify({
          items: lines.map((line) => ({
            menuItemId: line.menuItemId,
            quantity: line.quantity,
            size: line.size,
            crust: line.crust,
            toppingIds: line.toppingIds.length > 0 ? line.toppingIds : undefined,
            removedIngredients:
              line.removedIngredients.length > 0
                ? line.removedIngredients
                : undefined,
          })),
          discount: discountPayload
            ? {
                type: discountPayload.type,
                value: discountPayload.value,
                reason: discountReason || undefined,
              }
            : undefined,
        }),
      });

      setQuote(normalizeQuoteResult(result));
      setPayError(null);
    } catch (error: unknown) {
      setQuote(buildLocalQuote(lines, discountPayload));
      setPayError(
        error instanceof Error
          ? `${error.message} (showing local total)`
          : "Server quote unavailable (showing local total)",
      );
    }
  }, [discountPayload, discountReason]);

  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return;
    }

    setQuote(buildLocalQuote(cart, discountPayload));

    const timer = window.setTimeout(() => {
      void refreshQuote(cart);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [cart, refreshQuote, discountPayload]);

  function openModifier(item: MenuItem) {
    const category = categories.find(
      (entry) => entry.slug === item.categorySlug,
    );
    const showSize = Boolean(
      category?.supportsSizeOptions && hasEnabledSizeOptions(item.sizeOptions),
    );
    const showExtras = categoryHasExtras(item.categorySlug, categories);

    setModifierState({
      item,
      category,
      crustOptions: showSize ? crustOptions : [],
      toppingCategories: showExtras
        ? filterToppingsForItem(toppingGroups, item.allowedToppingIds ?? [])
        : [],
    });
  }

  function addToCart(payload: CartAddPayload) {
    const key = buildCartLineKey({
      menuItemId: payload.menuItemId,
      size: payload.size,
      crust: payload.crust,
      toppingIds: payload.toppingIds,
      removedIngredients: payload.removedIngredients,
    });

    const detail = buildLineDetail({
      crustLabel: payload.crustLabel,
      toppingLabels: payload.toppingLabels,
      removedIngredients: payload.removedIngredients,
    });

    setCart((current) => {
      const existing = current.find((line) => line.key === key);

      if (existing) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + payload.quantity }
            : line,
        );
      }

      return [
        ...current,
        {
          key,
          menuItemId: payload.menuItemId,
          name: payload.name,
          detail,
          quantity: payload.quantity,
          size: payload.size,
          crust: payload.crust,
          toppingIds: payload.toppingIds,
          removedIngredients: payload.removedIngredients,
          unitPrice: payload.unitPrice,
        },
      ];
    });
    setPayError(null);
  }

  function incrementLine(key: string) {
    setCart((current) =>
      current.map((line) =>
        line.key === key ? { ...line, quantity: line.quantity + 1 } : line,
      ),
    );
  }

  function decrementLine(key: string) {
    setCart((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity - 1 }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((current) => current.filter((line) => line.key !== key));
  }

  function clearCart(options?: { keepPayError?: boolean }) {
    setCart([]);
    setQuote(null);
    if (!options?.keepPayError) {
      setPayError(null);
    }
    setOrderNotes("");
    setCustomerName("");
    setCustomerPhone("");
    setTableNumber("");
    setPagerNumber("");
    setDiscountType(null);
    setDiscountValue(0);
    setDiscountReason("");
    clearManagerToken();
  }

  function printPaidOrder(order: {
    ticketNumber: number | null;
    total?: number;
  }) {
    const payload: PrintOrderPayload = {
      storeName: selectedStore?.name ?? "POS",
      locationName: selectedLocation?.name,
      ticketNumber: order.ticketNumber,
      fulfillmentType,
      tableNumber: tableNumber || null,
      pagerNumber: pagerNumber || null,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      notes: orderNotes || null,
      items: cart.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        detail: line.detail,
        unitPrice: line.unitPrice,
        lineTotal: line.unitPrice * line.quantity,
        size: line.size,
        crust: line.crust,
      })),
      subtotal: quote?.subtotal,
      discountAmount: quote?.discountAmount,
      total: quote?.total ?? order.total ?? 0,
      paymentMethod: "PAID",
      isTraining: trainingMode,
      createdAt: new Date().toLocaleString(),
    };
    printReceipt(payload);
    window.setTimeout(() => printKitchenTicket(payload), 600);
    void apiFetch("/pos/print/escpos", {
      method: "POST",
      body: JSON.stringify({
        target: "receipt",
        text: buildEscPosText(payload, "receipt"),
      }),
    }).catch(() => undefined);
    void apiFetch("/pos/print/escpos", {
      method: "POST",
      body: JSON.stringify({
        target: "kitchen",
        text: buildEscPosText(payload, "kitchen"),
      }),
    }).catch(() => undefined);
  }

  async function runPayment(
    payment: "cash" | "card",
    payload: PosOrderPayload,
    inventoryOverrideReason?: string,
  ) {
    setPaying(true);
    setPayError(null);
    setOverrideError(null);
    setRecoverOrderId(null);
    setRecoverTicket(null);
    setRecoverTxnRef(null);
    setCardOverlayTicket(null);
    setCardOverlayTxnRef(null);

    if (payment === "card") {
      setCardPaying(true);
    }

    try {
      const order =
        payment === "cash"
          ? await submitCashPayment(payload, { inventoryOverrideReason })
          : await submitCardPayment(payload, { inventoryOverrideReason });

      setLastTicket(order.ticketNumber);
      setShortageDialog(null);
      setOverrideReason("");
      setRecoverOrderId(null);
      setRecoverTicket(null);
      setRecoverTxnRef(null);
      printPaidOrder(order);

      const stillPending = listPendingPayments().some(
        (entry) => entry.clientRequestId === payload.clientRequestId,
      );

      if (stillPending) {
        setPayError(
          payment === "cash"
            ? `Ticket #${order.ticketNumber ?? "?"} saved — cash payment will sync when connection is stable.`
            : formatCardOutcomeMessage({
                kind: "timeout",
                ticketNumber: order.ticketNumber,
                txnRef: order.linklyTxnRef,
              }),
        );
        if (payment === "card" && order.id) {
          focusRecover(order.id, order.ticketNumber, order.linklyTxnRef);
        }
      }

      clearCart({ keepPayError: stillPending });
    } catch (error: unknown) {
      if (error instanceof InventoryShortageError) {
        setShortageDialog({
          payment,
          payload,
          shortages: error.shortages,
          message: error.message,
        });
        setPayError(error.message);
        return;
      }

      if (error instanceof CardPaymentError) {
        if (error.orderId) {
          focusRecover(
            error.orderId,
            error.ticketNumber ?? null,
            error.linklyTxnRef ?? null,
          );
        }
        setCardOverlayTxnRef(error.linklyTxnRef ?? null);
        setPayError(
          formatCardOutcomeMessage({
            kind: error.linklyInProgress
              ? "in_progress"
              : error.message.toLowerCase().includes("timeout") ||
                  error.message.toLowerCase().includes("network") ||
                  error.message.toLowerCase().includes("failed to fetch")
                ? "timeout"
                : "declined",
            detail: error.linklyResponseText || error.message,
            txnRef: error.linklyTxnRef,
            ticketNumber: error.ticketNumber,
          }),
        );
        return;
      }

      setPayError(
        error instanceof Error ? error.message : "Payment failed",
      );
    } finally {
      setPaying(false);
      setCardPaying(false);
      setCardOverlayTicket(null);
      setCardOverlayTxnRef(null);
    }
  }

  async function handleRecoverCard() {
    if (!recoverOrderId) return;
    setRecovering(true);
    setPayError(null);
    try {
      const outcome = await applyRecoverResult(recoverOrderId);
      if (outcome === "paid") {
        clearCart({ keepPayError: true });
      }
    } catch (error: unknown) {
      setPayError(
        error instanceof Error ? error.message : "Could not recover payment",
      );
    } finally {
      setRecovering(false);
    }
  }

  async function submitOrder(payment: "cash" | "card") {
    if (cart.length === 0 || !quote) {
      return;
    }

    const payload: PosOrderPayload = {
      clientRequestId: createClientRequestId(),
      items: cart.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        size: line.size,
        crust: line.crust,
        toppingIds: line.toppingIds.length > 0 ? line.toppingIds : undefined,
        removedIngredients:
          line.removedIngredients.length > 0
            ? line.removedIngredients
            : undefined,
      })),
      fulfillmentType,
      notes: orderNotes.trim() || undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      tableNumber: tableNumber.trim() || undefined,
      pagerNumber: pagerNumber.trim() || undefined,
      ...(discountType
        ? {
            discountType,
            discountValue,
            discountReason: discountReason.trim() || undefined,
            managerActionToken: managerActionToken ?? undefined,
          }
        : {}),
    };

    await runPayment(payment, payload);
  }

  async function confirmInventoryOverride() {
    if (!shortageDialog) {
      return;
    }

    const reason = overrideReason.trim();
    if (!reason) {
      setOverrideError("Enter a reason to override.");
      return;
    }

    await runPayment(
      shortageDialog.payment,
      shortageDialog.payload,
      reason,
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
        Loading menu…
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
        {loadError}
      </p>
    );
  }

  return (
    <>
      <section className="grid h-full min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)] lg:gap-5">
        <div className="glass-panel flex min-h-0 flex-col rounded-2xl p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500"
              placeholder="Search menu (/ to focus)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearch("");
              }}
            />
          </div>

          {favouriteItems.length > 0 ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {favouriteItems.map((item) => (
                <button
                  key={`fav-${item.id}`}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200"
                  type="button"
                  onClick={() => openModifier(item)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}

          <CategoryPillNav
            activeCategory={activeCategory}
            categories={categories}
            onChange={setActiveCategory}
          />

          <div className="pos-scrollbar grid flex-1 auto-rows-max grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
            {visibleItems.map((item) => {
              const inCartQty = cart
                .filter((l) => l.menuItemId === item.id)
                .reduce((s, l) => s + l.quantity, 0);

              return (
                <ProductCard
                  key={item.id}
                  inCartQty={inCartQty}
                  item={item}
                  onSelect={openModifier}
                />
              );
            })}
          </div>
        </div>

        <CurrentOrderSidebar
          cart={cart}
          cardTerminalEnabled={cardTerminalEnabled}
          cardProvider={cardProvider}
          linklyPaired={linklyPaired}
          customerName={customerName}
          onCustomerNameChange={setCustomerName}
          customerPhone={customerPhone}
          onCustomerPhoneChange={setCustomerPhone}
          tableNumber={tableNumber}
          onTableNumberChange={setTableNumber}
          pagerNumber={pagerNumber}
          onPagerNumberChange={setPagerNumber}
          orderNotes={orderNotes}
          onOrderNotesChange={setOrderNotes}
          discountType={discountType}
          discountValue={discountValue}
          onDiscountChange={(type, value) => {
            setDiscountType(type);
            setDiscountValue(value);
          }}
          onRequestDiscount={() => {
            setDiscountDraftType(discountType ?? "PERCENT");
            setDiscountDraftValue(
              discountType === "COMP" ? "" : String(discountValue || 10),
            );
            setDiscountOpen(true);
          }}
          onPark={() => {
            if (!selectedLocation?.id || cart.length === 0) return;
            setParkLabel(customerName.trim());
            setParkOpen(true);
          }}
          onOpenRecall={() => {
            if (selectedLocation?.id) {
              setParked(listParkedOrders(selectedLocation.id));
            }
            setRecallOpen(true);
          }}
          parkedCount={parked.length}
          onLookupPhone={() => {
            if (!customerPhone.trim()) return;
            void apiFetch<
              Array<{
                guestName?: string;
                notes?: string;
                items: Array<{
                  menuItemId: string;
                  name: string;
                  quantity: number;
                  price: number | string;
                  size?: string;
                  crust?: string;
                }>;
              }>
            >(`/pos/orders/by-phone?phone=${encodeURIComponent(customerPhone)}`)
              .then((rows) => {
                const last = rows[0];
                if (!last) {
                  setPayError("No prior orders for that phone");
                  return;
                }
                if (customerName.trim() === "" && last.guestName) {
                  setCustomerName(last.guestName);
                }
                if (
                  window.confirm(
                    `Load last order for ${last.guestName ?? customerPhone}?`,
                  )
                ) {
                  setCart(
                    last.items.map((item, index) => ({
                      key: `${item.menuItemId}-${index}`,
                      menuItemId: item.menuItemId,
                      name: item.name,
                      quantity: item.quantity,
                      size: item.size ?? undefined,
                      crust: item.crust ?? undefined,
                      toppingIds: [],
                      removedIngredients: [],
                      unitPrice: Number(item.price),
                    })),
                  );
                }
              })
              .catch((err: unknown) =>
                setPayError(
                  err instanceof Error ? err.message : "Lookup failed",
                ),
              );
          }}
          cashEnabled={cashEnabled}
          fulfillmentType={fulfillmentType}
          lastTicket={lastTicket}
          payError={payError}
          paying={paying}
          quote={quote}
          recoverOrderId={recoverOrderId}
          recoverTicket={recoverTicket}
          recoverTxnRef={recoverTxnRef}
          recovering={recovering}
          trainingMode={trainingMode}
          onClear={() => clearCart()}
          onDecrement={decrementLine}
          onDismissPayError={() => setPayError(null)}
          onFulfillmentChange={setFulfillmentType}
          onIncrement={incrementLine}
          onPayCash={() => void submitOrder("cash")}
          onPayStripe={() => void submitOrder("card")}
          onRecoverCard={() => void handleRecoverCard()}
          onRemove={removeLine}
        />
      </section>

      {discountOpen ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-zinc-950/75 p-4 backdrop-blur-sm">
          <form
            className="glass-panel w-full max-w-md rounded-2xl p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(discountDraftValue) || 0;
              if (discountDraftType !== "COMP" && value <= 0) return;
              setPendingDiscount({
                type: discountDraftType,
                value: discountDraftType === "COMP" ? 0 : value,
              });
              setDiscountOpen(false);
              setPinModalOpen(true);
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Manager approval
            </p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-50">Discount</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Choose a type, then a manager PIN is required.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(
                [
                  ["PERCENT", "% off"],
                  ["AMOUNT", "$ off"],
                  ["COMP", "Comp"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  className={
                    discountDraftType === type
                      ? "rounded-xl bg-pay-gradient px-2 py-2.5 text-sm font-semibold text-white"
                      : "rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-sm font-semibold text-zinc-300"
                  }
                  type="button"
                  onClick={() => setDiscountDraftType(type)}
                >
                  {label}
                </button>
              ))}
            </div>
            {discountDraftType !== "COMP" ? (
              <label className="mt-4 block text-sm text-zinc-300">
                {discountDraftType === "PERCENT" ? "Percent" : "Amount"}
                <input
                  autoFocus
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 font-mono text-lg text-zinc-50 outline-none focus:ring-2 focus:ring-rose-500/40"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  type="number"
                  value={discountDraftValue}
                  onChange={(event) => setDiscountDraftValue(event.target.value)}
                />
              </label>
            ) : (
              <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-300">
                Comp makes this order $0.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-zinc-300"
                type="button"
                onClick={() => setDiscountOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-pay-gradient px-3 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ManagerPinModal
        open={pinModalOpen}
        title="Manager PIN for discount"
        description="Approve this discount"
        onCancel={() => {
          setPinModalOpen(false);
          setPendingDiscount(null);
        }}
        onApproved={() => {
          if (pendingDiscount) {
            setDiscountType(pendingDiscount.type);
            setDiscountValue(pendingDiscount.value);
            setDiscountReason("Manager approved");
          }
          setPendingDiscount(null);
          setPinModalOpen(false);
        }}
      />

      {parkOpen ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-zinc-950/75 p-4 backdrop-blur-sm">
          <form
            className="glass-panel w-full max-w-md rounded-2xl p-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedLocation?.id) return;
              parkOrder(selectedLocation.id, {
                label: parkLabel.trim() || customerName.trim() || "Held order",
                cart,
                fulfillmentType,
                customerName,
                customerPhone,
                orderNotes,
                tableNumber,
                pagerNumber,
                discountType,
                discountValue,
                discountReason,
              });
              setParked(listParkedOrders(selectedLocation.id));
              setParkOpen(false);
              clearCart();
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Hold this order
            </p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-50">Park order</h3>
            <p className="mt-1 text-sm text-zinc-400">
              The cart is saved on this register. Use Recall to bring it back.
            </p>
            <label className="mt-4 block text-sm text-zinc-300">
              Name this hold
              <input
                autoFocus
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-50 outline-none focus:ring-2 focus:ring-rose-500/40"
                maxLength={60}
                placeholder="Customer name or table"
                value={parkLabel}
                onChange={(event) => setParkLabel(event.target.value)}
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-zinc-300"
                type="button"
                onClick={() => setParkOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-pay-gradient px-3 py-2.5 text-sm font-semibold text-white"
                type="submit"
              >
                Park order
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {recallOpen ? (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-zinc-950/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="glass-panel w-full max-w-md rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-50">Parked orders</h3>
              <button
                className="text-sm text-zinc-400"
                type="button"
                onClick={() => setRecallOpen(false)}
              >
                Close
              </button>
            </div>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {parked.length === 0 ? (
                <li className="py-6 text-center text-sm text-zinc-500">
                  No parked orders
                </li>
              ) : (
                parked.map((entry) => (
                  <li key={entry.id}>
                    <button
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left"
                      type="button"
                      onClick={() => {
                        setCart(entry.cart);
                        setFulfillmentType(entry.fulfillmentType);
                        setCustomerName(entry.customerName);
                        setCustomerPhone(entry.customerPhone);
                        setOrderNotes(entry.orderNotes);
                        setTableNumber(entry.tableNumber);
                        setPagerNumber(entry.pagerNumber);
                        setDiscountType(entry.discountType ?? null);
                        setDiscountValue(entry.discountValue ?? 0);
                        setDiscountReason(entry.discountReason ?? "");
                        removeParkedOrder(entry.id);
                        if (selectedLocation?.id) {
                          setParked(listParkedOrders(selectedLocation.id));
                        }
                        setRecallOpen(false);
                      }}
                    >
                      <p className="font-semibold text-zinc-100">{entry.label}</p>
                      <p className="text-xs text-zinc-400">
                        {entry.cart.length} lines ·{" "}
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {modifierState ? (
        <ItemModifierModal
          crustOptions={modifierState.crustOptions}
          category={modifierState.category}
          item={modifierState.item}
          open={Boolean(modifierState)}
          toppingCategories={modifierState.toppingCategories}
          onAdd={addToCart}
          onClose={() => setModifierState(null)}
        />
      ) : null}

      {shortageDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-zinc-50">
              Insufficient stock
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{shortageDialog.message}</p>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
              {shortageDialog.shortages.map((row) => (
                <li
                  key={row.stockItemId}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <span className="font-semibold text-zinc-100">{row.name}</span>
                  <span className="mt-0.5 block text-zinc-400">
                    need {row.required}
                    {row.unit ? ` ${row.unit}` : ""} · on hand {row.onHand}
                    {row.unit ? ` ${row.unit}` : ""} · short {row.shortfall}
                    {row.unit ? ` ${row.unit}` : ""}
                  </span>
                </li>
              ))}
            </ul>

            {canOverrideInventory ? (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-zinc-200">
                  Manager override reason
                  <textarea
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    rows={2}
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    placeholder="Why continue with low stock?"
                  />
                </label>
                {overrideError ? (
                  <p className="text-sm text-rose-300">{overrideError}</p>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-zinc-200"
                    disabled={paying}
                    onClick={() => {
                      setShortageDialog(null);
                      setOverrideReason("");
                      setOverrideError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-xl bg-pay-gradient px-3 py-2.5 text-sm font-semibold text-white shadow-pay-glow"
                    disabled={paying}
                    onClick={() => void confirmInventoryOverride()}
                  >
                    {paying ? "Processing…" : "Override & continue"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-zinc-400">
                  Ask a manager to override, or restock before paying.
                </p>
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold"
                  onClick={() => setShortageDialog(null)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {cardPaying ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 backdrop-blur-md">
          <div className="glass-panel flex w-[min(92vw,22rem)] flex-col items-center gap-5 rounded-2xl p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/20 to-violet-500/20 ring-1 ring-white/10">
              <svg
                className="h-10 w-10 text-rose-300"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-zinc-50">
                {cardProvider === "STRIPE"
                  ? "Present card to reader"
                  : "Waiting on EFTPOS"}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {cardProvider === "STRIPE"
                  ? "Tap, insert, or swipe on the Stripe Terminal reader."
                  : "Follow the prompts on the Linkly pinpad / Virtual PIN Pad."}
              </p>
              {(cardOverlayTicket != null || recoverTicket != null) && (
                <p className="mt-2 text-xs font-semibold text-zinc-300">
                  Ticket #{cardOverlayTicket ?? recoverTicket}
                </p>
              )}
              {(cardOverlayTxnRef || recoverTxnRef) && (
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  TxnRef {cardOverlayTxnRef ?? recoverTxnRef}
                </p>
              )}
            </div>
            <div className="flex gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-rose-400 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-rose-400" />
            </div>
            <p className="text-xs text-zinc-500">
              Do not close this screen — payment is processing.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
