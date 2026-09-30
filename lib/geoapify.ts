/**
 * Geoapify geocoding + dark-matter map helpers (Japan meeting points).
 */

export type GeoapifyPlace = {
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  placeId: string;
};

type GeoapifyFeature = {
  properties?: {
    name?: string;
    formatted?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    place_id?: string;
    lat?: number;
    lon?: number;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

export function getGeoapifyApiKey(): string {
  return String(process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || "").trim();
}

function featureToPlace(f: GeoapifyFeature): GeoapifyPlace | null {
  const p = f.properties || {};
  const coords = f.geometry?.coordinates;
  const lat =
    typeof p.lat === "number"
      ? p.lat
      : coords
        ? coords[1]
        : NaN;
  const lng =
    typeof p.lon === "number"
      ? p.lon
      : coords
        ? coords[0]
        : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const address = String(p.formatted || "").trim();
  const name = String(p.name || address.split(",")[0] || "").trim();
  const city = String(
    p.city || p.municipality || p.county || p.state || ""
  ).trim();
  if (!name && !address) return null;
  return {
    name: name || address,
    address: address || name,
    city,
    lat,
    lng,
    placeId: String(p.place_id || `${lat},${lng}`),
  };
}

export async function geoapifyAutocomplete(
  query: string,
  signal?: AbortSignal
): Promise<GeoapifyPlace[]> {
  const key = getGeoapifyApiKey();
  const text = query.trim();
  if (!key || text.length < 2) return [];

  const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  url.searchParams.set("text", text);
  url.searchParams.set("filter", "countrycode:jp");
  url.searchParams.set("limit", "8");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Geoapify autocomplete ${res.status}`);
  const data = (await res.json()) as { features?: GeoapifyFeature[] };
  return (data.features || [])
    .map(featureToPlace)
    .filter((p): p is GeoapifyPlace => Boolean(p));
}

export async function geoapifySearch(
  address: string,
  signal?: AbortSignal
): Promise<GeoapifyPlace | null> {
  const key = getGeoapifyApiKey();
  const text = address.trim();
  if (!key || !text) return null;

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", text);
  url.searchParams.set("filter", "countrycode:jp");
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", key);

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) throw new Error(`Geoapify search ${res.status}`);
  const data = (await res.json()) as { features?: GeoapifyFeature[] };
  const first = data.features?.[0];
  return first ? featureToPlace(first) : null;
}

/** Interactive + static dark-matter tile URL template. */
export function geoapifyDarkMatterTileUrl(): string {
  const key = getGeoapifyApiKey();
  return `https://maps.geoapify.com/v1/tile/dark-matter/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(key)}`;
}

/** Static map image for MEET widget background. */
export function geoapifyStaticMapUrl(
  lat: number,
  lng: number,
  size = { width: 600, height: 300 }
): string {
  const key = getGeoapifyApiKey();
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const url = new URL("https://maps.geoapify.com/v1/staticmap");
  url.searchParams.set("style", "dark-matter-yellow-roads");
  url.searchParams.set("width", String(size.width));
  url.searchParams.set("height", String(size.height));
  url.searchParams.set("center", `lonlat:${lng},${lat}`);
  url.searchParams.set("zoom", "15");
  url.searchParams.set(
    "marker",
    `lonlat:${lng},${lat};color:#f6a724;size:medium`
  );
  url.searchParams.set("apiKey", key);
  return url.toString();
}
