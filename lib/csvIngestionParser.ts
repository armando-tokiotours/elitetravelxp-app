/**
 * Claude → Ops 12-column inquiry CSV parser.
 * Columns: record_type, pnr, guest_name, guest_email, pax_count, start_date,
 * day_number, time_slot, category, item_title, price_eur, is_bonus
 */

export type IngestionRecordType = "HEADER" | "LINE_ITEM";

export type IngestionTimeSlot =
  | "Morning"
  | "Mid-morning"
  | "Lunch"
  | "Afternoon"
  | "Evening"
  | "All Day";

export type IngestionCategory =
  | "TOURS"
  | "TRANSIT"
  | "TICKET"
  | "ACCOMMODATION";

export type IngestionPipeline = "URGENT_DATED" | "FLEXIBLE_UNDATED";

export interface IngestionRow {
  record_type: IngestionRecordType;
  pnr: string;
  guest_name: string;
  guest_email: string;
  pax_count: number;
  start_date: string | null;
  day_number: number;
  time_slot: IngestionTimeSlot;
  category: IngestionCategory;
  item_title: string;
  price_eur: number;
  is_bonus: boolean;
}

const HEADER_ALIASES: Record<string, keyof IngestionRow | "skip"> = {
  record_type: "record_type",
  recordtype: "record_type",
  type: "record_type",
  pnr: "pnr",
  booking_ref: "pnr",
  guest_name: "guest_name",
  guestname: "guest_name",
  name: "guest_name",
  guest_email: "guest_email",
  guestemail: "guest_email",
  email: "guest_email",
  pax_count: "pax_count",
  pax: "pax_count",
  guests: "pax_count",
  start_date: "start_date",
  startdate: "start_date",
  tour_date: "start_date",
  day_number: "day_number",
  day: "day_number",
  time_slot: "time_slot",
  timeslot: "time_slot",
  category: "category",
  item_title: "item_title",
  itemtitle: "item_title",
  title: "item_title",
  description: "item_title",
  price_eur: "price_eur",
  price: "price_eur",
  exactprice: "price_eur",
  is_bonus: "is_bonus",
  isbonus: "is_bonus",
  bonus: "is_bonus",
};

const TIME_SLOTS = new Set<string>([
  "Morning",
  "Mid-morning",
  "Lunch",
  "Afternoon",
  "Evening",
  "All Day",
]);

/** RFC4180-ish row split (quoted commas / escaped quotes). */
export function parseCsvTable(csvText: string): string[][] {
  const s = String(csvText || "").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n") {
      row.push(field);
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (c === "\r") continue;
    field += c;
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
}

function normHeader(h: string): string {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseBool(raw: string): boolean {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y";
}

function parseDate(raw: string): string | null {
  const v = String(raw || "")
    .trim()
    .replace(/^"|"$/g, "");
  if (!v || /^null$/i.test(v) || v === "-" || v === "TBD") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }
  return null;
}

function parseCategory(raw: string): IngestionCategory {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  if (v === "TOUR" || v === "TOURS" || v === "EXPERIENCE") return "TOURS";
  if (v === "TRANSIT" || v === "TRANSPORT" || v === "CAR" || v === "VEHICLE")
    return "TRANSIT";
  if (v === "TICKET" || v === "TICKETS" || v === "PASS") return "TICKET";
  if (v === "ACCOMMODATION" || v === "HOTEL" || v === "STAY")
    return "ACCOMMODATION";
  return "TOURS";
}

function parseTimeSlot(raw: string): IngestionTimeSlot {
  const v = String(raw || "").trim();
  if (TIME_SLOTS.has(v)) return v as IngestionTimeSlot;
  const lower = v.toLowerCase();
  if (lower.includes("mid")) return "Mid-morning";
  if (lower.includes("morning")) return "Morning";
  if (lower.includes("lunch")) return "Lunch";
  if (lower.includes("afternoon")) return "Afternoon";
  if (lower.includes("evening") || lower.includes("night")) return "Evening";
  return "All Day";
}

function parseRecordType(raw: string): IngestionRecordType {
  const v = String(raw || "")
    .trim()
    .toUpperCase();
  if (v === "HEADER" || v === "HEAD") return "HEADER";
  return "LINE_ITEM";
}

function cellsToRow(
  cells: string[],
  indexByKey: Partial<Record<keyof IngestionRow, number>> | null
): IngestionRow {
  const get = (key: keyof IngestionRow, fallbackIndex: number): string => {
    if (indexByKey && indexByKey[key] != null) {
      return String(cells[indexByKey[key]!] ?? "").trim();
    }
    return String(cells[fallbackIndex] ?? "").trim();
  };

  return {
    record_type: parseRecordType(get("record_type", 0)),
    pnr: get("pnr", 1),
    guest_name: get("guest_name", 2),
    guest_email: get("guest_email", 3),
    pax_count: Math.max(1, parseInt(get("pax_count", 4), 10) || 1),
    start_date: parseDate(get("start_date", 5)),
    day_number: Math.max(1, parseInt(get("day_number", 6), 10) || 1),
    time_slot: parseTimeSlot(get("time_slot", 7)),
    category: parseCategory(get("category", 8)),
    item_title: get("item_title", 9),
    price_eur: Math.max(0, Number.parseFloat(get("price_eur", 10)) || 0),
    is_bonus: parseBool(get("is_bonus", 11)),
  };
}

export function parseIngestionCSV(csvText: string): IngestionRow[] {
  const table = parseCsvTable(csvText);
  if (table.length === 0) return [];

  const first = table[0].map(normHeader);
  const looksLikeHeader = first.some(
    (h) => h === "record_type" || h === "item_title" || h === "guest_email"
  );

  let dataRows = table;
  let indexByKey: Partial<Record<keyof IngestionRow, number>> | null = null;

  if (looksLikeHeader) {
    indexByKey = {};
    first.forEach((h, i) => {
      const mapped = HEADER_ALIASES[h];
      if (mapped && mapped !== "skip") indexByKey![mapped] = i;
    });
    dataRows = table.slice(1);
  }

  return dataRows
    .map((cells) => cellsToRow(cells, indexByKey))
    .filter((row) => {
      if (row.record_type === "HEADER") return true;
      return Boolean(String(row.item_title || "").trim());
    });
}

export function resolveIngestionPipeline(
  startDate: string | null | undefined
): IngestionPipeline {
  return startDate ? "URGENT_DATED" : "FLEXIBLE_UNDATED";
}

export function pipelineLabel(pipeline: IngestionPipeline): string {
  return pipeline === "URGENT_DATED"
    ? "Pipeline 1 · Urgent / Dated"
    : "Pipeline 2 · Flexible / Undated";
}
