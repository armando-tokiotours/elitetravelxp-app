"use client";

import type PocketBase from "pocketbase";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as XLSX from "xlsx";
import {
  DEFAULT_DAY_EXPENSES_JPY,
  DEFAULT_SPECIALTY_TIERS,
  loadGuidePaySettings,
  saveGuidePaySettings,
  type SpecialtyTier,
} from "@/lib/guidePayBreakdown";
import { formatPbError } from "@/lib/pocketbase/admin-schema";

type PbClient = PocketBase;

/** Exact export column order — id included for round-trip sync. */
const CSV_HEADERS = [
  "id",
  "year",
  "tour_name",
  "duration_hours",
  "pax_count",
  "guide_pay_jpy",
  "expenses_jpy",
  "is_meet_and_greet",
  "notes",
] as const;

type CsvRow = Record<(typeof CSV_HEADERS)[number], string | number | boolean>;

type GuidePayRule = {
  id: string;
  year?: number;
  tour_name?: string;
  duration_hours?: number;
  pax_count?: number;
  guide_pay_jpy?: number;
  expenses_jpy?: number;
  is_meet_and_greet?: boolean;
  notes?: string;
};

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[€$£()\s_\-./]/g, "");
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  const entries = Object.entries(row);
  for (const k of keys) {
    const nk = normalizeHeader(k);
    if (!nk) continue;
    const hit = entries.find(([rk]) => normalizeHeader(rk) === nk);
    if (hit && hit[1] != null && String(hit[1]).trim() !== "") {
      return String(hit[1]).trim();
    }
  }
  return "";
}

