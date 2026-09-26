"use client";

import { pbFileUrl } from "@/lib/pocketbase/client";
import type { SeasonalMatch } from "@/lib/seasonalMatcher";
import { BoxGradingGlow } from "@/components/branding/BoxGradingGlow";

export function ConciergeSuggestionCard({
  match,
  tourAlreadyAdded,
  onAddTour,
}: {
  match: SeasonalMatch;
  tourAlreadyAdded?: boolean;
  onAddTour?: (tourId: string) => void;
}) {
  const h = match.highlight;
  const badge = h.badge_text?.trim() || "Seasonal Highlight";
  const photo =
    h.cover_photo && h.collectionId
      ? pbFileUrl(h.collectionId, h.id, h.cover_photo, "120x120")
      : "";
  const tourId = h.suggested_tour_id;

  return (
    <div className="relative mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/80 p-3 backdrop-blur-md">
      <BoxGradingGlow />
      <div className="relative z-10 flex gap-3">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg">
            ✨
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#075473]">
            ✨ {badge}
          </p>
          <p className="mt-0.5 font-medium text-white">{h.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {h.description
              ? h.description
              : `During your stay (${match.stayLabel}), this experience is in season.`}
            {h.description ? (
              <span className="mt-1 block text-zinc-400">
                During your stay ({match.stayLabel}).
              </span>
            ) : null}
          </p>
          {tourId && onAddTour ? (
            <button
              type="button"
              disabled={tourAlreadyAdded}
              onClick={() => onAddTour(tourId)}
              className="mt-2 rounded-full border border-white/15 bg-[#054F70] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-default disabled:border-[#075473]/50 disabled:bg-zinc-900 disabled:text-[#F3D9C4]"
            >
              {tourAlreadyAdded
                ? "Recommended tour added"
                : "Add Recommended Tour +"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
