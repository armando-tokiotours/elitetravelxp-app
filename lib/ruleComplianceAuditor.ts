/**
 * Compare Claude inquiry CSV line prices against live PocketBase catalog / rules.
 */

import type PocketBase from "pocketbase";
import type { IngestionRow } from "@/lib/csvIngestionParser";
import { calculateTourPrice } from "@/lib/tourPricing";

export type RuleAuditStatus = "MATCH" | "DISCREPANCY" | "CUSTOM_OVERRIDE";

export type RuleAuditConflict = {
  itemTitle: string;
  category: string;
  dayNumber: number;
  importedPrice: number;
  expectedPrice: number | null;
  deltaEur: number | null;
  ruleApplied: string;
  status: RuleAuditStatus;
  catalogId?: string;
  notes?: string;
};

export type RuleAuditSummary = {
  auditedAt: string;
  paxCount: number;
  startDate: string | null;
  seasonalMultiplier: number;
  seasonTierLabel: string | null;
  conflicts: RuleAuditConflict[];
  matchCount: number;
  discrepancyCount: number;
  customCount: number;
};

type TourRow = {
  id: string;
  title?: string;
  city_id?: string;
  price_1_pax?: number;
  price_2_pax?: number;
  price_3_pax?: number;
  price_4_pax?: number;
  price_extra_pax?: number;
  base_price_eur?: number;
  price?: number;
  is_active?: boolean;
};

type TransportRow = {
  id: string;
  name?: string;
  transport_type?: string;
  price_per_person?: number;
  city_id?: string;
};

type VehicleRow = {
  id: string;
  name?: string;
  price_per_day?: number;
  max_passengers?: number;
};

type CityRow = {
  id: string;
  name?: string;
  base_price_modifier?: number;
  base_price?: number;
};

type ChauffeurRow = {
  id: string;
  city_id?: string;
  vehicle_id?: string;
  base_daily_rate?: number;
  expand?: { vehicle_id?: { name?: string }; city_id?: { name?: string } };
};

type AccommodationRow = {
  id: string;
  name?: string;
  city_id?: string;
  star_rating?: string;
  tier?: string;
  room_type?: string;
  price_min?: number;
  price_max?: number;
  min_price?: number;
  max_price?: number;
};

