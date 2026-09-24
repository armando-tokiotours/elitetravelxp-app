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
import { Globe, MapPinned, ListChecks, Plus, Check } from "lucide-react";

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
  onAdd,
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
  /** Pass selected language code when adding; omit / empty when removing. */
  onAdd: (selectedLanguage?: string) => void;
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

  const isActivity =
    String(tour.category || "tour").toLowerCase() === "activity";
  const categoryLabel = isActivity
    ? "Specific Experience / Access"
    : "Multi-District Tour";

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
      ) : mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-end bg-gradient-to-br from-[#1a3355] to-[#0B1F3A] p-5">
          <span className="font-display text-2xl text-white/90">
            {tour.title}
          </span>
        </div>
      )}
    </>
  );

  if (fullscreen) {
    return (
      <article className="flex h-full min-h-[100dvh] w-full flex-col overflow-hidden bg-[#05080C] text-white">
        {/* Hero media ~68% */}
        <div className="relative h-[68dvh] w-full shrink-0 overflow-hidden bg-zinc-900">
          {mediaEl}
          {recommended ? (
            <span className="absolute left-3 top-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))] z-10 rounded-full border border-[#F6A724]/40 bg-[#F6A724]/15 px-2 py-0.5 text-[10px] font-medium text-[#F6A724] shadow-md backdrop-blur-sm">
              ⭐ Recommended Match
            </span>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-4 pt-16">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                isActivity
                  ? "border-violet-400/40 bg-violet-500/30 text-violet-200"
                  : "border-cyan-400/40 bg-cyan-500/30 text-cyan-300"
              }`}
            >
              {categoryLabel}
            </span>
            <h1 className="mt-1 font-godiva text-2xl uppercase tracking-wider text-white drop-shadow-md">
              {tour.title}
            </h1>
            {hours > 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <ClockIcon />
                {hours}h
              </p>
            ) : null}
          </div>
        </div>

        {/* Details sheet ~32% */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-white/10 bg-[#05080C]">
          <div
            className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-y-contain px-4 py-3"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex items-start justify-between gap-3">
              {!selected ? (
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#075473]">
                    <Globe className="h-3 w-3 shrink-0" aria-hidden />
                    Preferred language
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                            active
                              ? "bg-[#075473] text-white"
                              : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                          }`}
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>
                  {langError ? (
                    <p className="mt-1.5 text-xs font-medium text-[#DC6E8A]">
                      Select a language before adding.
                    </p>
                  ) : null}
                </div>
              ) : bookedLanguage ? (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                  <Globe className="h-3 w-3 shrink-0 text-[#075473]" aria-hidden />
                  Guided in {bookedLanguage}
                </p>
              ) : (
                <span />
              )}
              {priceLabel ? (
                <p className="shrink-0 text-xs font-semibold text-zinc-300">
                  {priceLabel}
                </p>
              ) : null}
            </div>

            {bodyLabel ? (
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#075473]">
                {bodyLabel}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
              {bodyText}
            </p>
            {selected && scheduledLabel ? (
              <p className="text-xs font-medium text-[#F6A724]">
                Scheduled · {scheduledLabel}
              </p>
            ) : null}
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-zinc-800/80 bg-[#05080C] px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => toggleTab("route")}
              aria-pressed={activeTab === "route"}
              className={`flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold transition ${
                activeTab === "route"
                  ? "bg-[#075473] text-white"
                  : "bg-zinc-800/80 text-white hover:bg-zinc-700"
              }`}
            >
              <MapPinned className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
              Route
            </button>
            <button
              type="button"
              onClick={() => toggleTab("included")}
              aria-pressed={activeTab === "included"}
              className={`flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold transition ${
                activeTab === "included"
                  ? "bg-[#075473] text-white"
                  : "bg-zinc-800/80 text-white hover:bg-zinc-700"
              }`}
            >
              <ListChecks className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
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
              className={`flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold shadow-lg transition ${
                selected
                  ? "bg-[#075473]/30 text-white"
                  : pickedLanguage
                    ? "bg-[#075473] text-white hover:bg-[#0A6C93]"
                    : "cursor-not-allowed bg-zinc-800 text-zinc-500"
              }`}
            >
              {selected ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden />
              )}
              {selected ? "Added" : "+ Add"}
            </button>
          </div>
        </div>
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
          {isActivity ? (
            <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              🎟️ Specific Experience / Access
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-[#075473]/40 bg-[#075473]/10 px-2 py-0.5 text-[10px] font-medium text-[#7E3202]">
              🗺️ Multi-District Tour
            </span>
          )}
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
          <p className="mt-2 text-xs font-medium text-[#075473]">
            Scheduled · {scheduledLabel}
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
          {selected ? "Added" : "+ Add"}
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
