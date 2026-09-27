"use client";

export default function ShiftPage(): React.ReactElement {
  return (
    <div className="glass-panel mx-auto max-w-lg rounded-2xl p-6">
      <h1 className="text-xl font-semibold text-zinc-50">Shifts</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Shifts are opened and closed from the store dashboard, under Locations.
        Staff use the code their manager gave them, then change it on first login.
      </p>
    </div>
  );
}
