import { apiFetch } from "@/lib/api";
import type { ComboDeal } from "@/types/combo-deals";

export function fetchComboDeals(): Promise<ComboDeal[]> {
  return apiFetch<ComboDeal[]>("/combo-deals");
}

export function comboBundlePrice(deal: ComboDeal): number {
  const n = Number(deal.bundlePrice);
  return Number.isFinite(n) ? n : 0;
}