function norm(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nearlyEqual(a: number, b: number, tol = 1): boolean {
  return Math.abs(a - b) <= tol;
}

function hotelMin(a: AccommodationRow): number {
  return Math.max(
    0,
    Number(a.price_min ?? a.min_price ?? a.price_max ?? a.max_price) || 0
  );
}

function findSeasonMultiplier(
  systemRules: Record<string, string>,
  seasonTiers: { tier?: string; month?: string; start_day?: number; end_day?: number }[],
  startDate: string | null
): { multiplier: number; label: string | null } {
  const fromRules = Number(systemRules.seasonal_multiplier);
  let multiplier =
    Number.isFinite(fromRules) && fromRules > 0 ? fromRules : 1;

  if (systemRules.seasonal_markup_percentage != null) {
    const pct = Number(systemRules.seasonal_markup_percentage);
    if (Number.isFinite(pct) && systemRules.seasonal_multiplier == null) {
      multiplier = 1 + pct / 100;
    }
  }

  if (!startDate) {
    return { multiplier: 1, label: null }; // undated → no season surcharge assumed
  }

  const parts = startDate.split("-").map(Number);
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return { multiplier, label: null };

  const monthNames = [
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
  ];
  const monthName = monthNames[m - 1];
  const hit = seasonTiers.find((t) => {
    const tm = String(t.month || "");
    if (tm && tm.toLowerCase() !== monthName.toLowerCase() && Number(tm) !== m)
      return false;
    const sd = Number(t.start_day) || 1;
    const ed = Number(t.end_day) || 31;
    return d >= sd && d <= ed;
  });

  const tier = String(hit?.tier || "").toLowerCase();
  let label: string | null = hit
    ? `${hit.tier || "?"} · ${monthName} ${d}`
    : null;

  // Soft tier bump when seasonal_multiplier is 1 but tier is High/Mid
  if (multiplier === 1 && tier === "high") multiplier = 1.15;
  if (multiplier === 1 && tier === "mid") multiplier = 1.08;

  return { multiplier, label };
}

function matchByTitle<T extends { id: string }>(
  rows: T[],
  title: string,
  getTitle: (r: T) => string
): T | undefined {
  const needle = norm(title);
  if (!needle) return undefined;
  return (
    rows.find((r) => norm(getTitle(r)) === needle) ||
    rows.find((r) => {
      const t = norm(getTitle(r));
      return t.includes(needle) || needle.includes(t);
    })
  );
}

export async function auditImportedCSVAgainstRules(
  pb: PocketBase,
  rows: IngestionRow[]
): Promise<RuleAuditSummary> {
  const header =
    rows.find((r) => r.record_type === "HEADER") || rows[0];
  const lineItems = rows.filter(
    (r) => r.record_type === "LINE_ITEM" && String(r.item_title || "").trim()
  );
  const pax = Math.max(1, Number(header?.pax_count) || 1);
  const startDate = header?.start_date || null;

  const [
    tours,
    transports,
    vehicles,
    cities,
    chauffeurRates,
    accommodations,
    seasonTiers,
    systemRulesRows,
  ] = await Promise.all([
    pb
      .collection("tours")
      .getFullList<TourRow>({
        filter: "is_active != false",
        requestKey: null,
      })
      .catch(() => [] as TourRow[]),
    pb
      .collection("transport_products")
      .getFullList<TransportRow>({
        filter: "is_active != false",
        requestKey: null,
      })
      .catch(() => [] as TransportRow[]),
    pb
      .collection("vehicles")
      .getFullList<VehicleRow>({ requestKey: null })
      .catch(() => [] as VehicleRow[]),
    pb
      .collection("cities")
      .getFullList<CityRow>({ requestKey: null })
      .catch(() => [] as CityRow[]),
    pb
      .collection("chauffeur_rates")
      .getFullList<ChauffeurRow>({
        expand: "vehicle_id,city_id",
        requestKey: null,
      })
      .catch(() => [] as ChauffeurRow[]),
    pb
      .collection("accommodations")
      .getFullList<AccommodationRow>({ requestKey: null })
      .catch(() => [] as AccommodationRow[]),
    pb
      .collection("season_tiers")
      .getFullList<{
        tier?: string;
        month?: string;
        start_day?: number;
        end_day?: number;
      }>({ requestKey: null })
      .catch(() => []),
    pb
      .collection("system_rules")
      .getFullList<{ key?: string; value?: string }>({ requestKey: null })
      .catch(() => []),
  ]);

  const systemRules: Record<string, string> = {};
  for (const r of systemRulesRows) {
    if (r.key) systemRules[String(r.key)] = String(r.value ?? "");
  }

  const { multiplier: seasonalMultiplier, label: seasonTierLabel } =
    findSeasonMultiplier(systemRules, seasonTiers, startDate);

  const cityById = new Map(cities.map((c) => [c.id, c]));

  const conflicts: RuleAuditConflict[] = lineItems.map((row) => {
    const imported = Math.max(0, Math.round(Number(row.price_eur) || 0));
    const title = String(row.item_title || "").trim();
    const cat = row.category;

    if (row.is_bonus) {
      return {
        itemTitle: title,
        category: cat,
        dayNumber: row.day_number,
        importedPrice: imported,
        expectedPrice: 0,
        deltaEur: imported,
        ruleApplied: "Bonus / complimentary (expected €0)",
        status: imported === 0 ? "MATCH" : "DISCREPANCY",
        notes: imported > 0 ? "Bonus flagged but CSV has a price" : undefined,
      };
    }

    if (cat === "TOURS") {
      const tour = matchByTitle(tours, title, (t) => String(t.title || ""));
      if (!tour) {
        return {
          itemTitle: title,
          category: cat,
          dayNumber: row.day_number,
          importedPrice: imported,
          expectedPrice: null,
          deltaEur: null,
          ruleApplied: "Custom agent quote (no catalog tour match)",
          status: "CUSTOM_OVERRIDE",
        };
      }
      let expected = Math.round(calculateTourPrice(pax, tour));
      const city = tour.city_id ? cityById.get(tour.city_id) : undefined;
      const cityMod = Number(city?.base_price_modifier ?? 1) || 1;
      const rules: string[] = [
        `Tour tier price · ${pax} pax`,
        `€${expected} catalog`,
      ];
      if (cityMod !== 1) {
        expected = Math.round(expected * cityMod);
        rules.push(`city modifier ×${cityMod}`);
      }
      if (seasonalMultiplier !== 1) {
        expected = Math.round(expected * seasonalMultiplier);
        rules.push(`season ×${seasonalMultiplier.toFixed(2)}`);
      }
      const status: RuleAuditStatus = nearlyEqual(imported, expected)
        ? "MATCH"
        : "DISCREPANCY";
      return {
        itemTitle: title,
        category: cat,
        dayNumber: row.day_number,
        importedPrice: imported,
        expectedPrice: expected,
        deltaEur: imported - expected,
        ruleApplied: rules.join(" · "),
        status,
        catalogId: tour.id,
      };
    }

    if (cat === "TRANSIT" || cat === "TICKET") {
      const transport = matchByTitle(
        transports,
        title,
        (t) => String(t.name || "")
      );
      const vehicle = matchByTitle(
        vehicles,
        title,
        (v) => String(v.name || "")
      );
      const chauffeur = chauffeurRates.find((r) => {
        const vn = String(r.expand?.vehicle_id?.name || "");
        return vn && (norm(vn) === norm(title) || norm(title).includes(norm(vn)));
      });

      if (transport) {
        const unit = Math.round(Number(transport.price_per_person) || 0);
        let expected = unit * pax;
        const rules = [
          `Transport ${transport.transport_type || "product"}`,
          `€${unit}/pax × ${pax}`,
        ];
        if (seasonalMultiplier !== 1 && cat === "TRANSIT") {
          expected = Math.round(expected * seasonalMultiplier);
          rules.push(`season ×${seasonalMultiplier.toFixed(2)}`);
        }
        return {
          itemTitle: title,
          category: cat,
          dayNumber: row.day_number,
          importedPrice: imported,
          expectedPrice: expected,
          deltaEur: imported - expected,
          ruleApplied: rules.join(" · "),
          status: nearlyEqual(imported, expected) ? "MATCH" : "DISCREPANCY",
          catalogId: transport.id,
        };
      }

      if (chauffeur || vehicle) {
        const daily = Math.round(
          Number(
            chauffeur?.base_daily_rate ?? vehicle?.price_per_day ?? 0
          ) || 0
        );
        return {
          itemTitle: title,
          category: cat,
          dayNumber: row.day_number,
          importedPrice: imported,
          expectedPrice: daily,
          deltaEur: imported - daily,
          ruleApplied: chauffeur
            ? `Chauffeur daily rate €${daily}`
            : `Vehicle day rate €${daily}`,
          status: nearlyEqual(imported, daily) ? "MATCH" : "DISCREPANCY",
          catalogId: chauffeur?.id || vehicle?.id,
        };
      }

      return {
        itemTitle: title,
        category: cat,
        dayNumber: row.day_number,
        importedPrice: imported,
        expectedPrice: null,
        deltaEur: null,
        ruleApplied: "Custom agent quote (no transport/vehicle match)",
        status: "CUSTOM_OVERRIDE",
      };
    }

    if (cat === "ACCOMMODATION") {
      const hotel = matchByTitle(
        accommodations,
        title,
        (a) => String(a.name || a.tier || a.star_rating || "")
      );
      if (!hotel) {
        return {
          itemTitle: title,
          category: cat,
          dayNumber: row.day_number,
          importedPrice: imported,
          expectedPrice: null,
          deltaEur: null,
          ruleApplied: "Custom hotel quote (no accommodations row match)",
          status: "CUSTOM_OVERRIDE",
        };
      }
      const expected = Math.round(hotelMin(hotel));
      return {
        itemTitle: title,
        category: cat,
        dayNumber: row.day_number,
        importedPrice: imported,
        expectedPrice: expected,
        deltaEur: imported - expected,
        ruleApplied: `Accommodation catalog min €${expected}`,
        status: nearlyEqual(imported, expected) ? "MATCH" : "DISCREPANCY",
        catalogId: hotel.id,
      };
    }

    return {
      itemTitle: title,
      category: cat,
      dayNumber: row.day_number,
      importedPrice: imported,
      expectedPrice: null,
      deltaEur: null,
      ruleApplied: "Custom agent quote",
      status: "CUSTOM_OVERRIDE",
    };
  });

  return {
    auditedAt: new Date().toISOString(),
    paxCount: pax,
    startDate,
    seasonalMultiplier,
    seasonTierLabel,
    conflicts,
    matchCount: conflicts.filter((c) => c.status === "MATCH").length,
    discrepancyCount: conflicts.filter((c) => c.status === "DISCREPANCY")
      .length,
    customCount: conflicts.filter((c) => c.status === "CUSTOM_OVERRIDE")
      .length,
  };
}
