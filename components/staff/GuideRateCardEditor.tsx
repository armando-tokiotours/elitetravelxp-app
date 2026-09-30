"use client";

import { useEffect, useState } from "react";
import type PocketBase from "pocketbase";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import {
  ensureGuideProfile,
  updateGuideProfile,
  type GuideProfile,
} from "@/lib/roleProfiles";

export function GuideRateCardEditor({
  getClient,
  staffId,
  seedName,
  seedEmail,
}: {
  getClient: () => PocketBase;
  staffId: string;
  seedName?: string;
  seedEmail?: string;
}) {
  const [guide, setGuide] = useState<GuideProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [availability, setAvailability] = useState("");
  const [notes, setNotes] = useState("");
  const [rate6, setRate6] = useState("");
  const [rate8, setRate8] = useState("");
  const [extraHead, setExtraHead] = useState("");
  const [feeMin, setFeeMin] = useState("");
  const [feeMax, setFeeMax] = useState("");
  const [currency, setCurrency] = useState("JPY");
  const [jlpt, setJlpt] = useState("");

  useEffect(() => {
    if (!staffId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const g = await ensureGuideProfile(getClient(), staffId, {
          full_name: seedName,
          email: seedEmail,
        });
        setGuide(g);
        setFullName(String(g.full_name || ""));
        setEmail(String(g.email || seedEmail || ""));
        setPhone(String(g.phone_number || ""));
        setCity(String(g.city_of_operation || ""));
        setAvailability(String(g.availability_pattern || ""));
        setNotes(String(g.availability_notes || ""));
        setRate6(g.base_rate_6h_or_less != null ? String(g.base_rate_6h_or_less) : "");
        setRate8(g.base_rate_8h_or_less != null ? String(g.base_rate_8h_or_less) : "");
        setExtraHead(
          g.extra_head_percentage != null ? String(g.extra_head_percentage) : ""
        );
        setFeeMin(g.fee_min != null ? String(g.fee_min) : "");
        setFeeMax(g.fee_max != null ? String(g.fee_max) : "");
        setCurrency(String(g.rate_currency || "JPY"));
        setJlpt(String(g.japanese_jlpt_level || ""));
      } catch (e) {
        setError(formatPbError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [getClient, staffId, seedName, seedEmail]);

  const save = async () => {
    if (!guide) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const updated = await updateGuideProfile(getClient(), guide.id, {
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        city_of_operation: city.trim(),
        availability_pattern: availability || "",
        availability_notes: notes.trim(),
        base_rate_6h_or_less: Number(rate6) || 0,
        base_rate_8h_or_less: Number(rate8) || 0,
        extra_head_percentage: Number(extraHead) || 0,
        fee_min: Number(feeMin) || 0,
        fee_max: Number(feeMax) || 0,
        rate_currency: currency,
        japanese_jlpt_level: jlpt || "",
      });
      setGuide(updated);
      setMsg("Guide rate card saved.");
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-zinc-400">Loading guide card…</p>;
  if (error && !guide)
    return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <h3 className="font-medium text-white">Guide rate card</h3>
      <p className="text-xs text-zinc-500">
        Default labor fees used when ops picks “guide card default”.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Full name", fullName, setFullName],
            ["Email", email, setEmail],
            ["Phone", phone, setPhone],
            ["City of operation", city, setCity],
          ] as const
        ).map(([label, value, set]) => (
          <label
            key={label}
            className="block text-xs uppercase tracking-wider text-zinc-500"
          >
            {label}
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
              value={value}
              onChange={(e) => set(e.target.value)}
            />
          </label>
        ))}
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          Availability
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
          >
            <option value="">—</option>
            <option value="Full-Time">Full-Time</option>
            <option value="Weekends Only">Weekends Only</option>
            <option value="Part-Time">Part-Time</option>
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          JLPT
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            value={jlpt}
            onChange={(e) => setJlpt(e.target.value)}
          >
            <option value="">—</option>
            {["N5", "N4", "N3", "N2", "N1", "Native", "None"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-500 sm:col-span-2">
          Availability notes
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {(
          [
            ["Base ≤6h", rate6, setRate6],
            ["Base ≤8h", rate8, setRate8],
            ["Extra head %", extraHead, setExtraHead],
            ["Fee min", feeMin, setFeeMin],
            ["Fee max", feeMax, setFeeMax],
          ] as const
        ).map(([label, value, set]) => (
          <label
            key={label}
            className="block text-xs uppercase tracking-wider text-zinc-500"
          >
            {label}
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
              value={value}
              onChange={(e) => set(e.target.value)}
            />
          </label>
        ))}
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          Currency
          <select
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="JPY">JPY</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-full bg-[#075473] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save rate card"}
      </button>
    </div>
  );
}
