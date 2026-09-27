"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { printReceipt, type PrintOrderPayload } from "@/lib/print";
import { useStaffPin } from "@/lib/staff-pin-context";
import { formatAud } from "@/lib/format";
import { ManagerPinModal } from "@/components/register/manager-pin-modal";

interface ShiftReport {
  cashSalesTotal: number;
  cardTotal: number;
  discountTotal: number;
  voidCount: number;
  refundTotal: number;
  expectedCash: number;
  orderCount: number;
  variance?: number;
  shift: {
    id: string;
    openingFloat: string | number;
    openedAt: string;
  };
}

export default function ShiftPage(): React.ReactElement {
  const { user } = useAuth();
  const { activeStaff, setOwnPin, lock } = useStaffPin();
  const [openShift, setOpenShift] = useState<{ id: string } | null>(null);
  const [openingFloat, setOpeningFloat] = useState("100");
  const [countedCash, setCountedCash] = useState("");
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [training, setTraining] = useState(false);

  async function refresh() {
    try {
      const settings = await apiFetch<{
        openShift: { id: string } | null;
        posTrainingMode: boolean;
      }>("/pos/settings");
      setOpenShift(settings.openShift);
      setTraining(settings.posTrainingMode);
      if (settings.openShift) {
        const r = await apiFetch<ShiftReport>(
          `/pos/shifts/${settings.openShift.id}/report`,
        );
        setReport(r);
      } else {
        setReport(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shift");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function openShiftAction() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/pos/shifts/open", {
        method: "POST",
        body: JSON.stringify({ openingFloat: Number(openingFloat) || 0 }),
      });
      setMessage("Shift opened");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open shift");
    } finally {
      setBusy(false);
    }
  }

  async function closeShiftAction() {
    if (!openShift) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ report: ShiftReport }>(
        `/pos/shifts/${openShift.id}/close`,
        {
          method: "POST",
          body: JSON.stringify({
            closingCountedCash: Number(countedCash) || 0,
          }),
        },
      );
      setMessage(
        `Shift closed · variance ${formatAud(result.report.variance ?? 0)}`,
      );
      const payload: PrintOrderPayload = {
        storeName: "Z-Report",
        ticketNumber: openShift.id.slice(0, 8),
        items: [
          {
            name: `Cash sales ${formatAud(result.report.cashSalesTotal)}`,
            quantity: 1,
            lineTotal: result.report.cashSalesTotal,
          },
          {
            name: `Card sales ${formatAud(result.report.cardTotal)}`,
            quantity: 1,
            lineTotal: result.report.cardTotal,
          },
          {
            name: `Expected cash ${formatAud(result.report.expectedCash)}`,
            quantity: 1,
            lineTotal: result.report.expectedCash,
          },
          {
            name: `Counted ${formatAud(Number(countedCash) || 0)}`,
            quantity: 1,
            lineTotal: Number(countedCash) || 0,
          },
        ],
        total: result.report.expectedCash,
        paymentMethod: `Variance ${formatAud(result.report.variance ?? 0)}`,
      };
      printReceipt(payload);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close shift");
    } finally {
      setBusy(false);
    }
  }

  async function savePin() {
    const target = activeStaff?.id ?? user?.id;
    if (!target || pin.length < 4) return;
    setBusy(true);
    try {
      await setOwnPin(target, pin);
      setMessage("PIN saved");
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-zinc-50">Shift</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {activeStaff
                ? `Active: ${activeStaff.firstName} ${activeStaff.lastName}`
                : "Unlock with PIN on the register"}
            </p>
          </div>
          <button
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300"
            type="button"
            onClick={lock}
          >
            Lock register
          </button>
        </div>

        {message ? (
          <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-300">
            Set / update my PIN
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono tracking-widest"
              inputMode="numeric"
              maxLength={6}
              type="password"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </label>
          <div className="flex items-end">
            <button
              className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold"
              disabled={busy || pin.length < 4}
              type="button"
              onClick={() => void savePin()}
            >
              Save PIN
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        {!openShift ? (
          <>
            <h2 className="font-semibold text-zinc-50">Open shift</h2>
            <label className="mt-3 block text-sm text-zinc-300">
              Opening float
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono"
                type="number"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
              />
            </label>
            <button
              className="mt-4 w-full rounded-2xl bg-pay-gradient py-3 text-sm font-semibold text-white shadow-pay-glow disabled:opacity-50"
              disabled={busy}
              type="button"
              onClick={() => void openShiftAction()}
            >
              Open shift
            </button>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-zinc-50">Open shift report</h2>
            {report ? (
              <ul className="mt-3 space-y-1 text-sm text-zinc-300">
                <li>Orders paid: {report.orderCount}</li>
                <li>Cash sales: {formatAud(report.cashSalesTotal)}</li>
                <li>Card sales: {formatAud(report.cardTotal)}</li>
                <li>Discounts: {formatAud(report.discountTotal)}</li>
                <li>Voids: {report.voidCount}</li>
                <li>Refunds: {formatAud(report.refundTotal)}</li>
                <li className="font-semibold text-zinc-50">
                  Expected cash: {formatAud(report.expectedCash)}
                </li>
              </ul>
            ) : null}
            <label className="mt-4 block text-sm text-zinc-300">
              Counted cash in drawer
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono"
                type="number"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
              />
            </label>
            <button
              className="mt-4 w-full rounded-2xl bg-amber-400 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              disabled={busy || countedCash === ""}
              type="button"
              onClick={() => void closeShiftAction()}
            >
              Close shift & print Z-report
            </button>
          </>
        )}
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <h2 className="font-semibold text-zinc-50">Training mode</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Currently {training ? "ON" : "OFF"}. Manager PIN required to toggle.
        </p>
        <button
          className="mt-3 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold"
          type="button"
          onClick={() => setPinModal(true)}
        >
          Toggle training mode
        </button>
      </div>

      <ManagerPinModal
        description="Confirm training mode change"
        open={pinModal}
        title="Manager PIN"
        onCancel={() => setPinModal(false)}
        onApproved={(token) => {
          setPinModal(false);
          void apiFetch("/pos/settings/training", {
            method: "POST",
            body: JSON.stringify({
              enabled: !training,
              managerActionToken: token,
            }),
          })
            .then(() => refresh())
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : "Failed"),
            );
        }}
      />
    </div>
  );
}
