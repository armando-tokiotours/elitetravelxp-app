"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
  type TravelStyleId,
} from "@/lib/preEliteBuilder";
import { TRAVEL_PACES, type PaceId } from "@/lib/travelPace";
import {
  TOUR_LANGUAGE_OPTIONS,
  languageDisplayLabel,
  languageToCode,
} from "@/lib/tourLanguages";
import {
  guestSpecialRequirementsValidationError,
  normalizeGuestSpecialRequirements,
  type GuestSpecialRequirements,
} from "@/lib/guestSpecialRequirements";
import { GuestRequirementsSelector } from "@/components/builder/GuestRequirementsSelector";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import {
  BRIEF_TILE_MAX_SPLITS,
  preEliteIconKey,
  resolveBriefTileImages,
  travelStyleIconKey,
} from "@/lib/brandingIcons";
import {
  brandingSlotVersionedUrl,
  preEliteCardSlot,
} from "@/lib/brandingImageSlots";
import {
  preEliteBrandingKey,
  preEliteMediaVersion,
} from "@/lib/preEliteBranding";

/** Real TokioTours mascot (same asset as Pre-Elite hero poses). */
const MASCOT_SRC = "/brand/mascot-bow.webp";

/**
 * Editable “YOUR TRAVEL BRIEF” answers.
 *
 * Field → real storage:
 * - `travelStyle`  → builder store `preEliteTravelStyle` → BAL `preEliteTravelStyle`
 * - `interests`    → builder store `preEliteInterests`   → BAL `preEliteInterests`
 * - `motivation`   → builder store `preEliteMotivation`  → BAL `preEliteMotivation`
 * - `painPoints`   → builder store `preElitePainPoints`  → BAL `preElitePainPoints`
 *   (Concerns / Preferences)
 * - `travelPace` / `tourLanguage` / `guestSpecialRequirements` — same
 *   store + BAL selections fields as before.
 */
export type TravelBriefAnswers = {
  travelStyle: TravelStyleId | null;
  travelPace: PaceId | null;
  /** Guided language code (EN, JA, …) — same values as `preferredTourLanguage`. */
  tourLanguage: string;
  guestSpecialRequirements: GuestSpecialRequirements;
  interests: string[];
  motivation: string | null;
  painPoints: string[];
};

/** Backward-compatible alias (older dossier imports). */
export type PreBuilderQuizAnswers = TravelBriefAnswers;

function normalizeBrief(a: TravelBriefAnswers): TravelBriefAnswers {
  return {
    travelStyle: a.travelStyle ?? null,
    travelPace: a.travelPace ?? null,
    tourLanguage: a.tourLanguage || "EN",
    guestSpecialRequirements: normalizeGuestSpecialRequirements(
      a.guestSpecialRequirements
    ),
    interests: Array.isArray(a.interests) ? [...a.interests] : [],
    motivation: a.motivation ?? null,
    painPoints: Array.isArray(a.painPoints) ? [...a.painPoints] : [],
  };
}

/**
 * Dietary & Mobility display line.
 * Explicit No/No → “No restrictions / Standard”; never answered → “None specified”.
 */
export function dietaryMobilityDisplayLabel(
  reqs: GuestSpecialRequirements | null | undefined
): string {
  const n = normalizeGuestSpecialRequirements(reqs);
  const unanswered =
    n.hasDietary == null &&
    n.hasMobility == null &&
    n.mobilityTags.length === 0 &&
    !n.customNotes.trim();
  if (unanswered) return "None specified";
  if (n.hasDietary === false && n.hasMobility === false) {
    return "No restrictions / Standard";
  }
  const parts: string[] = [];
  if (n.hasDietary === true) {
    parts.push(
      n.customNotes.trim()
        ? `Dietary: Yes — ${n.customNotes.trim()}`
        : "Dietary: Yes"
    );
  } else if (n.hasDietary === false) {
    parts.push("Dietary: No");
  } else {
    parts.push("Dietary: Pending");
  }
  if (n.mobilityTags.length > 0) {
    parts.push(`Mobility: ${n.mobilityTags.join(", ")}`);
  } else if (n.hasMobility === true) {
    parts.push("Mobility: Yes");
  } else if (n.hasMobility === false) {
    parts.push("Mobility: No");
  } else {
    parts.push("Mobility: Pending");
  }
  return parts.join(" · ");
}

