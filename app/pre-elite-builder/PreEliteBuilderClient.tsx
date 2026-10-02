"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Compass,
  Crown,
  Heart,
  Landmark,
  Languages,
  Minus,
  Mountain,
  Plane,
  Plus,
  Sparkles,
  Star,
  User,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
  stepError,
  toItineraryData,
  type InterestId,
  type MotivationId,
  type PainPointId,
  type TravelStyleId,
} from "@/lib/preEliteBuilder";
import { BRAND_LOGO_ICON } from "@/lib/brand";
import {
  type StoryExplanation,
} from "@/lib/preEliteStories";
import {
  preEliteBrandingKey,
  readPreEliteQuizLocalCache,
  resolvePreEliteStory,
  resolvePreEliteCardMedia,
  PRE_ELITE_QUIZ_LOCAL_KEY,
} from "@/lib/preEliteBranding";
import { isVideoFilename } from "@/lib/brandingUi";
import { StoryExplanationModal } from "@/components/pre-elite/StoryExplanationModal";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import { BrandCharacterPreloader } from "@/components/branding/BrandCharacterPreloader";
import { HoldUntilReadyMascot } from "@/components/branding/HoldUntilReadyMascot";
import {
  HiBubble,
  MascotHiZoom,
  useMascotHiTap,
} from "@/components/branding/MascotHiTap";
import { QuestionnaireCompletionModal } from "@/components/builder/QuestionnaireCompletionModal";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import { useBuilderStore } from "@/store/useBuilderStore";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import {
  GoldLight,
  type GoldLightPlacement,
} from "@/components/branding/GoldLight";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

type ChoiceSpotlight = {
  color: string;
  placement: GoldLightPlacement;
};

const CHOICE_SPOTLIGHT: Record<string, ChoiceSpotlight> = {
  // Travel style (step 1) — hover / selected
  classic_explorer: { color: "#DC6E8A", placement: "bottom-center" },
  premium_comfort: { color: "#1BA58A", placement: "left-center" },
  vip_bespoke: { color: "#F6A724", placement: "top-center" },
  // Interests (step 2) — hover / selected
  culture_heritage: { color: "#E60F43", placement: "top-center" },
  food_culinary: { color: "#DC6E8A", placement: "left-center" },
  modern_pop: { color: "#054F70", placement: "bottom-center" },
  nature_day_trips: { color: "#1BA58A", placement: "right-center" },
  // Motivation (step 3) — same color order as interests
  family: { color: "#E60F43", placement: "top-center" },
  romantic: { color: "#DC6E8A", placement: "left-center" },
  solo: { color: "#054F70", placement: "bottom-center" },
  first_time: { color: "#1BA58A", placement: "right-center" },
  // What to avoid (step 4) — same color order
  language_transit: { color: "#E60F43", placement: "top-center" },
  tourist_traps: { color: "#DC6E8A", placement: "left-center" },
  authentic_dining: { color: "#054F70", placement: "bottom-center" },
  packed_itinerary: { color: "#1BA58A", placement: "right-center" },
};

/** Bare sticker icons — top-right of each choice card (no circle/pill). */
const CHOICE_STICKER: Record<
  string,
  { Icon: LucideIcon; className: string }
> = {
  classic_explorer: { Icon: Compass, className: "text-[#075473]" },
  premium_comfort: { Icon: Star, className: "text-[#F6A724]" },
  vip_bespoke: { Icon: Crown, className: "text-white" },
  culture_heritage: { Icon: Landmark, className: "text-[#E60F43]" },
  food_culinary: { Icon: UtensilsCrossed, className: "text-[#DC6E8A]" },
  modern_pop: { Icon: Sparkles, className: "text-[#7ec8e3]" },
  nature_day_trips: { Icon: Mountain, className: "text-[#1BA58A]" },
  family: { Icon: Users, className: "text-[#E60F43]" },
  romantic: { Icon: Heart, className: "text-[#DC6E8A]" },
  solo: { Icon: User, className: "text-[#7ec8e3]" },
  first_time: { Icon: Plane, className: "text-[#1BA58A]" },
  language_transit: { Icon: Languages, className: "text-[#E60F43]" },
  tourist_traps: { Icon: AlertTriangle, className: "text-[#DC6E8A]" },
  authentic_dining: { Icon: UtensilsCrossed, className: "text-[#7ec8e3]" },
  packed_itinerary: { Icon: Clock, className: "text-[#1BA58A]" },
};

