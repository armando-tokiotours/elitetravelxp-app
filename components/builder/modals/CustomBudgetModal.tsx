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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl sm:p-6">
        <div className="mb-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[#D9BB96]">
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
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3 pl-8 pr-3 text-lg font-semibold text-white outline-none focus:border-[#B85304]"
            />
          </div>
        </label>

        {raw && Number(raw) > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Preview: {formatUsd(Math.round(Number(raw) || 0))}
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full rounded-xl bg-[#D9BB96] py-3 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#c9ab86] sm:flex-1"
          >
            Confirm Selection
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-zinc-700 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 sm:flex-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
