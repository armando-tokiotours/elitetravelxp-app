"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SystemMessageFox } from "@/components/branding/SystemMessageFox";
import { useBuilderStore } from "@/store/useBuilderStore";
import { canOpenBuilderStep } from "@/lib/builderSteps";
import { getSingleDayHighestUnlocked } from "@/lib/singleDaySteps";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";
import {
  dismissSystemMessage,
  showSystemMessage,
} from "@/store/useSystemMessageStore";
import { getSystemMessage } from "@/lib/systemMessages";

type AccordionCtx = {
  openSection: number | null;
  setOpenSection: (n: number | null) => void;
  toggleSection: (n: number) => void;
  /** Open a section and collapse others (used by progress bar / Continue). */
  openOnly: (n: number) => void;
  /**
   * After Save & Continue: collapse current and open `n` without re-checking
   * unlock (caller already validated + unlocked; avoids stale-context race).
   */
  advanceTo: (n: number) => void;
  /** Attempt to open; returns false when locked. */
  tryOpenSection: (n: number) => boolean;
  /** Effective unlock ceiling for this builder (M or S). */
  highestUnlockedStep: number;
  /** @deprecated Prefer showSystemMessage — kept for callers reading toast */
  toast: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
};

const BuilderAccordionContext = createContext<AccordionCtx | null>(null);

export function BuilderAccordionProvider({
  children,
  defaultOpen = null,
  unlockAll = false,
}: {
  children: ReactNode;
  /** Step number to open on mount, or null for all collapsed */
  defaultOpen?: number | null;
  /**
   * Builder S: ignore multi-day unlock and use Single-Day completion rules.
   * Does NOT mean every step is open — only steps earned by S criteria.
   */
  unlockAll?: boolean;
}) {
  const [openSection, setOpenSection] = useState<number | null>(defaultOpen);
  const multiDayUnlocked = useBuilderStore((s) => s.highestUnlockedStep);

  const tourDate = useSingleDayBuilderStore((s) => s.tourDate);
  const tourHours = useSingleDayBuilderStore((s) => s.tourHours);
  const adults = useSingleDayBuilderStore((s) => s.adults);
  const cityFocus = useSingleDayBuilderStore((s) => s.cityFocus);
  const selectedExperienceCount = useSingleDayBuilderStore(
    (s) => s.selectedExperiences.length
  );
  const experiencesStepDone = useSingleDayBuilderStore(
    (s) => s.experiencesStepDone
  );

  const singleDayUnlocked = useMemo(
    () =>
      getSingleDayHighestUnlocked({
        tourDate,
        tourHours,
        adults,
        cityFocus,
        selectedExperienceCount,
        experiencesStepDone,
      }),
    [
      tourDate,
      tourHours,
      adults,
      cityFocus,
      selectedExperienceCount,
      experiencesStepDone,
    ]
  );

  const effectiveUnlocked = unlockAll ? singleDayUnlocked : multiDayUnlocked;

  const showToast = useCallback((message: string) => {
    showSystemMessage({ text: message, tone: "error" });
  }, []);

  const clearToast = useCallback(() => dismissSystemMessage(), []);

  // If unlock clamps down, close a locked-open section
  useEffect(() => {
    setOpenSection((cur) => {
      if (cur != null && cur > effectiveUnlocked) return effectiveUnlocked;
      return cur;
    });
  }, [effectiveUnlocked]);

  const tryOpenSection = useCallback(
    (n: number) => {
      if (!canOpenBuilderStep(n, effectiveUnlocked)) {
        showToast(getSystemMessage("builder_lock"));
        return false;
      }
      setOpenSection(n);
      return true;
    },
    [effectiveUnlocked, showToast]
  );

  const toggleSection = useCallback(
    (n: number) => {
      if (!canOpenBuilderStep(n, effectiveUnlocked)) {
        showToast(getSystemMessage("builder_lock"));
        return;
      }
      setOpenSection((cur) => (cur === n ? null : n));
    },
    [effectiveUnlocked, showToast]
  );

  const openOnly = useCallback(
    (n: number) => {
      tryOpenSection(n);
    },
    [tryOpenSection]
  );

  /** Force-open next step after Save & Continue (skips stale unlock check). */
  const advanceTo = useCallback((n: number) => {
    setOpenSection(n);
  }, []);

  const value = useMemo(
    () => ({
      openSection,
      setOpenSection,
      toggleSection,
      openOnly,
      advanceTo,
      tryOpenSection,
      highestUnlockedStep: effectiveUnlocked,
      toast: null,
      showToast,
      clearToast,
    }),
    [
      openSection,
      toggleSection,
      openOnly,
      advanceTo,
      tryOpenSection,
      effectiveUnlocked,
      showToast,
      clearToast,
    ]
  );

  return (
    <BuilderAccordionContext.Provider value={value}>
      {children}
      <SystemMessageFox />
    </BuilderAccordionContext.Provider>
  );
}

export function useBuilderAccordion() {
  const ctx = useContext(BuilderAccordionContext);
  if (!ctx) {
    throw new Error(
      "useBuilderAccordion must be used within BuilderAccordionProvider"
    );
  }
  return ctx;
}

/** Safe hook when SectionBlock is rendered outside provider (falls back to always open). */
export function useBuilderAccordionOptional() {
  return useContext(BuilderAccordionContext);
}