/** Emoji for a motivation / interest, keyed off the real pre-Elite option ids + titles. */
function briefIconFor(id: string, title: string): string {
  const key = `${id} ${title}`.toLowerCase();
  if (/family/.test(key)) return "👨‍👩‍👧‍👦";
  if (/romantic|couple|honeymoon/.test(key)) return "💑";
  if (/solo/.test(key)) return "🚶";
  if (/food|culinary|dining|sushi|eat/.test(key)) return "🍣";
  if (/nature|mountain|outdoor|day.?trip|fuji|garden/.test(key)) return "🌲";
  if (/pop|anime|modern|tech|shopping|nightlife/.test(key)) return "👾";
  if (/culture|heritage|history|historic|shrine|temple|tradition/.test(key))
    return "🏯";
  if (/photo|camera|first/.test(key)) return "📸";
  return "✈️";
}

/** Icon for a travel style, keyed off the real `TRAVEL_STYLES` ids. */
function travelStyleIconFor(id: string, title: string): string {
  if (id === "vip_bespoke") return "💎";
  if (id === "premium_comfort") return "🛎️";
  if (id === "classic_explorer") return "🗺️";
  const key = `${id} ${title}`.toLowerCase();
  if (/vip|bespoke|exclusive|luxury/.test(key)) return "💎";
  if (/premium|comfort/.test(key)) return "🛎️";
  if (/classic|explorer/.test(key)) return "🗺️";
  return "✈️";
}

/** Icon(s) for a pain point / concern, keyed off the real `PAIN_POINTS` ids. */
function painPointIconFor(id: string, title: string): string {
  if (id === "language_transit") return "🗣️🚇";
  if (id === "tourist_traps") return "🚫";
  if (id === "authentic_dining") return "🍜";
  if (id === "packed_itinerary") return "⏳";
  const key = `${id} ${title}`.toLowerCase();
  if (/language|transit/.test(key)) return "🗣️🚇";
  if (/tourist|trap|crowd/.test(key)) return "🚫";
  if (/dining|food|authentic/.test(key)) return "🍜";
  if (/packed|breathe|time|pace/.test(key)) return "⏳";
  return "⚠️";
}

/** Compact strip label: explicit No/No → “None”, any Yes/notes/tags → “Noted”. */
function snapshotDietaryLabel(
  reqs: GuestSpecialRequirements | null | undefined
): string {
  const n = normalizeGuestSpecialRequirements(reqs);
  const unanswered =
    n.hasDietary == null &&
    n.hasMobility == null &&
    n.mobilityTags.length === 0 &&
    !n.customNotes.trim();
  if (unanswered) return "None specified";
  if (
    n.hasDietary === true ||
    n.hasMobility === true ||
    n.mobilityTags.length > 0 ||
    n.customNotes.trim()
  ) {
    return "Noted";
  }
  if (n.hasDietary === false && n.hasMobility === false) return "None";
  return "None";
}

function languageName(code: string): string {
  const c = languageToCode(code || "");
  if (!c) return "";
  const name = TOUR_LANGUAGE_OPTIONS.find((n) => languageToCode(n) === c);
  return name || code;
}

function titlesArrayFor(
  options: readonly { id: string; title: string }[],
  ids: string[]
): string[] {
  if (!ids.length) return ["None specified"];
  return ids.map((id) => options.find((o) => o.id === id)?.title ?? id);
}

function titlesFor(
  options: readonly { id: string; title: string }[],
  ids: string[]
): string {
  return titlesArrayFor(options, ids).join(", ");
}

function titleFor(
  options: readonly { id: string; title: string }[],
  id: string | null
): string {
  if (!id) return "None specified";
  return options.find((o) => o.id === id)?.title ?? id;
}

const chipClass = (selected: boolean) =>
  `rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
    selected
      ? "border-[#F6A724] bg-[#F6A724]/15 text-[#F6A724] shadow-md"
      : "border-white/10 bg-white/5 text-gray-300 hover:border-white/30 hover:text-white"
  }`;

