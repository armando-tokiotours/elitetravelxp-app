/**
 * Kid-friendly Catalog Wizard CSV templates / export / upsert.
 *
 * Real PocketBase mapping (not a fictional catalog_items collection):
 * - Cities → cities
 * - Tours → tours (category=tour) — guide included
 * - Experiences → tours (category=activity) — ticketed
 * - Clusters → tours (category=cluster) — neighborhood sectors, €0, time budget
 * - Vehicles → vehicles
 * - Transport → transport_products
 */

export type CatalogCsvTab =
  | "all"
  | "city"
  | "tour"
  | "activity"
  | "cluster"
  | "vehicle"
  | "transport";

export type CatalogCsvRow = Record<string, string>;

import {
  catalogCsvImageRef,
  ensureCatalogPlaceholder,
  pullCatalogImageFromUrl,
} from "@/lib/catalogMedia";

type PbLike = {
  collection: (name: string) => {
    getFullList: (opts?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    getOne: (id: string) => Promise<Record<string, unknown>>;
    create: (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
    update: (
      id: string,
      body: Record<string, unknown>
    ) => Promise<Record<string, unknown>>;
  };
};

const TAB_LABEL: Record<CatalogCsvTab, string> = {
  all: "All",
  city: "Cities",
  tour: "Tours",
  activity: "Experiences",
  cluster: "Clusters",
  vehicle: "Vehicles",
  transport: "Transport",
};

export function catalogTabLabel(tab: CatalogCsvTab): string {
  return TAB_LABEL[tab];
}

export function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Minimal RFC4180-ish CSV parse (quoted fields, commas, newlines). */
export function parseCatalogCsv(text: string): CatalogCsvRow[] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      pushCell();
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  pushCell();
  pushRow();

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.slice(1).map((cols) => {
    const out: CatalogCsvRow = {};
    headers.forEach((h, idx) => {
      if (!h) return;
      out[h] = String(cols[idx] ?? "").trim();
    });
    return out;
  });
}

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Full Tours / Experiences CSV schema — mirrors the +Add wizard
 * (City & audience → Vibes → Story & route → Price → Languages & duration).
 *
 * Pricing semantics:
 * - `price_1_pax` is the SELL price offered to the customer (€) — the only
 *   price you must fill. Blank `price_2/3/4_pax` / `price_extra_pax` are
 *   auto-filled with `price_1_pax` on import (extra pax = same as 1 pax).
 * - `base_price_eur` is OUR COST (€) — independent of the sell price.
 *   Blank = 0. It is never copied from `price_1_pax`.
 * Multi-value fields (`vibe_tags`, `languages`) use `;` as separator.
 */
export const TOUR_EXPERIENCE_CSV_HEADERS = [
  "id",
  "category",
  "title",
  "city_name",
  "audience",
  "vibe_tags", // culture;foodie;modern;nature;multi_vibe
  "crowd_tag", // hidden_gem | classic_highlight | balanced_mix
  "pace_tag", // relaxed | standard | active
  "access_type", // guided_route | direct_ticket | admission | vip_event | time_sensitive
  "is_niche",
  "is_bonus",
  "description",
  "route",
  "inclusions_exclusions",
  "duration_hours",
  "languages", // English;Spanish
  "is_customizable_duration",
  "media_type", // Image | Video
  "price_1_pax",
  "price_2_pax",
  "price_3_pax",
  "price_4_pax",
  "price_extra_pax",
  "base_price_eur",
  "is_active",
] as const;

const VIBE_ALLOWED = new Set([
  "culture",
  "foodie",
  "modern",
  "nature",
  "multi_vibe",
]);
const PACE_ALLOWED = new Set(["relaxed", "standard", "active"]);
const ACCESS_ALLOWED = new Set([
  "guided_route",
  "direct_ticket",
  "admission",
  "vip_event",
  "time_sensitive",
]);
const CROWD_ALLOWED = new Set([
  "hidden_gem",
  "classic_highlight",
  "balanced_mix",
]);

/** Array / legacy string → `a;b;c` CSV cell. */
function listToCsv(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(";");
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[|;,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(";");
  }
  return "";
}

/** `a;b|c` CSV cell → string[]. */
function listFromCsv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[|;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeAudience(raw: string | undefined): string {
  const s = String(raw || "").trim().toLowerCase();
  return s === "agency" || s === "individual" || s === "both" ? s : "both";
}

function normalizePaceTag(raw: string | undefined): string | undefined {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return undefined;
  if (s === "balanced" || s === "moderate") return "standard";
  return PACE_ALLOWED.has(s) ? s : undefined;
}

function normalizeCrowdTag(raw: string | undefined): string | undefined {
  const s = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return undefined;
  if (s === "hidden_gem" || s === "hidden_gems" || s === "hiddengem" || s === "niche")
    return "hidden_gem";
  if (
    s === "classic_highlight" ||
    s === "classic" ||
    s === "classic_landmarks" ||
    s === "landmark"
  )
    return "classic_highlight";
  if (s === "balanced_mix" || s === "balanced" || s === "mix" || s === "open_explorer")
    return "balanced_mix";
  return CROWD_ALLOWED.has(s) ? s : undefined;
}

function normalizeAccessType(
  raw: string | undefined,
  category: "tour" | "activity" | "cluster"
): string {
  const s = String(raw || "").trim().toLowerCase();
  if (ACCESS_ALLOWED.has(s)) return s;
  return category === "activity" ? "direct_ticket" : "guided_route";
}

function csvBool(raw: string | undefined, fallback = false): boolean {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return fallback;
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return fallback;
}

export function catalogTemplateCsv(tab: CatalogCsvTab): {
  filename: string;
  csv: string;
} | null {
  if (tab === "all") return null;

  if (tab === "city") {
    return {
      filename: "TokioTours_Template_Cities.csv",
      csv: [
        "id,name,description,base_price_eur,base_price_modifier,is_active",
        ',Tokyo,"Japan capital hub",0,1,true',
        ',Kyoto,"Cultural capital",0,1,true',
      ].join("\n"),
    };
  }

  if (tab === "tour") {
    return {
      filename: "TokioTours_Template_Tours.csv",
      csv: [
        TOUR_EXPERIENCE_CSV_HEADERS.join(","),
        // Only price_1_pax (sell price) filled: 2/3/4/extra auto = 408 on
        // import. base_price_eur 250 = our cost, kept separate.
        ',tour,"Sample Private Tokyo Tour",Tokyo,both,culture;foodie,classic_highlight,standard,guided_route,false,false,"Full day guided route","Asakusa - Ueno - Akihabara","Guide included; admissions excluded",6,English;Spanish,true,Image,408,,,,,250,true',
      ].join("\n"),
    };
  }

  if (tab === "activity") {
    return {
      filename: "TokioTours_Template_Experiences.csv",
      csv: [
        TOUR_EXPERIENCE_CSV_HEADERS.join(","),
        // Only price_1_pax (sell price €45) filled: 2/3/4/extra auto = 45 on
        // import. base_price_eur €30 = what it costs us.
        ',activity,"Sample Experience Ticket",Tokyo,both,modern,classic_highlight,relaxed,direct_ticket,false,false,"Entry / VIP experience","Meet at the entrance","Ticket included",2,English,false,Image,45,,,,,30,true',
      ].join("\n"),
    };
  }

  if (tab === "cluster") {
    return {
      filename: "TokioTours_Template_Clusters.csv",
      csv: [
        "id,category,title,city_name,duration_hours,description,is_active",
        ',cluster,"Asakusa Historical Sector",Tokyo,2.5,"Senso-ji, Nakamise, Sumida riverside — places inside are free",true',
        ',cluster,"Shibuya / Harajuku Cluster",Tokyo,2.5,"Crossing, Meiji Jingu approach, Takeshita — €0 sector time budget",true',
      ].join("\n"),
    };
  }

  if (tab === "vehicle") {
    return {
      filename: "TokioTours_Template_Vehicles.csv",
      csv: [
        "id,name,max_passengers,price_per_day_eur,max_luggage,is_active",
        ',Alphard,6,280,4,true',
        ',"14-Seater HiAce",10,550,8,true',
      ].join("\n"),
    };
  }

  return {
    filename: "TokioTours_Template_Transport.csv",
    csv: [
      "id,name,transport_type,price_per_person_eur,duration_hours,city_name,description,is_active",
      ',Suica Card,suica,25,0,Tokyo,"IC transit card",true',
      ',"Tokyo → Kyoto Shinkansen",bullet_train,140,2.5,Tokyo,"One-way bullet train",true',
    ].join("\n"),
  };
}

export function downloadCatalogTemplate(tab: CatalogCsvTab): boolean {
  const t = catalogTemplateCsv(tab);
  if (!t) return false;
  downloadBlob(t.filename, t.csv);
  return true;
}

type ExportSource = {
  cities: Record<string, unknown>[];
  tours: Record<string, unknown>[];
  vehicles: Record<string, unknown>[];
  transports: Record<string, unknown>[];
};

function cityNameMap(cities: Record<string, unknown>[]) {
  return new Map(
    cities.map((c) => [String(c.id), String(c.name || "").trim() || String(c.id)])
  );
}

export function buildCatalogExportCsv(
  tab: CatalogCsvTab,
  source: ExportSource
): { filename: string; csv: string } {
  const cityNames = cityNameMap(source.cities);
  const stamp = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  const pushTour = (t: Record<string, unknown>, forceCat?: "tour" | "activity") => {
    const cat =
      forceCat ||
      (String(t.category || "tour").toLowerCase() === "activity"
        ? "activity"
        : "tour");
    lines.push(
      [
        csvEscape(t.id),
        cat,
        csvEscape(t.title || ""),
        csvEscape(cityNames.get(String(t.city_id || "")) || ""),
        csvEscape(t.audience || "both"),
        csvEscape(listToCsv(t.vibe_tags)),
        csvEscape(t.crowd_tag || ""),
        csvEscape(t.pace_tag || ""),
        csvEscape(
          t.access_type || (cat === "activity" ? "direct_ticket" : "guided_route")
        ),
        t.is_niche === true ? "true" : "false",
        t.is_bonus === true ? "true" : "false",
        csvEscape(t.description || ""),
        csvEscape(t.route || ""),
        csvEscape(t.inclusions_exclusions || ""),
        csvEscape(t.duration_hours ?? ""),
        csvEscape(listToCsv(t.languages)),
        t.is_customizable_duration === true ? "true" : "false",
        csvEscape(t.media_type || "Image"),
        csvEscape(t.price_1_pax ?? 0),
        csvEscape(t.price_2_pax ?? 0),
        csvEscape(t.price_3_pax ?? 0),
        csvEscape(t.price_4_pax ?? 0),
        csvEscape(t.price_extra_pax ?? 0),
        csvEscape(t.base_price_eur ?? ""),
        t.is_active === false ? "false" : "true",
      ].join(",")
    );
  };

  if (tab === "all") {
    lines.push(
      "record_type,id,title_or_name,city_or_type,metric,price_eur,notes,is_active"
    );
    for (const c of source.cities) {
      lines.push(
        [
          "CITY",
          csvEscape(c.id),
          csvEscape(c.name || ""),
          "",
          csvEscape(c.base_price_modifier ?? 1),
          csvEscape(c.base_price ?? ""),
          csvEscape(c.description || ""),
          c.is_active === false ? "false" : "true",
        ].join(",")
      );
    }
    for (const t of source.tours) {
      const raw = String(t.category || "tour").toLowerCase();
      const typeLabel =
        raw === "activity"
          ? "EXPERIENCE"
          : raw === "cluster"
            ? "CLUSTER"
            : "TOUR";
      lines.push(
        [
          typeLabel,
          csvEscape(t.id),
          csvEscape(t.title || ""),
          csvEscape(cityNames.get(String(t.city_id || "")) || ""),
          csvEscape(t.duration_hours != null ? `${t.duration_hours}h` : ""),
          csvEscape(raw === "cluster" ? 0 : t.price_1_pax ?? 0),
          csvEscape(t.description || ""),
          t.is_active === false ? "false" : "true",
        ].join(",")
      );
    }
    for (const v of source.vehicles) {
      lines.push(
        [
          "VEHICLE",
          csvEscape(v.id),
          csvEscape(v.name || v.type || ""),
          "",
          csvEscape(
            v.max_passengers != null || v.max_pax != null
              ? `${v.max_passengers ?? v.max_pax} pax`
              : ""
          ),
          csvEscape(v.price_per_day ?? ""),
          "",
          v.is_active === false ? "false" : "true",
        ].join(",")
      );
    }
    for (const t of source.transports) {
      lines.push(
        [
          "TRANSPORT",
          csvEscape(t.id),
          csvEscape(t.name || ""),
          csvEscape(t.transport_type || ""),
          csvEscape(t.duration_hours != null ? `${t.duration_hours}h` : ""),
          csvEscape(t.price_per_person ?? ""),
          csvEscape(t.description || ""),
          t.is_active === false ? "false" : "true",
        ].join(",")
      );
    }
  } else if (tab === "city") {
    lines.push("id,name,description,base_price_eur,base_price_modifier,is_active");
    for (const c of source.cities) {
      lines.push(
        [
          csvEscape(c.id),
          csvEscape(c.name || ""),
          csvEscape(c.description || ""),
          csvEscape(c.base_price ?? ""),
          csvEscape(c.base_price_modifier ?? 1),
          c.is_active === false ? "false" : "true",
        ].join(",")
      );
    }
  } else if (tab === "tour" || tab === "activity") {
    lines.push(TOUR_EXPERIENCE_CSV_HEADERS.join(","));
    for (const t of source.tours) {
      const cat =
        String(t.category || "tour").toLowerCase() === "activity"
          ? "activity"
          : "tour";
      if (cat !== tab) continue;
      pushTour(t, tab);
    }
  } else if (tab === "cluster") {
    lines.push(
      "id,category,title,city_name,duration_hours,description,is_active"
    );
    for (const t of source.tours) {
      if (String(t.category || "").toLowerCase() !== "cluster") continue;
      lines.push(
        [
          csvEscape(t.id),
          "cluster",
          csvEscape(t.title || ""),
          csvEscape(cityNames.get(String(t.city_id || "")) || ""),
          csvEscape(t.duration_hours ?? 2.5),
          csvEscape(t.description || ""),
          t.is_active === false ? "false" : "true",
        ].join(",")
      );
    }
  } else if (tab === "vehicle") {
    lines.push("id,name,max_passengers,price_per_day_eur,max_luggage,is_active");
    for (const v of source.vehicles) {
      lines.push(
        [
          csvEscape(v.id),
          csvEscape(v.name || v.type || ""),
          csvEscape(v.max_passengers ?? v.max_pax ?? ""),
          csvEscape(v.price_per_day ?? ""),
          csvEscape(v.max_luggage ?? ""),
          v.is_active === false ? "false" : "true",
        ].join(",")
      );
    }
  } else {
    lines.push(
      "id,name,transport_type,price_per_person_eur,duration_hours,city_name,description,is_active"
    );
    for (const t of source.transports) {
      lines.push(
        [
          csvEscape(t.id),
          csvEscape(t.name || ""),
          csvEscape(t.transport_type || "other"),
          csvEscape(t.price_per_person ?? ""),
          csvEscape(t.duration_hours ?? ""),
          csvEscape(cityNames.get(String(t.city_id || "")) || ""),
          csvEscape(t.description || ""),
          t.is_active === false ? "false" : "true",
        ].join(",")
      );
    }
  }

  return {
    filename: `TokioTours_Master_${TAB_LABEL[tab].replace(/\s+/g, "")}_${stamp}.csv`,
    csv: lines.join("\n"),
  };
}

export function downloadCatalogExport(
  tab: CatalogCsvTab,
  source: ExportSource
): void {
  const { filename, csv } = buildCatalogExportCsv(tab, source);
  downloadBlob(filename, csv);
}

function num(row: CatalogCsvRow, ...keys: string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v == null || v === "") continue;
    const n = Number(String(v).replace(/[€,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function boolActive(row: CatalogCsvRow): boolean {
  const v = String(row.is_active ?? "true").toLowerCase();
  return !(v === "false" || v === "0" || v === "no" || v === "inactive");
}

async function resolveCityId(
  pb: PbLike,
  cityName: string,
  cache: Map<string, string>
): Promise<string | undefined> {
  const key = cityName.trim().toLowerCase();
  if (!key) return undefined;
  if (cache.has(key)) return cache.get(key);
  const cities = await pb.collection("cities").getFullList({
    fields: "id,name",
    requestKey: null,
  });
  for (const c of cities) {
    const name = String(c.name || "").trim().toLowerCase();
    if (name) cache.set(name, String(c.id));
  }
  return cache.get(key);
}

export type CatalogCsvImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export async function importCatalogCsv(
  pb: PbLike,
  tab: CatalogCsvTab,
  csvText: string
): Promise<CatalogCsvImportResult> {
  if (tab === "all") {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: ["Pick a category tab (Cities, Tours, …) before uploading."],
    };
  }

  const rows = parseCatalogCsv(csvText);
  const result: CatalogCsvImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };
  const cityCache = new Map<string, string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    // Shipped templates/exports carry NO image column; if a row nonetheless
    // carries an image URL, pull it into that record's `{id}_1` catalog slot.
    // No URL → nothing to write: the record resolves by ID convention later.
    const pullImage = async (recordId: string) => {
      const ref = catalogCsvImageRef(row);
      if (!ref || !recordId) return;
      const token = String(
        (pb as unknown as { authStore?: { token?: string } }).authStore?.token || ""
      );
      const ok = await pullCatalogImageFromUrl(recordId, ref, token).catch(() => false);
      if (!ok) result.errors.push(`Line ${line}: image pull failed for ${recordId}_1`);
    };
    // CREATE-only: a new record whose row carried no image URL is born
    // with the auto-placeholder `{id}_1` slot. Best-effort — the record
    // already saved, so failures are swallowed (never an import error).
    const ensurePlaceholder = async (recordId: string, title: string) => {
      if (!recordId || catalogCsvImageRef(row)) return;
      const token = String(
        (pb as unknown as { authStore?: { token?: string } }).authStore?.token || ""
      );
      await ensureCatalogPlaceholder(recordId, title, token).catch(() => false);
    };
    try {
      if (tab === "city") {
        const name = row.name || row.city_name || row.title;
        if (!name) {
          result.skipped++;
          continue;
        }
        const payload = {
          name,
          description: row.description || "",
          base_price: num(row, "base_price_eur", "base_price"),
          base_price_modifier: num(row, "base_price_modifier") || 1,
          is_active: boolActive(row),
        };
        if (row.id) {
          await pb.collection("cities").update(row.id, payload);
          result.updated++;
          await pullImage(row.id);
        } else {
          const created = await pb.collection("cities").create(payload);
          result.created++;
          await pullImage(String(created.id || ""));
          await ensurePlaceholder(String(created.id || ""), name);
        }
        continue;
      }

      if (tab === "tour" || tab === "activity" || tab === "cluster") {
        const title = row.title || row.record_title || row.name;
        if (!title) {
          result.skipped++;
          continue;
        }
        const cityId =
          row.city_id ||
          (await resolveCityId(pb, row.city_name || row.city || "", cityCache));
        if (!cityId) {
          result.errors.push(`Line ${line}: city not found for "${title}"`);
          result.skipped++;
          continue;
        }
        const rowCat = String(row.category || "").toLowerCase();
        const category =
          tab === "cluster" ||
          rowCat === "cluster" ||
          String(row.category || "").toUpperCase() === "CLUSTER"
            ? "cluster"
            : tab === "activity" ||
                rowCat === "activity" ||
                String(row.category || "").toUpperCase() === "EXPERIENCE"
              ? "activity"
              : "tour";
        const isCluster = category === "cluster";
        // Only price_1_pax (sell price to the customer) is required.
        // Blank 2/3/4/extra tiers auto-fill with price_1_pax — storing 0
        // would make calculateTourPrice charge €0 for those party sizes.
        // An explicit "0" in the CSV is respected. base_price_eur is OUR
        // COST: blank = 0, never copied from price_1_pax.
        const has = (...keys: string[]) =>
          keys.some((k) => k in row && String(row[k] ?? "").trim() !== "");
        const tier = (key: string, p1Val: number) =>
          has(key) ? num(row, key) : p1Val;
        const p1 = isCluster
          ? 0
          : num(row, "price_1_pax", "default_price_eur", "price_eur");
        const payload: Record<string, unknown> = {
          title,
          city_id: cityId,
          category,
          audience: normalizeAudience(row.audience),
          description: row.description || row.details || "",
          duration_hours: num(row, "duration_hours") || (isCluster ? 2.5 : undefined),
          price: p1,
          price_per_person: p1,
          price_1_pax: p1,
          price_2_pax: isCluster ? 0 : tier("price_2_pax", p1),
          price_3_pax: isCluster ? 0 : tier("price_3_pax", p1),
          price_4_pax: isCluster ? 0 : tier("price_4_pax", p1),
          price_extra_pax: isCluster ? 0 : tier("price_extra_pax", p1),
          // Only write cost when the column exists, so old CSVs without
          // base_price_eur don't wipe a stored cost on update.
          ...(isCluster
            ? { base_price_eur: 0 }
            : "base_price_eur" in row
              ? { base_price_eur: num(row, "base_price_eur") }
              : {}),
          is_active: boolActive(row),
        };
        if ("route" in row) payload.route = row.route || "";
        if (!isCluster) {
          // Full wizard fields — only touched when the CSV carries them,
          // so legacy 13-column files don't wipe existing tags on update.
          if ("vibe_tags" in row || "vibetags" in row || "vibes" in row) {
            payload.vibe_tags = listFromCsv(
              row.vibe_tags || row.vibetags || row.vibes
            )
              .map((t) => t.toLowerCase())
              .filter((t) => VIBE_ALLOWED.has(t));
          }
          const crowd = normalizeCrowdTag(row.crowd_tag || row.crowd);
          if (crowd) payload.crowd_tag = crowd;
          const pace = normalizePaceTag(row.pace_tag || row.pace);
          if (pace) payload.pace_tag = pace;
          if ("access_type" in row || "accesstype" in row || "access" in row) {
            payload.access_type = normalizeAccessType(
              row.access_type || row.accesstype || row.access,
              category
            );
          }
          if ("is_niche" in row) payload.is_niche = csvBool(row.is_niche);
          if ("is_bonus" in row) payload.is_bonus = csvBool(row.is_bonus);
          if ("inclusions_exclusions" in row || "inclusions" in row) {
            payload.inclusions_exclusions =
              row.inclusions_exclusions || row.inclusions || "";
          }
          if ("languages" in row) {
            payload.languages = listFromCsv(row.languages);
          }
          if ("is_customizable_duration" in row) {
            payload.is_customizable_duration = csvBool(
              row.is_customizable_duration
            );
          }
          if (row.media_type === "Image" || row.media_type === "Video") {
            payload.media_type = row.media_type;
          }
        }
        if (isCluster) payload.is_self_guided = true;
        if (row.id) {
          await pb.collection("tours").update(row.id, payload);
          result.updated++;
          await pullImage(row.id);
        } else {
          const created = await pb.collection("tours").create(payload);
          result.created++;
          await pullImage(String(created.id || ""));
          await ensurePlaceholder(String(created.id || ""), title);
        }
        continue;
      }

      if (tab === "vehicle") {
        const name = row.name || row.vehicle_name || row.title;
        if (!name) {
          result.skipped++;
          continue;
        }
        const payload = {
          name,
          max_passengers: num(row, "max_passengers", "max_pax") || 7,
          price_per_day: num(row, "price_per_day_eur", "price_per_day") || 0,
          max_luggage: num(row, "max_luggage") || undefined,
          is_active: boolActive(row),
        };
        if (row.id) {
          await pb.collection("vehicles").update(row.id, payload);
          result.updated++;
          await pullImage(row.id);
        } else {
          const created = await pb.collection("vehicles").create(payload);
          result.created++;
          await pullImage(String(created.id || ""));
          await ensurePlaceholder(String(created.id || ""), name);
        }
        continue;
      }

      if (tab === "transport") {
        const name = row.name || row.title;
        if (!name) {
          result.skipped++;
          continue;
        }
        const cityId =
          row.city_id ||
          (await resolveCityId(pb, row.city_name || row.city || "", cityCache));
        const payload: Record<string, unknown> = {
          name,
          transport_type: row.transport_type || "other",
          price_per_person: num(
            row,
            "price_per_person_eur",
            "price_per_person",
            "default_price_eur"
          ),
          duration_hours: num(row, "duration_hours") || undefined,
          description: row.description || row.details || "",
          is_active: boolActive(row),
        };
        if (cityId) payload.city_id = cityId;
        if (row.id) {
          await pb.collection("transport_products").update(row.id, payload);
          result.updated++;
          await pullImage(row.id);
        } else {
          const created = await pb.collection("transport_products").create(payload);
          result.created++;
          await pullImage(String(created.id || ""));
          await ensurePlaceholder(String(created.id || ""), name);
        }
      }
    } catch (e) {
      result.errors.push(
        `Line ${line}: ${e instanceof Error ? e.message : "import failed"}`
      );
      result.skipped++;
    }
  }

  return result;
}
