"use client";

import {
  PACE_SUMMARY_LABEL,
  QUIZ_CROWD,
  QUIZ_VIBE,
  isBestMatchTour,
  type ExperienceProfile,
} from "@/lib/experienceProfiler";
import type { UserTravelProfile } from "@/store/useItineraryStore";
import type { PbTour } from "@/lib/pocketbase/client";
import { LazyVideo } from "@/components/ui/LazyVideo";

function conciergeAdvice(
  cityName: string,
  profile: ExperienceProfile | null,
  userProfile: UserTravelProfile | null
): string {
  const vibe = profile?.vibe ?? userProfile?.vibe;
  const pace = profile?.pace ?? userProfile?.pace;
  const crowd = profile?.crowdStyle ?? userProfile?.crowdStyle;

  if (!vibe) {
    return `Take the 30-second Style Quiz to unlock tailored ${cityName} picks — we will highlight Best Match tours and pace-friendly booking tips here.`;
  }

  const paceTip =
    pace === "relaxed"
      ? "favour one standout experience per day and leave room for café pauses"
      : pace === "active"
        ? "stack morning and afternoon slots, and book full-day routes early"
        : "pair a half-day highlight with a lighter evening option";

  const crowdTip =
    crowd === "hidden_gems"
      ? "we recommend early-morning temple slots and quieter neighbourhood routes over peak mid-day crowds"
      : crowd === "classic"
        ? "iconic landmarks work best with timed entry — lock tickets before peak season"
        : "mix one famous stop with a quieter neighbourhood walk for balance";

  const vibeTip =
    vibe === "foodie"
      ? "Ask your concierge about izakaya crawls and market tastings."
      : vibe === "nature"
        ? "Garden and scenic day trips pair well with private chauffeur transfers."
        : vibe === "modern"
          ? "Evening districts and digital art museums reward late starts."
          : "Heritage sites feel calmer with private chauffeur transfers between wards.";

  return `Based on your preference for ${
    QUIZ_VIBE.find((o) => o.id === vibe)?.label ?? vibe
  } travel at a ${
    PACE_SUMMARY_LABEL[pace ?? "standard"]
  } pace, ${paceTip}. For ${cityName}, ${crowdTip}. ${vibeTip}`;
}

export function DiscoverMatchesPanel({
  cityName,
  experienceProfile,
  userProfile,
  tours,
  onRetakeQuiz,
  onPlayReel,
}: {
  cityName: string;
  experienceProfile: ExperienceProfile | null;
  userProfile: UserTravelProfile | null;
  tours: PbTour[];
  onRetakeQuiz: () => void;
  onPlayReel?: () => void;
}) {
  const vibe = experienceProfile?.vibe ?? userProfile?.vibe;
  const pace = experienceProfile?.pace ?? userProfile?.pace;
  const crowd = experienceProfile?.crowdStyle ?? userProfile?.crowdStyle;

  const vibeLabel = vibe
    ? QUIZ_VIBE.find((o) => o.id === vibe)?.label ?? vibe
    : "Not set yet";
  const paceLabel = pace ? PACE_SUMMARY_LABEL[pace] : "—";
  const crowdLabel = crowd
    ? QUIZ_CROWD.find((o) => o.id === crowd)?.label ?? crowd
    : "—";

  const matched = experienceProfile
    ? tours.filter((t) => isBestMatchTour(t, experienceProfile)).slice(0, 6)
    : [];

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#B85304]/40 bg-[#B85304]/15 p-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-500">
              Active Match Profile
            </span>
            <p className="mt-0.5 text-xs font-semibold text-zinc-200">
              {vibe
                ? `${vibeLabel} · ${paceLabel} · ${crowdLabel}`
                : "Take the Style Quiz to unlock matches"}
            </p>
          </div>
          <button
            type="button"
            onClick={onRetakeQuiz}
            className="shrink-0 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-bold text-zinc-950 transition-colors hover:bg-[#9C4203]"
          >
            {vibe ? "Retake Quiz" : "Take Quiz"}
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300">
          <h4 className="mb-1 flex items-center gap-1.5 font-bold text-accent-500">
            ✨ Tailored Suggestions for {cityName}
          </h4>
          <p>{conciergeAdvice(cityName, experienceProfile, userProfile)}</p>
        </div>

        {matched.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#B85304]">
              ⭐ Recommended for your vibe
            </p>
            <ul className="space-y-1.5">
              {matched.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-zinc-200"
                >
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {onPlayReel ? (
          <button
            type="button"
            onClick={onPlayReel}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#B85304]/40 bg-[#B85304]/15 py-3 text-sm font-semibold text-[#F3D9C4] transition hover:bg-[#B85304]/25"
          >
            ▶ Play Match Reel
          </button>
        ) : null}

        <div className="relative aspect-video overflow-hidden rounded-xl border border-zinc-800">
          <LazyVideo
            src="/videos/activity-matcher-guide.mp4"
            poster="/images/matcher-poster-card.webp"
            controls
            playsInline
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
