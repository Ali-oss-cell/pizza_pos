export function formatAud(amount: number | string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Number.isFinite(value) ? value : 0);
}
