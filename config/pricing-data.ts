/** Centralized pricing & option configuration for the Itinerary Designer. */

export const DURATION_OPTIONS = [10, 14, 21] as const;

export type HubId =
  | "osaka"
  | "narita"
  | "haneda"
  | "cruise";

export const HUBS: { id: HubId; label: string; short: string }[] = [
  { id: "osaka", label: "Osaka Airport (KIX/ITM)", short: "Osaka (KIX/ITM)" },
  { id: "narita", label: "Narita Airport (NRT)", short: "Narita (NRT)" },
  { id: "haneda", label: "Haneda Airport (HND)", short: "Haneda (HND)" },
  { id: "cruise", label: "Cruise Terminal", short: "Cruise Terminal" },
];

export type CityId =
  | "tokyo"
  | "kyoto"
  | "osaka"
  | "kawaguchiko"
  | "hakone"
  | "hiroshima"
  | "kanazawa"
  | "takayama"
  | "nagasaki"
  | "fukuoka";

export const CITIES: { id: CityId; label: string; region: string }[] = [
  { id: "tokyo", label: "Tokyo", region: "Kanto" },
  { id: "kyoto", label: "Kyoto", region: "Kansai" },
  { id: "osaka", label: "Osaka", region: "Kansai" },
  { id: "kawaguchiko", label: "Kawaguchiko", region: "Chubu" },
  { id: "hakone", label: "Hakone", region: "Kanto" },
  { id: "hiroshima", label: "Hiroshima", region: "Chugoku" },
  { id: "kanazawa", label: "Kanazawa", region: "Hokuriku" },
  { id: "takayama", label: "Takayama", region: "Chubu" },
  { id: "nagasaki", label: "Nagasaki", region: "Kyushu" },
  { id: "fukuoka", label: "Fukuoka", region: "Kyushu" },
];

export type HotelTier = "4-star" | "5-star";

export const HOTEL_TIERS: { id: HotelTier; label: string }[] = [
  { id: "4-star", label: "4-Star Luxury" },
  { id: "5-star", label: "5-Star Ultra Luxury" },
];

export type RoomType = "king" | "twin" | "executive-suite";

export const ROOM_TYPES: { id: RoomType; label: string }[] = [
  { id: "king", label: "King" },
  { id: "twin", label: "Twin" },
  { id: "executive-suite", label: "Executive Suite" },
];

export type TransitMode = "shinkansen" | "private-car";

export const TRANSIT_MODES: { id: TransitMode; label: string; description: string }[] = [
  {
    id: "shinkansen",
    label: "Bullet Train (Shinkansen — Gran Class)",
    description: "First-class rail between cities with reserved Gran Class seating.",
  },
  {
    id: "private-car",
    label: "Private Car / Executive Chauffeur",
    description: "Door-to-door private transfer with dedicated chauffeur.",
  },
];

export type TourId = string;

export interface TourPackage {
  id: TourId;
  cityId: CityId;
  name: string;
  durationHours: number;
  priceMin: number;
  priceMax: number;
}

export const TOUR_PACKAGES: TourPackage[] = [
  { id: "tokyo-imperial", cityId: "tokyo", name: "Imperial Palace & Ginza Private Tour", durationHours: 6, priceMin: 480, priceMax: 720 },
  { id: "tokyo-teamlab", cityId: "tokyo", name: "teamLab Borderless & Odaiba Experience", durationHours: 5, priceMin: 420, priceMax: 650 },
  { id: "tokyo-nikko", cityId: "tokyo", name: "Nikko UNESCO Day Excursion", durationHours: 10, priceMin: 780, priceMax: 1100 },
  { id: "kyoto-temples", cityId: "kyoto", name: "Arashiyama & Golden Pavilion Circuit", durationHours: 7, priceMin: 520, priceMax: 780 },
  { id: "kyoto-tea", cityId: "kyoto", name: "Gion Geisha District & Tea Ceremony", durationHours: 4, priceMin: 380, priceMax: 560 },
  { id: "kyoto-fuji", cityId: "kyoto", name: "Fushimi Inari Sunrise Private Walk", durationHours: 3, priceMin: 280, priceMax: 420 },
  { id: "osaka-food", cityId: "osaka", name: "Osaka Street Food & Castle Tour", durationHours: 5, priceMin: 360, priceMax: 540 },
  { id: "osaka-universal", cityId: "osaka", name: "Universal Studios VIP Day", durationHours: 8, priceMin: 650, priceMax: 980 },
  { id: "kawaguchiko-fuji", cityId: "kawaguchiko", name: "Mt. Fuji Lakeside & Chureito Pagoda", durationHours: 6, priceMin: 440, priceMax: 680 },
  { id: "hakone-onsen", cityId: "hakone", name: "Hakone Ropeway, Onsen & Lake Ashi Cruise", durationHours: 7, priceMin: 480, priceMax: 720 },
  { id: "hiroshima-peace", cityId: "hiroshima", name: "Peace Memorial & Miyajima Island", durationHours: 8, priceMin: 520, priceMax: 780 },
  { id: "kanazawa-garden", cityId: "kanazawa", name: "Kenrokuen Garden & Samurai District", durationHours: 5, priceMin: 380, priceMax: 560 },
  { id: "takayama-oldtown", cityId: "takayama", name: "Old Town & Hida Folk Village", durationHours: 5, priceMin: 360, priceMax: 540 },
  { id: "nagasaki-history", cityId: "nagasaki", name: "Nagasaki History & Dejima Walking Tour", durationHours: 5, priceMin: 340, priceMax: 520 },
  { id: "fukuoka-yatai", cityId: "fukuoka", name: "Fukuoka Yatai Food & Temples Tour", durationHours: 4, priceMin: 300, priceMax: 460 },
];

