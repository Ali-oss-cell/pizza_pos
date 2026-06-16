"use client";

import type { MenuItem } from "@/types/menu";
import { formatAud } from "@/lib/format";
import { getDisplayPrice } from "@/lib/menu";
import { cn } from "@/lib/utils";

interface SizePickerDialogProps {
  item: MenuItem;
  open: boolean;
  onClose: () => void;
  onSelect: (size: string) => void;
}

const SIZE_LABELS: Array<{ key: "small" | "large" | "family"; label: string }> =
  [
    { key: "small", label: "Small" },
    { key: "large", label: "Large" },
    { key: "family", label: "Family" },
  ];

export function SizePickerDialog({
  item,
  open,
  onClose,
  onSelect,
}: SizePickerDialogProps): React.ReactElement | null {
  if (!open) {
    return null;
  }

  const options = SIZE_LABELS.filter(
    (entry) => item.sizeOptions?.[entry.key]?.enabled,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface-container p-6">
        <h3 className="text-xl font-semibold">{item.name}</h3>
        <p className="mt-1 text-sm text-outline">Choose a size</p>

        <div className="mt-4 space-y-2">
          {options.map((entry) => (
            <button
              key={entry.key}
              className={cn(
                "min-h-touch flex w-full items-center justify-between rounded-xl bg-surface px-4 py-3 text-left font-medium",
              )}
              type="button"
              onClick={() => {
                onSelect(entry.label);
                onClose();
              }}
            >
              <span>{entry.label}</span>
              <span>{formatAud(getDisplayPrice(item, entry.label))}</span>
            </button>
          ))}
        </div>

        <button
          className="mt-4 min-h-touch w-full rounded-xl border border-white/10 px-4 py-3"
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
