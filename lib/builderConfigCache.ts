/**
 * In-memory + sessionStorage builder catalog cache + prefetch.
 * Prefers cached /api/catalog/builder-config (1h server revalidate).
 * UI never blocks paint on a cold fetch — paint shell immediately.
 */

import {
  fetchBuilderConfig,
  type BuilderConfig,
  type FetchBuilderConfigOpts,
  getPocketBase,
  type PbCity,
} from "@/lib/pocketbase/client";
import {
  setSeasonalCharacterRules,
  setSeasonalParticleRules,
} from "@/lib/seasonality";

const TTL_MS = 120_000;
const SESSION_KEY = "tokio-builder-config-v1";

let mem: { data: BuilderConfig; at: number } | null = null;
let inflight: Promise<BuilderConfig> | null = null;

export function emptyBuilderConfigShell(cities: PbCity[] = []): BuilderConfig {
  return {
    cities,
    accommodations: [],
    vehicles: [],
    transfers: [],
    hubs: [],
    tours: [],
    transitModes: [],
    cityMovements: [],
    airportTransfers: [],
    chauffeurRates: [],
    seasonalHighlights: [],
    seasonTiers: [],
    seasonalParticles: [],
    seasonalCharacters: [],
    branding: null,
    rules: {},
  };
}

function applySeasonRules(data: BuilderConfig): void {
  try {
    setSeasonalParticleRules(data.seasonalParticles || []);
    setSeasonalCharacterRules(data.seasonalCharacters || []);
  } catch {
    /* ignore on partial shells */
  }
}

function readSessionCache(): BuilderConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: BuilderConfig };
    if (!parsed?.data || !Array.isArray(parsed.data.cities)) return null;
    if (Date.now() - parsed.at > TTL_MS * 30) return null; // ~1h session reuse
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache(data: BuilderConfig): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    /* quota */
  }
}

export function peekBuilderConfigCache(): BuilderConfig | null {
  if (mem && Date.now() - mem.at <= TTL_MS) return mem.data;
  if (mem && Date.now() - mem.at > TTL_MS) mem = null;
  const fromSession = readSessionCache();
  if (fromSession) {
    mem = { data: fromSession, at: Date.now() };
    return fromSession;
  }
  return null;
}

export function setBuilderConfigCache(data: BuilderConfig): void {
  mem = { data, at: Date.now() };
  writeSessionCache(data);
  applySeasonRules(data);
}

export function clearBuilderConfigCache(): void {
  mem = null;
  inflight = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}

async function fetchViaCachedApi(): Promise<BuilderConfig | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/catalog/builder-config", {
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as BuilderConfig;
    if (!data || !Array.isArray(data.cities)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Full catalog — memory/session → cached API → direct PB. */
export async function getBuilderConfig(
  opts: FetchBuilderConfigOpts = {}
): Promise<BuilderConfig> {
  const hit = peekBuilderConfigCache();
  if (hit && !opts.includeAccommodations) return hit;

  if (inflight && !opts.includeAccommodations) return inflight;

  const request = (async () => {
    if (!opts.includeAccommodations) {
      const fromApi = await fetchViaCachedApi();
      if (fromApi) {
        setBuilderConfigCache(fromApi);
        return fromApi;
      }
    }
    const data = await fetchBuilderConfig(opts);
    if (!opts.includeAccommodations) setBuilderConfigCache(data);
    return data;
  })();

  if (!opts.includeAccommodations) {
    inflight = request.finally(() => {
      inflight = null;
    });
    return inflight;
  }
  return request;
}

/** Fire-and-forget warm during Pre-Elite / home. */
export function prefetchBuilderConfig(): void {
  if (typeof window === "undefined") return;
  if (peekBuilderConfigCache()) return;
  void getBuilderConfig();
}

/**
 * Cities-only shell for first paint when cache is cold.
 * Tours load in the background via getBuilderConfig().
 */
export async function fetchBuilderConfigShell(): Promise<BuilderConfig> {
  const hit = peekBuilderConfigCache();
  if (hit) return hit;

  try {
    const pb = getPocketBase();
    const citiesRaw = await pb
      .collection("cities")
      .getFullList<PbCity>({ sort: "sort_order,name" });
    return emptyBuilderConfigShell(
      citiesRaw.filter((c) => c.is_active !== false)
    );
  } catch {
    return emptyBuilderConfigShell();
  }
}
