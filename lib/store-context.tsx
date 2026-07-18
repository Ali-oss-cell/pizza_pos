"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/lib/auth-context";
import {
  clearStoreSelection,
  getStoreSelection,
  setStoreSelection,
  type PosStoreSelection,
} from "@/lib/store-session";
import type { PosStore, PosStoreLocation } from "@/types/auth";

interface StoreContextValue {
  stores: PosStore[];
  selectedStore: PosStore | null;
  selectedLocation: PosStoreLocation | null;
  isReady: boolean;
  selectStore: (storeSlug: string, locationId: string) => void;
  clearSelection: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function findSelection(
  stores: PosStore[],
  selection: PosStoreSelection | null,
): { store: PosStore; location: PosStoreLocation } | null {
  if (!selection) {
    return null;
  }

  const store = stores.find((item) => item.slug === selection.storeSlug);
  const location = store?.locations.find(
    (item) => item.id === selection.locationId,
  );

  if (!store || !location) {
    return null;
  }

  return { store, location };
}

export function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const { user } = useAuth();
  const [selection, setSelection] = useState<PosStoreSelection | null>(null);
  const [isReady, setIsReady] = useState(false);

  const stores = user?.stores ?? [];

  useEffect(() => {
    if (!user) {
      setSelection(null);
      setIsReady(true);
      return;
    }

    const stored = getStoreSelection();
    const matched = findSelection(user.stores, stored);

    if (matched) {
      setSelection({
        storeSlug: matched.store.slug,
        locationId: matched.location.id,
      });
      setIsReady(true);
      return;
    }

    if (stored) {
      clearStoreSelection();
    }

    if (user.stores.length === 1 && user.stores[0].locations.length === 1) {
      const only = {
        storeSlug: user.stores[0].slug,
        locationId: user.stores[0].locations[0].id,
      };
      setStoreSelection(only);
      setSelection(only);
      setIsReady(true);
      return;
    }

    if (
      user.stores.length === 1 &&
      user.stores[0].locations.length > 1
    ) {
      const preferred =
        user.stores[0].locations.find((location) => location.isDefault) ??
        user.stores[0].locations[0];
      const only = {
        storeSlug: user.stores[0].slug,
        locationId: preferred.id,
      };
      setStoreSelection(only);
      setSelection(only);
      setIsReady(true);
      return;
    }

    setSelection(null);
    setIsReady(true);
  }, [user]);

  const selectStore = useCallback((storeSlug: string, locationId: string) => {
    const next = {
      storeSlug: storeSlug.trim().toLowerCase(),
      locationId: locationId.trim(),
    };
    setStoreSelection(next);
    setSelection(next);
  }, []);

  const clearSelection = useCallback(() => {
    clearStoreSelection();
    setSelection(null);
  }, []);

  const matched = findSelection(stores, selection);

  const value = useMemo(
    () => ({
      stores,
      selectedStore: matched?.store ?? null,
      selectedLocation: matched?.location ?? null,
      isReady,
      selectStore,
      clearSelection,
    }),
    [stores, matched, isReady, selectStore, clearSelection],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }

  return context;
}
