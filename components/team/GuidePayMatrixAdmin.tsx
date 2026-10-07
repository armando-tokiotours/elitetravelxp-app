"use client";

import type PocketBase from "pocketbase";
import { useCallback, useRef, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
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
  const raw = cell(row, ...keys).replace(/[€$£,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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
  const [busy, setBusy] = useState<"down" | "up" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
        guide_pay_jpy: Number(r.guide_pay_jpy) || "",
        expenses_jpy: Number(r.expenses_jpy) || 0,
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
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-white">{title}</h2>
          <p className="mt-1 text-xs text-zinc-400">
            PocketBase <code className="text-[#F6A724]">guide_pay_rules</code> —
            download, edit in Excel, upload to upsert (by id or year/tour/hours/pax/M&amp;G).
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
        expenses_jpy, is_meet_and_greet, notes
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
    </div>
  );
}