function num(row: Record<string, unknown>, ...keys: string[]): number | null {
  // Accept plain numbers or yen-formatted cells (¥18,000 / ￥18000) so CSV
  // stays clearly JPY and is not confused with € elsewhere in Source of Truth.
  const raw = cell(row, ...keys)
    .replace(/[¥￥€$£,\s]/g, "")
    .replace(/jpy/gi, "")
    .trim();
  if (!raw) return null;
  // Meet & Assist rows often use – / — / n/a for duration → store as 0h.
  if (raw === "-" || raw === "–" || raw === "—" || /^n\/?a$/i.test(raw)) {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Display JPY in CSV downloads so pay columns are never mistaken for EUR. */
function yenCsv(n: number): string {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return `¥${v.toLocaleString("en-US")}`;
}

function boolish(raw: string, fallback = false): boolean {
  const s = raw.toLowerCase().trim();
  if (!s) return fallback;
  if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
  if (["true", "1", "yes", "y", "active"].includes(s)) return true;
  return fallback;
}

function naturalKey(opts: {
  year: number;
  tour_name: string;
  duration_hours: number;
  pax_count: number;
  is_meet_and_greet: boolean;
}): string {
  return [
    opts.year,
    opts.tour_name.trim().toLowerCase(),
    opts.duration_hours,
    opts.pax_count,
    opts.is_meet_and_greet ? "1" : "0",
  ].join("|");
}

function downloadCsv(rows: CsvRow[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...CSV_HEADERS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Guide Pay");
  XLSX.writeFile(wb, filename, { bookType: "csv" });
}

export function GuidePayMatrixAdmin({
  getClient,
  onSynced,
  title = "Guide Pay Matrix",
  trailing,
}: {
  getClient: () => PbClient;
  onSynced: () => Promise<void> | void;
  title?: string;
  trailing?: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"down" | "up" | "settings" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** Preserved on save — no longer edited in this UI (Dispatch/portal still use it). */
  const storedDefaultExpensesRef = useRef(DEFAULT_DAY_EXPENSES_JPY);
  const [tiers, setTiers] = useState<SpecialtyTier[]>(DEFAULT_SPECIALTY_TIERS);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await loadGuidePaySettings(getClient());
        if (cancelled) return;
        storedDefaultExpensesRef.current =
          settings.default_expenses_jpy || DEFAULT_DAY_EXPENSES_JPY;
        setTiers(
          settings.specialty_tiers.length
            ? settings.specialty_tiers
            : DEFAULT_SPECIALTY_TIERS
        );
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getClient]);

  const saveSettings = useCallback(async () => {
    setBusy("settings");
    setErr(null);
    setSettingsMsg(null);
    try {
      const cleaned = tiers
        .map((t, i) => ({
          id: String(t.id || `tier_${i}`).trim() || `tier_${i}`,
          label: String(t.label || "").trim(),
          amount_jpy: Math.max(0, Math.round(Number(t.amount_jpy) || 0)),
        }))
        .filter((t) => t.label && t.amount_jpy > 0);
      // Keep existing default_expenses_jpy (or ¥3000) — expense is matrix/CSV-driven.
      await saveGuidePaySettings(getClient(), {
        default_expenses_jpy:
          storedDefaultExpensesRef.current || DEFAULT_DAY_EXPENSES_JPY,
        specialty_tiers: cleaned.length ? cleaned : DEFAULT_SPECIALTY_TIERS,
      });
      setTiers(cleaned.length ? cleaned : DEFAULT_SPECIALTY_TIERS);
      setSettingsMsg("Baseline settings saved — used by Guide Dispatch payouts.");
      await onSynced();
    } catch (e) {
      setErr(formatPbError(e));
    } finally {
      setBusy(null);
    }
  }, [getClient, onSynced, tiers]);

  const download = useCallback(async () => {
    setBusy("down");
    setErr(null);
    setMsg(null);
    try {
      const pb = getClient();
      const rules = await pb.collection("guide_pay_rules").getFullList<GuidePayRule>({
        sort: "year,tour_name,duration_hours,pax_count",
      });
      const rows: CsvRow[] = rules.map((r) => ({
        id: String(r.id ?? ""),
        year: Number(r.year) || "",
        tour_name: String(r.tour_name ?? ""),
        duration_hours: Number(r.duration_hours) || "",
        pax_count: Number(r.pax_count) || "",
        guide_pay_jpy: yenCsv(Number(r.guide_pay_jpy) || 0),
        expenses_jpy: yenCsv(Number(r.expenses_jpy) || 0),
        is_meet_and_greet: r.is_meet_and_greet === true,
        notes: String(r.notes ?? ""),
      }));
      downloadCsv(rows, "guide_pay_rules_export.csv");
      setMsg(`Downloaded ${rows.length} guide pay rule(s).`);
    } catch (e) {
      setErr(formatPbError(e));
    } finally {
      setBusy(null);
    }
  }, [getClient]);

  const upload = useCallback(
    async (file: File) => {
      setBusy("up");
      setErr(null);
      setMsg(null);
      try {
        const pb = getClient();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });
        if (!parsed.length) throw new Error("No data rows found in the CSV.");

        const existing = await pb
          .collection("guide_pay_rules")
          .getFullList<GuidePayRule>();
        const byId = new Map(existing.map((r) => [String(r.id), r]));
        const byNatural = new Map(
          existing.map((r) => [
            naturalKey({
              year: Number(r.year) || 0,
              tour_name: String(r.tour_name ?? ""),
              duration_hours: Number(r.duration_hours) || 0,
              pax_count: Number(r.pax_count) || 0,
              is_meet_and_greet: r.is_meet_and_greet === true,
            }),
            r,
          ])
        );

        let updated = 0;
        let added = 0;
        let skipped = 0;

        for (const row of parsed) {
          const tour_name = cell(row, "tour_name", "tour", "title");
          const year = num(row, "year");
          const duration_hours = num(
            row,
            "duration_hours",
            "duration",
            "hours"
          );
          const pax_count = num(row, "pax_count", "pax", "guests", "guest_count");
          const guide_pay_jpy = num(
            row,
            "guide_pay_jpy",
            "guide_pay",
            "pay_jpy",
            "fee_jpy"
          );

          if (!tour_name || year == null || duration_hours == null || pax_count == null) {
            skipped += 1;
            continue;
          }
          if (guide_pay_jpy == null) {
            skipped += 1;
            continue;
          }

          const is_meet_and_greet = boolish(
            cell(row, "is_meet_and_greet", "meet_and_greet", "meetandgreet", "mng"),
            false
          );
          const expenses_jpy =
            num(row, "expenses_jpy", "expenses", "expense_jpy") ?? 0;
          const notes = cell(row, "notes", "note");

          const payload: Record<string, unknown> = {
            year,
            tour_name,
            duration_hours,
            pax_count,
            guide_pay_jpy,
            expenses_jpy,
            is_meet_and_greet,
            notes,
          };

          const csvId = cell(row, "id");
          const existingById = csvId ? byId.get(csvId) : undefined;
          const nk = naturalKey({
            year,
            tour_name,
            duration_hours,
            pax_count,
            is_meet_and_greet,
          });
          const existingByKey = byNatural.get(nk);

          if (existingById) {
            await pb.collection("guide_pay_rules").update(csvId, payload);
            updated += 1;
            byId.set(csvId, { ...existingById, ...payload, id: csvId });
            byNatural.set(nk, { ...existingById, ...payload, id: csvId });
          } else if (existingByKey) {
            await pb
              .collection("guide_pay_rules")
              .update(existingByKey.id, payload);
            updated += 1;
            byId.set(existingByKey.id, {
              ...existingByKey,
              ...payload,
              id: existingByKey.id,
            });
            byNatural.set(nk, {
              ...existingByKey,
              ...payload,
              id: existingByKey.id,
            });
          } else {
            const created = await pb
              .collection("guide_pay_rules")
              .create(payload);
            added += 1;
            const createdRow = {
              ...payload,
              id: String(created.id),
            } as GuidePayRule;
            byId.set(createdRow.id, createdRow);
            byNatural.set(nk, createdRow);
          }
        }

        await onSynced();
        const skipNote = skipped ? ` · ${skipped} skipped` : "";
        setMsg(`Sync Complete: ${updated} Updated, ${added} Added${skipNote}`);
      } catch (e) {
        setErr(formatPbError(e));
      } finally {
        setBusy(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [getClient, onSynced]
  );

  return (
    <div className="mb-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white">{title}</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Super User baseline for guide day payouts: matrix rows (base rates) +
            specialty bonus tiers. Per-row expenses stay in the CSV. Used by Guide
            Dispatch and the Guide Portal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void download()}
            className="rounded-full border border-[#F6A724]/40 bg-[#0A1017] px-3.5 py-2 text-sm font-medium text-[#F6A724] hover:bg-[#F6A724]/10 disabled:opacity-50"
          >
            {busy === "down" ? "Preparing…" : "⬇️ Download CSV"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-full bg-[#F6A724] px-3.5 py-2 text-sm font-semibold text-[#0A1017] hover:bg-[#f8b84a] disabled:opacity-50"
          >
            {busy === "up" ? "Syncing…" : "⬆️ Upload CSV"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          {busy === "up" ? (
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#F6A724] border-t-transparent"
              aria-label="Syncing"
            />
          ) : null}
          {trailing}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">
        Columns: id, year, tour_name, duration_hours, pax_count, guide_pay_jpy,
        expenses_jpy, is_meet_and_greet, notes. Pay amounts are{" "}
        <span className="text-[#F6A724]">Japanese yen (¥)</span> — e.g.{" "}
        <code className="text-zinc-300">¥18,000</code> is accepted on upload.
      </p>
      {msg ? (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {err}
        </p>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#0D1117]/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold tracking-wider text-[#F6A724] uppercase">
              Guide pay matrix · baselines
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              Base day rates and per-row expenses live in the CSV matrix (e.g. 6h
              = ¥18,000 / 8h = ¥24,000). Specialty tiers below feed Dispatch
              assign and portal totals.
            </p>
          </div>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void saveSettings()}
            className="rounded-full bg-[#075473] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#054F70] disabled:opacity-50"
          >
            {busy === "settings" ? "Saving…" : "Save baselines"}
          </button>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Specialty bonus tiers
            </span>
            <button
              type="button"
              onClick={() =>
                setTiers((prev) => [
                  ...prev,
                  {
                    id: `tier_${Date.now()}`,
                    label: "New specialty",
                    amount_jpy: 3000,
                  },
                ])
              }
              className="rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-zinc-300 uppercase hover:border-white/30"
            >
              + Add tier
            </button>
          </div>
          <div className="space-y-2">
            {tiers.map((tier, idx) => (
              <div
                key={tier.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2"
              >
                <input
                  type="text"
                  value={tier.label}
                  onChange={(e) =>
                    setTiers((prev) =>
                      prev.map((t, i) =>
                        i === idx ? { ...t, label: e.target.value } : t
                      )
                    )
                  }
                  placeholder="Label"
                  className="min-w-[10rem] flex-1 rounded-lg border border-white/10 bg-[#0A1017] px-2.5 py-1.5 text-xs text-white focus:border-[#F6A724] focus:outline-none"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-zinc-500">¥</span>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={tier.amount_jpy}
                    onChange={(e) =>
                      setTiers((prev) =>
                        prev.map((t, i) =>
                          i === idx
                            ? {
                                ...t,
                                amount_jpy: Math.max(
                                  0,
                                  Math.round(Number(e.target.value) || 0)
                                ),
                              }
                            : t
                        )
                      )
                    }
                    className="w-24 rounded-lg border border-white/10 bg-[#0A1017] px-2.5 py-1.5 font-mono text-xs text-white focus:border-[#F6A724] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTiers((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="rounded-lg border border-red-500/30 px-2 py-1 text-[10px] font-bold text-red-300 uppercase hover:bg-red-950/40"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {settingsMsg ? (
          <p className="mt-3 text-sm text-emerald-300">{settingsMsg}</p>
        ) : null}
      </div>
    </div>
  );
}
