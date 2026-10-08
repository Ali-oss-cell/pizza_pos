"use client";

export interface PrintLineItem {
  name: string;
  quantity: number;
  detail?: string | null;
  unitPrice?: number;
  lineTotal?: number;
  size?: string | null;
  crust?: string | null;
  notes?: string | null;
}

export interface PrintOrderPayload {
  storeName: string;
  locationName?: string;
  ticketNumber: number | string | null;
  fulfillmentType?: string | null;
  tableNumber?: string | null;
  pagerNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  /** Online/phone orders: where it goes and when it's due. */
  channelLabel?: string | null;
  deliveryAddress?: string | null;
  dueLabel?: string | null;
  notes?: string | null;
  items: PrintLineItem[];
  subtotal?: number;
  discountAmount?: number;
  total: number;
  paymentMethod?: string | null;
  createdAt?: string;
  isTraining?: boolean;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number | undefined): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

export function buildReceiptHtml(order: PrintOrderPayload): string {
  const rows = order.items
    .map((item) => {
      const detail = [item.size, item.crust, item.detail, item.notes]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
        <td>${item.quantity}× ${esc(item.name)}${detail ? `<div class="muted">${esc(detail)}</div>` : ""}</td>
        <td class="right">${money(item.lineTotal ?? (item.unitPrice ?? 0) * item.quantity)}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html><html><head><title>Receipt #${order.ticketNumber ?? ""}</title>
  <style>
    body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;padding:16px;color:#111}
    h1{font-size:16px;margin:0 0 4px} .muted{color:#555;font-size:11px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    td{padding:4px 0;vertical-align:top} .right{text-align:right}
    .total{font-size:14px;font-weight:700;border-top:1px dashed #999;padding-top:8px;margin-top:8px}
    .banner{background:#111;color:#fff;padding:4px 8px;margin-bottom:8px;display:inline-block}
    @media print{body{padding:0}}
  </style></head><body>
  ${order.isTraining ? `<div class="banner">TRAINING — NOT A REAL SALE</div>` : ""}
  <h1>${esc(order.storeName)}</h1>
  ${order.locationName ? `<div class="muted">${esc(order.locationName)}</div>` : ""}
  <div><strong>Ticket #${order.ticketNumber ?? "—"}</strong></div>
  <div class="muted">${esc(order.fulfillmentType ?? "")}${order.tableNumber ? ` · Table ${esc(order.tableNumber)}` : ""}${order.pagerNumber ? ` · Pager ${esc(order.pagerNumber)}` : ""}</div>
  ${order.customerName ? `<div>For: ${esc(order.customerName)}</div>` : ""}
  ${order.customerPhone ? `<div class="muted">${esc(order.customerPhone)}</div>` : ""}
  <table>${rows}</table>
  <div class="total">
    ${order.discountAmount ? `<div class="muted">Discount −${money(order.discountAmount)}</div>` : ""}
    <div>Total ${money(order.total)}</div>
    <div class="muted">${esc(order.paymentMethod ?? "")} · ${esc(order.createdAt ?? new Date().toLocaleString())}</div>
  </div>
  ${order.notes ? `<p class="muted">Notes: ${esc(order.notes)}</p>` : ""}
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),400)}</script>
  </body></html>`;
}

export function buildKitchenTicketHtml(order: PrintOrderPayload): string {
  const rows = order.items
    .map((item) => {
      const mods = [item.size, item.crust, item.detail, item.notes]
        .filter(Boolean)
        .join(" / ");
      return `<div class="item"><strong>${item.quantity}× ${esc(item.name)}</strong>${mods ? `<div class="mods">${esc(mods)}</div>` : ""}</div>`;
    })
    .join("");

  return `<!doctype html><html><head><title>Kitchen #${order.ticketNumber ?? ""}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:18px;padding:12px;color:#000}
    h1{font-size:28px;margin:0} .meta{font-size:14px;margin:6px 0 12px}
    .item{border-bottom:1px solid #ccc;padding:8px 0} .mods{font-size:14px;margin-top:2px}
    .banner{background:#000;color:#fff;padding:4px 8px;margin-bottom:8px;display:inline-block}
    @media print{body{padding:0}}
  </style></head><body>
  ${order.isTraining ? `<div class="banner">TRAINING</div>` : ""}
  <h1>#${order.ticketNumber ?? "—"}</h1>
  <div class="meta">${order.channelLabel ? `<strong>${esc(order.channelLabel)}</strong> · ` : ""}${esc(order.fulfillmentType ?? "")}${order.tableNumber ? ` · T${esc(order.tableNumber)}` : ""}${order.pagerNumber ? ` · P${esc(order.pagerNumber)}` : ""}${order.customerName ? ` · ${esc(order.customerName)}` : ""}${order.customerPhone ? ` · ${esc(order.customerPhone)}` : ""}</div>
  ${order.dueLabel ? `<div class="banner">${esc(order.dueLabel)}</div>` : ""}
  ${order.deliveryAddress ? `<p><strong>DELIVER TO:</strong> ${esc(order.deliveryAddress)}</p>` : ""}
  ${rows}
  ${order.notes ? `<p><strong>NOTES:</strong> ${esc(order.notes)}</p>` : ""}
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),400)}</script>
  </body></html>`;
}

export function openPrintWindow(html: string): void {
  /* No "noopener" in the features: with it, window.open returns null and
     nothing was ever printed. Cut the back-reference by hand instead. */
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return;
  w.opener = null;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function printReceipt(order: PrintOrderPayload): void {
  openPrintWindow(buildReceiptHtml(order));
}

export function printKitchenTicket(order: PrintOrderPayload): void {
  openPrintWindow(buildKitchenTicketHtml(order));
}

export function buildEscPosText(order: PrintOrderPayload, kind: "receipt" | "kitchen"): string {
  const lines: string[] = [];
  lines.push(order.storeName);
  lines.push(`Ticket #${order.ticketNumber ?? "—"}`);
  if (order.tableNumber) lines.push(`Table ${order.tableNumber}`);
  if (order.pagerNumber) lines.push(`Pager ${order.pagerNumber}`);
  lines.push("---");
  for (const item of order.items) {
    lines.push(`${item.quantity}x ${item.name}`);
    const mods = [item.size, item.crust, item.detail].filter(Boolean).join(", ");
    if (mods) lines.push(`  ${mods}`);
  }
  if (kind === "receipt") {
    lines.push("---");
    lines.push(`TOTAL ${money(order.total)}`);
  }
  if (order.notes) lines.push(`Notes: ${order.notes}`);
  lines.push("\n\n\n");
  return lines.join("\n");
}
