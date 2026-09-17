"use client";

import type PocketBase from "pocketbase";
import { useCallback, useRef, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { formatPbError } from "@/lib/pocketbase/admin-schema";
import type { PbCity } from "@/lib/pocketbase/client";
import { normalizeTourLanguages } from "@/lib/tourLanguages";

type PbClient = PocketBase;

const CSV_HEADERS = [
  "id",
  "city_id",
  "city",
  "category",
  "title",
  "description",
  "route",
  "inclusions_exclusions",
  "price_1_pax",
  "price_2_pax",
  "price_3_pax",
  "price_4_pax",
  "price_extra_pax",
  "duration_hours",
  "languages",
  "is_customizable_duration",
  "is_active",
  "media_type",
] as const;

type CsvRow = Record<(typeof CSV_HEADERS)[number], string | number | boolean>;

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

function boolish(raw: string, fallback = true): boolean {
  const s = raw.toLowerCase().trim();
  if (!s) return fallback;
  if (["false", "0", "no", "n", "inactive"].includes(s)) return false;
  if (["true", "1", "yes", "y", "active"].includes(s)) return true;
  return fallback;
}

function downloadCsv(rows: CsvRow[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...CSV_HEADERS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tours");
  XLSX.writeFile(wb, filename, { bookType: "csv" });
}

function languagesToCsv(raw: unknown): string {
  return normalizeTourLanguages(raw).join("; ");
}

function languagesFromCsv(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[|;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeCategory(raw: string): "tour" | "activity" {
  const s = raw.trim().toLowerCase();
  if (
    s === "activity" ||
    s === "activities" ||
    s === "experience" ||
    s === "experiences" ||
    s === "exp"
  ) {
    return "activity";
  }
  return "tour";
}

export function ToursCsvSync({
  getClient,
  cities,
  onSynced,
  title = "Tours",
  trailing,
}: {
  getClient: () => PbClient;
  cities: PbCity[];
  onSynced: () => Promise<void> | void;
  title?: string;
  trailing?: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"down" | "up" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const cityName = useCallback(
    (id: string) => cities.find((c) => c.id === id)?.name ?? "",
    [cities]
  );

  const resolveCityId = useCallback(
    (cityId: string, cityLabel: string): string | null => {
      if (cityId && cities.some((c) => c.id === cityId)) return cityId;
      const label = cityLabel.trim().toLowerCase();
      if (!label) return cityId || null;
      const hit = cities.find((c) => c.name.toLowerCase() === label);
      return hit?.id ?? (cityId || null);
    },
    [cities]
  );

  const download = useCallback(async () => {
    setBusy("down");
    setErr(null);
    setMsg(null);
    try {
      const pb = getClient();
      const tours = await pb.collection("tours").getFullList({ sort: "title" });
      const rows: CsvRow[] = tours.map((t) => {
        const r = t as Record<string, unknown>;
        return {
          id: String(r.id ?? ""),
          city_id: String(r.city_id ?? ""),
          city: cityName(String(r.city_id ?? "")),
          category: normalizeCategory(String(r.category ?? "tour")),
          title: String(r.title ?? ""),
          description: String(r.description ?? ""),
          route: String(r.route ?? ""),
          inclusions_exclusions: String(r.inclusions_exclusions ?? ""),
          price_1_pax: Number(r.price_1_pax) || "",
          price_2_pax: Number(r.price_2_pax) || "",
          price_3_pax: Number(r.price_3_pax) || "",
          price_4_pax: Number(r.price_4_pax) || "",
          price_extra_pax: Number(r.price_extra_pax) || "",
          duration_hours: Number(r.duration_hours) || "",
          languages: languagesToCsv(r.languages),
          is_customizable_duration: r.is_customizable_duration === true,
          is_active: r.is_active !== false,
          media_type: String(r.media_type ?? ""),
        };
      });
      downloadCsv(rows, "tours_export.csv");
      setMsg(`Downloaded ${rows.length} tour(s).`);
    } catch (e) {
      setErr(formatPbError(e));
    } finally {
      setBusy(null);
    }
  }, [cityName, getClient]);

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

        const existing = await pb.collection("tours").getFullList();
        const byId = new Map(existing.map((t) => [String(t.id), t]));
        const byTitleCity = new Map(
          existing.map((t) => {
            const r = t as Record<string, unknown>;
            const key = `${String(r.title ?? "")
              .trim()
              .toLowerCase()}::${String(r.city_id ?? "")}`;
            return [key, t] as const;
          })
        );

        let updated = 0;
        let added = 0;

        for (const row of parsed) {
          const title = cell(row, "title");
          if (!title) continue;

          const csvId = cell(row, "id");
          const cityIdRaw = cell(row, "city_id", "cityid");
          const cityLabel = cell(row, "city", "city_name", "cityname");
          const city_id = resolveCityId(cityIdRaw, cityLabel);
          if (!city_id) {
            throw new Error(
              `Missing city for tour "${title}" — set city_id or city name.`
            );
          }

          const payload: Record<string, unknown> = {
            city_id,
            title,
            category: normalizeCategory(cell(row, "category", "type")),
            description: cell(row, "description"),
            route: cell(row, "route"),
            inclusions_exclusions: cell(
              row,
              "inclusions_exclusions",
              "inclusions",
              "includes"
            ),
            duration_hours: num(row, "duration_hours", "duration") ?? 0,
            languages: languagesFromCsv(cell(row, "languages")),
            is_customizable_duration: boolish(
              cell(row, "is_customizable_duration", "customizable"),
              false
            ),
            is_active: boolish(cell(row, "is_active", "active"), true),
          };

          const p1 = num(row, "price_1_pax", "price1");
          const p2 = num(row, "price_2_pax", "price2");
          const p3 = num(row, "price_3_pax", "price3");
          const p4 = num(row, "price_4_pax", "price4");
          const px = num(row, "price_extra_pax", "price_extra", "extra_pax");
          if (p1 != null) payload.price_1_pax = p1;
          if (p2 != null) payload.price_2_pax = p2;
          if (p3 != null) payload.price_3_pax = p3;
          if (p4 != null) payload.price_4_pax = p4;
          if (px != null) payload.price_extra_pax = px;
          if (p1 != null) {
            payload.price = p1;
            payload.price_per_person = p1;
          }

          const mediaType = cell(row, "media_type");
          if (mediaType === "Image" || mediaType === "Video") {
            payload.media_type = mediaType;
          }

          const titleKey = `${title.trim().toLowerCase()}::${city_id}`;
          const match =
            (csvId && byId.get(csvId)) || byTitleCity.get(titleKey) || null;

          if (match) {
            await pb.collection("tours").update(String(match.id), payload);
            updated += 1;
            byId.set(String(match.id), match);
            byTitleCity.set(titleKey, match);
          } else {
            const created = await pb.collection("tours").create(payload);
            added += 1;
            byId.set(String(created.id), created);
            byTitleCity.set(titleKey, created);
          }
        }

        await onSynced();
        setMsg(`Sync Complete: ${updated} Updated, ${added} Added`);
      } catch (e) {
        setErr(formatPbError(e));
      } finally {
        setBusy(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [getClient, onSynced, resolveCityId]
  );

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void download()}
            className="rounded-full border border-[#D9D2C7] bg-white px-3.5 py-2 text-sm font-medium text-[#0B1F3A] hover:border-[#C4A35A] disabled:opacity-50"
          >
            {busy === "down" ? "Preparing…" : "⬇️ Download CSV"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-[#0B1F3A] bg-[#0B1F3A] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#143052] disabled:opacity-50"
          >
            {busy === "up" ? "Syncing…" : "⬆️ Upload / Replace CSV"}
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
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#C4A35A] border-t-transparent"
              aria-label="Syncing"
            />
          ) : null}
          {trailing}
        </div>
      </div>
      {msg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </p>
      ) : null}
    </div>
  );
}
