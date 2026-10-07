/**
 * Transport arrangement cards (Self / Public / Private).
 * In-city + inter-city use separate PocketBase `mode_id` keys so titles/photos
 * do not collide (unique key on mode_id).
 */

import { getPocketBase, pbFileUrl } from "@/lib/pocketbase/client";
import { TRANSPORT_ARRANGE_IMAGES } from "@/components/builder/DynamicWidgetBackground";

export type TransportCardModeId = "self" | "public" | "private";
export type TransportCardScope = "incity" | "intercity";

export interface PbUiTransportCard {
  id: string;
  mode_id: string;
  title?: string;
  description?: string;
  subtext?: string;
  image?: string;
  sort_order?: number;
  collectionId?: string;
}

export interface ResolvedTransportCard {
  mode: TransportCardModeId;
  title: string;
  description: string;
  subtext: string;
  image: string;
}

/** Gray car placeholder — inter-city until photos are uploaded. */
export const TRANSPORT_GRAY_CAR = "/brand/widgets/transport-gray-car.svg";

export const TRANSPORT_CARD_MODE_ORDER: TransportCardModeId[] = [
  "self",
  "public",
  "private",
];

export function transportCardStorageKey(
  scope: TransportCardScope,
  mode: TransportCardModeId
): string {
  return scope === "incity" ? mode : `intercity_${mode}`;
}

export function parseTransportCardStorageKey(
  raw: string
): { scope: TransportCardScope; mode: TransportCardModeId } | null {
  const id = String(raw || "")
    .trim()
    .toLowerCase();
  if (id === "self" || id === "public" || id === "private") {
    return { scope: "incity", mode: id };
  }
  const m = /^intercity_(self|public|private)$/.exec(id);
  if (m) {
    return { scope: "intercity", mode: m[1] as TransportCardModeId };
  }
  return null;
}

export const TRANSPORT_CARD_FALLBACKS_BY_SCOPE: Record<
  TransportCardScope,
  Record<TransportCardModeId, ResolvedTransportCard>
> = {
  incity: {
    self: {
      mode: "self",
      title: "Self-arranged",
      description: "Walk · taxi · on your own · €0 invoice",
      subtext: "Invoice €0",
      image: TRANSPORT_ARRANGE_IMAGES.self,
    },
    public: {
      mode: "public",
      title: "Public transport",
      description: "Metro · Suica · local trains",
      subtext: "",
      image: TRANSPORT_ARRANGE_IMAGES.public,
    },
    private: {
      mode: "private",
      title: "Private chauffeur",
      description: "Door-to-door pick-up · vanity van",
      subtext: "",
      image: TRANSPORT_ARRANGE_IMAGES.private,
    },
  },
  intercity: {
    self: {
      mode: "self",
      title: "Self-arranged",
      description: "Book your own train or car · €0 invoice",
      subtext: "Invoice €0",
      image: TRANSPORT_GRAY_CAR,
    },
    public: {
      mode: "public",
      title: "Train / Bullet train",
      description: "Shinkansen · reserved seats · JR",
      subtext: "",
      image: TRANSPORT_GRAY_CAR,
    },
    private: {
      mode: "private",
      title: "Private chauffeur",
      description: "Inter-city door-to-door · vanity van",
      subtext: "",
      image: TRANSPORT_GRAY_CAR,
    },
  },
};

/** In-city fallbacks — back-compat for `TRANSPORT_CARD_FALLBACKS.self` etc. */
export const TRANSPORT_CARD_FALLBACKS =
  TRANSPORT_CARD_FALLBACKS_BY_SCOPE.incity;

export function uiTransportCardImageUrl(
  row: PbUiTransportCard | null | undefined,
  thumb?: string
): string {
  if (!row?.image) return "";
  return pbFileUrl(
    row.collectionId || "ui_transport_cards",
    row.id,
    row.image,
    thumb
  );
}

export async function fetchUiTransportCards(): Promise<PbUiTransportCard[]> {
  const pb = getPocketBase();
  try {
    return await pb
      .collection("ui_transport_cards")
      .getFullList<PbUiTransportCard>({
        sort: "sort_order,mode_id",
        requestKey: null,
      });
  } catch {
    return [];
  }
}

export function resolveTransportCards(
  rows: PbUiTransportCard[] | null | undefined,
  scope: TransportCardScope = "incity"
): ResolvedTransportCard[] {
  const byKey = new Map<string, PbUiTransportCard>();
  for (const row of rows || []) {
    const id = String(row.mode_id || "")
      .trim()
      .toLowerCase();
    if (id) byKey.set(id, row);
  }

  return TRANSPORT_CARD_MODE_ORDER.map((mode) => {
    const fb = TRANSPORT_CARD_FALLBACKS_BY_SCOPE[scope][mode];
    const key = transportCardStorageKey(scope, mode);
    const row = byKey.get(key);
    const uploaded =
      uiTransportCardImageUrl(row, "600x400") || uiTransportCardImageUrl(row);
    const image =
      uploaded || (scope === "intercity" ? TRANSPORT_GRAY_CAR : fb.image);
    return {
      mode,
      title: String(row?.title || "").trim() || fb.title,
      description: String(row?.description || "").trim() || fb.description,
      subtext: String(row?.subtext ?? fb.subtext).trim(),
      image,
    };
  });
}
