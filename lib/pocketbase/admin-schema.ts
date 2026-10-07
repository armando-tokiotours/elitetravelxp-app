/** Exact Source of Truth field maps for Team Access forms. */

export type CollectionKey =
  | "cities"
  | "tours"
  | "guide_pay_rules"
  | "vehicles"
  | "transport_products"
  | "transfers"
  | "hubs"
  | "accommodations"
  | "seasonal_highlights"
  | "season_tiers"
  | "city_movements"
  | "airport_transfers"
  | "chauffeur_rates"
  | "feature_explainers"
  | "app_settings";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "bool"
  | "select"
  | "multiselect"
  | "city"
  | "hub"
  | "vehicle"
  | "tour"
  | "file";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  accept?: string;
  /** Max selections for multiselect (UI + validation). */
  maxSelect?: number;
  /** Helper copy under the field label. */
  hint?: string;
  /** When saving, also write this legacy column (same value / same file). */
  legacyKey?: string;
  /** Bool toggle labels (default Active / Inactive). */
  trueLabel?: string;
  falseLabel?: string;
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
      {
        key: "avg_taxi_eur",
        label: "Self-arrange · avg taxi/Uber (€)",
        type: "number",
        hint: "Shown when guest picks Self — estimated out-of-pocket hop",
      },
      {
        key: "avg_subway_day_eur",
        label: "Self-arrange · avg subway / day (€)",
        type: "number",
        hint: "Typical local rail/subway day spend for Self comparison",
      },
      {
        key: "taxi_wait_mins",
        label: "Self-arrange · taxi wait (mins)",
        type: "number",
        hint: "Typical wait / transfer friction shown on Self micro-table",
      },
      {
        key: "available_languages",
        label: "Available languages",
        type: "multiselect",
        options: [
          "English",
          "Japanese",
          "French",
          "German",
          "Spanish",
          "Italian",
          "Dutch",
          "Portuguese",
          "Chinese",
          "Korean",
        ],
        hint: "Shown in Builder Experiences language dropdown for this city",
      },
      { key: "is_active", label: "Active in builder", type: "bool" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  {
    id: "tours",
    label: "Tours",
    titleKey: "title",
    sort: "title",
    fileFields: ["cover_photo", "media_file"],
    fields: [
      { key: "city_id", label: "City", type: "city", required: true },
      {
        key: "category",
        label: "Category",
        type: "select",
        required: true,
        options: ["tour", "activity"],
        hint: "Tour = multi-stop guided day · Activity = single experience / ticket",
      },
      {
        key: "audience",
        label: "Audience",
        type: "select",
        options: ["agency", "individual", "both"],
        hint: "Travel agencies only · Individuals only · Both",
      },
      {
        key: "vibe_tags",
        label: "Vibe tags",
        type: "multiselect",
        options: ["culture", "foodie", "modern", "nature", "multi_vibe"],
        maxSelect: 4,
        hint: "Tours: multiple vibes OK. Activities: pick 1 primary vibe.",
      },
      {
        key: "access_type",
        label: "Access type",
        type: "select",
        options: [
          "guided_route",
          "direct_ticket",
          "admission",
          "vip_event",
          "time_sensitive",
        ],
        hint: "Ticket = buy before · Admission = on-site · VIP / Time-sensitive also need Ops.",
      },
      {
        key: "crowd_tag",
        label: "Crowd / highlight style",
        type: "select",
        options: ["hidden_gem", "classic_highlight", "balanced_mix"],
        hint: "Maps to the Experience Profiler crowd answer.",
      },
      {
        key: "pace_tag",
        label: "Pace / intensity",
        type: "select",
        options: ["relaxed", "standard", "active"],
      },
      {
        key: "is_niche",
        label: "Niche / VIP exclusive",
        type: "bool",
      },
      {
        key: "is_bonus",
        label: "Bonus gift (agent-only)",
        type: "bool",
        trueLabel: "Bonus",
        falseLabel: "No",
        hint: "Hidden from guest catalog until an agent adds it to the package.",
      },
      { key: "title", label: "Title", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      { key: "route", label: "Route", type: "textarea" },
      {
        key: "inclusions_exclusions",
        label: "Inclusions & Exclusions",
        type: "textarea",
      },
      {
        key: "media_type",
        label: "Media type",
        type: "select",
        options: ["Image", "Video"],
      },
      {
        key: "media_file",
        label: "Media file (image or video)",
        type: "file",
        accept: "image/*,video/mp4,video/webm,video/quicktime",
      },
      {
        key: "cover_photo",
        label: "Cover photo / poster",
        type: "file",
        accept: "image/*",
        legacyKey: "image",
      },
      {
        key: "price_1_pax",
        label: "1 Pax (€)",
        type: "number",
        required: true,
      },
      { key: "price_2_pax", label: "2 Pax (€)", type: "number", required: true },
      { key: "price_3_pax", label: "3 Pax (€)", type: "number", required: true },
      { key: "price_4_pax", label: "4 Pax (€)", type: "number", required: true },
      {
        key: "price_extra_pax",
        label: "Extra Pax 5+ (€)",
        type: "number",
        required: true,
      },
      {
        key: "pricing_tier",
        label: "Pricing tier (Budget Planner)",
        type: "select",
        options: ["free", "low_cost", "standard", "luxury"],
      },
      {
        key: "is_self_guided",
        label: "Self-guided (ticket only / no private guide)",
        type: "bool",
      },
      {
        key: "guide_required",
        label: "Guide required",
        type: "bool",
      },
      {
        key: "base_price_eur",
        label: "Base ticket / entry (€ per person)",
        type: "number",
      },
      {
        key: "display_badge",
        label: "Display badge",
        type: "select",
        options: ["FREE / LOW-COST", "POPULAR", "SELF-GUIDED"],
      },
      { key: "duration_hours", label: "Duration (hours)", type: "number" },
      {
        key: "languages",
        label: "Languages",
        type: "multiselect",
        options: [
          "English",
          "Dutch",
          "Spanish",
          "French",
          "German",
          "Italian",
          "Japanese",
          "Portuguese",
          "Chinese",
          "Korean",
        ],
      },
      {
        key: "is_customizable_duration",
        label: "Tailor-made duration (guest can adjust hours)",
        type: "bool",
      },
      { key: "is_active", label: "Active", type: "bool" },
    ],
  },
  {
    id: "guide_pay_rules",
    label: "Guide Pay Matrix",
    titleKey: "tour_name",
    sort: "year,tour_name,duration_hours,pax_count",
    detailKeys: ["year", "duration_hours", "pax_count", "guide_pay_jpy"],
    fields: [
      { key: "year", label: "Year", type: "number", required: true },
      { key: "tour_name", label: "Tour name", type: "text", required: true },
      {
        key: "duration_hours",
        label: "Duration (hours)",
        type: "number",
        required: true,
      },
      {
        key: "pax_count",
        label: "Pax count",
        type: "number",
        required: true,
      },
      {
        key: "guide_pay_jpy",
        label: "Guide pay (JPY)",
        type: "number",
        required: true,
      },
      {
        key: "expenses_jpy",
        label: "Expenses (JPY)",
        type: "number",
      },
      {
        key: "is_meet_and_greet",
        label: "Meet & greet",
        type: "bool",
        trueLabel: "Yes",
        falseLabel: "No",
      },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "transport_products",
    label: "Transport",
    titleKey: "name",
    sort: "sort_order,name",
    fileFields: ["cover_photo", "explainer_video"],
    detailKeys: ["transport_type", "price_per_person"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      {
        key: "transport_type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          "suica",
          "bullet_train",
          "local_rail",
          "ferry",
          "bike",
          "ride",
          "other",
        ],
        hint: "Suica / bullet train / ferry / bike / ride — Ticketer line items",
      },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "price_per_person",
        label: "Price per person (€)",
        type: "number",
        required: true,
      },
      {
        key: "duration_hours",
        label: "Duration / total hours",
        type: "number",
        hint: "How long this ticket covers (e.g. Suica day pass hours, train ride)",
      },
      {
        key: "total_hours_note",
        label: "Hours note (guest-facing)",
        type: "text",
        hint: "Make duration crystal clear for guests and ticketer",
      },
      {
        key: "explainer_url",
        label: "Explainer link (URL)",
        type: "text",
      },
      {
        key: "explainer_video",
        label: "Explainer video",
        type: "file",
        accept: "video/mp4,video/webm,video/quicktime",
      },
      {
        key: "cover_photo",
        label: "Cover photo",
        type: "file",
        accept: "image/*",
      },
      { key: "city_id", label: "City (optional)", type: "city" },
      { key: "is_active", label: "Active", type: "bool" },
      { key: "sort_order", label: "Sort order", type: "number" },
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
        label: "Max passengers (max_pax)",
        type: "number",
        required: true,
        legacyKey: "max_pax",
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
  {
    id: "city_movements",
    label: "Inter-City Routes",
    titleKey: "from_city_id",
    sort: "from_city_id,to_city_id",
    fields: [
      {
        key: "from_city_id",
        label: "From city",
        type: "city",
        required: true,
      },
      {
        key: "to_city_id",
        label: "To city",
        type: "city",
        required: true,
      },
      {
        key: "public_transit_time_mins",
        label: "Public transit time (mins)",
        type: "number",
      },
      {
        key: "public_transit_cost",
        label: "Public transit cost (€ per person)",
        type: "number",
        hint: "Per-person bullet/express rail — multiplied by guest count in quotes",
      },
      {
        key: "private_transit_time_mins",
        label: "Private transit time (mins)",
        type: "number",
      },
      {
        key: "private_transit_cost",
        label: "Private transit cost (€)",
        type: "number",
        hint: "Vehicle total for private chauffeur transfer (not × guests)",
      },
      {
        key: "linked_transport_product_id",
        label: "Linked transport ticket",
        type: "text",
        hint: "transport_products id (Shinkansen / Suica) auto-attached when Public is selected",
      },
      {
        key: "is_recommended_order",
        label: "Recommended travel direction",
        type: "bool",
      },
    ],
  },
  {
    id: "airport_transfers",
    label: "Airport Transfers",
    titleKey: "hub_id",
    sort: "hub_id,vehicle_id",
    fields: [
      {
        key: "hub_id",
        label: "Airport / hub",
        type: "hub",
        required: true,
      },
      {
        key: "vehicle_id",
        label: "Vehicle",
        type: "vehicle",
        required: true,
      },
      {
        key: "base_pickup_fee",
        label: "Base pickup fee (€)",
        type: "number",
        required: true,
      },
      {
        key: "base_dropoff_fee",
        label: "Base drop-off fee (€)",
        type: "number",
        required: true,
      },
    ],
  },
  {
    id: "chauffeur_rates",
    label: "Chauffeur Rates",
    titleKey: "city_id",
    sort: "city_id,vehicle_id",
    fields: [
      {
        key: "city_id",
        label: "City",
        type: "city",
        required: true,
      },
      {
        key: "vehicle_id",
        label: "Vehicle",
        type: "vehicle",
        required: true,
      },
      {
        key: "base_daily_rate",
        label: "Base daily rate (€)",
        type: "number",
        required: true,
      },
    ],
  },
  {
    id: "feature_explainers",
    label: "Explanations",
    titleKey: "title",
    sort: "feature_key,title",
    fileFields: ["thumbnail_image", "media_file"],
    fields: [
      {
        key: "feature_key",
        label: "Feature key",
        type: "select",
        required: true,
        options: [
          "airport_transfers",
          "airport_pickup",
          "airport_dropoff",
          "private_chauffeur",
          "hotel_rooms",
          "elite_concierge",
          "guide_explainer",
          "daily_transport_explainer",
          "public_transport",
          "self_arranged_transport",
        ],
      },
      { key: "title", label: "Title", type: "text", required: true },
      {
        key: "description",
        label: "Description",
        type: "textarea",
      },
      {
        key: "thumbnail_image",
        label: "Button Thumbnail Image",
        type: "file",
        required: true,
        accept: "image/jpeg,image/png,image/webp,image/gif,image/*",
      },
      {
        key: "media_type",
        label: "Modal media type",
        type: "select",
        options: ["Video", "Image"],
      },
      {
        key: "media_file",
        label: "Modal Looping Video",
        type: "file",
        required: true,
        accept:
          "video/mp4,video/webm,video/quicktime,video/x-m4v,.m4v,image/*",
      },
    ],
  },
];

type PbFieldError = { message?: string; code?: string };

/** PocketBase ClientResponseError: `.data` is an alias for `.response` (full body). */
function pbFieldErrors(e: {
  response?: { data?: unknown };
  data?: unknown;
}): Record<string, PbFieldError> | null {
  const body = e.response && typeof e.response === "object" ? e.response : null;
  const nested = body && "data" in body ? (body as { data?: unknown }).data : null;
  // Prefer nested field map; fall back only when `.data` is already the field map
  // (not the full response body alias from the JS SDK).
  const candidate =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? nested
      : e.data &&
          typeof e.data === "object" &&
          !Array.isArray(e.data) &&
          !("message" in (e.data as object) && "data" in (e.data as object))
        ? e.data
        : null;
  if (!candidate || typeof candidate !== "object") return null;
  const out: Record<string, PbFieldError> = {};
  for (const [field, info] of Object.entries(candidate as Record<string, unknown>)) {
    if (info && typeof info === "object" && !Array.isArray(info)) {
      const row = info as PbFieldError;
      if (row.message || row.code) out[field] = row;
    }
  }
  return Object.keys(out).length ? out : null;
}

function humanizePbFieldError(field: string, info: PbFieldError): string {
  const code = String(info.code || "");
  const msg = String(info.message || "").toLowerCase();
  if (
    field === "email" &&
    (code.includes("invalid_email") ||
      msg.includes("valid email") ||
      msg.includes("invalid email"))
  ) {
    return "Email must look like name@company.com (include @ and a domain).";
  }
  if (
    field === "email" &&
    (code.includes("unique") ||
      code.includes("validation_not_unique") ||
      msg.includes("unique") ||
      msg.includes("already") ||
      msg.includes("exists"))
  ) {
    return "⚠️ This email already exists in the system. To change their role, edit the existing user instead of creating a new one.";
  }
  if (field === "password" || field === "passwordConfirm") {
    if (msg.includes("min") || msg.includes("at least") || code.includes("min")) {
      return "⚠️ Password must be at least 8 characters and match the confirmation.";
    }
    if (msg.includes("match") || code.includes("match")) {
      return "⚠️ Password must be at least 8 characters and match the confirmation.";
    }
    return "⚠️ Password must be at least 8 characters and match the confirmation.";
  }
  const label = field === "passwordConfirm" ? "Confirm password" : field;
  return info.message ? `${label}: ${info.message}` : `${label} is invalid.`;
}

export function formatPbError(e: unknown): string {
  if (!e || typeof e !== "object") return "Request failed";
  // Plain Error thrown by client validation — keep the message as-is.
  if (e instanceof Error && !("status" in e) && !("response" in e)) {
    return e.message || "Request failed";
  }
  const err = e as {
    message?: string;
    status?: number;
    response?: { message?: string; data?: Record<string, PbFieldError> };
    data?: Record<string, PbFieldError> | { message?: string; data?: Record<string, PbFieldError> };
  };
  // Status 0 = network failure (PocketBase down / wrong URL / CORS)
  if (err.status === 0) {
    return "Cannot reach PocketBase — is it running on http://127.0.0.1:8090? (npm run pb)";
  }
  if (err.status === 403) {
    return "Admin session expired or missing — sign out and sign in again to Team Access.";
  }
  const fields = pbFieldErrors(err);
  if (fields) {
    const human = Object.entries(fields).map(([field, info]) =>
      humanizePbFieldError(field, info)
    );
    // Prefer field detail over PB's generic "Something went wrong…"
    if (human.length === 1) return human[0];
    return human.join(" · ");
  }
  const raw = String(err.response?.message || err.message || "").trim();
  if (/something went wrong/i.test(raw) || (!raw && err.status === 400)) {
    if (err.status === 400) {
      return "Request rejected (HTTP 400) — email may already exist, or password is invalid (min 8). Check Credential registry before creating again.";
    }
    return err.status ? `${raw} (HTTP ${err.status})` : raw;
  }
  const parts: string[] = [];
  if (raw) parts.push(raw);
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
  if (def.id === "feature_explainers") {
    if (row.thumbnail_image) return String(row.thumbnail_image);
    if (row.media_file && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(row.media_file))) {
      return String(row.media_file);
    }
  }
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
