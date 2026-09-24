"use client";

import type PocketBase from "pocketbase";
import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { formatPbError } from "@/lib/pocketbase/admin-schema";

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
      // Exact after stripping currency/punctuation: "Price Min (€)" ↔ "Price Min"
      if (nr === nk) return true;
      // Allow longer header containing the search key (min length avoids "Min"→"Month")
      if (nk.length >= 5 && (nr.includes(nk) || nk.includes(nr))) return true;
      return false;
    });
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

function normalizeStar(raw: string): "3-star" | "4-star" | "5-star" | null {
  const s = raw.toLowerCase();
  if (s.includes("3")) return "3-star";
  if (s.includes("4")) return "4-star";
  if (s.includes("5")) return "5-star";
  return null;
}

function normalizeMonth(raw: string): string | null {
  if (!raw) return null;
  const hit = MONTHS.find(
    (m) =>
      m.toLowerCase() === raw.toLowerCase() ||
      m.slice(0, 3).toLowerCase() === raw.slice(0, 3).toLowerCase()
  );
  return hit || null;
}

function normalizeSeason(raw: string): "Low" | "Mid" | "High" | null {
  const s = raw.toLowerCase();
  if (s.includes("low")) return "Low";
  if (s.includes("mid")) return "Mid";
  if (s.includes("high")) return "High";
  return null;
}

function normalizeRoom(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("twin")) return "Twin";
  if (s.includes("superior")) return "Superior";
  if (s.includes("standard") || !s) return "Standard";
  return raw || "Standard";
}

function normalizeBreakfast(raw: string): "Included" | "Not Included" {
  const s = raw.toLowerCase();
  if (!s || s.includes("not") || s.includes("no") || s === "false" || s === "0")
    return "Not Included";
  if (s.includes("include") || s.includes("yes") || s === "true" || s === "1")
    return "Included";
  return "Not Included";
}

const EXPORT_HEADERS = [
  "City",
  "Star Rating",
  "Month",
  "Season Tier",
  "Room Type",
  "Breakfast",
  "Price Min (€)",
  "Price Max (€)",
  "Average (€)",
] as const;

type ExportRow = Record<(typeof EXPORT_HEADERS)[number], string | number>;

