/** Exact Source of Truth field maps for Team Access forms. */

export type CollectionKey =
  | "cities"
  | "tours"
  | "vehicles"
  | "transfers"
  | "hubs"
  | "accommodations"
  | "seasonal_highlights"
  | "season_tiers"
  | "app_settings";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "bool"
  | "select"
  | "city"
  | "tour"
  | "file";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  accept?: string;
  /** When saving, also write this legacy column (same value / same file). */
  legacyKey?: string;
}

export interface CollectionDef {
  id: CollectionKey;
  label: string;
  titleKey: string;
  /** PocketBase sort expression (avoid `created` — not present on all collections). */
  sort: string;
  fields: FieldDef[];
  fileFields?: string[];
  /** Keys shown in the list “details” column (first available wins for subtitle). */
  detailKeys?: string[];
}

export const COLLECTIONS: CollectionDef[] = [
  {
    id: "cities",
    label: "Cities",
    titleKey: "name",
    sort: "sort_order,name",
    fileFields: ["cover_photo"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "cover_photo",
        label: "Cover photo",
        type: "file",
        accept: "image/*",
        legacyKey: "image",
      },
      {
        key: "base_price_modifier",
        label: "Base price modifier",
        type: "number",
        required: true,
      },
      { key: "base_price", label: "Base price (€)", type: "number" },
      { key: "is_active", label: "Active in builder", type: "bool" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  {
    id: "tours",
    label: "Tours",
    titleKey: "title",
    sort: "title",
    fileFields: ["cover_photo"],
    fields: [
      { key: "city_id", label: "City", type: "city", required: true },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "cover_photo",
        label: "Cover photo",
        type: "file",
        accept: "image/*",
        legacyKey: "image",
      },
      {
        key: "price_per_person",
        label: "Price per person (€)",
        type: "number",
        required: true,
        legacyKey: "price",
      },
      { key: "duration_hours", label: "Duration (hours)", type: "number" },
      { key: "is_active", label: "Active", type: "bool" },
    ],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    titleKey: "name",
    sort: "max_passengers",
    fileFields: ["vehicle_image"],
    fields: [
      {
        key: "name",
        label: "Vehicle name",
        type: "text",
        required: true,
        legacyKey: "type",
      },
      {
        key: "max_passengers",
        label: "Max passengers",
        type: "number",
        required: true,
      },
      { key: "max_luggage", label: "Max luggage", type: "number" },
      {
        key: "price_per_day",
        label: "Price per day (€)",
        type: "number",
        required: true,
      },
      {
        key: "vehicle_image",
        label: "Vehicle image",
        type: "file",
        accept: "image/*",
      },
    ],
  },
  {
    id: "transfers",
    label: "Transfers",
    titleKey: "location_name",
    sort: "location_name,location",
    fields: [
      {
        key: "location_name",
        label: "Location name",
        type: "text",
        required: true,
        legacyKey: "location",
      },
      {
        key: "type",
        label: "Type",
        type: "select",
        options: ["Arrival", "Departure", "Both"],
        required: true,
      },
      {
        key: "base_pickup_fee",
        label: "Pickup fee (€)",
        type: "number",
        required: true,
        legacyKey: "pickup_fee",
      },
      {
        key: "base_dropoff_fee",
        label: "Drop-off fee (€)",
        type: "number",
        required: true,
        legacyKey: "dropoff_fee",
      },
    ],
  },
  {
    id: "hubs",
    label: "Hubs / Ports",
    titleKey: "name",
    sort: "sort_order,name",
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        options: ["Airport", "Cruise Terminal"],
        required: true,
      },
      { key: "name", label: "Hub name", type: "text", required: true },
      { key: "city_id", label: "City (optional)", type: "city" },
      {
        key: "pickup_fee",
        label: "Pickup fee (€)",
        type: "number",
        required: true,
      },
      {
        key: "dropoff_fee",
        label: "Drop-off fee (€)",
        type: "number",
        required: true,
      },
      { key: "is_active", label: "Active", type: "bool" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  {
    id: "accommodations",
    label: "Hotels",
    titleKey: "room_type",
    sort: "star_rating,room_type",
    fields: [
      { key: "city_id", label: "City", type: "city" },
      {
        key: "star_rating",
        label: "Star rating",
        type: "select",
        options: ["3-star", "4-star", "5-star"],
        required: true,
      },
      {
        key: "month",
        label: "Month",
        type: "select",
        options: [
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
        ],
      },
      {
        key: "season_tier",
        label: "Season tier",
        type: "select",
        options: ["Low", "Mid", "High"],
      },
      {
        key: "room_type",
        label: "Room type",
        type: "select",
        options: ["Standard", "Twin", "Superior"],
        required: true,
      },
      {
        key: "breakfast",
        label: "Breakfast",
        type: "select",
        options: ["Included", "Not Included"],
      },
      {
        key: "price_min",
        label: "Price min (€)",
        type: "number",
        required: true,
        legacyKey: "min_price_per_night",
      },
      {
        key: "price_max",
        label: "Price max (€)",
        type: "number",
        required: true,
        legacyKey: "max_price_per_night",
      },
      {
        key: "tier",
        label: "Legacy tier",
        type: "select",
        options: ["3-star", "4-star", "5-star"],
      },
      { key: "max_occupancy", label: "Max occupancy", type: "number" },
    ],
  },
  {
    id: "seasonal_highlights",
    label: "Seasonal Highlights",
    titleKey: "title",
    sort: "start_month,start_day,title",
    fileFields: ["cover_photo"],
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      {
        key: "city_id",
        label: "City (empty = All Japan)",
        type: "city",
      },
      { key: "start_month", label: "Start month (1–12)", type: "number", required: true },
      { key: "start_day", label: "Start day (1–31)", type: "number", required: true },
      { key: "end_month", label: "End month (1–12)", type: "number", required: true },
      { key: "end_day", label: "End day (1–31)", type: "number", required: true },
      { key: "description", label: "Concierge note", type: "textarea" },
      {
        key: "suggested_tour_id",
        label: "Suggested tour",
        type: "tour",
      },
      { key: "badge_text", label: "Badge text", type: "text" },
      {
        key: "cover_photo",
        label: "Cover photo",
        type: "file",
        accept: "image/*",
      },
      { key: "is_active", label: "Active", type: "bool" },
    ],
  },
  {
    id: "season_tiers",
    label: "Seasonality Rules",
    titleKey: "month",
    sort: "sort_order,month,start_day",
    fields: [
      {
        key: "month",
        label: "Month",
        type: "select",
        required: true,
        options: [
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
        ],
      },
      { key: "start_day", label: "Start day", type: "number", required: true },
      { key: "end_day", label: "End day", type: "number", required: true },
      {
        key: "tier",
        label: "Season tier",
        type: "select",
        required: true,
        options: ["Low", "Mid", "High"],
      },
      { key: "crowd_level", label: "Crowd level", type: "text" },
      {
        key: "concierge_note",
        label: "Concierge note",
        type: "textarea",
      },
      { key: "sort_order", label: "Sort order", type: "number" },
      { key: "is_active", label: "Active", type: "bool" },
    ],
  },
];

export function formatPbError(e: unknown): string {
  if (!e || typeof e !== "object") return "Request failed";
  const err = e as {
    message?: string;
    status?: number;
    response?: { message?: string; data?: Record<string, { message?: string; code?: string }> };
    data?: Record<string, { message?: string; code?: string }>;
  };
  const data = err.response?.data || err.data;
  const parts: string[] = [];
  if (err.response?.message || err.message) {
    parts.push(String(err.response?.message || err.message));
  }
  if (data && typeof data === "object") {
    for (const [field, info] of Object.entries(data)) {
      if (info && typeof info === "object" && info.message) {
        parts.push(`${field}: ${info.message}`);
      }
    }
  }
  if (err.status) parts.push(`(HTTP ${err.status})`);
  return parts.filter(Boolean).join(" — ") || "Request failed";
}

/** Resolve display title for a row given collection def. */
export function rowTitle(def: CollectionDef, row: Record<string, unknown>): string {
  const keys = [def.titleKey, "name", "title", "location", "location_name", "room_type"];
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return String(row.id ?? "Record");
}

/** Resolve photo filename from exact or legacy file field. */
export function rowPhotoFilename(
  def: CollectionDef,
  row: Record<string, unknown>
): string {
  for (const f of def.fields) {
    if (f.type !== "file") continue;
    const primary = row[f.key];
    if (primary) return String(primary);
    if (f.legacyKey && row[f.legacyKey]) return String(row[f.legacyKey]);
  }
  if (row.cover_photo) return String(row.cover_photo);
  if (row.image) return String(row.image);
  if (row.vehicle_image) return String(row.vehicle_image);
  return "";
}
