"use client";

import { useEffect, useMemo, useState } from "react";
import type { PbTour } from "@/lib/pocketbase/client";
import {
  pbFileUrl,
  tourMediaFile,
  tourMediaType,
  tourPrice,
} from "@/lib/pocketbase/client";
import { formatUsd } from "@/lib/builder-pricing";
import { tourLanguageChoices } from "@/lib/tourLanguages";
import {
  Compass,
  Globe,
  MapPinned,
  ListChecks,
  Plus,
  Check,
  Ticket,
} from "lucide-react";
import {
  CATALOG_KIND_BADGE,
  CATALOG_KIND_LABELS,
  catalogKind,
  type CatalogKind,
} from "@/lib/experiencesPlaces";
import { CatalogSlotImg } from "@/components/catalog/CatalogSlotPhoto";
import {
  DiscoverReelActionRail,
  DiscoverReelInfo,
} from "@/components/discover/DiscoverReelChrome";

type InfoTab = "description" | "route" | "included";

/** Shared tour detail card (media + copy + CTA) used by Builder drawer & Discover modal. */
export function TourDetailPanel({
  tour,
  guests,
  selected = false,
  scheduledLabel = null,
  bookedLanguage = null,
  /** Prefill language pills from city-level dropdown */
  defaultLanguage = null,
  /** When false, video is paused / not auto-playing (carousel inactive slides). */
  mediaActive = true,
  /** Gold “Recommended Match” badge from Experience Profiler */
  recommended = false,
  /** Discover keeps experience cards focused on value — hide price tags */
  hidePrice = false,
  /** Show full description (no line-clamp) for vertical scroll sheets */
  expandDescription = false,
  /** Edge-to-edge layout for Discover reel slides */
  fullscreen = false,
  /** City label under the tour title on Discover reel overlays */
  cityName = "",
  /** Tour-family master ID — the ONE photo owner for the whole family:
   * the hero resolves to `{familyMasterId}_1`, never a variant slot. */
  familyMasterId = "",
  /** Duration variants of this family (master included) for the 6h/8h pills. */
  durationVariants,
  onSelectVariant,
  onAdd,
  onRemove,
  /** Discover Reels chrome: open options / detail bottom sheet */
  onOpenReelOptions,
  onOpenReelDetail,
  onReelQuickAdd,
}: {
  tour: PbTour;
  guests: { adults: number; children: number };
  selected?: boolean;
  scheduledLabel?: string | null;
  /** Language code already booked for this tour (EN, NL, …) */
  bookedLanguage?: string | null;
  /** Prefill from city preferred language dropdown */
  defaultLanguage?: string | null;
  mediaActive?: boolean;
  recommended?: boolean;
  hidePrice?: boolean;
  expandDescription?: boolean;
  fullscreen?: boolean;
  cityName?: string;
  familyMasterId?: string;
  durationVariants?: PbTour[];
  onSelectVariant?: (tour: PbTour) => void;
  /** Pass selected language code when adding; omit / empty when removing. */
  onAdd: (selectedLanguage?: string) => void;
  /** When set, selected cards show Remove separately and Add books again. */
  onRemove?: () => void;
  onOpenReelOptions?: () => void;
  onOpenReelDetail?: () => void;
  /** Heart/+ rail: toggle add when language already known, else open detail sheet */
  onReelQuickAdd?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<InfoTab>("description");
  const [pickedLanguage, setPickedLanguage] = useState("");
  const [langError, setLangError] = useState(false);
  const mediaType = tourMediaType(tour);
  const filename = tourMediaFile(tour);
  const mediaUrl =
    filename && tour.collectionId
      ? pbFileUrl(tour.collectionId, tour.id, filename)
      : "";
  const hours = Number(tour.duration_hours) || 0;
  const priceMin = tourPrice(tour, guests);
  const priceMax = priceMin > 0 ? Math.round(priceMin * 1.15) : 0;
  const priceLabel =
    hidePrice || priceMin <= 0
      ? null
      : priceMax > priceMin
        ? `From ${formatUsd(priceMin)} – ${formatUsd(priceMax)}`
        : `From ${formatUsd(priceMin)}`;
  const description = (tour.description ?? "").trim();
  const route = (tour.route ?? "").trim();
  const inclusions = (tour.inclusions_exclusions ?? "").trim();
  const languageChoices = useMemo(
    () => tourLanguageChoices(tour.languages),
    [tour.languages]
  );

  useEffect(() => {
    setActiveTab("description");
    const choices = tourLanguageChoices(tour.languages);
    const pref =
      defaultLanguage &&
      choices.some((c) => c.code === defaultLanguage)
        ? defaultLanguage
        : // A single available language is already the choice — show its
          // pill selected instead of forcing a pointless tap.
          choices.length === 1
          ? choices[0].code
          : "";
    setPickedLanguage(pref);
    setLangError(false);
  }, [tour.id, tour.languages, defaultLanguage]);

  const toggleTab = (tab: "route" | "included") => {
    setActiveTab((current) => (current === tab ? "description" : tab));
  };

  const bodyText =
    activeTab === "route"
      ? route || "No route details published yet."
      : activeTab === "included"
        ? inclusions || "No inclusion details published yet."
        : description || "No description yet.";

  const bodyLabel =
    activeTab === "route"
      ? "Route"
      : activeTab === "included"
        ? "Includes"
        : null;

  const handleAddClick = () => {
    if (selected) {
      if (onRemove) {
        // Book again on another day
        onAdd(
          pickedLanguage || bookedLanguage || defaultLanguage || "EN"
        );
        return;
      }
      onAdd();
      return;
    }
    if (!pickedLanguage) {
      setLangError(true);
      return;
    }
    setLangError(false);
    onAdd(pickedLanguage);
  };

  const kind: CatalogKind = catalogKind(tour);
  const categoryLabel = CATALOG_KIND_LABELS[kind].short;
  const badgeLight = CATALOG_KIND_BADGE[kind].light;
  const CategoryIcon =
    kind === "cluster" ? MapPinned : kind === "activity" ? Ticket : Compass;

  const mediaEl = (
    <>
      {mediaUrl && mediaType === "Video" ? (
        <video
          key={mediaUrl || `tour-media-${tour.id}`}
          src={mediaUrl}
          autoPlay={mediaActive}
          muted
          loop
          playsInline
          disablePictureInPicture
          preload={mediaActive ? "metadata" : "none"}
          ref={(el) => {
            if (!el) return;
            if (mediaActive) {
              void el.play().catch(() => {});
            } else {
              el.pause();
            }
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <CatalogSlotImg
          recordId={familyMasterId || String(tour.family_id || "") || tour.id}
          fallbackSrc={mediaUrl}
          className="h-full w-full object-cover"
          emptyClassName="h-full w-full bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]"
        />
      )}
    </>
  );

  if (fullscreen) {
    // Instagram Reels-style: full-bleed media + overlays. Detail / add
    // live in DiscoverReelBottomSheet (opened from Options or caption).
    return (
      <article className="relative h-full min-h-[100dvh] w-full overflow-hidden bg-[#05080C] text-white">
        <div className="absolute inset-0 bg-zinc-900">{mediaEl}</div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/85 via-black/15 to-black/40"
        />
        {recommended ? (
          <span className="absolute left-4 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-40 rounded-full border border-[#F6A724]/40 bg-[#F6A724]/15 px-2 py-0.5 text-[10px] font-medium text-[#F6A724] shadow-md backdrop-blur-sm">
            ⭐ Recommended Match
          </span>
        ) : null}

        <DiscoverReelInfo
          tour={tour}
          cityName={cityName}
          onOpenDetail={() => onOpenReelDetail?.()}
        />
        <DiscoverReelActionRail
          saved={selected}
          onAdd={() => {
            if (onReelQuickAdd) {
              onReelQuickAdd();
              return;
            }
            if (selected) {
              onAdd();
              return;
            }
            if (pickedLanguage) {
              onAdd(pickedLanguage);
              return;
            }
            onOpenReelDetail?.();
          }}
          onReviews={() => onOpenReelDetail?.()}
          onSend={() => onOpenReelOptions?.()}
          onOptions={() => onOpenReelOptions?.()}
        />
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[#EEE8DF] bg-white shadow-[0_4px_20px_rgba(11,31,58,0.06)]">
      <div
        className={`relative w-full bg-[#0B1F3A] ${
          expandDescription
            ? "aspect-[16/10] max-h-[40dvh]"
            : "aspect-[4/5] max-h-[50dvh]"
        }`}
      >
        {mediaEl}
        {hours > 0 ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <ClockIcon />
            {hours}h
          </span>
        ) : null}
        {recommended ? (
          <span className="absolute left-3 top-3 z-10 rounded-full border border-[#075473]/40 bg-[#075473]/15 px-2 py-0.5 text-[10px] font-medium text-accent-500 shadow-md backdrop-blur-sm">
            ⭐ Recommended Match
          </span>
        ) : null}
      </div>

      <div className="touch-pan-y px-4 pt-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {recommended ? (
            <span className="inline-flex items-center rounded-full border border-[#075473]/40 bg-[#075473]/15 px-2 py-0.5 text-[10px] font-medium text-accent-700">
              ⭐ Recommended Match
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badgeLight}`}
          >
            <CategoryIcon className="h-3 w-3 shrink-0" aria-hidden />
            {categoryLabel}
          </span>
          {tour.is_niche ? (
            <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-700">
              ✨ Exclusive / Special Interest
            </span>
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display text-xl leading-snug text-[#0B1F3A]">
            {tour.title}
          </h4>
          {priceLabel ? (
            <span className="shrink-0 text-sm font-semibold text-[#0B1F3A]">
              {priceLabel}
            </span>
          ) : null}
        </div>
        {hours > 0 ? (
          <p className="mt-1.5 text-xs text-[#5C6570]">{hours}h</p>
        ) : null}

        {!selected ? (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#075473]">
              <Globe className="h-3 w-3 shrink-0" aria-hidden />
              Preferred language
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {languageChoices.map(({ name, code }, i) => {
                const active = pickedLanguage === code;
                return (
                  <button
                    key={code || `lang-${i}`}
                    type="button"
                    title={name}
                    aria-pressed={active}
                    onClick={() => {
                      setPickedLanguage(code);
                      setLangError(false);
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? "bg-[#0B1F3A] text-white ring-1 ring-[#075473]"
                        : "bg-[#F7F3EB] text-[#5C6570] ring-1 ring-[#EEE8DF] hover:ring-[#075473]/60"
                    }`}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
            {langError ? (
              <p className="mt-1.5 text-xs font-medium text-[#8A3B2A]">
                Select a language before adding this experience.
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-[#8A8278]">
                Required to add this experience to your itinerary.
              </p>
            )}
          </div>
        ) : bookedLanguage ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#0B1F3A]">
            <Globe className="h-3 w-3 shrink-0 text-[#075473]" aria-hidden />
            Guided in {bookedLanguage}
          </p>
        ) : null}

        <div className="mt-3 min-h-[4.5rem] pb-4">
          {bodyLabel ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#075473]">
              {bodyLabel}
            </p>
          ) : null}
          <p
            className={`whitespace-pre-wrap text-sm leading-relaxed text-[#5C6570] ${
              activeTab === "description" && !expandDescription
                ? "line-clamp-3"
                : ""
            }`}
          >
            {bodyText}
          </p>
        </div>

        {selected && scheduledLabel ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-[#075473]">
            <span>Scheduled · {scheduledLabel}</span>
            {onRemove ? (
              <button
                type="button"
                onClick={onRemove}
                className="rounded-md border border-[#075473]/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5C6570] hover:bg-[#F7F3EB] hover:text-[#0B1F3A]"
              >
                Remove
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      <div
        className={`grid shrink-0 grid-cols-3 border-t border-[#EEE8DF] ${
          expandDescription
            ? "sticky bottom-0 z-10 mt-3 bg-white/95 backdrop-blur-md"
            : "mt-3"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleTab("route")}
          aria-pressed={activeTab === "route"}
          className={`flex flex-col items-center gap-1 px-2 py-3 text-xs font-semibold transition ${
            activeTab === "route"
              ? "bg-[#0B1F3A] text-white"
              : "bg-white text-[#0B1F3A] hover:bg-[#F7F3EB]"
          }`}
        >
          <MapPinned className="h-4 w-4" aria-hidden />
          Route
        </button>
        <button
          type="button"
          onClick={() => toggleTab("included")}
          aria-pressed={activeTab === "included"}
          className={`flex flex-col items-center gap-1 border-x border-[#EEE8DF] px-2 py-3 text-xs font-semibold transition ${
            activeTab === "included"
              ? "bg-[#0B1F3A] text-white"
              : "bg-white text-[#0B1F3A] hover:bg-[#F7F3EB]"
          }`}
        >
          <ListChecks className="h-4 w-4" aria-hidden />
          Included
        </button>
        <button
          type="button"
          onClick={handleAddClick}
          aria-pressed={selected}
          disabled={!selected && !pickedLanguage}
          title={
            !selected && !pickedLanguage
              ? "Select a preferred language first"
              : undefined
          }
          className={`flex flex-col items-center gap-1 px-2 py-3 text-xs font-semibold transition ${
            selected
              ? "bg-[#075473]/20 text-[#0B1F3A]"
              : pickedLanguage
                ? "bg-[#0B1F3A] text-white hover:bg-[#143052]"
                : "cursor-not-allowed bg-[#0B1F3A]/40 text-white/70"
          }`}
        >
          {selected ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          {selected ? (onRemove ? "Add again" : "Added") : "+ Add"}
        </button>
      </div>
    </article>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M6 3.2V6l1.8 1.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
