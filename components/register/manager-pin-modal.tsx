"use client";

import { useState } from "react";
import { useStaffPin } from "@/lib/staff-pin-context";

export function ManagerPinModal({
  open,
  title,
  description,
  onCancel,
  onApproved,
}: {
  open: boolean;
  title: string;
  description?: string;
  onCancel: () => void;
  onApproved: (token: string) => void;
}): React.ReactElement | null {
  const { requestManagerToken } = useStaffPin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await requestManagerToken(pin);
      setPin("");
      onApproved(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm">
      <form
        className="glass-panel w-full max-w-sm rounded-2xl p-5"
        onSubmit={(e) => void submit(e)}
      >
        <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        ) : null}
        <input
          autoFocus
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] text-zinc-50 outline-none focus:ring-2 focus:ring-rose-500/40"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-zinc-300"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="flex-1 rounded-xl bg-pay-gradient px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy || pin.length < 4}
            type="submit"
          >
            {busy ? "Checking…" : "Approve"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function StaffLockScreen(): React.ReactElement | null {
  const { locked, unlockWithPin, activeStaff } = useStaffPin();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!locked) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlockWithPin(pin);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/95 p-6 backdrop-blur-md">
      <form
        className="glass-panel w-full max-w-md rounded-2xl p-8 text-center"
        onSubmit={(e) => void submit(e)}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Register locked
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Enter staff PIN</h2>
        {activeStaff ? (
          <p className="mt-1 text-sm text-zinc-400">
            Last: {activeStaff.firstName} {activeStaff.lastName}
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-400">
            Set a PIN under Shift if none exists yet.
          </p>
        )}
        <input
          autoFocus
          className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center font-mono text-3xl tracking-[0.5em] text-zinc-50 outline-none focus:ring-2 focus:ring-rose-500/40"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <button
          className="mt-5 w-full rounded-2xl bg-pay-gradient py-3 text-sm font-semibold text-white shadow-pay-glow disabled:opacity-50"
          disabled={busy || pin.length < 4}
          type="submit"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