type BriefTileItem = {
  icon: string;
  title: string;
  /** Legacy PB ICONS-tab upload — only a fallback if the slot photo fails. */
  iconUrl?: string;
  /** Pre-Builder option photo: `/uploads/branding/preelite-{id}-card.webp`. */
  photoUrl?: string;
};

/**
 * The photo defined for a Pre-Builder option in the quiz — the stable
 * slot the quiz card itself renders (`preEliteCardSlot`), versioned by
 * the branding row's media stamp like `AccordionArtwork` in the quiz.
 * Returns the URL even when the file is absent; `BriefTileBackground`
 * falls back cleanly on error, so there is never a broken-image glyph.
 */
function briefOptionPhotoUrl(
  optionId: string,
  row?: { description?: string; media_version?: string } | null
): string {
  if (!optionId) return "";
  return brandingSlotVersionedUrl(
    preEliteCardSlot(optionId),
    preEliteMediaVersion(row)
  );
}

/**
 * One collage cell (CatalogSlotImg pattern): stage 0 = option slot
 * photo → stage 1 = PB ICONS upload (if any) → stage 2 = that option's
 * emoji centred on the dark tile bg in JUST this cell (never a
 * broken-image glyph, never collapsing the grid).
 * Plain <img> (never next/image — the optimizer 400s on /uploads URLs).
 */
function BriefTileCell({ item }: { item: BriefTileItem }) {
  // stage 0 photoUrl (quiz slot) → 1 iconUrl (PB icon) → 2 emoji
  const maxStage = item.iconUrl ? 2 : 1;
  const [stage, setStage] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setStage(0);
  }, [item.photoUrl, item.iconUrl, item.title]);
  // SSR/hydration race: an <img> that 404s before React attaches onError
  // never replays the event — re-check once mounted (CatalogSlotImg).
  useEffect(() => {
    const t = setTimeout(() => {
      const el = imgRef.current;
      if (el && el.complete && el.naturalWidth === 0) {
        setStage((s) => Math.min(s + 1, maxStage));
      }
    }, 60);
    return () => clearTimeout(t);
  }, [stage, maxStage, item.photoUrl, item.iconUrl]);

  const src =
    stage === 0 ? item.photoUrl || "" : stage === 1 ? item.iconUrl || "" : "";
  if (!src) {
    return (
      <div className="relative min-w-0 overflow-hidden bg-[#141922]">
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center text-3xl leading-none"
        >
          {item.icon}
        </span>
      </div>
    );
  }
  return (
    <div className="relative min-w-0 overflow-hidden bg-[#141922]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        title={item.title}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setStage((s) => Math.min(s + 1, maxStage))}
      />
    </div>
  );
}

/**
 * Full-tile photo distribution for a snapshot tile (capped at
 * `BRIEF_TILE_MAX_SPLITS` = 4, the max selectable):
 *   1 photo → full-bleed
 *   2 photos → 50/50 side-by-side vertical halves
 *   3 photos → three equal vertical columns
 *   4 photos → 2×2 grid (sane aspect in the wide tile)
 * Cells are separated by a hairline (`gap-px`) of the dark tile bg.
 * With nothing selected, a single ✅/✨ fallback cell is shown.
 */
function BriefTileBackground({
  items,
  emptyEmoji = "✨",
}: {
  items: readonly BriefTileItem[];
  emptyEmoji?: string;
}) {
  const cells: BriefTileItem[] = items.length
    ? items.slice(0, BRIEF_TILE_MAX_SPLITS)
    : [{ icon: emptyEmoji, title: "None specified" }];
  const gridClass =
    cells.length >= 4
      ? "grid-cols-2 grid-rows-2"
      : cells.length === 3
        ? "grid-cols-3"
        : cells.length === 2
          ? "grid-cols-2"
          : "grid-cols-1";
  return (
    <div
      aria-hidden
      className={`absolute inset-0 grid gap-px bg-[#141922] ${gridClass}`}
    >
      {cells.map((item, i) => (
        <BriefTileCell
          key={`${item.title}-${item.photoUrl || item.iconUrl || item.icon}-${i}`}
          item={item}
        />
      ))}
    </div>
  );
}