const PRE_ELITE_HERO_POSES = {
  bow: "/brand/mascot-bow.webp",
  note: "/brand/mascot-note.webp",
  multi: "/brand/mascot-multiday.webp",
  single: "/brand/mascot-1day-pass.webp",
  time: "/brand/mascot-time.webp",
  look: "/brand/mascot-look.webp",
} as const;

type PreEliteHeroPose = keyof typeof PRE_ELITE_HERO_POSES;

const STEP_TITLES = [
  "Travel style",
  "Interests",
  "Motivation",
  "What to avoid",
] as const;

const QUIZ_STEP_COUNT = 4;

export function PreEliteBuilderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draft = usePreBuilderStore();
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [activeStory, setActiveStory] = useState<StoryExplanation | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [localQuiz, setLocalQuiz] = useState(() =>
    typeof window !== "undefined" ? readPreEliteQuizLocalCache() : {}
  );
  /** Idle 7s → time.png; activity → look */
  const [isIdle, setIsIdle] = useState(false);
  /** Pick / Continue → bow for 1.3s */
  const [showBow, setShowBow] = useState(false);
  const bowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bowDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showHi, triggerHi } = useMascotHiTap();
  const typeSeededRef = useRef(false);

  // Seed trip type from landing modal (?type=single|multiday)
  useEffect(() => {
    if (typeSeededRef.current) return;
    const raw = String(searchParams.get("type") || "")
      .trim()
      .toLowerCase();
    if (raw === "single" || raw === "single_day") {
      typeSeededRef.current = true;
      usePreBuilderStore.getState().setTripType("single_day");
    } else if (
      raw === "multiday" ||
      raw === "multi" ||
      raw === "multi_day"
    ) {
      typeSeededRef.current = true;
      usePreBuilderStore.getState().setTripType("multi_day");
    }
  }, [searchParams]);

  const triggerBow = () => {
    if (bowTimerRef.current) clearTimeout(bowTimerRef.current);
    if (bowDelayRef.current) {
      clearTimeout(bowDelayRef.current);
      bowDelayRef.current = null;
    }
    setShowBow(true);
    setIsIdle(false);
    bowTimerRef.current = setTimeout(() => {
      setShowBow(false);
      bowTimerRef.current = null;
    }, 1300);
  };

  /** Bow starts 1s after the story / video pop closes */
  const scheduleBowAfterPopClose = () => {
    if (bowDelayRef.current) clearTimeout(bowDelayRef.current);
    if (bowTimerRef.current) {
      clearTimeout(bowTimerRef.current);
      bowTimerRef.current = null;
    }
    setShowBow(false);
    bowDelayRef.current = setTimeout(() => {
      bowDelayRef.current = null;
      triggerBow();
    }, 1000);
  };

  const ensureBranding = useSiteBrandingStore((s) => s.ensureLoaded);
  const getBrandingItem = useSiteBrandingStore((s) => s.getItem);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  void brandingItems;

  useEffect(() => {
    void ensureBranding();
  }, [ensureBranding]);

  useEffect(() => {
    setLocalQuiz(readPreEliteQuizLocalCache());
    const onStorage = (e: StorageEvent) => {
      if (e.key === PRE_ELITE_QUIZ_LOCAL_KEY) {
        setLocalQuiz(readPreEliteQuizLocalCache());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const openStory = (id: string) => {
    const story = resolvePreEliteStory(
      id,
      getBrandingItem(preEliteBrandingKey(id)),
      localQuiz[id] || null
    );
    if (story) setActiveStory(story);
  };

  useEffect(() => {
    const unsub = usePreBuilderStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (usePreBuilderStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const step = Math.min(QUIZ_STEP_COUNT, Math.max(1, draft.step));
  const hasSavedContact =
    draft.pnrDraftStatus === "SAVED" &&
    Boolean(draft.bookingRef && draft.lastPayload?.email);
  const hasTempDraft =
    draft.pnrDraftStatus === "TEMPORARY_UNSAVED" && Boolean(draft.bookingRef);

  // Saved contact brief → pre-build confirmation card
  useEffect(() => {
    if (!hydrated || !hasSavedContact) return;
    router.replace("/pre-build");
  }, [hydrated, hasSavedContact, router]);

  // Temp quiz draft already entered builder once — resume builder
  useEffect(() => {
    if (!hydrated || !hasTempDraft || hasSavedContact) return;
    const isSingle = draft.tripType === "single_day";
    router.replace(isSingle ? "/builder-single" : "/builder");
  }, [hydrated, hasTempDraft, hasSavedContact, draft.tripType, router]);

  // Idle timer: 7s without mouse/scroll/click → time mascot
  useEffect(() => {
    if (!hydrated || hasSavedContact || hasTempDraft) return;
    const bump = () => {
      setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIsIdle(true), 7_000);
    };
    bump();
    window.addEventListener("mousemove", bump, { passive: true });
    window.addEventListener("mousedown", bump);
    window.addEventListener("click", bump);
    window.addEventListener("keydown", bump);
    window.addEventListener("touchstart", bump, { passive: true });
    window.addEventListener("scroll", bump, { passive: true, capture: true });
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("mousedown", bump);
      window.removeEventListener("click", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("touchstart", bump);
      window.removeEventListener("scroll", bump, true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (bowTimerRef.current) clearTimeout(bowTimerRef.current);
      if (bowDelayRef.current) clearTimeout(bowDelayRef.current);
    };
  }, [hydrated, hasSavedContact, hasTempDraft]);

  const heroPose: PreEliteHeroPose = (() => {
    if (showBow) return "bow";
    if (isIdle) return "time";
    return "look";
  })();

  const stepBlurb =
    step === 1
      ? "How do you want the days to feel? This sets the comfort tier before we design anything."
      : step === 2
        ? "Choose every thread you want woven in. You can select more than one."
        : step === 3
          ? "What is this journey actually for?"
          : "Tell us the friction you want us to remove. Select every concern that applies.";

  const finishQuizLocally = () => {
    if (!draft.tripType) {
      const msg =
        "Trip type missing — use START TRIP and choose Single-Day or Multi-Day.";
      setError(msg);
      showSystemMessage({ text: msg, tone: "error" });
      return false;
    }
    const itinerary = toItineraryData(draft, { requireContact: false });
    if (!itinerary) {
      const msg = "Finish all preference steps before continuing.";
      setError(msg);
      showSystemMessage({ text: msg, tone: "error" });
      return false;
    }
    const bookingRef = useBuilderStore.getState().ensureTempBookingRef();
    const itineraryData = JSON.stringify(itinerary);
    draft.markTemporaryDraft({ bookingRef, itineraryData });
    hydrateStoresFromPreEliteBrief({
      bookingRef,
      fullName: "",
      email: "",
      itineraryData,
    });
    return true;
  };

  const goNext = () => {
    const message = stepError(step, draft);
    if (message) {
      setError(message);
      showSystemMessage({ text: message, tone: "error" });
      return;
    }
    setError(null);
    triggerBow();
    if (step >= QUIZ_STEP_COUNT) {
      setShowCompletion(true);
      return;
    }
    draft.setStep(Math.min(QUIZ_STEP_COUNT, step + 1));
  };

  const goBack = () => {
    setError(null);
    draft.setStep(Math.max(1, step - 1));
  };

  const lockHero = hydrated && !hasSavedContact && !hasTempDraft;

  return (
    <div
      className={
        lockHero
          ? "flex h-dvh flex-col overflow-hidden bg-transparent text-white"
          : "min-h-dvh bg-transparent text-white"
      }
    >
      <BrandCharacterPreloader />
      <SystemMessageFox />
      <header className="shrink-0 border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:py-5">
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_LOGO_ICON}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="font-godiva text-sm tracking-[0.22em] text-[#D91147] uppercase">
              TOKIOTOURS
            </span>
          </Link>
          <p className="text-xs tracking-[0.18em] text-white/50 uppercase">
            PRE-BUILDER
          </p>
        </div>
      </header>

      {!hydrated || hasSavedContact || hasTempDraft ? (
        <main className="relative mx-auto w-full max-w-3xl overflow-visible px-5 py-10 sm:py-14">
          <div className="h-80 rounded-3xl border border-zinc-800/80 bg-[#0D1117]/80 backdrop-blur-md" />
        </main>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-start overflow-x-visible overflow-y-visible sm:justify-center">
          <div className="relative z-40 mx-auto w-full max-w-3xl shrink-0 px-5 pt-4 sm:pt-2">
            <div className="relative min-h-[6.5rem] overflow-visible sm:min-h-[8.5rem]">
              <span
                role="button"
                tabIndex={0}
                aria-label="Say hi"
                onClick={triggerHi}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") triggerHi(e);
                }}
                className="absolute -right-2 top-0 z-30 cursor-pointer overflow-visible sm:-right-4 sm:-top-6"
              >
                <HiBubble
                  show={showHi}
                  className="-left-8 top-0 w-[5.5rem] sm:-left-10 sm:w-[6.5rem]"
                />
                <MascotHiZoom showHi={showHi} className="pointer-events-none">
                  <HoldUntilReadyMascot
                    pose={heroPose}
                    poses={PRE_ELITE_HERO_POSES}
                    imgClassName="h-28 w-auto select-none object-contain sm:h-44 md:h-48"
                  />
                </MascotHiZoom>
              </span>
              <div className="relative z-10">
                <p className="text-[10px] tracking-[0.22em] text-[#1CA67F] uppercase sm:text-xs">
                  Step {step} of {QUIZ_STEP_COUNT}
                </p>
                <h1 className="mt-1 max-w-[70%] font-display text-2xl leading-tight text-white sm:mt-3 sm:max-w-none sm:text-4xl">
                  {STEP_TITLES[step - 1]}
                </h1>
                <p className="mt-1 max-w-xl pr-20 text-xs leading-snug text-white/60 sm:mt-2 sm:pr-32 sm:text-sm sm:leading-relaxed">
                  {stepBlurb}
                </p>
              </div>
            </div>
            <div className="relative z-10 mt-3 h-1 overflow-hidden rounded-full bg-white/10 sm:mt-6">
              <div
                className="h-full rounded-full bg-[#075473] transition-all"
                style={{ width: `${(step / QUIZ_STEP_COUNT) * 100}%` }}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-5 pb-4 pt-2 sm:pb-8 sm:pt-4">
              <div className="relative origin-top scale-[0.93] overflow-visible rounded-3xl border border-zinc-800/80 bg-[#0D1117]/80 p-5 backdrop-blur-md sm:p-7">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="relative overflow-visible"
                  >
                    {step === 1 && (
                      <ChoiceList
                        options={TRAVEL_STYLES}
                        selected={draft.travelStyle}
                        resolveCopy={(id) =>
                          resolvePreEliteStory(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null
                          )
                        }
                        resolveCard={(id, svgUrl) =>
                          resolvePreEliteCardMedia(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null,
                            svgUrl
                          )
                        }
                        onOpenStory={openStory}
                      />
                    )}
                    {step === 2 && (
                      <ChoiceList
                        options={INTERESTS}
                        selected={draft.interests}
                        multiple
                        resolveCopy={(id) =>
                          resolvePreEliteStory(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null
                          )
                        }
                        resolveCard={(id, svgUrl) =>
                          resolvePreEliteCardMedia(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null,
                            svgUrl
                          )
                        }
                        onOpenStory={openStory}
                      />
                    )}
                    {step === 3 && (
                      <ChoiceList
                        options={MOTIVATIONS}
                        selected={draft.tripMotivation}
                        resolveCopy={(id) =>
                          resolvePreEliteStory(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null
                          )
                        }
                        resolveCard={(id, svgUrl) =>
                          resolvePreEliteCardMedia(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null,
                            svgUrl
                          )
                        }
                        onOpenStory={openStory}
                      />
                    )}
                    {step === 4 && (
                      <ChoiceList
                        options={PAIN_POINTS}
                        selected={draft.painPoints}
                        multiple
                        resolveCopy={(id) =>
                          resolvePreEliteStory(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null
                          )
                        }
                        resolveCard={(id, svgUrl) =>
                          resolvePreEliteCardMedia(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null,
                            svgUrl
                          )
                        }
                        onOpenStory={openStory}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>

                {error && (
                  <p className="sr-only" role="alert">
                    {error}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 1}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white/70 disabled:opacity-30"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-2 rounded-full bg-[#075473] px-5 py-2.5 text-sm font-medium text-white"
                  >
                    {step >= QUIZ_STEP_COUNT ? "Finish" : "Continue"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <QuestionnaireCompletionModal
        open={showCompletion}
        builderType={
          draft.tripType === "single_day" ? "single" : "multiday"
        }
        onConfirm={() => {
          const ok = finishQuizLocally();
          if (!ok) {
            setShowCompletion(false);
            return false;
          }
          setShowCompletion(false);
          return true;
        }}
      />

      <StoryExplanationModal
        open={Boolean(activeStory)}
        story={activeStory}
        onClose={() => {
          setActiveStory(null);
          scheduleBowAfterPopClose();
        }}
        onSelect={() => {
          if (!activeStory) return;
          const id = activeStory.optionId;
          if (step === 1) {
            draft.setTravelStyle(id as TravelStyleId);
          } else if (step === 2) {
            if (!draft.interests.includes(id as InterestId)) {
              draft.toggleInterest(id as InterestId);
            }
          } else if (step === 3) {
            draft.setTripMotivation(id as MotivationId);
          } else if (step === 4) {
            if (!draft.painPoints.includes(id as PainPointId)) {
              draft.togglePainPoint(id as PainPointId);
            }
          }
          setError(null);
          setActiveStory(null);
          scheduleBowAfterPopClose();
        }}
      />
    </div>
  );
}
function ChoiceList({
  options,
  selected,
  onOpenStory,
  resolveCopy,
  resolveCard,
}: {
  options: readonly {
    id: string;
    title: string;
    eyebrow?: string;
    description: string;
    svgUrl?: string;
  }[];
  selected: string | readonly string[] | null;
  /** Kept for API compatibility with multi-select steps; selection happens in the story modal. */
  multiple?: boolean;
  onOpenStory: (id: string) => void;
  resolveCopy?: (id: string) => StoryExplanation | null;
  resolveCard?: (
    id: string,
    svgUrl?: string
  ) => { url: string; isVideo: boolean; posterUrl?: string };
}) {
  const isOn = (id: string) =>
    Array.isArray(selected) ? selected.includes(id) : selected === id;

  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const on = isOn(option.id);
        const story = resolveCopy?.(option.id);
        const title = story?.title || option.title;
        const description = option.description;
        const card = resolveCard?.(option.id, option.svgUrl) || {
          url:
            option.svgUrl?.trim() ||
            story?.slides?.[0]?.imageUrl ||
            "/svg/style-premium-comfort.svg",
          isVideo: false,
        };
        const cardUrl = card.url;
        const cardIsVideo = card.isVideo || isVideoFilename(cardUrl);
        const cardPoster = card.posterUrl || "";
        const spotlight = CHOICE_SPOTLIGHT[option.id];
        const accent = spotlight?.color || "#22D3EE";
        const accentRgb = (() => {
          const h = accent.replace("#", "");
          const n = Number.parseInt(h, 16);
          if (!Number.isFinite(n) || h.length !== 6) return "34,211,238";
          return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
        })();
        const sticker = CHOICE_STICKER[option.id];
        const StickerIcon = sticker?.Icon;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            aria-label={`Preview and select ${title}`}
            onClick={() => onOpenStory(option.id)}
            className={`group relative w-full min-h-[7rem] cursor-pointer overflow-hidden rounded-2xl border p-5 pr-12 text-left transition-all duration-300 ${
              on
                ? "scale-[1.01]"
                : "border-white/10 bg-[#0D1117]/70 hover:border-white/25"
            }`}
            style={
              on
                ? {
                    borderColor: accent,
                    boxShadow: `0 0 25px rgba(${accentRgb},0.35)`,
                  }
                : undefined
            }
          >
            {/* Selected background — Team Access card photo wins over SVG */}
            {on ? (
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0A1017]">
                {cardIsVideo ? (
                  <>
                    {cardPoster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cardPoster}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                    <video
                      key={cardUrl}
                      src={cardUrl}
                      poster={cardPoster || undefined}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cardUrl}
                    alt=""
                    className="h-full w-full scale-105 object-cover transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
              </div>
            ) : null}

            {spotlight ? (
              <GoldLight
                color={spotlight.color}
                placement={spotlight.placement}
                active={on}
                className="!z-[1]"
              />
            ) : null}

            {/* Bare sticker icon — top-right, no circle/pill */}
            {StickerIcon ? (
              <StickerIcon
                className={`pointer-events-none absolute top-4 right-4 z-10 h-5 w-5 ${sticker.className}`}
                strokeWidth={1.75}
                aria-hidden
              />
            ) : null}

            <div className="relative z-10 flex h-full flex-col justify-end space-y-2 pt-1">
              <div>
                <h3 className="font-godiva text-base font-bold tracking-wide text-white">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                  {description}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

