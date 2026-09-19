"use client";

import type PocketBase from "pocketbase";
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import type { PbSeasonTier } from "@/lib/pocketbase/client";

type PbClient = PocketBase;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const TIERS = ["Low", "Mid", "High"] as const;

const CSV_HEADERS = [
  "Month",
  "Start Day",
  "End Day",
  "Tier",
  "Crowd Level",
  "Concierge Note",
  "Sort Order",
  "Active",
] as const;

type CsvRow = Record<(typeof CSV_HEADERS)[number], string | number>;

type Draft = {
  id?: string;
  month: string;
  start_day: number;
  end_day: number;
  tier: string;
  crowd_level: string;
  concierge_note: string;
  is_active: boolean;
  sort_order: number;
};

const emptyDraft = (): Draft => ({
  month: "January",
  start_day: 1,
  end_day: 31,
  tier: "Low",
  crowd_level: "",
  concierge_note: "",
  is_active: true,
  sort_order: 0,
});

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[€$£()\s_\-./]/g, "");
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  const entries = Object.entries(row);
  for (const k of keys) {
    const nk = normalizeHeader(k);
    if (!nk) continue;
    const hit = entries.find(([rk]) => {
      const nr = normalizeHeader(rk);
      if (!nr) return false;
      if (nr === nk) return true;
      if (nk.length >= 4 && (nr.includes(nk) || nk.includes(nr))) return true;
      return false;
    });
    if (hit && hit[1] != null && String(hit[1]).trim() !== "") {
      return String(hit[1]).trim();
    }
  }
  return "";
}

