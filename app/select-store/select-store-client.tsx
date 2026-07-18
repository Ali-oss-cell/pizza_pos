"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { cn } from "@/lib/utils";

function SelectStoreForm(): React.ReactElement | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const { stores, selectedStore, selectedLocation, isReady, selectStore } =
    useStore();

  const [storeSlug, setStoreSlug] = useState("");
  const [locationId, setLocationId] = useState("");

  const activeStore = useMemo(
    () => stores.find((store) => store.slug === storeSlug) ?? null,
    [stores, storeSlug],
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (selectedStore && selectedLocation) {
      const from = searchParams.get("from");
      router.replace(from && from.startsWith("/") ? from : "/register");
      return;
    }

    if (stores.length === 1) {
      setStoreSlug(stores[0].slug);
      const preferred =
        stores[0].locations.find((location) => location.isDefault) ??
        stores[0].locations[0];
      if (preferred) {
        setLocationId(preferred.id);
      }
    }
  }, [isReady, selectedStore, selectedLocation, stores, router, searchParams]);

  useEffect(() => {
    if (!activeStore) {
      setLocationId("");
      return;
    }

    const stillValid = activeStore.locations.some(
      (location) => location.id === locationId,
    );
    if (stillValid) {
      return;
    }

    const preferred =
      activeStore.locations.find((location) => location.isDefault) ??
      activeStore.locations[0];
    setLocationId(preferred?.id ?? "");
  }, [activeStore, locationId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storeSlug || !locationId) {
      return;
    }

    selectStore(storeSlug, locationId);
    const from = searchParams.get("from");
    router.push(from && from.startsWith("/") ? from : "/register");
  }

  if (!user) {
    return null;
  }

  if (stores.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <section className="w-full max-w-md rounded-2xl bg-surface-container p-6 text-center">
          <h1 className="text-2xl font-semibold">No store access</h1>
          <p className="mt-2 text-sm text-outline">
            Your account is not assigned to any store. Contact a platform admin.
          </p>
          <button
            className="mt-6 min-h-touch w-full rounded-lg bg-surface-container-high px-4 py-3 font-semibold"
            type="button"
            onClick={logout}
          >
            Sign out
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <section className="w-full max-w-md rounded-2xl bg-surface-container p-6">
        <p className="text-sm uppercase tracking-widest text-outline">POS</p>
        <h1 className="mt-1 text-2xl font-semibold">Select store</h1>
        <p className="mt-2 text-sm text-outline">
          Orders and menu will stay locked to this store until you switch.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Store</span>
            <select
              className="min-h-touch w-full rounded-lg border border-white/10 bg-surface px-4"
              value={storeSlug}
              onChange={(event) => setStoreSlug(event.target.value)}
              required
            >
              <option value="" disabled>
                Choose a store…
              </option>
              {stores.map((store) => (
                <option key={store.id} value={store.slug}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>

          {activeStore && activeStore.locations.length > 1 ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium">Location</span>
              <select
                className="min-h-touch w-full rounded-lg border border-white/10 bg-surface px-4"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                required
              >
                {activeStore.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            className={cn(
              "min-h-touch w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white",
              (!storeSlug || !locationId) && "opacity-70",
            )}
            type="submit"
            disabled={!storeSlug || !locationId}
          >
            Continue
          </button>
        </form>

        <button
          className="mt-4 w-full text-left text-sm text-outline hover:text-on-surface"
          type="button"
          onClick={logout}
        >
          Sign out
        </button>
      </section>
    </div>
  );
}

export default function SelectStorePage(): React.ReactElement {
  return (
    <RequireAuth>
      <SelectStoreForm />
    </RequireAuth>
  );
}
