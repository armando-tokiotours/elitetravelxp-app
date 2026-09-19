"use client";

import { useEffect, useState } from "react";
import { formatUsd } from "@/lib/builder-pricing";

export function CustomBudgetModal({
  open,
  onClose,
  initialValue,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initialValue: number | null;
  onSubmit: (amount: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRaw(initialValue != null && initialValue > 0 ? String(initialValue) : "");
    setError(null);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    const n = Number(String(raw).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n < 100) {
      setError("Enter a target budget of at least €100.");
      return;
    }
    onSubmit(Math.round(n));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-400">
              Custom Budget Matcher
            </p>
            <h3 className="mt-1 font-display text-2xl text-white">
              Set your target budget
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              We’ll use this figure to suggest optimized itinerary options for
              your trip.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300"
          >
            Close
          </button>
        </div>

        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Target budget (EUR)
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              €
            </span>
            <input
              type="number"
              min={100}
              step={50}
              inputMode="numeric"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
              placeholder="1200"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 pl-8 pr-3 text-lg font-semibold text-white outline-none focus:border-amber-500"
            />
          </div>
        </label>

        {raw && Number(raw) > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Preview: {formatUsd(Math.round(Number(raw) || 0))}
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={handleSubmit}
          className="mt-5 w-full rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-400"
        >
          Submit Budget Request
        </button>
      </div>
    </div>
  );
}
