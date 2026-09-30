/**
 * Transport catalog products (Suica, Shinkansen, ferry…) shown in
 * Source wizard + Ticketer line items.
 */

export type TransportType =
  | "suica"
  | "bullet_train"
  | "local_rail"
  | "ferry"
  | "bike"
  | "ride"
  | "other";

export type TransportProduct = {
  id: string;
  name: string;
  transport_type: TransportType | string;
  description?: string;
  price_per_person?: number;
  duration_hours?: number;
  total_hours_note?: string;
  explainer_url?: string;
  city_id?: string;
  is_active?: boolean;
  cover_photo?: string;
  explainer_video?: string;
  collectionId?: string;
};

/** Guest/builder pick that lands on Ticketer. */
export type TransportTicketLine = {
  productId: string;
  name: string;
  transportType: string;
  pricePerPerson: number;
  quantity: number;
  durationHours?: number;
  hoursNote?: string;
  explainerUrl?: string;
  cityId?: string;
};

export const TRANSPORT_TYPE_LABELS: Record<string, string> = {
  suica: "Suica / PASMO",
  bullet_train: "Bullet train",
  local_rail: "Local rail",
  ferry: "Ferry",
  bike: "Bike",
  ride: "Ride / taxi voucher",
  other: "Other ticket",
};

export function formatTransportType(type: string): string {
  return TRANSPORT_TYPE_LABELS[type] || type || "Transport";
}
