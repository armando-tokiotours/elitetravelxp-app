import type { TravelPace } from "@/store/useBuilderStore";
import { BRANDING_UI_FALLBACKS, paceBrandingKey } from "@/lib/brandingUi";

export type PaceId = Exclude<TravelPace, null>;

/** Static fallbacks — prefer `useSiteBrandingStore().getTravelPaces()` at runtime. */
export const TRAVEL_PACES: {
  id: PaceId;
  label: string;
  tagline: string;
  description: string;
  detail: string;
  image: string;
}[] = (["fast", "moderate", "relaxed"] as PaceId[]).map((id) => {
  const fb = BRANDING_UI_FALLBACKS[paceBrandingKey(id)]!;
  const [description, detail = ""] = fb.description.split(/\n\n/);
  return {
    id,
    label: fb.title,
    tagline: fb.subtitle,
    description,
    detail,
    image: fb.mediaFallback,
  };
});

export function travelPaceLabel(pace: TravelPace): string | null {
  if (!pace) return null;
  return TRAVEL_PACES.find((p) => p.id === pace)?.label ?? null;
}
