/**
 * Transport arrangement cards (Self / Public / Private).
 * Content lives in PocketBase `ui_transport_cards`; static paths are fallbacks.
 */

import { getPocketBase, pbFileUrl } from "@/lib/pocketbase/client";
import { TRANSPORT_ARRANGE_IMAGES } from "@/components/builder/DynamicWidgetBackground";

export type TransportCardModeId = "self" | "public" | "private";

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

export const TRANSPORT_CARD_FALLBACKS: Record<
  TransportCardModeId,
  ResolvedTransportCard
> = {
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
    description: "Shinkansen · metro · Suica tickets",
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
};

export const TRANSPORT_CARD_MODE_ORDER: TransportCardModeId[] = [
  "self",
  "public",
  "private",
];

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
  rows: PbUiTransportCard[] | null | undefined
): ResolvedTransportCard[] {
  const byMode = new Map<string, PbUiTransportCard>();
  for (const row of rows || []) {
    const id = String(row.mode_id || "")
      .trim()
      .toLowerCase();
    if (id) byMode.set(id, row);
  }

  return TRANSPORT_CARD_MODE_ORDER.map((mode) => {
    const fb = TRANSPORT_CARD_FALLBACKS[mode];
    const row = byMode.get(mode);
    const image =
      uiTransportCardImageUrl(row, "600x400") ||
      uiTransportCardImageUrl(row) ||
      fb.image;
    return {
      mode,
      title: String(row?.title || "").trim() || fb.title,
      description: String(row?.description || "").trim() || fb.description,
      subtext: String(row?.subtext ?? fb.subtext).trim(),
      image,
    };
  });
}
