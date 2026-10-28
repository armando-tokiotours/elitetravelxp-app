"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  Check,
  ChevronDown,
  Heart,
  Info,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { PbTour } from "@/lib/pocketbase/client";
import { tourLanguageChoices } from "@/lib/tourLanguages";
import {
  CATALOG_KIND_LABELS,
  catalogKind,
  EXPERIENCES_PLACES_TABS,
  type ExperiencesPlacesTab,
} from "@/lib/experiencesPlaces";

export type ReelSheetMode = "options" | "detail" | "filter" | null;
/** Content-type tabs — Tours | Experiences | Areas (top nav only) */
export type ReelTopTab = "tours" | "experiences" | "areas";
/** Category / vibe modifiers applied via the filter sheet */
export type ReelCategoryFilter = ExperiencesPlacesTab | "nature";

/** Sector pills — same look as former in-sheet Tours/Experiences/Areas control */
const SECTOR_PILL =
  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition";
const SECTOR_PILL_ACTIVE = "bg-white text-[#111A24]";
const SECTOR_PILL_IDLE = "bg-white/10 text-white/70";

const TOP_TABS: { id: ReelTopTab; label: string }[] = [
  { id: "tours", label: "Tours" },
  { id: "experiences", label: "Experiences" },
  { id: "areas", label: "Areas" },
];

const CATEGORY_FILTERS: { id: ReelCategoryFilter; label: string }[] = [
  ...EXPERIENCES_PLACES_TABS,
  { id: "nature", label: "Nature" },
];