function downloadSheet(rows: ExportRow[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [...EXPORT_HEADERS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hotel Rates");
  XLSX.writeFile(wb, filename, { bookType: "csv" });
}

function formatEuro(n: number | ""): string | number {
  if (n === "" || n == null || Number.isNaN(Number(n))) return "";
  return Number(n);
}

export function HotelRatesUploader({
  getClient,
  onImported,
}: {
  getClient: () => PbClient;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const exportHotels = useCallback(async () => {
    setExportBusy(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const [cities, accommodations] = await Promise.all([
        pb.collection("cities").getFullList<{ id: string; name: string }>({
          sort: "name",
        }),
        pb.collection("accommodations").getFullList<Record<string, unknown>>(),
      ]);
      const cityName = new Map(cities.map((c) => [c.id, c.name]));

      const rows: ExportRow[] = accommodations.map((row) => {
        const min = row.price_min ?? row.min_price_per_night ?? row.min_price;
        const max = row.price_max ?? row.max_price_per_night ?? row.max_price;
        const minN = min != null && min !== "" ? Number(min) : NaN;
        const maxN = max != null && max !== "" ? Number(max) : NaN;
        const avg =
          Number.isFinite(minN) && Number.isFinite(maxN)
            ? Math.round((minN + maxN) / 2)
            : "";
        return {
          City: cityName.get(String(row.city_id || "")) || "",
          "Star Rating": String(row.star_rating || row.tier || ""),
          Month: String(row.month || ""),
          "Season Tier": String(row.season_tier || ""),
          "Room Type": String(row.room_type || "Standard"),
          Breakfast: String(row.breakfast || "Not Included"),
          "Price Min (€)": formatEuro(Number.isFinite(minN) ? minN : ""),
          "Price Max (€)": formatEuro(Number.isFinite(maxN) ? maxN : ""),
          "Average (€)": formatEuro(avg === "" ? "" : avg),
        };
      });

      if (!rows.length) {
        setMsg(
          "No hotel rates saved yet — download the blank template to fill in."
        );
        return;
      }

      downloadSheet(rows, "hotel-rates-export.csv");
      setMsg(`Exported ${rows.length} hotel rate row(s).`);
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setExportBusy(false);
    }
  }, [getClient]);

  const downloadTemplate = useCallback(async () => {
    setExportBusy(true);
    setMsg(null);
    setError(null);
    try {
      const pb = getClient();
      const cities = await pb.collection("cities").getFullList<{
        id: string;
        name: string;
      }>({ sort: "name" });

      const sampleStars = ["3-star", "4-star", "5-star"] as const;
      const sampleRooms = ["Standard", "Twin", "Superior"] as const;
      const rows: ExportRow[] =
        cities.length > 0
          ? cities.flatMap((city, i) => [
              {
                City: city.name,
                "Star Rating": sampleStars[i % 3],
                Month: "January",
                "Season Tier": "Low",
                "Room Type": sampleRooms[i % 3],
                Breakfast: "Included",
                "Price Min (€)": "",
                "Price Max (€)": "",
                "Average (€)": "",
              },
            ])
          : [
              {
                City: "Tokyo",
                "Star Rating": "4-star",
                Month: "January",
                "Season Tier": "Low",
                "Room Type": "Standard",
                Breakfast: "Included",
                "Price Min (€)": 180,
                "Price Max (€)": 280,
                "Average (€)": 230,
              },
            ];

      downloadSheet(rows, "hotel-rates-template.csv");
      setMsg(
        `Template downloaded with ${rows.length} starter row(s). Fill Price Min/Max and re-upload.`
      );
    } catch (e) {
      setError(formatPbError(e));
    } finally {
      setExportBusy(false);
    }
  }, [getClient]);

  const importFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setMsg(null);
      setError(null);
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName =
          wb.SheetNames.find((n) => /hotel/i.test(n)) || wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });
        if (!rows.length) throw new Error("No data rows found in the file.");

        const pb = getClient();
        const cities = await pb.collection("cities").getFullList<{
          id: string;
          name: string;
        }>();
        const cityByName = new Map(
          cities.map((c) => [c.name.trim().toLowerCase(), c.id])
        );

        let imported = 0;
        let skippedCity = 0;
        let skippedStar = 0;
        let skippedPrice = 0;
        const batch: Record<string, unknown>[] = [];

        for (const row of rows) {
          const cityName = cell(row, "City", "City / Area", "city");
          const city_id = cityByName.get(cityName.toLowerCase());
          if (!city_id) {
            skippedCity++;
            continue;
          }
          const star_rating = normalizeStar(
            cell(row, "Star Rating", "Star", "star_rating", "Tier")
          );
          if (!star_rating) {
            skippedStar++;
            continue;
          }
          const month = normalizeMonth(cell(row, "Month", "month"));
          const season_tier = normalizeSeason(
            cell(row, "Season Tier", "Season", "season_tier", "season")
          );
          const room_type = normalizeRoom(
            cell(row, "Room Type", "Room", "room_type")
          );
          const breakfast = normalizeBreakfast(
            cell(row, "Breakfast", "breakfast")
          );
          const price_min = num(
            row,
            "Price Min (€)",
            "Price Min",
            "price_min",
            "Min Price",
            "Low Season Min (€)",
            "min_price"
          );
          const price_max = num(
            row,
            "Price Max (€)",
            "Price Max",
            "price_max",
            "Max Price",
            "High Season Max (€)",
            "max_price"
          );
          if (price_min == null || price_max == null) {
            skippedPrice++;
            continue;
          }

          batch.push({
            city_id,
            star_rating,
            tier: star_rating === "3-star" ? "4-star" : star_rating,
            month: month || "",
            season_tier: season_tier || "",
            room_type,
            breakfast,
            price_min,
            price_max,
            min_price_per_night: price_min,
            max_price_per_night: price_max,
            min_price: price_min,
            max_price: price_max,
            max_occupancy: 2,
          });
        }

        // Create in chunks of 20
        for (let i = 0; i < batch.length; i += 20) {
          const chunk = batch.slice(i, i + 20);
          await Promise.all(
            chunk.map((payload) => pb.collection("accommodations").create(payload))
          );
          imported += chunk.length;
        }

        const skipped = skippedCity + skippedStar + skippedPrice;
        const reasons = [
          skippedCity ? `${skippedCity} unknown city` : null,
          skippedStar ? `${skippedStar} bad star rating` : null,
          skippedPrice ? `${skippedPrice} missing price` : null,
        ]
          .filter(Boolean)
          .join(", ");

        setMsg(
          `Successfully imported ${imported} hotel rates.${
            skipped ? ` Skipped ${skipped} rows (${reasons}).` : ""
          }`
        );
        onImported();
      } catch (e) {
        setError(formatPbError(e));
      } finally {
        setBusy(false);
      }
    },
    [getClient, onImported]
  );

  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || exportBusy}
          onClick={() => void downloadTemplate()}
          className="rounded-full border border-[#D9D2C7] bg-white px-4 py-2 text-sm font-semibold text-[#0B1F3A] transition hover:border-[#075473] disabled:opacity-50"
        >
          {exportBusy ? "Preparing…" : "Download CSV template"}
        </button>
        <button
          type="button"
          disabled={busy || exportBusy}
          onClick={() => void exportHotels()}
          className="rounded-full bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16325a] disabled:opacity-50"
        >
          {exportBusy ? "Preparing…" : "Export hotels CSV"}
        </button>
        <p className="w-full text-xs text-[#8A8278] sm:w-auto sm:flex-1">
          Template uses your exact city names. Export mirrors what is already
          saved so you can edit and re-upload.
        </p>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void importFile(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
          dragOver
            ? "border-[#075473] bg-[#FDF7F3]"
            : "border-[#D9D2C7] bg-[#FBF8F2] hover:border-[#075473]"
        } ${busy ? "opacity-60" : ""}`}
      >
        <span className="text-2xl" aria-hidden>
          📥
        </span>
        <span className="mt-2 text-sm font-semibold text-[#0B1F3A]">
          {busy ? "Importing hotel rates…" : "Drop Hotel Rates CSV/Excel Here"}
        </span>
        <span className="mt-1 max-w-md text-xs text-[#8A8278]">
          Columns: City, Star Rating, Month, Season Tier, Room Type, Breakfast,
          Price Min (€), Price Max (€), Average (€)
        </span>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {msg ? <p className="mt-2 text-sm text-emerald-700">{msg}</p> : null}
      {error ? (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
