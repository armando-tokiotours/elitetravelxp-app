"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Sparkles, X } from "lucide-react";
import {
  createExperienceProfile,
  experienceToUserTravelProfile,
  PACE_SUMMARY_LABEL,
  type ExperienceProfile,
  type ProfilerCrowdStyle,
  type ProfilerPace,
  type ProfilerVibe,
  type QuizStepId,
} from "@/lib/experienceProfiler";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { useQuizStore } from "@/store/useQuizStore";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";

const STEPS: QuizStepId[] = ["vibe", "pace", "crowd"];

export function ExperienceProfilerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const setExperienceProfile = useBuilderStore((s) => s.setExperienceProfile);
  const setTravelPace = useBuilderStore((s) => s.setTravelPace);
  const setUserProfile = useItineraryStore((s) => s.setUserProfile);
  const clearUserProfile = useItineraryStore((s) => s.clearUserProfile);
  const isQuizCompleted = useQuizStore((s) => s.isQuizCompleted);
  const savedProfile = useQuizStore((s) => s.travelProfile);
  const completeQuiz = useQuizStore((s) => s.completeQuiz);
  const clearQuiz = useQuizStore((s) => s.clearQuiz);
  const ensureBrandingLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const quizVibe = useSiteBrandingStore((s) => s.getQuizVibe)();
  const quizPace = useSiteBrandingStore((s) => s.getQuizPace)();
  const quizCrowd = useSiteBrandingStore((s) => s.getQuizCrowd)();
  void brandingItems;

  const [mounted, setMounted] = useState(false);
  /** -1 = intro / take quiz screen; 0–2 = questions; 3 = summary */
  const [step, setStep] = useState(-1);
  const [vibe, setVibe] = useState<ProfilerVibe | null>(null);
  const [pace, setPace] = useState<ProfilerPace | null>(null);
  const [crowd, setCrowd] = useState<ProfilerCrowdStyle | null>(null);
  /** Draft summary — not persisted until Apply */
  const [draft, setDraft] = useState<ExperienceProfile | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void ensureBrandingLoaded();
    // Only hydrate completed Match Quiz answers — never Pre-Elite leftovers
    if (isQuizCompleted && savedProfile) {
      setVibe(savedProfile.vibe);
      setPace(savedProfile.pace);
      setCrowd(savedProfile.crowdStyle);
      setDraft(savedProfile);
      setStep(3);
    } else {
      setVibe(null);
      setPace(null);
      setCrowd(null);
      setDraft(null);
      setStep(-1);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isQuizCompleted, savedProfile, ensureBrandingLoaded]);

  if (!mounted) return null;

  const showingIntro = step < 0 && !draft;
  const showingSummary = step >= 3 && draft;
  const stepId = STEPS[Math.min(Math.max(step, 0), 2)];
  const progress = showingIntro
    ? 0
    : ((showingSummary ? 4 : step + 1) / 4) * 100;

  const selectVibe = (id: ProfilerVibe) => {
    setVibe(id);
    setStep(1);
  };
  const selectPace = (id: ProfilerPace) => {
    setPace(id);
    setStep(2);
  };
  const selectCrowd = (id: ProfilerCrowdStyle) => {
    setCrowd(id);
    if (!vibe || !pace) return;
    setDraft(createExperienceProfile(vibe, pace, id));
    setStep(3);
  };

  const applyProfile = () => {
    if (!draft) return;
    completeQuiz(draft);
    setExperienceProfile(draft);
    setUserProfile(experienceToUserTravelProfile(draft));
    setTravelPace(
      draft.pace === "relaxed"
        ? "relaxed"
        : draft.pace === "active"
          ? "fast"
          : "moderate"
    );
    onClose();
  };

  const retake = () => {
    clearQuiz();
    setExperienceProfile(null);
    clearUserProfile();
    setDraft(null);
    setStep(-1);
    setVibe(null);
    setPace(null);
    setCrowd(null);
  };

  const startFresh = () => {
    setDraft(null);
    setVibe(null);
    setPace(null);
    setCrowd(null);
    setStep(0);
  };

  const vibeLabel =
    quizVibe.find((o) => o.id === (draft?.vibe ?? vibe))?.label ?? "—";
  const paceLabel = draft
    ? PACE_SUMMARY_LABEL[draft.pace]
    : pace
      ? PACE_SUMMARY_LABEL[pace]
      : "—";
  const crowdLabel =
    quizCrowd.find((o) => o.id === (draft?.crowdStyle ?? crowd))?.label ??
    "—";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="experience-profiler"
          className="tokio-modal-backdrop fixed inset-0 z-[110] flex items-end justify-center bg-[#05080C]/55 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Experience Profiler Quiz"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            className="tokio-modal-content relative z-[1] flex max-h-[min(92dvh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 sm:rounded-3xl"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              {step > 0 && !showingSummary && !showingIntro ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-white"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DC6E8A]/15 text-[#DC6E8A]">
                  <Sparkles className="h-4 w-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#E60F43]">
                  30-Second Style Quiz
                </p>
                <h2 className="truncate text-base font-bold text-white">
                  Experience Profiler
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-1 w-full bg-zinc-900">
              <div
                className="h-full bg-[#075473] transition-all duration-300"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {showingIntro ? (
                <div className="flex flex-col items-center gap-5 py-6 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#DC6E8A]/15 text-[#DC6E8A]">
                    <Sparkles className="h-7 w-7" />
                  </span>
                  <div>
                    <h3 className="font-godiva text-xl uppercase tracking-wider text-white">
                      Take 30-Second Match Quiz
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      No profile yet. Answer three quick questions to unlock
                      ★ Match badges — nothing is pre-selected.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startFresh}
                    className="w-full rounded-full bg-[#DC6E8A] py-3.5 text-sm font-semibold text-white ring-1 ring-[#DC6E8A]/40 transition hover:bg-[#D9718C]"
                  >
                    Start fresh →
                  </button>
                </div>
              ) : showingSummary && draft ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display text-xl text-white">
                      ✨ Your Travel Profile Match
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Step 4 of 4 · Review before applying
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <SummaryRow label="Vibe" value={vibeLabel} />
                    <SummaryRow label="Pace" value={paceLabel} />
                    <SummaryRow label="Access Style" value={crowdLabel} />
                  </div>

                  <div className="rounded-2xl border border-[#075473]/35 bg-[#075473]/10 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1BA58A]">
                      Your Travel Profile
                    </p>
                    <p className="mt-2 font-mono text-[0.8625rem] text-[#F6A724]">
                      {draft.userProfileTag}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                      We&apos;ve customized your experience suggestions based on
                      your profile!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={applyProfile}
                    className="w-full rounded-full bg-[#DC6E8A] py-3 text-sm font-semibold text-white ring-1 ring-[#DC6E8A]/40 transition hover:bg-[#D9718C]"
                  >
                    Apply Profile &amp; View Matches
                  </button>
                  <button
                    type="button"
                    onClick={retake}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-700 py-2.5 text-sm text-zinc-300 hover:text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Retake / Edit Quiz
                  </button>
                </div>
              ) : (
                <>
                  <p className="mb-1 text-base font-semibold text-white">
                    {stepId === "vibe"
                      ? "What is your travel style?"
                      : stepId === "pace"
                        ? "What pace do you prefer?"
                        : "How do you like to explore?"}
                  </p>
                  <p className="mb-4 text-xs text-zinc-500">
                    3-tag matcher · Step {step + 1} of {STEPS.length}
                  </p>
                  <div className="space-y-2.5">
                    {stepId === "vibe"
                      ? quizVibe.map((opt) => (
                          <QuizChoice
                            key={opt.id}
                            label={opt.label}
                            hint={opt.hint}
                            selected={vibe === opt.id}
                            onClick={() => selectVibe(opt.id)}
                          />
                        ))
                      : null}
                    {stepId === "pace"
                      ? quizPace.map((opt) => (
                          <QuizChoice
                            key={opt.id}
                            label={opt.label}
                            hint={opt.hint}
                            selected={pace === opt.id}
                            onClick={() => selectPace(opt.id)}
                          />
                        ))
                      : null}
                    {stepId === "crowd"
                      ? quizCrowd.map((opt) => (
                          <QuizChoice
                            key={opt.id}
                            label={opt.label}
                            hint={opt.hint}
                            selected={crowd === opt.id}
                            onClick={() => selectCrowd(opt.id)}
                          />
                        ))
                      : null}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function QuizChoice({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-2xl border px-4 py-3.5 text-left transition ${
        selected
          ? "border-[#075473] bg-[#075473]/12"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
      }`}
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>
    </button>
  );
}
