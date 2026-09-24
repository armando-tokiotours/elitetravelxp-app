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
      router.push("/pre-build");
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

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        {!hydrated ? (
          <div className="h-80 rounded-3xl border border-zinc-800/80 bg-[#0D1117]/80 backdrop-blur-md" />
        ) : submitted && draft.lastPayload ? (
          <div className="rounded-3xl border border-[#075473]/40 bg-[#0D1117]/80 p-7 text-center backdrop-blur-md sm:p-10">
            <p className="text-sm text-white/60">Taking you to your brief…</p>
            <Link
              href="/pre-build"
              className="mt-4 inline-flex text-sm font-semibold text-[#F29727]"
            >
              Open Pre-Build Summary →
            </Link>
          </div>
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

            <div className="mt-8 rounded-3xl border border-zinc-800/80 bg-[#0D1117]/80 p-5 backdrop-blur-md sm:p-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
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
                    {submitting ? "Saving…" : "Submit qualification"}
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
  options: readonly { id: string; title: string; eyebrow?: string; description: string }[];
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
        const overlay = resolveCopy?.(option.id);
        const title = overlay?.title || option.title;
        const description = overlay?.subtitle || option.description;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            aria-label={`Preview and select ${title}`}
            onClick={() => onOpenStory(option.id)}
            className={`relative w-full rounded-2xl px-4 py-4 text-left transition ${
              on
                ? "border-2 border-[#075473] bg-[#0D1117]/80 shadow-lg shadow-[#075473]/10 backdrop-blur-md"
                : "border border-zinc-800/80 bg-[#0D1117]/60 backdrop-blur-md hover:border-zinc-700"
            }`}
          >
            {option.eyebrow && (
              <span
                className="text-[11px] tracking-[0.16em] uppercase"
                style={{ color: eyebrowColor(option.eyebrow) }}
              >
                {option.eyebrow}
              </span>
            )}
            <span className="mt-1 block text-base text-white">
              {title}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-white/55">
              {description}
            </span>
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
  return (
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
        label={tripType === "single_day" ? "Tour date" : "Planned dates or target month"}
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
