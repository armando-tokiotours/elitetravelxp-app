/**
 * Full Catalog & Rules snapshot for Claude (tokiotours_master_knowledge.json).
 * Uses real PocketBase collection names from Team Access / admin-schema.
 *
 * Experiences & places live primarily on shared `tours` with
 * category = tour | activity | cluster (see lib/catalogCsvHub.ts).
 * Optional legacy `experiences_and_places` is included when present.
 */

import type PocketBase from "pocketbase";
import { INGESTION_AI_PROMPT_INSTRUCTIONS } from "@/lib/ingestionAiPrompt";

const FILEISH =
  /(_file|photo|image|video|mascot|thumbnail|media_file|cover_photo|explainer_video|document_file)$/i;

/** Drop heavy / unused payload fields while keeping ids, titles, rates. */
const STRIP_KEYS = new Set([
  "expand",
  "collectionId",
  "collectionName",
  "cover_media_urls",
  "media_urls",
  "gallery",
  "raw_html",
  "html",
]);

function stripHeavy(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRIP_KEYS.has(k)) continue;
    if (FILEISH.test(k) && typeof v === "string") {
      out[k] = v; // filename only — never binary
      continue;
    }
    // Keep URL pointers (VPS paths) but skip huge nested blobs
    if (
      (k === "description" || k === "route" || k === "inclusions_exclusions") &&
      typeof v === "string" &&
      v.length > 4000
    ) {
      out[k] = `${v.slice(0, 4000)}…`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

async function listSafe(
  pb: PocketBase,
  collection: string,
  opts?: { sort?: string; filter?: string; fields?: string }
): Promise<Record<string, unknown>[]> {
  try {
    const rows = await pb.collection(collection).getFullList<Record<string, unknown>>({
      sort: opts?.sort,
      filter: opts?.filter,
      fields: opts?.fields,
      requestKey: null,
    });
    return rows.map((r) => stripHeavy(r));
  } catch {
    return [];
  }
}

/** Prefer active rows when the collection has is_active. */
function activeFilter(hasActive = true): string | undefined {
  return hasActive ? "is_active != false" : undefined;
}

export type MasterKnowledgeSnapshot = {
  exportedAt: string;
  version: 1;
  note: string;
  /** Full TokioTours ingestion system prompt (same as COPY AI PROMPT). */
  ai_prompt_instructions: string;
  collectionsIncluded: string[];
  catalogMap: {
    tours: string;
    experiences: string;
    clusters: string;
    vehicles: string;
    chauffeurRates: string;
    transport: string;
  };
  businessRules: {
    cities: Record<string, unknown>[];
    guidePayMatrix: Record<string, unknown>[];
    seasonTiers: Record<string, unknown>[];
    seasonalHighlights: Record<string, unknown>[];
    chauffeurRates: Record<string, unknown>[];
    systemRules: Record<string, string>;
    appSettings: Record<string, unknown>[];
  };
  catalog: {
    /** All active tours rows (category tour | activity | cluster). */
    tours: Record<string, unknown>[];
    /** Convenience slices of `tours` by category. */
    toursByCategory: {
      tour: Record<string, unknown>[];
      activity: Record<string, unknown>[];
      cluster: Record<string, unknown>[];
      other: Record<string, unknown>[];
    };
    /** Legacy collection if present; prefer tours.category=activity. */
    experiencesAndPlaces: Record<string, unknown>[];
    transportProducts: Record<string, unknown>[];
    vehicles: Record<string, unknown>[];
    transfers: Record<string, unknown>[];
    hubs: Record<string, unknown>[];
    accommodations: Record<string, unknown>[];
    cityMovements: Record<string, unknown>[];
    airportTransfers: Record<string, unknown>[];
    featureExplainers: Record<string, unknown>[];
  };
};

function splitToursByCategory(tours: Record<string, unknown>[]) {
  const tour: Record<string, unknown>[] = [];
  const activity: Record<string, unknown>[] = [];
  const cluster: Record<string, unknown>[] = [];
  const other: Record<string, unknown>[] = [];
  for (const row of tours) {
    const cat = String(row.category || "")
      .toLowerCase()
      .trim();
    if (cat === "tour") tour.push(row);
    else if (cat === "activity") activity.push(row);
    else if (cat === "cluster") cluster.push(row);
    else other.push(row);
  }
  return { tour, activity, cluster, other };
}

export async function buildMasterKnowledgeSnapshot(
  pb: PocketBase
): Promise<MasterKnowledgeSnapshot> {
  const [
    cities,
    tours,
    guidePayMatrix,
    transportProducts,
    vehicles,
    transfers,
    hubs,
    accommodations,
    seasonalHighlights,
    seasonTiers,
    cityMovements,
    airportTransfers,
    chauffeurRates,
    featureExplainers,
    experiencesAndPlaces,
    appSettings,
    systemRulesRows,
  ] = await Promise.all([
    listSafe(pb, "cities", {
      sort: "sort_order,name",
      filter: activeFilter(),
    }),
    listSafe(pb, "tours", {
      sort: "title",
      filter: activeFilter(),
    }),
    listSafe(pb, "guide_pay_rules", { sort: "-year,tour_name" }),
    listSafe(pb, "transport_products", {
      sort: "sort_order,name",
      filter: activeFilter(),
    }),
    listSafe(pb, "vehicles", { sort: "max_passengers" }),
    listSafe(pb, "transfers"),
    listSafe(pb, "hubs", {
      sort: "sort_order,name",
      filter: activeFilter(),
    }),
    listSafe(pb, "accommodations", { sort: "star_rating,room_type" }),
    listSafe(pb, "seasonal_highlights", { filter: activeFilter() }),
    listSafe(pb, "season_tiers", {
      sort: "sort_order",
      filter: activeFilter(),
    }),
    listSafe(pb, "city_movements"),
    listSafe(pb, "airport_transfers"),
    listSafe(pb, "chauffeur_rates"),
    listSafe(pb, "feature_explainers", {
      sort: "feature_key,title",
      filter: activeFilter(),
    }),
    listSafe(pb, "experiences_and_places", {
      sort: "title",
      filter: activeFilter(),
    }),
    listSafe(pb, "app_settings"),
    listSafe(pb, "system_rules"),
  ]);

  const systemRules: Record<string, string> = {};
  for (const row of systemRulesRows) {
    const key = String(row.key || "").trim();
    if (!key) continue;
    systemRules[key] = String(row.value ?? "");
  }

  const toursByCategory = splitToursByCategory(tours);

  const collectionsIncluded = [
    "cities",
    "tours",
    "guide_pay_rules",
    "transport_products",
    "vehicles",
    "transfers",
    "hubs",
    "accommodations",
    "seasonal_highlights",
    "season_tiers",
    "city_movements",
    "airport_transfers",
    "chauffeur_rates",
    "feature_explainers",
    "app_settings",
    "system_rules",
    ...(experiencesAndPlaces.length > 0 ? ["experiences_and_places"] : []),
  ];

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    note:
      "TokioTours Master Knowledge — self-contained Catalog & Rules snapshot for AI ingestion. " +
      "Experiences/places are primarily `tours` rows (category=activity|cluster); " +
      "match vehicles by name against catalog.vehicles + chauffeur_rates (never hardcode record ids).",
    ai_prompt_instructions: INGESTION_AI_PROMPT_INSTRUCTIONS,
    collectionsIncluded,
    catalogMap: {
      tours: "tours (category=tour)",
      experiences: "tours (category=activity) ± experiences_and_places",
      clusters: "tours (category=cluster)",
      vehicles: "vehicles",
      chauffeurRates: "chauffeur_rates",
      transport: "transport_products",
    },
    businessRules: {
      cities,
      guidePayMatrix,
      seasonTiers,
      seasonalHighlights,
      chauffeurRates,
      systemRules,
      appSettings,
    },
    catalog: {
      tours,
      toursByCategory,
      experiencesAndPlaces,
      transportProducts,
      vehicles,
      transfers,
      hubs,
      accommodations,
      cityMovements,
      airportTransfers,
      featureExplainers,
    },
  };
}