function num(row: Record<string, unknown>, ...keys: string[]): number | null {
  const raw = cell(row, ...keys).replace(/[,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeMonth(raw: string): string | null {
  if (!raw) return null;
  return (
    MONTHS.find(
      (m) =>
        m.toLowerCase() === raw.toLowerCase() ||
        m.slice(0, 3).toLowerCase() === raw.slice(0, 3).toLowerCase()
    ) || null
  );
}

function normalizeTier(raw: string): "Low" | "Mid" | "High" | null {
  const s = raw.toLowerCase();
  if (s.includes("low")) return "Low";
  if (s.includes("mid")) return "Mid";
  if (s.includes("high")) return "High";
  return null;
}

function normalizeActive(raw: string): boolean {
  const s = raw.toLowerCase().trim();
  if (!s) return true;
  if (["false", "0", "no", "off", "inactive"].includes(s)) return false;
  return true;
}

function downloadCsv(rows: CsvRow[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...CSV_HEADERS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Seasonality");
  XLSX.writeFile(wb, filename, { bookType: "csv" });
}

export function SeasonalityPanel({ getClient }: { getClient: () => PbClient }) {
  const [rows, setRows] = useState<PbSeasonTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyCsv, setBusyCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getClient()
        .collection("season_tiers")
        .getFullList<PbSeasonTier>({ sort: "sort_order,month,start_day" });
      setRows(list);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setLoading(false);
    }
  }, [getClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    setMsg(null);
    const data: CsvRow[] = rows.map((row) => ({
      Month: row.month,
      "Start Day": row.start_day,
      "End Day": row.end_day,
      Tier: row.tier,
      "Crowd Level": row.crowd_level || "",
      "Concierge Note": row.concierge_note || "",
      "Sort Order": row.sort_order ?? 0,
      Active: row.is_active === false ? "false" : "true",
    }));
    if (!data.length) {
      downloadCsv(
        [
          {
            Month: "January",
            "Start Day": 1,
            "End Day": 3,
            Tier: "High",
            "Crowd Level": "High Crowds",
            "Concierge Note":
              "New Year holidays. Expect peak crowds and premium rates.",
            "Sort Order": 10,
            Active: "true",
          },
          {
            Month: "January",
            "Start Day": 4,
            "End Day": 31,
            Tier: "Low",
            "Crowd Level": "Quiet",
            "Concierge Note": "Quiet winter travel with softer hotel rates.",
            "Sort Order": 20,
            Active: "true",
          },
        ],
        "seasonality-rules-template.csv"
      );
      setMsg("No rules yet — downloaded a starter template CSV.");
      return;
    }
    downloadCsv(data, "seasonality-rules-export.csv");
    setMsg(`Exported ${data.length} seasonality rule(s).`);
  };

  const importCsv = async (file: File) => {
    setBusyCsv(true);
    setMsg(null);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet =
        wb.Sheets[
          wb.SheetNames.find((n) => /season/i.test(n)) || wb.SheetNames[0]
        ];
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      if (!parsed.length) throw new Error("No data rows found in the file.");

      const pb = getClient();
      let imported = 0;
      let skipped = 0;
      const batch: Record<string, unknown>[] = [];

      for (const row of parsed) {
        const month = normalizeMonth(
          cell(row, "Month", "month_name", "month")
        );
        const tier = normalizeTier(
          cell(row, "Tier", "Season Tier", "season_tier", "season")
        );
        const start_day = num(row, "Start Day", "start_day", "start", "from");
        const end_day = num(row, "End Day", "end_day", "end", "to");
        if (!month || !tier || start_day == null || end_day == null) {
          skipped++;
          continue;
        }
        if (start_day < 1 || start_day > 31 || end_day < 1 || end_day > 31) {
          skipped++;
          continue;
        }
        batch.push({
          month,
          start_day,
          end_day,
          tier,
          crowd_level: cell(row, "Crowd Level", "crowds", "crowd_level"),
          concierge_note: cell(
            row,
            "Concierge Note",
            "note",
            "concierge_note",
            "description"
          ),
          sort_order: num(row, "Sort Order", "sort_order", "sort") ?? imported,
          is_active: normalizeActive(
            cell(row, "Active", "is_active", "enabled")
          ),
        });
      }

      for (let i = 0; i < batch.length; i += 20) {
        const chunk = batch.slice(i, i + 20);
        await Promise.all(
          chunk.map((payload) => pb.collection("season_tiers").create(payload))
        );
        imported += chunk.length;
      }

      setMsg(
        `Imported ${imported} seasonality rule(s).${
          skipped ? ` Skipped ${skipped} invalid row(s).` : ""
        }`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : formatPbError(e));
    } finally {
      setBusyCsv(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const payload = {
        month: editing.month,
        start_day: Number(editing.start_day),
        end_day: Number(editing.end_day),
        tier: editing.tier,
        crowd_level: editing.crowd_level,
        concierge_note: editing.concierge_note,
        is_active: editing.is_active,
        sort_order: Number(editing.sort_order) || 0,
      };
      const pb = getClient();
      if (editing.id) {
        await pb.collection("season_tiers").update(editing.id, payload);
      } else {
        await pb.collection("season_tiers").create(payload);
      }
      setEditing(null);
      setMsg("Seasonality rule saved.");
      await load();
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this seasonality rule?")) return;
    try {
      await getClient().collection("season_tiers").delete(id);
      await load();
    } catch (e) {
      setError(formatPbError(e));
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Seasonality Rules</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Map calendar windows to Low / Mid / High hotel tiers and concierge
            notes shown when guests pick an arrival date.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyCsv}
            onClick={exportCsv}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            disabled={busyCsv}
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 disabled:opacity-50"
          >
            {busyCsv ? "Importing…" : "Import CSV"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCsv(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => setEditing(emptyDraft())}
            className="rounded-full bg-[#B85304] px-4 py-2 text-sm font-semibold text-zinc-100"
          >
            + Add rule
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-[#A39A8E]">
        CSV columns: Month, Start Day, End Day, Tier, Crowd Level, Concierge
        Note, Sort Order, Active
      </p>

      {error ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {msg ? <p className="mb-3 text-sm text-emerald-700">{msg}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-400">Loading season_tiers…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No rules yet. Export a template CSV or click + Add rule.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-400">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium">Days</th>
                <th className="pb-2 font-medium">Tier</th>
                <th className="pb-2 font-medium">Crowds</th>
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#F5F0E8]">
                  <td className="py-3 pr-2 font-medium text-zinc-100">
                    {row.month}
                    {row.is_active === false ? (
                      <span className="ml-2 text-xs text-[#B8B0A4]">
                        (off)
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-2 text-[#5C6570]">
                    {row.start_day}–{row.end_day}
                  </td>
                  <td className="py-3 pr-2">
                    <TierBadge tier={row.tier} />
                  </td>
                  <td className="py-3 pr-2 text-[#5C6570]">
                    {row.crowd_level || "—"}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      className="mr-2 text-sm font-medium text-[#B85304]"
                      onClick={() =>
                        setEditing({
                          id: row.id,
                          month: row.month,
                          start_day: row.start_day,
                          end_day: row.end_day,
                          tier: row.tier,
                          crowd_level: row.crowd_level || "",
                          concierge_note: row.concierge_note || "",
                          is_active: row.is_active !== false,
                          sort_order: row.sort_order ?? 0,
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-sm text-red-600"
                      onClick={() => void remove(row.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-zinc-900 p-5 shadow-xl">
            <h3 className="font-display text-xl text-zinc-100">
              {editing.id ? "Edit seasonality rule" : "Add seasonality rule"}
            </h3>
            <div className="mt-4 grid gap-3">
              <label className="text-xs uppercase tracking-wider text-zinc-400">
                Month
                <select
                  value={editing.month}
                  onChange={(e) =>
                    setEditing({ ...editing, month: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-700 px-3 py-2.5 text-sm text-zinc-100"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs uppercase tracking-wider text-zinc-400">
                  Start day
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={editing.start_day}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        start_day: Number(e.target.value) || 1,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-700 px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="text-xs uppercase tracking-wider text-zinc-400">
                  End day
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={editing.end_day}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        end_day: Number(e.target.value) || 1,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-zinc-700 px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
              <label className="text-xs uppercase tracking-wider text-zinc-400">
                Season tier
                <select
                  value={editing.tier}
                  onChange={(e) =>
                    setEditing({ ...editing, tier: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-700 px-3 py-2.5 text-sm"
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-wider text-zinc-400">
                Crowd level
                <input
                  type="text"
                  value={editing.crowd_level}
                  onChange={(e) =>
                    setEditing({ ...editing, crowd_level: e.target.value })
                  }
                  placeholder="High Crowds, Quiet…"
                  className="mt-1 w-full rounded-xl border border-zinc-700 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-xs uppercase tracking-wider text-zinc-400">
                Concierge note
                <textarea
                  rows={3}
                  value={editing.concierge_note}
                  onChange={(e) =>
                    setEditing({ ...editing, concierge_note: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-700 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-100">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) =>
                    setEditing({ ...editing, is_active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-full bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const tone =
    tier === "High"
      ? "bg-[#0B1F3A] text-white"
      : tier === "Mid"
        ? "bg-[#B85304] text-zinc-100"
        : "bg-[#E8E2D9] text-zinc-100";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {tier || "—"}
    </span>
  );
}