/** Per-night hotel rates by tier and room type (USD). */
export const HOTEL_RATES: Record<
  HotelTier,
  Record<RoomType, { min: number; max: number }>
> = {
  "4-star": {
    king: { min: 280, max: 420 },
    twin: { min: 260, max: 400 },
    "executive-suite": { min: 450, max: 680 },
  },
  "5-star": {
    king: { min: 520, max: 820 },
    twin: { min: 490, max: 780 },
    "executive-suite": { min: 980, max: 1600 },
  },
};

/** Airport / port transfer fees one-way (USD per vehicle). */
export const TRANSFER_FEES: Record<HubId, { min: number; max: number }> = {
  osaka: { min: 180, max: 280 },
  narita: { min: 220, max: 340 },
  haneda: { min: 160, max: 250 },
  cruise: { min: 200, max: 320 },
};

/** Base daily rate for private chauffeur (USD). */
export const CHAUFFEUR_DAILY = { min: 450, max: 680 };

/** Per-leg inter-city transit estimates (USD per guest for train; per vehicle for car). */
export const TRANSIT_RATES: Record<
  TransitMode,
  { min: number; max: number; unit: "per-guest-leg" | "per-vehicle-leg" }
> = {
  shinkansen: { min: 180, max: 320, unit: "per-guest-leg" },
  "private-car": { min: 420, max: 780, unit: "per-vehicle-leg" },
};

/** Planning / concierge base fee per trip (USD). */
export const BASE_SERVICE_FEE = { min: 800, max: 1400 };

/** Per-day guest experience buffer (meals, incidentals guidance) — optional soft estimate. */
export const DAILY_GUEST_BUFFER = { min: 120, max: 280 };

export type VehicleType = "alphard" | "hiace";

export interface VehicleSpec {
  id: VehicleType;
  label: string;
  maxGuests: number;
  maxLuggage: number;
}

export const VEHICLES: VehicleSpec[] = [
  { id: "alphard", label: "Toyota Alphard", maxGuests: 3, maxLuggage: 3 },
  { id: "hiace", label: "Toyota HiAce", maxGuests: 8, maxLuggage: 8 },
];

/**
 * Car allocation:
 * - Up to 3 guests → 1 Alphard
 * - 4+ guests → prefer 1 HiAce, or 2 Alphards if party prefers split vehicles
 */
export function allocateVehicles(guestCount: number): {
  alphards: number;
  hiaces: number;
  summary: string;
} {
  if (guestCount <= 0) {
    return { alphards: 0, hiaces: 0, summary: "No vehicles required" };
  }
  if (guestCount <= 3) {
    return {
      alphards: 1,
      hiaces: 0,
      summary: "1 × Toyota Alphard (up to 3 guests)",
    };
  }
  if (guestCount <= 8) {
    return {
      alphards: 0,
      hiaces: 1,
      summary: `1 × Toyota HiAce (or 2 × Alphard) for ${guestCount} guests`,
    };
  }
  const hiaces = Math.ceil(guestCount / 8);
  return {
    alphards: 0,
    hiaces,
    summary: `${hiaces} × Toyota HiAce for ${guestCount} guests`,
  };
}
