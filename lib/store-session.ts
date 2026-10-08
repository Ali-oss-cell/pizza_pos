export const BRAND_SLUG_HEADER = "x-brand-slug";
export const LOCATION_ID_HEADER = "x-location-id";

const STORE_SLUG_KEY = "pos_store_slug";
const LOCATION_ID_KEY = "pos_location_id";
/** Which store this register belongs to. Survives logout so staff can sign in with a code. */
const DEVICE_STORE_KEY = "pos_device_store_slug";

export interface PosStoreSelection {
  storeSlug: string;
  locationId: string;
}

export function getStoreSelection(): PosStoreSelection | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storeSlug = localStorage.getItem(STORE_SLUG_KEY)?.trim().toLowerCase();
  const locationId = localStorage.getItem(LOCATION_ID_KEY)?.trim();

  if (!storeSlug || !locationId) {
    return null;
  }

  return { storeSlug, locationId };
}

export function getDeviceStoreSlug(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(DEVICE_STORE_KEY)?.trim().toLowerCase() || null;
}

export function setStoreSelection(selection: PosStoreSelection): void {
  localStorage.setItem(STORE_SLUG_KEY, selection.storeSlug.trim().toLowerCase());
  localStorage.setItem(DEVICE_STORE_KEY, selection.storeSlug.trim().toLowerCase());
  localStorage.setItem(LOCATION_ID_KEY, selection.locationId.trim());
}

export function clearStoreSelection(): void {
  localStorage.removeItem(STORE_SLUG_KEY);
  localStorage.removeItem(LOCATION_ID_KEY);
}
