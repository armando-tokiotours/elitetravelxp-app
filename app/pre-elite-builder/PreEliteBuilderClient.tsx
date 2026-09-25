"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
  TRIP_TYPES,
  emptyTiming,
  normalizeTiming,
  stepError,
  type InterestId,
  type MotivationId,
  type PainPointId,
  type PreEliteTiming,
  type TravelStyleId,
  type TripType,
} from "@/lib/preEliteBuilder";
import {
  type StoryExplanation,
} from "@/lib/preEliteStories";
import {
  preEliteBrandingKey,
  readPreEliteQuizLocalCache,
  resolvePreEliteStory,
  PRE_ELITE_QUIZ_LS_KEY,
} from "@/lib/preEliteBranding";
import { StoryExplanationModal } from "@/components/pre-elite/StoryExplanationModal";
import { TimingSelector } from "@/components/pre-elite/TimingSelector";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

const STEP_TITLES = [
  "Travel style",
  "Interests",
  "Motivation",
  "What to avoid",
  "Contact & timing",
] as const;

export function PreEliteBuilderClient() {
  const router = useRouter();
  const draft = usePreBuilderStore();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeStory, setActiveStory] = useState<StoryExplanation | null>(null);
  const [localQuiz, setLocalQuiz] = useState(() =>
    typeof window !== "undefined" ? readPreEliteQuizLocalCache() : {}
  );

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
      if (e.key === PRE_ELITE_QUIZ_LS_KEY) {
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

  const step = draft.step;
  const submitted = Boolean(draft.bookingRef && draft.lastPayload);

  // Already submitted → go straight to /pre-build (no interstitial).
  useEffect(() => {
    if (!hydrated || !submitted) return;
    router.replace("/pre-build");
  }, [hydrated, submitted, router]);

  const goNext = () => {
    const message = stepError(step, draft);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    draft.setStep(Math.min(5, step + 1));
  };

  const goBack = () => {
    setError(null);
    draft.setStep(Math.max(1, step - 1));
  };

  const submit = async () => {
    const message = stepError(5, draft);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/pre-elite-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          travelStyle: draft.travelStyle,
          interests: draft.interests,
          tripMotivation: draft.tripMotivation,
          painPoints: draft.painPoints,
          tripType: draft.tripType,
          fullName: draft.fullName,
          email: draft.email,
          whatsapp: draft.whatsapp,
          timing: draft.timing,
          adults: draft.adults,
          children: draft.children,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Could not save your brief.");
      }
      draft.markSubmitted({
        bookingRef: String(data.bookingRef),
        fullName: String(data.fullName || draft.fullName).trim(),
        email: String(data.email || draft.email).trim().toLowerCase(),
        status: "draft",
        itineraryData: String(data.itineraryData || ""),
      });
      router.replace("/pre-build");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your brief.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/tokiotours-logo.png"
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="font-godiva text-sm tracking-[0.22em] text-[#D91147] uppercase">
              TOKIOTOURS
            </span>
          </Link>
          <p className="text-xs tracking-[0.18em] text-white/50 uppercase">
            Pre-Elite Builder
          </p>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl overflow-visible px-5 py-10 sm:py-14">
        {!hydrated || submitted ? (
          <div className="h-80 rounded-3xl border border-zinc-800/80 bg-[#0D1117]/80 backdrop-blur-md" />
        ) : (
          <>
            <p className="text-xs tracking-[0.22em] text-[#1CA67F] uppercase">
              Step {step} of 5
            </p>
            <h1 className="mt-3 font-display text-3xl text-white sm:text-4xl">
              {STEP_TITLES[step - 1]}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
              {step === 1 &&
                "How do you want the days to feel? This sets the comfort tier before we design anything."}
              {step === 2 &&
                "Choose every thread you want woven in. You can select more than one."}
              {step === 3 && "What is this journey actually for?"}
              {step === 4 &&
                "Tell us the friction you want us to remove. Select every concern that applies."}
              {step === 5 &&
                "Choose Multi-Day or Single-Day, then share dates and contact details. No payment yet."}
            </p>

            <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#075473] transition-all"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>

            <div
              className={`relative overflow-visible rounded-3xl border border-zinc-800/80 bg-[#0D1117]/80 p-5 backdrop-blur-md sm:p-7 ${
                step === 5 ? "mt-10 pt-12" : "mt-8"
              }`}
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
                      onOpenStory={openStory}
                    />
                  )}
                  {step === 5 && (
                    <ContactFields
                      tripType={draft.tripType}
                      fullName={draft.fullName}
                      email={draft.email}
                      whatsapp={draft.whatsapp}
                      timing={draft.timing}
                      adults={draft.adults}
                      children={draft.children}
                      onChange={(patch) => {
                        draft.setContact(patch);
                        setError(null);
                      }}
                      onTripType={(tripType) => {
                        draft.setTripType(tripType);
                        setError(null);
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {error && (
                <p className="mt-5 text-sm text-[#075473]" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-7 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 1 || submitting}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-white/70 disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                {step < 5 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-2 rounded-full bg-[#075473] px-5 py-2.5 text-sm font-medium text-white"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-full bg-[#075473] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {submitting ? "Saving…" : "Save Request →"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <StoryExplanationModal
        open={Boolean(activeStory)}
        story={activeStory}
        onClose={() => setActiveStory(null)}
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
}) {
  const isOn = (id: string) =>
    Array.isArray(selected) ? selected.includes(id) : selected === id;

  const eyebrowColor = (eyebrow: string) => {
    const key = eyebrow.trim().toLowerCase();
    if (key === "most popular") return "#1CA67F";
    if (key === "best value") return "#D9718C";
    if (key === "exclusive") return "#F29727";
    return "#D9718C";
  };

  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const on = isOn(option.id);
        const story = resolveCopy?.(option.id);
        const title = story?.title || option.title;
        const description = option.description;
        const badgeTag = option.eyebrow;
        const slide = story?.slides?.[0];
        const videoUrl = slide?.videoUrl?.trim() || "";
        /** Prefer dedicated SVG card art for instant selected-state swaps. */
        const svgUrl = option.svgUrl?.trim() || "";
        const imageFallback =
          svgUrl ||
          slide?.imageUrl?.trim() ||
          "/svg/style-premium-comfort.svg";

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            aria-label={`Preview and select ${title}`}
            onClick={() => onOpenStory(option.id)}
            className={`relative w-full min-h-[7.5rem] cursor-pointer overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
              on
                ? "scale-[1.01] border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)]"
                : "border-white/10 bg-[#0A1017] opacity-60 hover:border-white/20 hover:opacity-90"
            }`}
          >
            {/* Selected background — SVG first for crisp instant swaps; video optional */}
            {on ? (
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                {videoUrl && !svgUrl ? (
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster={imageFallback}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageFallback}
                    alt=""
                    className="h-full w-full scale-105 object-cover transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
              </div>
            ) : null}

            <div className="relative z-10 flex h-full flex-col justify-between space-y-2">
              <div className="flex items-center justify-between gap-2">
                {badgeTag ? (
                  <span
                    className={`text-[10px] font-bold tracking-widest uppercase ${
                      on ? "text-cyan-400" : ""
                    }`}
                    style={on ? undefined : { color: eyebrowColor(badgeTag) }}
                  >
                    {badgeTag}
                  </span>
                ) : (
                  <span />
                )}
                {on ? (
                  <span className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
                ) : null}
              </div>

              <div>
                <h3 className="font-godiva text-base font-bold tracking-wide text-white">
                  {title}
                </h3>
                <p
                  className={`mt-1 text-xs leading-relaxed ${
                    on ? "text-zinc-300" : "text-white/55"
                  }`}
                >
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

function ContactFields({
  tripType,
  fullName,
  email,
  whatsapp,
  timing,
  adults,
  children,
  onChange,
  onTripType,
}: {
  tripType: TripType | null;
  fullName: string;
  email: string;
  whatsapp: string;
  timing: PreEliteTiming;
  adults: number;
  children: number;
  onChange: (patch: {
    fullName?: string;
    email?: string;
    whatsapp?: string;
    timing?: PreEliteTiming;
    adults?: number;
    children?: number;
  }) => void;
  onTripType: (tripType: TripType) => void;
}) {
  const mascotSrc =
    tripType === "multi_day"
      ? "/svg/mascot-multiday.svg"
      : tripType === "single_day"
        ? "/svg/mascot-1day.svg"
        : null;

  return (
    <div className="relative overflow-visible pt-2">
      {/* Trip-type mascot — always visible (incl. mobile); pops out top-right */}
      <div className="pointer-events-none absolute -top-10 -right-1 z-30 block md:-top-14 md:-right-2">
        <AnimatePresence mode="wait">
          {mascotSrc ? (
            <motion.img
              key={tripType}
              src={mascotSrc}
              alt="Tokiotours Trip Type Mascot"
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.75, y: 4 }}
              transition={{
                opacity: { duration: 0.2 },
                scale: {
                  duration: 0.3,
                  ease: [0.34, 1.56, 0.64, 1],
                },
                y: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
              }}
              className="block h-24 w-24 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] md:h-32 md:w-32"
            />
          ) : null}
        </AnimatePresence>
      </div>

      <div className="grid gap-4">
        <Field label="Trip type" as="div">
          <div className="grid gap-2 sm:grid-cols-2">
            {TRIP_TYPES.map((option) => {
              const on = tripType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onTripType(option.id)}
                  className={`rounded-2xl px-4 py-3.5 text-left transition ${
                    on
                      ? "border-2 border-[#075473] bg-[#075473]/15"
                      : "border border-white/10 bg-black/20 hover:border-white/25"
                  }`}
                >
                  <span className="block text-sm font-medium text-white">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/55">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Full name">
          <input
            value={fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            autoComplete="name"
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => onChange({ email: e.target.value })}
            autoComplete="email"
            className={inputClass}
          />
        </Field>
        <Field label="WhatsApp number" hint="Optional">
          <input
            value={whatsapp}
            onChange={(e) => onChange({ whatsapp: e.target.value })}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+81 …"
            className={inputClass}
          />
        </Field>
        <Field
          label={
            tripType === "single_day" ? "Tour date" : "Planned dates or target month"
          }
          labelClassName="text-white"
          as="div"
        >
          <TimingSelector
            value={timing ?? emptyTiming()}
            tripType={tripType}
            onChange={(next) => onChange({ timing: normalizeTiming(next) })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adults">
            <input
              type="number"
              min={1}
              max={20}
              value={adults}
              onChange={(e) => onChange({ adults: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Children" labelClassName="text-[#DC6E8A]">
            <input
              type="number"
              min={0}
              max={20}
              value={children}
              onChange={(e) => onChange({ children: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  as = "label",
  labelClassName,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  as?: "label" | "div";
  labelClassName?: string;
}) {
  const Tag = as;
  return (
    <Tag className="block">
      <span
        className={`mb-1.5 flex items-baseline justify-between text-xs tracking-[0.14em] uppercase ${
          labelClassName ?? "text-[#1BA58A]"
        }`}
      >
        {label}
        {hint && <span className="tracking-normal text-white/35 normal-case">{hint}</span>}
      </span>
      {children}
    </Tag>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#075473]";