/**
 * Full-bleed background for a snapshot tile (see
 * `BriefTileBackground`). Kept as a named export for older imports;
 * the brief tiles render `BriefTileBackground` directly.
 */
export function SplitImageBackground({
  items,
  emptyEmoji = "✨",
}: {
  items: readonly BriefTileItem[];
  emptyEmoji?: string;
}) {
  return <BriefTileBackground items={items} emptyEmoji={emptyEmoji} />;
}

/** Max label lines that fit the h-[7.5rem] tile (matches BRIEF_TILE_MAX_SPLITS). */
const MAX_TILE_VALUE_LINES = 4;

function IconSnapshotTile({
  label,
  icons,
  valueLines,
  fullText,
  emptyEmoji,
  avoid = false,
}: {
  label: string;
  icons: BriefTileItem[];
  /**
   * One line per selection, stacked at the bottom of the tile (each
   * truncated individually; full joined text stays in `title`/`aria-label`).
   * Pre-Elite Interests/Avoid lists have at most 4 options, so all
   * selections normally show; anything beyond 4 collapses to "+N more".
   */
  valueLines: string[];
  fullText: string;
  emptyEmoji?: string;
  avoid?: boolean;
}) {
  const lines = valueLines.length ? valueLines : ["None specified"];
  const visibleLines =
    lines.length > MAX_TILE_VALUE_LINES
      ? [
          ...lines.slice(0, MAX_TILE_VALUE_LINES - 1),
          `+${lines.length - (MAX_TILE_VALUE_LINES - 1)} more`,
        ]
      : lines;
  // Full-tile distribution: ALL selections (max 4) share the tile —
  // 1 full-bleed, 2 halves, 3 columns, 4 as 2×2 (see
  // BriefTileBackground). Every label stays listed at the bottom.
  const cells: BriefTileItem[] = icons.length
    ? icons.slice(0, BRIEF_TILE_MAX_SPLITS)
    : [{ icon: emptyEmoji ?? "✨", title: "None specified" }];
  return (
    <div
      title={fullText}
      aria-label={`${label}: ${fullText}`}
      className="relative flex h-[7.5rem] min-w-0 flex-col justify-end overflow-hidden rounded-xl border border-white/10 bg-[#141922] p-3 print:border-gray-300"
    >
      <BriefTileBackground
        key={cells
          .map((c) => `${c.title}-${c.photoUrl || c.iconUrl || c.icon}`)
          .join("|")}
        items={cells}
      />
      {/* Bottom scrim so white labels read over any photo; for Avoid
          tiles the red state tint rides above the photo as this same
          overlay (photo stays visible through it). */}
      <div
        aria-hidden
        className={`absolute inset-0 bg-gradient-to-t print:hidden ${
          avoid
            ? "from-red-950/80 via-red-950/25 to-transparent"
            : "from-black/90 via-black/40 to-transparent"
        }`}
      />
      <div className="relative z-10 min-w-0">
        {visibleLines.map((line, i) => (
          <span
            key={`${line}-${i}`}
            title={fullText}
            className="block truncate text-[10px] font-bold text-white print:text-gray-900"
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-dashed border-white/10 py-2.5 last:border-b-0">
      <span className="shrink-0 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-semibold break-words text-white">
        {value}
      </span>
    </div>
  );
}

function ChipGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Standalone “YOUR BRIEF IS WITH US!” questionnaire popup — the exact
 * modal the Guest Vision Brief widget opens (view → Update Brief
 * Details → Save). Extracted so the builders' hamburger menu
 * (OPEN_TRAVEL_BRIEF_EVENT → AppNavDock) opens the same popup in-place
 * with the current draft, instead of duplicating it. Discover owns the
 * former dock Questionnaire slot.
 */
export function TravelBriefModal({
  open,
  onClose,
  answers,
  onSave,
  guestName,
  pnrCode,
  tripTypeLabel,
  timingLabel,
  groupLabel,
}: {
  open: boolean;
  onClose: () => void;
  answers: TravelBriefAnswers;
  onSave: (next: TravelBriefAnswers) => Promise<boolean>;
  guestName?: string;
  pnrCode?: string;
  tripTypeLabel?: string;
  timingLabel?: string;
  groupLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TravelBriefAnswers>(() =>
    normalizeBrief(answers)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answersRef = useRef<TravelBriefAnswers>(normalizeBrief(answers));
  useEffect(() => {
    answersRef.current = normalizeBrief(answers);
  }, [answers]);

  // (Re)seed the draft every time the popup opens.
  useEffect(() => {
    if (!open) return;
    setDraft(answersRef.current);
    setEditing(false);
    setError(null);
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, saving, onClose]);

  if (!open) return null;

  const closeModal = () => {
    if (saving) return;
    onClose();
  };

  const cancelEdit = () => {
    setDraft(answersRef.current);
    setError(null);
    setEditing(false);
  };

  const handleSave = async () => {
    const notesError = guestSpecialRequirementsValidationError(
      draft.guestSpecialRequirements
    );
    if (notesError) {
      setError(notesError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ok = await onSave(normalizeBrief(draft));
      if (!ok) {
        setError(
          "Could not save your brief — please check your connection and try again."
        );
        return;
      }
      setEditing(false);
      onClose();
    } catch {
      setError(
        "Could not save your brief — please check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const shown = normalizeBrief(answers);
  const styleLabel = titleFor(TRAVEL_STYLES, shown.travelStyle);
  const interestsLabel = titlesFor(INTERESTS, shown.interests);
  const motivationLabel = titleFor(MOTIVATIONS, shown.motivation);
  const concernsLabel = titlesFor(PAIN_POINTS, shown.painPoints);
  const paceLabel = shown.travelPace
    ? (TRAVEL_PACES.find((p) => p.id === shown.travelPace)?.label ??
      shown.travelPace)
    : "None specified";
  const langName = languageName(shown.tourLanguage);
  const languageLabel = langName
    ? languageDisplayLabel(langName)
    : "None specified";
  const dietaryLabel = dietaryMobilityDisplayLabel(
    shown.guestSpecialRequirements
  );
  const tripTimingLabel =
    [tripTypeLabel, timingLabel].filter(Boolean).join(" · ") ||
    "None specified";
  const displayPnr = pnrCode && pnrCode !== "······" ? pnrCode : null;
  const displayName = (guestName || "").trim() || "Traveller";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Your Travel Brief"
      onClick={closeModal}
    >
      <div
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0D1117] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeModal}
          disabled={saving}
          aria-label="Close"
          className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-300 transition hover:text-white disabled:opacity-50"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex items-start gap-4 pr-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MASCOT_SRC}
            alt="TokioTours mascot"
            className="h-16 w-16 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#F6A724]">
              We&apos;ve Got Your Request
            </p>
            <h3 className="mt-1 text-base font-bold break-words text-white">
              {displayName}, YOUR BRIEF IS WITH US!
            </h3>
            {displayPnr ? (
              <span className="mt-2 inline-block rounded-full border border-[#075473] bg-[#075473]/25 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-white">
                {displayPnr}
              </span>
            ) : null}
          </div>
        </div>

        {!editing ? (
          <>
            <div className="mt-4">
              <SummaryRow label="Style" value={styleLabel} />
              <SummaryRow label="Interests" value={interestsLabel} />
              <SummaryRow label="Motivation" value={motivationLabel} />
              <SummaryRow
                label="Concerns / Preferences"
                value={concernsLabel}
              />
              <SummaryRow label="Trip Type & Timing" value={tripTimingLabel} />
              <SummaryRow
                label="Group Size"
                value={groupLabel || "None specified"}
              />
              <SummaryRow label="Pace" value={paceLabel} />
              <SummaryRow label="Language" value={languageLabel} />
              <SummaryRow label="Dietary & Mobility" value={dietaryLabel} />
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft(answersRef.current);
                setError(null);
                setEditing(true);
              }}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-[#F6A724]/40 bg-[#F6A724]/10 px-4 py-2.5 text-[11px] font-bold tracking-wider text-[#F6A724] uppercase transition hover:bg-[#F6A724]/20"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Update Brief Details
            </button>
          </>
        ) : (
          <div className="mt-5 space-y-5">
            <ChipGroup label="Travel Style">
              {TRAVEL_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, travelStyle: style.id })
                  }
                  className={chipClass(draft.travelStyle === style.id)}
                >
                  {draft.travelStyle === style.id ? "✓ " : ""}
                  {style.title}
                </button>
              ))}
            </ChipGroup>

            <ChipGroup label="Interests">
              {INTERESTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      interests: toggleInList(draft.interests, item.id),
                    })
                  }
                  className={chipClass(draft.interests.includes(item.id))}
                >
                  {draft.interests.includes(item.id) ? "✓ " : ""}
                  {item.title}
                </button>
              ))}
            </ChipGroup>

            <ChipGroup label="Motivation">
              {MOTIVATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, motivation: item.id })
                  }
                  className={chipClass(draft.motivation === item.id)}
                >
                  {draft.motivation === item.id ? "✓ " : ""}
                  {item.title}
                </button>
              ))}
            </ChipGroup>

            <ChipGroup label="Concerns / Preferences">
              {PAIN_POINTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      painPoints: toggleInList(draft.painPoints, item.id),
                    })
                  }
                  className={chipClass(draft.painPoints.includes(item.id))}
                >
                  {draft.painPoints.includes(item.id) ? "✓ " : ""}
                  {item.title}
                </button>
              ))}
            </ChipGroup>

            <ChipGroup label="Travel Pace">
              {TRAVEL_PACES.map((pace) => (
                <button
                  key={pace.id}
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, travelPace: pace.id })
                  }
                  className={chipClass(draft.travelPace === pace.id)}
                >
                  {draft.travelPace === pace.id ? "✓ " : ""}
                  {pace.label}
                </button>
              ))}
            </ChipGroup>

            <div>
              <span className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                Primary Language
              </span>
              <select
                value={languageToCode(draft.tourLanguage || "EN") || "EN"}
                onChange={(e) =>
                  setDraft({ ...draft, tourLanguage: e.target.value })
                }
                className="w-full max-w-xs rounded-xl border border-white/20 bg-black/60 px-3 py-2.5 text-sm text-white outline-none focus:border-[#F6A724]"
              >
                {TOUR_LANGUAGE_OPTIONS.map((name) => (
                  <option key={name} value={languageToCode(name)}>
                    {languageDisplayLabel(name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-2 block text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                Dietary &amp; Mobility
              </span>
              <GuestRequirementsSelector
                value={draft.guestSpecialRequirements}
                onChange={(guestSpecialRequirements) =>
                  setDraft({ ...draft, guestSpecialRequirements })
                }
              />
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
              <SummaryRow label="Trip Type & Timing" value={tripTimingLabel} />
              <SummaryRow
                label="Group Size"
                value={groupLabel || "None specified"}
              />
            </div>

            {error ? (
              <p className="text-xs font-medium text-[#E60F43]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F6A724] px-4 py-2.5 text-[11px] font-bold tracking-wider text-black uppercase transition hover:bg-[#F6A724]/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "✓ Save Your Brief"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-[11px] font-bold tracking-wider text-gray-300 uppercase transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * “YOUR TRAVEL BRIEF” (Guest Vision Brief) — below the Booking Pass.
 *
 * Display reads from the builder stores (via `answers`); Save is delegated
 * to `onSave`, wired by the dossier views to the existing
 * `syncSingleDayBookingLead` / `syncMultiDayBookingLead` helpers
 * (`/api/bookings-and-leads/upsert`). `onSave` applies the store update
 * optimistically and must revert + return `false` when persistence fails.
 *
 * Clicking the widget — or the small pencil button at its top-right —
 * opens the brief modal in view mode; editing starts from the modal's
 * “Update Brief Details” / edit action inside.
 * Trip type / timing / group size are display-only (they come from the
 * booking itself, not from editable brief fields).
 */
export function YourTravelBriefWidget({
  answers,
  onSave,
  guestName,
  pnrCode,
  tripTypeLabel,
  timingLabel,
  groupLabel,
}: {
  answers: TravelBriefAnswers;
  onSave: (next: TravelBriefAnswers) => Promise<boolean>;
  guestName?: string;
  pnrCode?: string;
  /** Display-only, from the booking (e.g. “Grand Japan Journey”). */
  tripTypeLabel?: string;
  /** Display-only, from the booking (dates / duration label). */
  timingLabel?: string;
  /** Display-only, from the booking (e.g. “2 Adults · 1 Child”). */
  groupLabel?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  // Uploaded ICONS-tab icons (Site Branding) — emoji fallback when absent.
  const ensureBranding = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const getBrandingIconUrl = useSiteBrandingStore((s) => s.getBrandingIconUrl);
  useEffect(() => {
    void ensureBranding();
  }, [ensureBranding]);
  // `brandingItems` subscribed so tiles re-render when branding loads
  // (its rows carry the media_version stamp for the slot photo URLs).

  const shown = normalizeBrief(answers);
  const styleLabel = titleFor(TRAVEL_STYLES, shown.travelStyle);
  const interestsLabel = titlesFor(INTERESTS, shown.interests);
  const motivationLabel = titleFor(MOTIVATIONS, shown.motivation);
  const concernsLabel = titlesFor(PAIN_POINTS, shown.painPoints);
  const paceLabel = shown.travelPace
    ? (TRAVEL_PACES.find((p) => p.id === shown.travelPace)?.label ??
      shown.travelPace)
    : "None specified";
  const langName = languageName(shown.tourLanguage);
  const languageLabel = langName
    ? languageDisplayLabel(langName)
    : "None specified";
  const dietaryLabel = dietaryMobilityDisplayLabel(
    shown.guestSpecialRequirements
  );
  const dietarySnapshot = snapshotDietaryLabel(
    shown.guestSpecialRequirements
  );
  // Split-background image URLs: pure resolution over the global, cached
  // branding store (`itemsByKey` → PB `branding_ui_items.icon` via
  // `getBrandingIconUrl`). No DB/network call per render — the store's
  // `ensureLoaded()` (effect above) dedupes the single load; this memo
  // only recomputes when the loaded map or the selected keys change.
  const styleKey = shown.travelStyle
    ? travelStyleIconKey(shown.travelStyle)
    : "";
  const motivationKey = shown.motivation
    ? preEliteIconKey(shown.motivation)
    : "";
  const interestKeysKey = shown.interests.map(preEliteIconKey).join(",");
  const painPointKeysKey = shown.painPoints.map(preEliteIconKey).join(",");
  const briefTileImages = useMemo(
    () => ({
      style: resolveBriefTileImages(
        styleKey ? [styleKey] : [],
        getBrandingIconUrl
      ),
      motivation: resolveBriefTileImages(
        motivationKey ? [motivationKey] : [],
        getBrandingIconUrl
      ),
      interests: resolveBriefTileImages(
        interestKeysKey ? interestKeysKey.split(",") : [],
        getBrandingIconUrl
      ),
      painPoints: resolveBriefTileImages(
        painPointKeysKey ? painPointKeysKey.split(",") : [],
        getBrandingIconUrl
      ),
    }),
    // `brandingItems` is the subscribed store map — its identity change
    // is what invalidates the resolved URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brandingItems, getBrandingIconUrl, styleKey, motivationKey, interestKeysKey, painPointKeysKey]
  );

  // Selection → photo: the option's own Pre-Builder card photo
  // (`preelite-{optionId}-card` slot, same file the quiz card shows).
  // Selection values are the canonical option ids from
  // TRAVEL_STYLES / INTERESTS / MOTIVATIONS / PAIN_POINTS (stored on
  // the booking/lead as those ids), so no label normalisation is
  // needed; an unknown id simply 404s and BriefTileBackground falls
  // back to the PB icon, then the emoji. PB ICONS url stays as fallback.
  const photoFor = (optionId: string) =>
    briefOptionPhotoUrl(
      optionId,
      brandingItems[preEliteBrandingKey(optionId)]
    ) || undefined;
  const motivationIcons = shown.motivation
    ? [
        {
          icon: briefIconFor(shown.motivation, motivationLabel),
          title: motivationLabel,
          iconUrl: briefTileImages.motivation[0]?.imageUrl || undefined,
          photoUrl: photoFor(shown.motivation),
        },
      ]
    : [];
  const interestIcons = shown.interests.map((id, i) => {
    const title =
      INTERESTS.find((o) => o.id === id)?.title ?? id;
    return {
      icon: briefIconFor(id, title),
      title,
      iconUrl: briefTileImages.interests[i]?.imageUrl || undefined,
      photoUrl: photoFor(id),
    };
  });
  const styleIcons = shown.travelStyle
    ? [
        {
          icon: travelStyleIconFor(shown.travelStyle, styleLabel),
          title: styleLabel,
          iconUrl: briefTileImages.style[0]?.imageUrl || undefined,
          photoUrl: photoFor(shown.travelStyle),
        },
      ]
    : [];
  const painPointIcons = shown.painPoints.map((id, i) => {
    const title =
      PAIN_POINTS.find((o) => o.id === id)?.title ?? id;
    return {
      icon: painPointIconFor(id, title),
      title,
      iconUrl: briefTileImages.painPoints[i]?.imageUrl || undefined,
      photoUrl: photoFor(id),
    };
  });
  const avoidIcons = painPointIcons.length
    ? painPointIcons
    : [{ icon: "✅", title: "No concerns selected" }];
  const avoidFullText = shown.painPoints.length
    ? concernsLabel
    : "No concerns selected";
  const tripTimingLabel =
    [tripTypeLabel, timingLabel].filter(Boolean).join(" · ") ||
    "None specified";
  const displayPnr =
    pnrCode && pnrCode !== "······" ? pnrCode : null;
  const displayName = (guestName || "").trim() || "Traveller";

  return (
    <>
      {/* px inset so soft side shadow isn’t clipped by itinerary `overflow-x-hidden` mains */}
      <div className="w-full px-6 sm:px-8 print:px-0">
        <div className="relative z-[1] flex h-full w-full flex-col rounded-[32px] bg-white px-6 py-5 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] print:break-inside-avoid print:shadow-none">
          <p className="text-xs font-black tracking-widest text-[#060A0F] uppercase md:text-sm">
            Guest Vision Brief
          </p>

          <section
            onClick={() => setModalOpen(true)}
            className="relative flex-1 cursor-pointer overflow-hidden border-0 border-transparent bg-transparent pt-4 transition hover:border-transparent print:rounded-none print:border-0 print:bg-transparent"
            aria-label="Your Travel Brief — tap to view"
          >
            <button
              type="button"
              title="Edit Brief"
              aria-label="Edit Brief"
              onClick={(e) => {
                e.stopPropagation();
                setModalOpen(true);
              }}
              className="absolute top-0 right-0 z-20 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-800 print:hidden"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
            <div className="relative z-10">
              <h2 className="sr-only">Your Travel Brief</h2>

              <div className="grid grid-cols-2 gap-3">
                <IconSnapshotTile
                  label="Style"
                  icons={styleIcons}
                  valueLines={[styleLabel]}
                  fullText={styleLabel}
                  emptyEmoji="✨"
                />
                <IconSnapshotTile
                  label="Motivation"
                  icons={motivationIcons}
                  valueLines={[motivationLabel]}
                  fullText={motivationLabel}
                  emptyEmoji="✨"
                />
                <IconSnapshotTile
                  label="Interests"
                  icons={interestIcons}
                  valueLines={titlesArrayFor(INTERESTS, shown.interests)}
                  fullText={interestsLabel}
                  emptyEmoji="✨"
                />
                <IconSnapshotTile
                  label="Avoid"
                  icons={avoidIcons}
                  valueLines={
                    shown.painPoints.length
                      ? titlesArrayFor(PAIN_POINTS, shown.painPoints)
                      : ["None"]
                  }
                  fullText={avoidFullText}
                  emptyEmoji="✅"
                  avoid
                />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-slate-500 print:text-gray-700">
                <span className="font-semibold text-slate-700 print:text-gray-900">
                  Dietary &amp; Mobility:
                </span>{" "}
                {dietarySnapshot}
              </p>
            </div>
          </section>
        </div>
      </div>

      <TravelBriefModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        answers={answers}
        onSave={onSave}
        guestName={guestName}
        pnrCode={pnrCode}
        tripTypeLabel={tripTypeLabel}
        timingLabel={timingLabel}
        groupLabel={groupLabel}
      />
    </>
  );
}

/** Backward-compatible alias (older dossier imports). */
export const PreBuilderSummaryWidget = YourTravelBriefWidget;
