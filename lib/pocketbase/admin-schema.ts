/** Exact Source of Truth field maps for Team Access forms. */

export type CollectionKey =
  | "cities"
  | "tours"
  | "vehicles"
  | "transfers"
  | "accommodations"
  | "app_settings";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "bool"
  | "select"
  | "city"
  | "file";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  accept?: string;
}

export interface CollectionDef {
  id: CollectionKey;
  label: string;
  titleKey: string;
  fields: FieldDef[];
  fileFields?: string[];
}

export const COLLECTIONS: CollectionDef[] = [
  {
    id: "cities",
    label: "Cities",
    titleKey: "name",
    fileFields: ["cover_photo"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "cover_photo",
        label: "Cover photo",
        type: "file",
        accept: "image/*",
      },
      { key: "is_active", label: "Active in builder", type: "bool" },
      { key: "sort_order", label: "Sort order", type: "number" },
    ],
  },
  {
    id: "tours",
    label: "Tours",
    titleKey: "title",
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
      },
      {
        key: "price_per_person",
        label: "Price per person",
        type: "number",
        required: true,
      },
      { key: "duration_hours", label: "Duration (hours)", type: "number" },
      { key: "is_active", label: "Active", type: "bool" },
    ],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    titleKey: "name",
    fileFields: ["vehicle_image"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      {
        key: "max_passengers",
        label: "Max passengers",
        type: "number",
        required: true,
      },
      { key: "max_luggage", label: "Max luggage", type: "number" },
      {
        key: "price_per_day",
        label: "Price per day",
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
    fields: [
      {
        key: "location_name",
        label: "Location name",
        type: "text",
        required: true,
      },
      {
        key: "type",
        label: "Type",
        type: "select",
        options: ["Arrival", "Departure", "Both"],
        required: true,
      },
      { key: "base_pickup_fee", label: "Base pickup fee", type: "number" },
      { key: "base_dropoff_fee", label: "Base dropoff fee", type: "number" },
    ],
  },
  {
    id: "accommodations",
    label: "Hotels",
    titleKey: "room_type",
    fields: [
      {
        key: "tier",
        label: "Tier",
        type: "select",
        options: ["4-star", "5-star"],
        required: true,
      },
      { key: "room_type", label: "Room type", type: "text", required: true },
      {
        key: "min_price_per_night",
        label: "Min price / night",
        type: "number",
        required: true,
      },
      {
        key: "max_price_per_night",
        label: "Max price / night",
        type: "number",
        required: true,
      },
      { key: "max_occupancy", label: "Max occupancy", type: "number" },
    ],
  },
];
