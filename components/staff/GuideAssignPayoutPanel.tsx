"use client";

import { useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  resolveAndSaveGuideAssignment,
  type FeeSource,
} from "@/lib/pricing/guidePayoutResolver";
import { getGuideByStaff } from "@/lib/roleProfiles";

/**
 * Ops: after a guide staff is assigned, snapshot payout terms.
 */
export function GuideAssignPayoutPanel({
  pb,
  pnr,
  staffGuideId,
  defaultRetail,
  defaultHours = 8,
  guestCount = 2,
}: {
  pb: PocketBase;
  pnr: string;
  /** ops_dispatch.assigned_guide_id (staff id) */
  staffGuideId: string;
  defaultRetail?: number;
  defaultHours?: number;
  guestCount?: number;
}) {
  const [source, setSource] = useState<FeeSource>("guide_card_default");
  const [hours, setHours] = useState(String(defaultHours));
  const [retail, setRetail] = useState(String(defaultRetail || ""));
  const [manualFee, setManualFee] = useState("");
  const [manualExp, setManualExp] = useState("");
  const [currency, setCurrency] = useState<"JPY" | "EUR">("JPY");
  const [tourId, setTourId] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const guide = await getGuideByStaff(pb, staffGuideId);
      if (!guide) {
        throw new Error(
          "No guides profile for this staff — open Guide portal → Rate card first."
        );
      }
      const result = await resolveAndSaveGuideAssignment(pb, {
        pnr,
        guideId: guide.id,
        tourId: tourId.trim() || undefined,
        durationHours: Number(hours) || 8,
        guestCount,
        retailPriceClient: Number(retail) || 0,
        currency,
        selectedSource: source,
        manualFeeOverride: Number(manualFee) || 0,
        manualExpensesOverride: Number(manualExp) || 0,
      });
      setMsg(
        `Saved · fee ${result.resolvedFee} + exp ${result.resolvedExpenses} = ${result.totalPayout} · margin ${result.netMargin}`
      );
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  if (!staffGuideId) return null;

  return (
    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Guide payout snapshot
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block text-[10px] uppercase text-zinc-500">
          Fee source
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={source}
            onChange={(e) => setSource(e.target.value as FeeSource)}
          >
            <option value="guide_card_default">Guide card default</option>
            <option value="tour_standard">Tour standard</option>
            <option value="manual_override">Manual override</option>
          </select>
        </label>
        <label className="block text-[10px] uppercase text-zinc-500">
          Hours
          <input
            type="number"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </label>
        <label className="block text-[10px] uppercase text-zinc-500">
          Retail (client)
          <input
            type="number"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={retail}
            onChange={(e) => setRetail(e.target.value)}
          />
        </label>
        <label className="block text-[10px] uppercase text-zinc-500">
          Currency
          <select
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "JPY" | "EUR")}
          >
            <option value="JPY">JPY</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        {source === "tour_standard" ? (
          <label className="block text-[10px] uppercase text-zinc-500 sm:col-span-2">
            Tour id (PB)
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
              value={tourId}
              onChange={(e) => setTourId(e.target.value)}
            />
          </label>
        ) : null}
        {source === "manual_override" ? (
          <>
            <label className="block text-[10px] uppercase text-zinc-500">
              Manual fee
              <input
                type="number"
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                value={manualFee}
                onChange={(e) => setManualFee(e.target.value)}
              />
            </label>
            <label className="block text-[10px] uppercase text-zinc-500">
              Manual expenses
              <input
                type="number"
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                value={manualExp}
                onChange={(e) => setManualExp(e.target.value)}
              />
            </label>
          </>
        ) : null}
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="mt-2 rounded-lg bg-[#1BA58A] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save payout assignment"}
      </button>
      {msg ? <p className="mt-1 text-[11px] text-emerald-400">{msg}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}
