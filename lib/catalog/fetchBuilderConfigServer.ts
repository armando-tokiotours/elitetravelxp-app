/**
 * Server-side builder catalog fetch (no admin auth — public list rules).
 * Used by /api/catalog/builder-config with Next.js revalidate caching.
 */

import PocketBase from "pocketbase";
import {
  type BuilderConfig,
  type PbAirportTransfer,
  type PbAppSetting,
  type PbChauffeurRate,
  type PbCity,
  type PbCityMovement,
  type PbHub,
  type PbSeasonalCharacter,
  type PbSeasonalHighlight,
  type PbSeasonalParticle,
  type PbSeasonTier,
  type PbSiteBranding,
  type PbTour,
  type PbTransitMode,
  type PbTransfer,
  type PbVehicle,
  isGuestCatalogTour,
  rulesToMap,
  DEFAULT_APP_SETTINGS,
} from "@/lib/pocketbase/client";
function pbUrl(): string {
  return (
    process.env.POCKETBASE_INTERNAL_URL?.trim() ||
    process.env.POCKETBASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_POCKETBASE_URL?.trim() ||
    "http://127.0.0.1:8090"
  );
}

export async function fetchBuilderConfigServer(): Promise<BuilderConfig> {
  const pb = new PocketBase(pbUrl());
  pb.autoCancellation(false);

  const [
    citiesRaw,
    vehicles,
    transfers,
    hubsRaw,
    toursRaw,
    transitModes,
    cityMovements,
    airportTransfers,
    chauffeurRates,
    seasonalHighlightsRaw,
    seasonTiersRaw,
    seasonalParticlesRaw,
    seasonalCharactersRaw,
    brandingRows,
    settingsRows,
    legacyRules,
  ] = await Promise.all([
    pb.collection("cities").getFullList<PbCity>({ sort: "sort_order,name" }),
    pb.collection("vehicles").getFullList<PbVehicle>({
      sort: "max_passengers",
    }),
    pb.collection("transfers").getFullList<PbTransfer>(),
    pb
      .collection("hubs")
      .getFullList<PbHub>({ sort: "sort_order,name" })
      .catch(() => [] as PbHub[]),
    pb.collection("tours").getFullList<PbTour>({
      sort: "title",
      expand: "city_id",
    }),
    pb
      .collection("transit_modes")
      .getFullList<PbTransitMode>({ sort: "label" })
      .catch(() => [] as PbTransitMode[]),
    pb
      .collection("city_movements")
      .getFullList<PbCityMovement>({
        sort: "from_city_id,to_city_id",
        expand: "from_city_id,to_city_id",
      })
      .catch(() => [] as PbCityMovement[]),
    pb
      .collection("airport_transfers")
      .getFullList<PbAirportTransfer>({ sort: "hub_id,vehicle_id" })
      .catch(() => [] as PbAirportTransfer[]),
    pb
      .collection("chauffeur_rates")
      .getFullList<PbChauffeurRate>({ sort: "city_id,vehicle_id" })
      .catch(() => [] as PbChauffeurRate[]),
    pb
      .collection("seasonal_highlights")
      .getFullList<PbSeasonalHighlight>({ sort: "start_month,start_day" })
      .catch(() => [] as PbSeasonalHighlight[]),
    pb
      .collection("season_tiers")
      .getFullList<PbSeasonTier>({ sort: "sort_order,month,start_day" })
      .catch(() => [] as PbSeasonTier[]),
    pb
      .collection("seasonal_particles")
      .getFullList<PbSeasonalParticle>({
        sort: "sort_order,start_month,start_day",
      })
      .catch(() => [] as PbSeasonalParticle[]),
    pb
      .collection("seasonal_characters")
      .getFullList<PbSeasonalCharacter>({ sort: "sort_order,key" })
      .catch(() => [] as PbSeasonalCharacter[]),
    pb
      .collection("site_branding")
      .getFullList<PbSiteBranding>()
      .catch(() => [] as PbSiteBranding[]),
    pb
      .collection("app_settings")
      .getFullList<PbAppSetting>({ sort: "key" })
      .catch(() => [] as PbAppSetting[]),
    pb
      .collection("system_rules")
      .getFullList<{ key: string; value: string }>({ sort: "key" })
      .catch(() => [] as { key: string; value: string }[]),
  ]);

  const cities = citiesRaw.filter((c) => c.is_active !== false);
  const tours = toursRaw.filter(isGuestCatalogTour);
  const seasonalHighlights = seasonalHighlightsRaw.filter(
    (h) => h.is_active !== false
  );
  const seasonTiers = seasonTiersRaw.filter((t) => t.is_active !== false);
  const seasonalParticles = seasonalParticlesRaw.filter(
    (p) => p.is_active !== false
  );
  const seasonalCharacters = seasonalCharactersRaw.filter(
    (c) => c.is_active !== false
  );
  const hubs = hubsRaw.filter((h) => h.is_active !== false);

  const rules = {
    ...Object.fromEntries(DEFAULT_APP_SETTINGS.map((r) => [r.key, r.value])),
    ...rulesToMap(legacyRules),
    ...rulesToMap(settingsRows),
  };

  if (
    rules.seasonal_markup_percentage != null &&
    rules.seasonal_multiplier == null
  ) {
    const pct = Number(rules.seasonal_markup_percentage) || 0;
    rules.seasonal_multiplier = String(1 + pct / 100);
  }

  return {
    cities,
    accommodations: [],
    vehicles,
    transfers,
    hubs,
    tours,
    transitModes,
    cityMovements,
    airportTransfers,
    chauffeurRates,
    seasonalHighlights,
    seasonTiers,
    seasonalParticles,
    seasonalCharacters,
    branding: brandingRows[0] ?? null,
    rules,
  };
}