/** Fixed top tabs + filter for the Discover vertical reel. */
export function DiscoverReelTopNav({
  activeTab,
  onTabChange,
  onOpenFilter,
}: {
  activeTab: ReelTopTab;
  onTabChange: (tab: ReelTopTab) => void;
  onOpenFilter: () => void;
}) {
  return (
    <div className="absolute top-12 left-0 z-40 flex w-full items-center justify-between px-4">
      <div className="flex items-center gap-4">
        {TOP_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`text-sm font-semibold transition ${
                active ? "text-white" : "text-white/45"
              }`}
            >
              {tab.label}
              {active ? (
                <span className="mt-0.5 block h-0.5 w-full rounded-full bg-white" />
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onOpenFilter}
        aria-label="Filters"
        className="rounded-full border border-white/20 bg-black/40 p-2 text-white backdrop-blur-md transition active:scale-95"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/** IG-style right action rail over the active reel slide. */
export function DiscoverReelActionRail({
  likes = 540,
  comments = 21,
  shares = 15,
  saved = false,
  onAdd,
  onReviews,
  onSend,
  onOptions,
}: {
  likes?: number;
  comments?: number;
  shares?: number;
  saved?: boolean;
  onAdd: () => void;
  onReviews: () => void;
  onSend: () => void;
  onOptions: () => void;
}) {
  return (
    <div className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-center gap-6 lg:bottom-20">
      <RailButton
        label={formatCount(likes)}
        onClick={onAdd}
        ariaLabel={saved ? "Added" : "Add"}
      >
        {saved ? (
          <Heart className="h-7 w-7 fill-[#E60F43] text-[#E60F43]" aria-hidden />
        ) : (
          <Plus className="h-7 w-7" aria-hidden />
        )}
      </RailButton>
      <RailButton
        label={formatCount(comments)}
        onClick={onReviews}
        ariaLabel="Reviews"
      >
        <MessageCircle className="h-7 w-7" aria-hidden />
      </RailButton>
      <RailButton
        label={formatCount(shares)}
        onClick={onSend}
        ariaLabel="Send"
      >
        <Send className="h-7 w-7" aria-hidden />
      </RailButton>
      <RailButton label="" onClick={onOptions} ariaLabel="Options">
        <MoreHorizontal className="h-7 w-7" aria-hidden />
      </RailButton>
    </div>
  );
}

function RailButton({
  children,
  label,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={ariaLabel}
      className="flex flex-col items-center gap-1 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] transition active:scale-95"
    >
      {children}
      {label ? (
        <span className="text-[11px] font-semibold tabular-nums">{label}</span>
      ) : null}
    </button>
  );
}

/** Bottom-left badge + title + caption on the reel slide. */
export function DiscoverReelInfo({
  tour,
  cityName,
  onOpenDetail,
}: {
  tour: PbTour;
  cityName: string;
  onOpenDetail: () => void;
}) {
  const kind = catalogKind(tour);
  const badge =
    kind === "activity"
      ? CATALOG_KIND_LABELS.activity.short
      : kind === "cluster"
        ? CATALOG_KIND_LABELS.cluster.short
        : CATALOG_KIND_LABELS.tour.short;
  const description = (tour.description ?? "").trim();

  return (
    <div className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 z-40 flex max-w-[70%] flex-col gap-2 lg:bottom-20">
      <span className="w-fit rounded-full border border-white/25 bg-black/45 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
        {badge}
      </span>
      <div>
        <h2 className="text-xl font-bold leading-tight text-white drop-shadow-md">
          {tour.title}
        </h2>
        {cityName ? (
          <p className="mt-0.5 text-sm font-medium text-white/65">{cityName}</p>
        ) : null}
      </div>
      {description ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          className="text-left text-sm text-white line-clamp-2 drop-shadow-md"
        >
          {description}
        </button>
      ) : null}
    </div>
  );
}

/** Options / detail / filter bottom sheet over the reel video. */
export function DiscoverReelBottomSheet({
  mode,
  tour,
  cityName,
  durationVariants,
  selected = false,
  bookedLanguage = null,
  defaultLanguage = "",
  categoryFilter = "all",
  onCategoryFilterChange,
  onClose,
  onSelectVariant,
  onAdd,
  onOpenDetail,
}: {
  mode: ReelSheetMode;
  tour: PbTour | null;
  cityName: string;
  durationVariants?: PbTour[];
  selected?: boolean;
  bookedLanguage?: string | null;
  /** Builder preferred language code — seeds the pick when opening detail */
  defaultLanguage?: string;
  categoryFilter?: ReelCategoryFilter;
  onCategoryFilterChange?: (next: ReelCategoryFilter) => void;
  onClose: () => void;
  onSelectVariant?: (tour: PbTour) => void;
  onAdd: (selectedLanguage: string) => void;
  onOpenDetail: () => void;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [pickedLanguage, setPickedLanguage] = useState("");
  const [langError, setLangError] = useState(false);

  const languageChoices = useMemo(
    () => tourLanguageChoices(tour?.languages),
    [tour?.languages]
  );

  // Reset sheet-local picks whenever the sheet opens or the active tour changes.
  useEffect(() => {
    if (!mode || !tour) {
      setDescriptionOpen(true);
      setPickedLanguage("");
      setLangError(false);
      return;
    }
    setDescriptionOpen(true);
    setLangError(false);
    const preferred = (defaultLanguage || "").trim().toUpperCase();
    const pref =
      bookedLanguage &&
      languageChoices.some((c) => c.code === bookedLanguage)
        ? bookedLanguage
        : preferred && languageChoices.some((c) => c.code === preferred)
          ? preferred
          : languageChoices.length === 1
            ? languageChoices[0].code
            : languageChoices.find((c) => c.code === "EN")?.code ||
              languageChoices[0]?.code ||
              "";
    setPickedLanguage(pref);
  }, [mode, tour?.id, bookedLanguage, defaultLanguage, languageChoices]);

  const hours = Number(tour?.duration_hours) || 0;
  const description = (tour?.description ?? "").trim();
  const durationOptions =
    durationVariants && durationVariants.length > 0
      ? durationVariants
      : tour
        ? [tour]
        : [];

  const handleAdd = () => {
    if (selected) {
      onAdd("");
      return;
    }
    if (!pickedLanguage) {
      setLangError(true);
      return;
    }
    setLangError(false);
    onAdd(pickedLanguage);
  };

  return (
    <AnimatePresence>
      {mode && (tour || mode === "filter") ? (
        <motion.div
          key="discover-reel-sheet"
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Dismiss"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={
              mode === "options"
                ? "Options"
                : mode === "filter"
                  ? "Filters"
                  : tour?.title || "Details"
            }
            className="relative z-[1] flex h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-[#111A24] p-6"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <button
              type="button"
              aria-label="Close sheet"
              onClick={onClose}
              className="mx-auto mb-4 flex h-5 w-full shrink-0 items-start justify-center"
            >
              <span className="h-1 w-10 rounded-full bg-white/25" />
            </button>

            {mode === "options" ? (
              <OptionsSheetBody
                onClose={onClose}
                onOpenDetail={onOpenDetail}
              />
            ) : mode === "filter" ? (
              <FilterSheetBody
                active={categoryFilter}
                onSelect={(next) => {
                  onCategoryFilterChange?.(next);
                  onClose();
                }}
                onClose={onClose}
              />
            ) : !tour ? null : (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-28">
                  <header>
                    <h3 className="text-lg font-bold text-white">{tour.title}</h3>
                    <p className="mt-0.5 text-sm text-white/55">{cityName}</p>
                  </header>

                  <AccordionRow
                    title="Description"
                    open={descriptionOpen}
                    onToggle={() => setDescriptionOpen((o) => !o)}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                      {description || "No description yet."}
                    </p>
                  </AccordionRow>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white">Language</p>
                    {!selected ? (
                      <div className="flex flex-wrap gap-2">
                        {languageChoices.map(({ name, code }) => {
                          const active = pickedLanguage === code;
                          return (
                            <button
                              key={code}
                              type="button"
                              title={name}
                              aria-pressed={active}
                              onClick={() => {
                                setPickedLanguage(code);
                                setLangError(false);
                              }}
                              className={`${SECTOR_PILL} ${
                                active ? SECTOR_PILL_ACTIVE : SECTOR_PILL_IDLE
                              }`}
                            >
                              {code}
                            </button>
                          );
                        })}
                      </div>
                    ) : bookedLanguage ? (
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`${SECTOR_PILL} ${SECTOR_PILL_ACTIVE}`}
                        >
                          {bookedLanguage}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-white/55">
                        Language set on your booking.
                      </p>
                    )}
                    {langError && !selected ? (
                      <p className="text-xs font-medium text-[#DC6E8A]">
                        Select a language before adding.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white">Duration</p>
                    <div className="flex flex-wrap gap-2">
                      {durationOptions.map((variant) => {
                        const vh = Number(variant.duration_hours) || 0;
                        const isActive = variant.id === tour.id;
                        const label =
                          vh > 0
                            ? `${vh}h`
                            : hours > 0
                              ? `${hours}h`
                              : "Set later";
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            aria-pressed={isActive}
                            disabled={durationOptions.length < 2}
                            onClick={() => onSelectVariant?.(variant)}
                            className={`${SECTOR_PILL} ${
                              isActive ? SECTOR_PILL_ACTIVE : SECTOR_PILL_IDLE
                            } ${
                              durationOptions.length < 2
                                ? "cursor-default"
                                : ""
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#111A24] px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                  <button
                    type="button"
                    onClick={handleAdd}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition active:scale-[0.99] ${
                      selected
                        ? "bg-[#075473]/35 text-white"
                        : "bg-[#075473] text-white hover:bg-[#0A6C93]"
                    }`}
                  >
                    {selected ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden />
                    )}
                    {selected
                      ? "Added to Booking"
                      : "Select & Add to Booking"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function OptionsSheetBody({
  onClose,
  onOpenDetail,
}: {
  onClose: () => void;
  onOpenDetail: () => void;
}) {
  const rows: {
    icon: ReactNode;
    label: string;
    danger?: boolean;
    onClick: () => void;
  }[] = [
    {
      icon: <Bookmark className="h-5 w-5" aria-hidden />,
      label: "Save",
      onClick: onClose,
    },
    {
      icon: <Info className="h-5 w-5" aria-hidden />,
      label: "Why you're seeing this",
      onClick: onOpenDetail,
    },
    {
      icon: <Heart className="h-5 w-5" aria-hidden />,
      label: "Interested",
      onClick: onClose,
    },
    {
      icon: <X className="h-5 w-5" aria-hidden />,
      label: "Not interested",
      onClick: onClose,
    },
    {
      icon: <MessageCircle className="h-5 w-5 text-[#DC6E8A]" aria-hidden />,
      label: "Report",
      danger: true,
      onClick: onClose,
    },
  ];

  return (
    <div className="space-y-2 overflow-y-auto">
      <h3 className="mb-3 text-base font-bold text-white">Options</h3>
      <div className="overflow-hidden rounded-2xl bg-white/5">
        {rows.slice(0, 2).map((row) => (
          <OptionRow key={row.label} {...row} />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl bg-white/5">
        {rows.slice(2).map((row) => (
          <OptionRow key={row.label} {...row} />
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenDetail}
        className="mt-3 w-full rounded-2xl bg-[#075473] py-3 text-sm font-bold text-white"
      >
        View full details
      </button>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
    >
      <span className={danger ? "text-[#DC6E8A]" : "text-white"}>{icon}</span>
      <span
        className={`text-sm font-medium ${
          danger ? "text-[#DC6E8A]" : "text-white"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function FilterSheetBody({
  active,
  onSelect,
  onClose,
}: {
  active: ReelCategoryFilter;
  onSelect: (next: ReelCategoryFilter) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto">
      <h3 className="text-base font-bold text-white">Category filters</h3>
      <p className="text-sm text-white/60">
        Narrow the active Tours / Experiences / Areas feed by vibe.
      </p>
      <div className="flex flex-col gap-2">
        {CATEGORY_FILTERS.map((row) => {
          const selected = active === row.id;
          return (
            <button
              key={row.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(row.id)}
              className={`rounded-2xl px-4 py-3.5 text-left text-sm font-semibold transition ${
                selected
                  ? "bg-[#075473] text-white"
                  : "bg-white/5 text-white/80 hover:bg-white/10"
              }`}
            >
              {row.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white"
      >
        Close
      </button>
    </div>
  );
}

function AccordionRow({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-white">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-white/60 transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open ? <div className="px-4 pb-3">{children}</div> : null}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/** Match top-tab content type (Tours | Experiences | Areas). */
export function tourMatchesReelTab(tour: PbTour, tab: ReelTopTab): boolean {
  const kind = catalogKind(tour);
  if (tab === "tours") return kind === "tour";
  if (tab === "experiences") return kind === "activity";
  if (tab === "areas") return kind === "cluster";
  return true;
}

/** Match filter-sheet category / vibe modifiers. */
export function tourMatchesReelCategory(
  tour: PbTour,
  filter: ReelCategoryFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "matches") return true; // caller ranks / marks matches
  if (filter === "places") return catalogKind(tour) === "cluster";
  const tags = (tour.vibe_tags ?? []).map((t) => String(t).toLowerCase());
  if (tags.length === 0) return false;
  if (filter === "food") {
    return tags.some((t) =>
      ["foodie", "nightlife", "food"].includes(t) || t.includes("food")
    );
  }
  if (filter === "modern") {
    return tags.some(
      (t) => t === "modern" || t === "art" || t.includes("modern")
    );
  }
  if (filter === "nature") {
    return tags.some((t) => t === "nature" || t.includes("nature"));
  }
  if (filter === "culture") {
    return tags.some((t) => t === "culture" || t.includes("culture"));
  }
  return tags.some((t) => t === filter || t.includes(filter));
}
