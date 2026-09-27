"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

export interface ActiveStaff {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  email?: string;
}

interface StaffPinContextValue {
  activeStaff: ActiveStaff | null;
  locked: boolean;
  managerActionToken: string | null;
  lock: () => void;
  unlockWithPin: (pin: string) => Promise<ActiveStaff>;
  clearManagerToken: () => void;
  requestManagerToken: (pin: string) => Promise<string>;
  setOwnPin: (userId: string, pin: string) => Promise<void>;
}

const StaffPinContext = createContext<StaffPinContextValue | null>(null);
const ACTIVE_KEY = "pos_active_staff";
const IDLE_MS = 10 * 60 * 1000;

export function StaffPinProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [activeStaff, setActiveStaff] = useState<ActiveStaff | null>(null);
  const [locked, setLocked] = useState(false);
  const [managerActionToken, setManagerActionToken] = useState<string | null>(
    null,
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_KEY);
      if (raw) {
        setActiveStaff(JSON.parse(raw) as ActiveStaff);
        setLocked(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (locked) return;
    let timer = window.setTimeout(() => setLocked(true), IDLE_MS);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), IDLE_MS);
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [locked]);

  const lock = useCallback(() => {
    setLocked(true);
    setManagerActionToken(null);
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const result = await apiFetch<{
      user: ActiveStaff;
      managerActionToken: string | null;
    }>("/pos/auth/verify-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    setActiveStaff(result.user);
    sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(result.user));
    setManagerActionToken(result.managerActionToken);
    setLocked(false);
    return result.user;
  }, []);

  const requestManagerToken = useCallback(async (pin: string) => {
    const result = await apiFetch<{
      managerActionToken: string | null;
      canApproveManagerActions: boolean;
    }>("/pos/auth/verify-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    if (!result.managerActionToken) {
      throw new Error("Manager PIN required");
    }
    setManagerActionToken(result.managerActionToken);
    return result.managerActionToken;
  }, []);

  const setOwnPin = useCallback(async (userId: string, pin: string) => {
    await apiFetch("/pos/auth/set-pin", {
      method: "POST",
      body: JSON.stringify({ userId, pin }),
    });
  }, []);

  const value = useMemo(
    () => ({
      activeStaff,
      locked,
      managerActionToken,
      lock,
      unlockWithPin,
      clearManagerToken: () => setManagerActionToken(null),
      requestManagerToken,
      setOwnPin,
    }),
    [
      activeStaff,
      locked,
      managerActionToken,
      lock,
      unlockWithPin,
      requestManagerToken,
      setOwnPin,
    ],
  );

  return (
    <StaffPinContext.Provider value={value}>{children}</StaffPinContext.Provider>
  );
}

export function useStaffPin(): StaffPinContextValue {
  const ctx = useContext(StaffPinContext);
  if (!ctx) {
    throw new Error("useStaffPin must be used within StaffPinProvider");
  }
  return ctx;
}
