/** Staff-facing copy for Linkly card outcomes on the POS. */

export function formatTxnRefLine(txnRef?: string | null): string {
  const ref = txnRef?.trim();
  return ref ? `TxnRef ${ref}` : "";
}

export function formatCardOutcomeMessage(params: {
  kind:
    | "declined"
    | "in_progress"
    | "timeout"
    | "not_found"
    | "failed"
    | "paid"
    | "generic";
  detail?: string | null;
  txnRef?: string | null;
  ticketNumber?: number | null;
}): string {
  const txn = formatTxnRefLine(params.txnRef);
  const ticket =
    params.ticketNumber != null ? `Ticket #${params.ticketNumber}` : null;
  const meta = [ticket, txn].filter(Boolean).join(" · ");
  const suffix = meta ? ` (${meta})` : "";

  switch (params.kind) {
    case "declined":
      return `${params.detail?.trim() || "Card declined on pinpad."}${suffix}`;
    case "in_progress":
      return `Payment still in progress on the pinpad — wait, then tap Recover.${suffix}`;
    case "timeout":
      return `Connection lost while charging the card. Tap Recover before trying again.${suffix}`;
    case "not_found":
      return `${params.detail?.trim() || "No transaction found on Linkly — safe to try card again."}${suffix}`;
    case "failed":
      return `${params.detail?.trim() || "Card payment failed."}${suffix}`;
    case "paid":
      return `Card payment confirmed${suffix}.`;
    default:
      return `${params.detail?.trim() || "Card payment issue."}${suffix}`;
  }
}
