import PocketBase from "pocketbase";

const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";

let client: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  if (!client) {
    client = new PocketBase(PB_URL);
  }
  return client;
}

export function pbFileUrl(
  collectionIdOrName: string,
  recordId: string,
  filename: string,
  thumb?: string
): string {
  if (!filename) return "";
  const base = `${PB_URL}/api/files/${collectionIdOrName}/${recordId}/${filename}`;
  return thumb ? `${base}?thumb=${thumb}` : base;
}

export interface PbCity {
  id: string;
  name: string;
  image: string;
  base_price_modifier: number;
  sort_order?: number;
  collectionId: string;
  collectionName: string;
}

export interface PbAccommodation {
  id: string;
  tier: "4-star" | "5-star";
  room_type: string;
  min_price: number;
  max_price: number;
}

export interface PbVehicle {
  id: string;
  type: string;
  max_passengers: number;
  price_per_day: number;
}

export interface PbTransfer {
  id: string;
  location: string;
  pickup_fee: number;
  dropoff_fee: number;
}

export interface PbTour {
  id: string;
  city_id: string;
  title: string;
  price: number;
  expand?: { city_id?: PbCity };
}

export interface PbTransitMode {
  id: string;
  label: string;
  price_per_leg: number;
}

export interface BuilderConfig {
  cities: PbCity[];
  accommodations: PbAccommodation[];
  vehicles: PbVehicle[];
  transfers: PbTransfer[];
  tours: PbTour[];
  transitModes: PbTransitMode[];
}

export async function fetchBuilderConfig(): Promise<BuilderConfig> {
  const pb = getPocketBase();

  const [cities, accommodations, vehicles, transfers, tours, transitModes] =
    await Promise.all([
      pb.collection("cities").getFullList<PbCity>({
        sort: "sort_order,name",
      }),
      pb.collection("accommodations").getFullList<PbAccommodation>({
        sort: "tier,room_type",
      }),
      pb.collection("vehicles").getFullList<PbVehicle>({
        sort: "max_passengers",
      }),
      pb.collection("transfers").getFullList<PbTransfer>({
        sort: "location",
      }),
      pb.collection("tours").getFullList<PbTour>({
        sort: "title",
        expand: "city_id",
      }),
      pb.collection("transit_modes").getFullList<PbTransitMode>({
        sort: "label",
      }),
    ]);

  return {
    cities,
    accommodations,
    vehicles,
    transfers,
    tours,
    transitModes,
  };
}
