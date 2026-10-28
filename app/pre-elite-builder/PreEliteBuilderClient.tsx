"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
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
  Play,
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
import {
  type StoryExplanation,
} from "@/lib/preEliteStories";
import {
  preEliteBrandingKey,
  preEliteMediaVersion,
  readPreEliteQuizLocalCache,
  resolvePreEliteStory,
  PRE_ELITE_QUIZ_LOCAL_KEY,
} from "@/lib/preEliteBranding";
import {
  brandingSlotMobileUrl,
  brandingSlotSrcSet,
  brandingSlotWebUrl,
  preEliteCardSlot,
  preEliteSlideSlot,
} from "@/lib/brandingImageSlots";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import { BrandCharacterPreloader } from "@/components/branding/BrandCharacterPreloader";
import { BrandLogoIcon } from "@/components/branding/BrandLogoIcon";
import { HoldUntilReadyMascot } from "@/components/branding/HoldUntilReadyMascot";

const StoryExplanationModal = dynamic(
  () =>
    import("@/components/pre-elite/StoryExplanationModal").then((m) => ({
      default: m.StoryExplanationModal,
    })),
  { ssr: false }
);
import {
  HiBubble,
  MascotHiZoom,
  useMascotHiTap,
} from "@/components/branding/MascotHiTap";
import { QuestionnaireCompletionModal } from "@/components/builder/QuestionnaireCompletionModal";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import { prefetchBuilderConfig } from "@/lib/builderConfigCache";
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

  // Warm builder catalog while guest answers quiz — open feels instant.
  useEffect(() => {
    prefetchBuilderConfig();
  }, []);

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
    if (!story) return;
    // Story images prefer the stable branding slot (outside PocketBase,
    // overwritten in place by Site Branding). If that slot file does not
    // exist yet, the modal falls back to the resolved image — no breakage.
    // The record's media stamp versions the URL so a replaced photo
    // is never hidden by the browser cache.
    const stamp = preEliteMediaVersion(
      useSiteBrandingStore.getState().itemsByKey[preEliteBrandingKey(id)]
    );
    const version = stamp ? `?v=${stamp}` : "";
    const withSlots = {
      ...story,
      slides: story.slides.map((s, i) =>
        s.videoUrl || !s.imageUrl || i > 2
          ? s
          : {
              ...s,
              imageUrl:
                brandingSlotWebUrl(
                  preEliteSlideSlot(id, (i + 1) as 1 | 2 | 3)
                ) + version,
              fallbackImageUrl: s.imageUrl,
            }
      ),
    };
    setActiveStory(withSlots);
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
      <header className="flex-none border-b border-white/10 bg-[#0A1017]/85">
        <nav
          className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3 sm:py-5"
          aria-label="Pre-builder"
        >
          <Link href="/" className="inline-flex items-center gap-2">
            <BrandLogoIcon
              priority
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="font-godiva text-sm tracking-[0.22em] text-[#D91147] uppercase">
              TOKIOTOURS
            </span>
          </Link>
          <p className="text-xs tracking-[0.18em] text-white/50 uppercase">
            PRE-BUILDER
          </p>
        </nav>
      </header>

      {!hydrated || hasSavedContact || hasTempDraft ? (
        <div className="relative mx-auto w-full max-w-3xl overflow-visible px-5 py-10 sm:py-14">
          <div className="h-80 bg-transparent" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            data-quiz-step-header=""
            className="relative z-40 mx-auto w-full max-w-3xl flex-none px-5 pt-4 sm:pt-2"
          >
            <div className="relative min-h-[6.5rem] overflow-visible sm:min-h-[8.5rem]">
              <button
                type="button"
                aria-label="Say hi"
                onClick={triggerHi}
                className="absolute -right-2 top-0 z-30 cursor-pointer overflow-visible border-0 bg-transparent p-0 sm:-right-4 sm:-top-6"
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
              </button>
              <div className="relative z-10">
                <p className="text-[10px] tracking-[0.22em] text-[#1CA67F] uppercase sm:text-xs">
                  Step {step} of {QUIZ_STEP_COUNT}
                </p>
                <h1 className="mt-1 max-w-[70%] font-display text-2xl leading-tight text-white sm:mt-3 sm:max-w-none sm:text-4xl">
                  {STEP_TITLES[step - 1]}
                </h1>
                <p className="mt-1 max-w-xl pr-20 text-xs leading-snug text-white/75 sm:mt-2 sm:pr-32 sm:text-sm sm:leading-relaxed">
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

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div
              data-quiz-content=""
              className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center bg-transparent px-5 py-8"
            >
              <div
                data-quiz-card-stack=""
                className="relative w-full overflow-visible bg-transparent"
              >
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
                      <TravelStyleAccordion
                        options={TRAVEL_STYLES}
                        selected={draft.travelStyle}
                        resolveCopy={(id) =>
                          resolvePreEliteStory(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null
                          )
                        }
                        onSelect={(id) => {
                          draft.setTravelStyle(id as TravelStyleId);
                          setError(null);
                        }}
                        onOpenStory={openStory}
                      />
                    )}
                    {step === 2 && (
                      <InterestsGrid
                        options={INTERESTS}
                        selected={draft.interests}
                        resolveCopy={(id) =>
                          resolvePreEliteStory(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null
                          )
                        }
                        onSelect={(id) => {
                          draft.toggleInterest(id as InterestId);
                          setError(null);
                        }}
                        onOpenStory={openStory}
                      />
                    )}
                    {step === 3 && (
                      <MotivationAccordion
                        options={MOTIVATIONS}
                        selected={draft.tripMotivation}
                        resolveCopy={(id) =>
                          resolvePreEliteStory(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null
                          )
                        }
                        onSelect={(id) => {
                          draft.setTripMotivation(id as MotivationId);
                          setError(null);
                        }}
                        onOpenStory={openStory}
                      />
                    )}
                    {step === 4 && (
                      <PainPointsGrid
                        options={PAIN_POINTS}
                        selected={draft.painPoints}
                        resolveCopy={(id) =>
                          resolvePreEliteStory(
                            id,
                            getBrandingItem(preEliteBrandingKey(id)),
                            localQuiz[id] || null
                          )
                        }
                        onSelect={(id) => {
                          draft.togglePainPoint(id as PainPointId);
                          setError(null);
                        }}
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

              </div>
            </div>
          </div>

          <div
            data-quiz-bottom-nav=""
            className="mx-auto w-full max-w-3xl flex-none px-5 pb-4 sm:pb-6"
          >
            <div className="flex w-full items-center justify-between gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white/80 disabled:opacity-30"
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
/**
 * Travel Style (step 1) — horizontal flex accordion mirroring the
 * homepage finale (`renderAccordion` / `renderCardFace` in
 * GridSequenceHero): one wide expanded panel + narrow collapsed strips
 * with vertical titles, panels physically squeezing each other via a
 * CSS flex transition (`flex-[5]` vs `flex-[1]`, duration-700).
 *
 * The expanded panel IS the selected style, so persistence, Continue
 * gating (`stepError` step 1), summary and pricing keep reading the
 * same store value the old flip-cards wrote. Tapping a collapsed strip
 * expands it and writes the selection; tapping the expanded panel
 * keeps it selected (never collapses to null). When nothing is stored
 * yet, the middle panel (premium_comfort) is expanded as a VISUAL
 * default only — the store stays null until the guest taps, so
 * Continue still errors with "Pick a travel style.".
 */
/**
 * Expanded-panel artwork from the stable branding slot
 * (`preelite-{optionId}-card`): mobile gets the light `--mobile` proxy,
 * web the master — same ID forever, overwritten in Site Branding.
 * If the slot file is missing, falls back to the built-in artwork.
 */
function AccordionArtwork({
  optionId,
  fallbackUrl,
}: {
  optionId: string;
  fallbackUrl?: string;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const slot = preEliteCardSlot(optionId);
  // Slot ID never changes on replace → version the URL with the
  // record's media stamp (written by Site Branding on every image
  // save) so a replaced photo is never hidden by the browser cache.
  const brandingRow = useSiteBrandingStore(
    (s) => s.itemsByKey[preEliteBrandingKey(optionId)]
  );
  const stamp = preEliteMediaVersion(brandingRow);
  const version = stamp ? `?v=${stamp}` : "";
  if (useFallback) {
    if (!fallbackUrl) return null;
    return (
      <div
        aria-hidden
        data-accordion-artwork="fallback"
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url("${fallbackUrl}")` }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      aria-hidden
      data-accordion-artwork=""
      src={`${brandingSlotWebUrl(slot)}${version}`}
      srcSet={
        version
          ? `${brandingSlotMobileUrl(slot)}${version} 768w, ${brandingSlotWebUrl(slot)}${version} 1600w`
          : brandingSlotSrcSet(slot)
      }
      sizes="(max-width: 767px) 92vw, 60vw"
      alt=""
      draggable={false}
      onError={() => setUseFallback(true)}
      className="absolute inset-0 h-full w-full object-cover opacity-40"
    />
  );
}

function TravelStyleAccordion({
  options,
  selected,
  onSelect,
  onOpenStory,
  resolveCopy,
}: {
  options: readonly {
    id: string;
    title: string;
    eyebrow?: string;
    description: string;
    svgUrl?: string;
  }[];
  selected: string | null;
  onSelect: (id: string) => void;
  onOpenStory: (id: string) => void;
  resolveCopy?: (id: string) => StoryExplanation | null;
}) {
  const expandedId =
    selected && options.some((option) => option.id === selected)
      ? selected
      : (options.find((option) => option.id === "premium_comfort")?.id ??
        options[1]?.id ??
        options[0]?.id);

  return (
    <div
      className="mx-auto flex h-[52dvh] max-h-[560px] min-h-[26rem] w-full flex-row gap-2 sm:min-h-[30rem] sm:gap-3"
      data-travel-style-accordion=""
      role="group"
      aria-label="Travel style"
    >
      {options.map((option) => {
        const isExpanded = expandedId === option.id;
        const isSelected = selected === option.id;
        const story = resolveCopy?.(option.id);
        const title = story?.title || option.title;
        const description = option.description;
        const spotlight = CHOICE_SPOTLIGHT[option.id];
        const accent = spotlight?.color || "#0080A3";
        const accentRgb = (() => {
          const h = accent.replace("#", "");
          const n = Number.parseInt(h, 16);
          if (!Number.isFinite(n) || h.length !== 6) return "0,128,163";
          return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
        })();
        const sticker = CHOICE_STICKER[option.id];
        const StickerIcon = sticker?.Icon;

        // Collapsed tap expands + selects; expanded tap confirms the
        // visual default if unselected, otherwise keeps the selection.
        const handleActivate = () => {
          if (!isSelected) onSelect(option.id);
        };

        return (
          <div
            key={option.id}
            data-accordion-option={option.id}
            data-accordion-panel={option.id}
            data-open={isExpanded ? "true" : "false"}
            data-expanded={isExpanded ? "true" : "false"}
            data-selected={isSelected ? "true" : "false"}
            role="button"
            tabIndex={0}
            aria-label={`Select ${title}`}
            aria-expanded={isExpanded}
            aria-pressed={isSelected}
            onClick={handleActivate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleActivate();
              }
            }}
            className={`group relative min-w-0 cursor-pointer overflow-hidden rounded-2xl border bg-[#0A1017] text-left shadow-[0_18px_44px_rgba(0,0,0,0.55)] transition-all duration-700 ease-in-out ${
              isExpanded
                ? "flex-[5] opacity-100"
                : "flex-[1] border-white/10 opacity-60 hover:border-white/25 hover:opacity-90"
            }`}
            style={
              isExpanded
                ? {
                    borderColor: accent,
                    boxShadow: `0 18px 44px rgba(0,0,0,0.55), 0 0 25px rgba(${accentRgb},0.35)`,
                  }
                : undefined
            }
          >
            {/* Artwork only when expanded/selected — collapsed strips stay clean.
                Stable branding slot (web + mobile proxy) first; the built-in
                SVG artwork is the fallback if the slot file is missing. */}
            {isExpanded ? (
              <AccordionArtwork optionId={option.id} fallbackUrl={option.svgUrl} />
            ) : null}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: isExpanded
                  ? `linear-gradient(to top, rgba(${accentRgb},0.45), rgba(${accentRgb},0.12) 45%, transparent 75%)`
                  : `linear-gradient(to top, rgba(${accentRgb},0.16), rgba(${accentRgb},0.04) 45%, transparent 75%)`,
              }}
            />
            <div
              aria-hidden
              className={`absolute inset-0 bg-gradient-to-t ${
                isExpanded
                  ? "from-black/85 via-black/25 to-black/10"
                  : "from-black/30 via-black/5 to-transparent"
              }`}
            />

            {spotlight ? (
              <GoldLight
                color={spotlight.color}
                placement={spotlight.placement}
                active={isExpanded}
                className="!z-[1]"
              />
            ) : null}

            {/* Collapsed label — vertical title, inset so it never touches panel edges */}
            <div
              aria-hidden={isExpanded}
              className={`absolute inset-x-0 inset-y-6 z-20 flex items-center justify-center transition-opacity duration-300 ${
                isExpanded ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <span className="block -rotate-90 text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap text-white uppercase drop-shadow-lg">
                {title}
              </span>
            </div>

            {/* Expanded face — fades in with a delay, like the homepage */}
            <div
              aria-hidden={!isExpanded}
              className={`absolute inset-0 z-20 transition-opacity duration-500 delay-200 ${
                isExpanded ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {option.eyebrow ? (
                <div className="absolute top-4 left-4 max-w-[80%]">
                  <span
                    className="block max-w-full truncate rounded-full border bg-[#060A0F]/80 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase backdrop-blur-md"
                    style={{
                      borderColor: `rgba(${accentRgb},0.45)`,
                      color: accent,
                    }}
                  >
                    {option.eyebrow}
                  </span>
                </div>
              ) : null}
              {StickerIcon ? (
                <StickerIcon
                  className={`absolute top-4 right-4 h-6 w-6 shrink-0 ${sticker.className}`}
                  strokeWidth={1.75}
                  aria-hidden
                />
              ) : null}
              <div className="absolute right-0 bottom-0 left-0 p-4 sm:p-6">
                <h3 className="font-godiva text-xl leading-tight font-black tracking-tight text-white uppercase drop-shadow-2xl sm:text-3xl">
                  {title}
                </h3>
                <p className="mt-2 line-clamp-4 max-w-md text-xs leading-relaxed font-light text-zinc-200 drop-shadow-lg sm:text-sm">
                  {description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-block rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase backdrop-blur-md ${
                      isSelected
                        ? "border-transparent text-white"
                        : "border-white/20 bg-white/10 text-white"
                    }`}
                    style={
                      isSelected ? { backgroundColor: accent } : undefined
                    }
                  >
                    {isSelected ? "Selected" : "Select Option"}
                  </span>
                  <button
                    type="button"
                    tabIndex={isExpanded ? 0 : -1}
                    className="text-xs font-semibold text-[#F6A724] underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenStory(option.id);
                    }}
                  >
                    Know More →
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Motivation (step 3) — literal transposition of TravelStyleAccordion
 * (step 1), rotated 90°: flex-COLUMN container with the same fixed
 * height classes, rows `flex-[5]` expanded vs `flex-[1]` collapsed
 * horizontal strips, same `transition-all duration-700`. Total stack
 * height stays fixed — expanding one row squeezes the others.
 * Collapsed strip shows ONLY the horizontal title (transposed from
 * step 1's rotated strip label); expanded row is step 1's expanded
 * face minus photo: eyebrow only if data has one (motivations have
 * none), title, description, Selected/Select pill + Know More.
 *
 * `tripMotivation` is single-select (`MotivationId | null`), so
 * expanded === selected. Unlike step 1 there is NO visual default:
 * with nothing stored every row is an equal `flex-[1]` strip and
 * Continue keeps gating on `stepError(3)`. Clicking the expanded row
 * keeps it selected/expanded (never null).
 *
 * NO PHOTO: no artwork, image, or svgUrl is rendered in these rows.
 * Selection is WHITE (border / icon / text / pill) with a blue
 * `#054F70` top-center GoldLight spotlight for every row (local
 * override; CHOICE_SPOTLIGHT is not used or edited here).
 */
function MotivationAccordion({
  options,
  selected,
  onSelect,
  onOpenStory,
  resolveCopy,
}: {
  options: readonly {
    id: string;
    title: string;
    eyebrow?: string;
    description: string;
  }[];
  selected: string | null;
  onSelect: (id: string) => void;
  onOpenStory: (id: string) => void;
  resolveCopy?: (id: string) => StoryExplanation | null;
}) {
  // Step 3 only: uniform white selection + blue top-center spotlight.
  const MOTIVATION_SPOTLIGHT_COLOR = "#054F70";
  const MOTIVATION_SPOTLIGHT_PLACEMENT: GoldLightPlacement = "top-center";
  // Transposed accent (step 1's per-style accent, here always white).
  const accent = "#FFFFFF";
  const accentRgb = "255,255,255";

  return (
    <div
      className="mx-auto flex h-[52dvh] max-h-[560px] min-h-[26rem] w-full flex-col gap-2 sm:min-h-[30rem] sm:gap-3"
      data-motivation-accordion=""
      role="group"
      aria-label="Motivation"
    >
      {options.map((option) => {
        const isSelected = selected === option.id;
        const isExpanded = isSelected;
        const story = resolveCopy?.(option.id);
        const title = story?.title || option.title;
        const description = option.description;
        const sticker = CHOICE_STICKER[option.id];
        const StickerIcon = sticker?.Icon;

        // Collapsed tap selects + expands; expanded tap keeps selection.
        const handleActivate = () => {
          if (!isSelected) onSelect(option.id);
        };

        return (
          <div
            key={option.id}
            data-motivation-panel={option.id}
            data-motivation-option={option.id}
            data-expanded={isExpanded ? "true" : "false"}
            data-selected={isSelected ? "true" : "false"}
            role="button"
            tabIndex={0}
            aria-label={`Select ${title}`}
            aria-expanded={isExpanded}
            aria-pressed={isSelected}
            onClick={handleActivate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleActivate();
              }
            }}
            className={`group relative min-h-0 cursor-pointer overflow-hidden rounded-2xl border bg-[#0A1017] text-left shadow-[0_18px_44px_rgba(0,0,0,0.55)] transition-all duration-700 ease-in-out ${
              isExpanded
                ? "flex-[5] opacity-100"
                : "flex-[1] border-white/10 opacity-60 hover:border-white/25 hover:opacity-90"
            }`}
            style={
              isExpanded
                ? {
                    borderColor: accent,
                    boxShadow: `0 18px 44px rgba(0,0,0,0.55), 0 0 25px rgba(${accentRgb},0.35)`,
                  }
                : undefined
            }
          >
            {/* No artwork/photo — plain dark gradient face (step 1 minus photo) */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: isExpanded
                  ? `linear-gradient(to top, rgba(${accentRgb},0.16), rgba(${accentRgb},0.05) 45%, transparent 75%)`
                  : `linear-gradient(to top, rgba(${accentRgb},0.06), rgba(${accentRgb},0.02) 45%, transparent 75%)`,
              }}
            />
            <div
              aria-hidden
              className={`absolute inset-0 bg-gradient-to-t ${
                isExpanded
                  ? "from-black/85 via-black/25 to-black/10"
                  : "from-black/30 via-black/5 to-transparent"
              }`}
            />

            <GoldLight
              color={MOTIVATION_SPOTLIGHT_COLOR}
              placement={MOTIVATION_SPOTLIGHT_PLACEMENT}
              active={isExpanded}
              className="!z-[1]"
            />

            {/* Collapsed label — horizontal title, centered like step 1's strip */}
            <div
              aria-hidden={isExpanded}
              className={`absolute inset-0 z-20 flex items-center justify-center px-4 transition-opacity duration-300 ${
                isExpanded ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <span className="block max-w-full truncate text-center text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap text-white uppercase drop-shadow-lg">
                {title}
              </span>
            </div>

            {/* Expanded face — fades in with a delay, like step 1 (no photo) */}
            <div
              aria-hidden={!isExpanded}
              className={`absolute inset-0 z-20 transition-opacity duration-500 delay-200 ${
                isExpanded ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {option.eyebrow ? (
                <div className="absolute top-4 left-4 max-w-[80%]">
                  <span
                    className="block max-w-full truncate rounded-full border bg-[#060A0F]/80 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] whitespace-nowrap uppercase backdrop-blur-md"
                    style={{
                      borderColor: `rgba(${accentRgb},0.45)`,
                      color: accent,
                    }}
                  >
                    {option.eyebrow}
                  </span>
                </div>
              ) : null}
              {StickerIcon ? (
                <span
                  aria-hidden
                  className="absolute top-4 right-4 shrink-0 text-white"
                >
                  <StickerIcon className="h-6 w-6" strokeWidth={1.75} />
                </span>
              ) : null}
              <div className="absolute right-0 bottom-0 left-0 p-4 sm:p-6">
                <h3 className="font-godiva text-xl leading-tight font-black tracking-tight text-white uppercase drop-shadow-2xl sm:text-3xl">
                  {title}
                </h3>
                <p
                  data-motivation-description={option.id}
                  className="mt-2 line-clamp-4 max-w-md text-xs leading-relaxed font-light text-zinc-200 drop-shadow-lg sm:text-sm"
                >
                  {description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-block rounded-full border px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase backdrop-blur-md ${
                      isSelected
                        ? "border-transparent bg-white text-[#060A0F]"
                        : "border-white/20 bg-white/10 text-white"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select Option"}
                  </span>
                  <button
                    type="button"
                    tabIndex={isExpanded ? 0 : -1}
                    className="text-xs font-semibold text-[#F6A724] underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenStory(option.id);
                    }}
                  >
                    Know More →
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InterestIcon({ id, className }: { id: string; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (id === "culture_heritage") {
    // Temple / shrine gate
    return (
      <svg {...common}>
        <path d="m12 3 9 5H3l9-5Z" />
        <path d="M5 21v-9" />
        <path d="M9.5 21v-9" />
        <path d="M14.5 21v-9" />
        <path d="M19 21v-9" />
        <path d="M3 21h18" />
      </svg>
    );
  }
  if (id === "food_culinary") {
    return (
      <svg {...common}>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </svg>
    );
  }
  if (id === "modern_pop") {
    return (
      <svg {...common}>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
      </svg>
    );
  }
  // nature_day_trips (and fallback): mountain
  return (
    <svg {...common}>
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}

/**
 * Interests (step 2) — fixed 2x2 grid of perfect squares (multi-select).
 *
 * Selection is the only state: `draft.interests` is the single source of
 * truth, so there is no local expanded/active state to desync and nothing
 * expands. Tiles never resize — tapping only highlights the tile, lights
 * the status dot, and fades the description in inside the square.
 * Continue gating is unchanged — `stepError(2)` requires
 * `interests.length >= 1` ("Pick at least one interest.").
 * Copy mirrors the previous Step-2 code: titles resolve via
 * resolvePreEliteStory (branding/local quiz overrides), descriptions
 * come from INTERESTS. Each tile's play info button opens the shared
 * story modal via onOpenStory — without toggling the tile. The tile
 * itself is a div with button semantics so the info <button> is never
 * nested inside another <button> (invalid HTML).
 */
/**
 * Shared square-tile grid — Step 2 (Interests) structure, reused by
 * Step 4 (What to avoid). Fixed 2-col perfect squares, no layout shift:
 * selection only highlights (white), lights the dot, lights the blue
 * top-center spotlight, and fades the description in inside the tile.
 * The tile is a div with button semantics so the nested play <button>
 * (opens the story modal without toggling) is never button-in-button.
 * `dataPrefix` preserves Step 2's data-interest-* hooks verbatim.
 */
function SquareChoiceGrid({
  options,
  selected,
  onSelect,
  onOpenStory,
  resolveCopy,
  ariaLabel,
  dataPrefix,
  renderIcon,
}: {
  options: readonly {
    id: string;
    title: string;
    eyebrow?: string;
    description: string;
    svgUrl?: string;
  }[];
  selected: readonly string[];
  onSelect: (id: string) => void;
  onOpenStory: (id: string) => void;
  resolveCopy?: (id: string) => StoryExplanation | null;
  ariaLabel: string;
  dataPrefix: string;
  renderIcon: (id: string) => ReactNode;
}) {
  // Uniform white selection + blue top-center spotlight for every tile
  // (overrides CHOICE_SPOTLIGHT locally; other steps keep theirs).
  const SQUARE_SPOTLIGHT_COLOR = "#054F70";
  const SQUARE_SPOTLIGHT_PLACEMENT: GoldLightPlacement = "top-center";
  const SQUARE_SELECTED_COLOR = "#FFFFFF";
  const gridData = { [`data-${dataPrefix}-grid`]: "" };

  return (
    <div
      className="mx-auto grid w-full grid-cols-2 gap-4 sm:max-w-[min(520px,calc(100dvh_-_23.25rem))]"
      {...gridData}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isSelected = selected.includes(option.id);
        const story = resolveCopy?.(option.id);
        const title = story?.title || option.title;
        const description = option.description;
        const panelData = { [`data-${dataPrefix}-panel`]: option.id };
        const infoData = { [`data-${dataPrefix}-info`]: option.id };
        const descriptionData = {
          [`data-${dataPrefix}-description`]: option.id,
        };

        return (
          <div
            key={option.id}
            role="button"
            tabIndex={0}
            {...panelData}
            data-active={isSelected ? "true" : "false"}
            data-selected={isSelected ? "true" : "false"}
            aria-label={`Select ${title}`}
            aria-pressed={isSelected}
            onClick={() => onSelect(option.id)}
            onKeyDown={(e) => {
              // Only the tile itself toggles — keys from the nested
              // info button must open the pop-up, never select.
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(option.id);
              }
            }}
            className={`group relative flex aspect-square w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              isSelected
                ? ""
                : "border-white/5 bg-[#0B1015] hover:border-white/15"
            }`}
            style={
              isSelected
                ? {
                    borderColor: "rgba(255,255,255,0.5)",
                    background:
                      "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 45%, #060A0F 100%)",
                    boxShadow: "0 0 25px rgba(255,255,255,0.12)",
                  }
                : undefined
            }
          >
            <GoldLight
              color={SQUARE_SPOTLIGHT_COLOR}
              placement={SQUARE_SPOTLIGHT_PLACEMENT}
              active={isSelected}
              className="!z-[1]"
            />

            <span className="relative z-10 flex w-full items-start justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="shrink-0 transition-colors duration-300"
                  style={{
                    color: isSelected ? SQUARE_SELECTED_COLOR : "#6B7280",
                  }}
                >
                  {renderIcon(option.id)}
                </span>
                <button
                  type="button"
                  {...infoData}
                  data-info={option.id}
                  aria-label={`About ${title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenStory(option.id);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/5 text-white/80 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <Play className="h-3 w-3 fill-current" aria-hidden />
                </button>
              </span>
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor: isSelected
                    ? SQUARE_SELECTED_COLOR
                    : "#374151",
                }}
              />
            </span>

            <span className="relative z-10 block w-full">
              <AnimatePresence initial={false}>
                {isSelected ? (
                  <motion.span
                    key="description"
                    {...descriptionData}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="block overflow-hidden"
                  >
                    <span className="mb-2 block text-[10px] leading-snug text-gray-300 md:text-xs">
                      {description}
                    </span>
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <span
                className={`block text-xs leading-tight font-bold tracking-widest uppercase md:text-sm ${
                  isSelected ? "text-white" : "text-gray-400"
                }`}
              >
                {title}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

type SquareGridProps = {
  options: readonly {
    id: string;
    title: string;
    eyebrow?: string;
    description: string;
    svgUrl?: string;
  }[];
  selected: readonly string[];
  onSelect: (id: string) => void;
  onOpenStory: (id: string) => void;
  resolveCopy?: (id: string) => StoryExplanation | null;
};

function InterestsGrid(props: SquareGridProps) {
  return (
    <SquareChoiceGrid
      {...props}
      ariaLabel="Interests"
      dataPrefix="interest"
      renderIcon={(id) => <InterestIcon id={id} className="h-6 w-6" />}
    />
  );
}

/**
 * What to avoid (step 4) — exact structural copy of Step 2's grid via
 * SquareChoiceGrid. Multi-select (`painPoints` / togglePainPoint);
 * Continue/Finish gating unchanged — `stepError(4)` requires
 * `painPoints.length >= 1` ("Pick at least one concern."). Icons reuse
 * the Lucide icons ChoiceList used for these options (CHOICE_STICKER),
 * recolored gray → white only (no per-option colors).
 */
function PainPointsGrid(props: SquareGridProps) {
  return (
    <SquareChoiceGrid
      {...props}
      ariaLabel="What to avoid"
      dataPrefix="pain-point"
      renderIcon={(id) => {
        const Icon = CHOICE_STICKER[id]?.Icon;
        return Icon ? (
          <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        ) : (
          <InterestIcon id={id} className="h-6 w-6" />
        );
      }}
    />
  );
}

