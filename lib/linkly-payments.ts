import { apiFetch } from "@/lib/api";

export interface LinklyPaymentStatus {
  orderId: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  paidAt?: string | null;
  linklySessionId?: string | null;
  linklyRfn?: string | null;
  linklyTxnRef?: string | null;
  linklyHttpStatus?: number;
  linklyInProgress?: boolean;
  linklyNotFound?: boolean;
  linklyResponseCode?: string;
  linklyResponseText?: string;
  message?: string;
}

export interface LinklyRefundResult {
  orderId: string;
  paymentStatus: string;
  alreadyRefunded?: boolean;
  linklySessionId?: string;
  linklyResponseCode?: string;
  linklyResponseText?: string;
  refundAmountCents?: number;
}

export interface LinklySettlementResult {
  success: boolean;
  settlementType: string;
  linklySessionId: string;
  linklyResponseCode: string;
  linklyResponseText: string;
}

export async function getPosPaymentStatus(
  orderId: string,
): Promise<LinklyPaymentStatus> {
  return apiFetch<LinklyPaymentStatus>(`/pos/payments/${orderId}/status`);
}

export async function recoverLinklyPayment(
  orderId: string,
): Promise<LinklyPaymentStatus> {
  return apiFetch<LinklyPaymentStatus>(
    `/pos/payments/${orderId}/linkly-recover`,
    { method: "POST" },
  );
}

export async function refundCardPayment(
  orderId: string,
  amountCents?: number,
): Promise<LinklyRefundResult> {
  return apiFetch<LinklyRefundResult>("/pos/payments/refund", {
    method: "POST",
    body: JSON.stringify({
      orderId,
      ...(amountCents != null ? { amountCents } : {}),
    }),
  });
}

export async function runLinklySettlement(
  settlementType: "S" | "P" | "L" = "S",
): Promise<LinklySettlementResult> {
  return apiFetch<LinklySettlementResult>("/pos/linkly/settlement", {
    method: "POST",
    body: JSON.stringify({ settlementType }),
  });
}
