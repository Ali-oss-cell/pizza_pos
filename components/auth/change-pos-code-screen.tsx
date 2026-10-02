"use client";

import { useState } from "react";
import { apiFetch, getAuthToken, setAuthSession } from "@/lib/api";
import { POS_ENTRY_CODE_KEY, useAuth } from "@/lib/auth-context";
import type { PosUser } from "@/types/auth";
import { normalizePosUser } from "@/types/auth";

export function ChangePosCodeScreen(): React.ReactElement | null {
  const { user } = useAuth();
  const [knownCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(POS_ENTRY_CODE_KEY) ?? "";
  });
  const [currentPin, setCurrentPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user?.posPinMustChange) {
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (nextPin !== confirmPin) {
      setError("New codes do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const startingCode = knownCode || currentPin;
      await apiFetch("/pos/auth/change-pin", {
        method: "POST",
        body: JSON.stringify({ currentPin: startingCode, newPin: nextPin }),
      });
      sessionStorage.removeItem(POS_ENTRY_CODE_KEY);
      const token = getAuthToken();
      const nextUser = normalizePosUser({
        ...(user as PosUser),
        posPinMustChange: false,
      });
      if (token) {
        setAuthSession(token, nextUser);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-zinc-950/95 p-6">
      <form
        className="glass-panel w-full max-w-md rounded-2xl p-8"
        onSubmit={(e) => void submit(e)}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          First login
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
          Change your POS code
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {knownCode
            ? "Choose your own code. You will use it every time you sign in."
            : "Enter the code your manager gave you, then choose a new one."}
        </p>
        {knownCode ? null : (
          <label className="mt-5 block text-sm text-zinc-300">
            Code from manager
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center font-mono text-xl tracking-[0.4em]"
              inputMode="numeric"
              maxLength={6}
              type="password"
              value={currentPin}
              onChange={(e) =>
                setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </label>
        )}
        <label
          className={`${knownCode ? "mt-5" : "mt-3"} block text-sm text-zinc-300`}
        >
          New code
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center font-mono text-xl tracking-[0.4em]"
            inputMode="numeric"
            maxLength={6}
            type="password"
            value={nextPin}
            onChange={(e) =>
              setNextPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </label>
        <label className="mt-3 block text-sm text-zinc-300">
          Confirm new code
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center font-mono text-xl tracking-[0.4em]"
            inputMode="numeric"
            maxLength={6}
            type="password"
            value={confirmPin}
            onChange={(e) =>
              setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </label>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <button
          className="mt-5 w-full rounded-2xl bg-pay-gradient py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={
            busy ||
            (knownCode ? knownCode.length < 4 : currentPin.length < 4) ||
            nextPin.length < 4 ||
            confirmPin.length < 4
          }
          type="submit"
        >
          {busy ? "Saving…" : "Save new code"}
        </button>
      </form>
    </div>
  );
}
