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
import { useBuilderStore } from "@/store/useBuilderStore";
import { canOpenBuilderStep } from "@/lib/builderSteps";

type AccordionCtx = {
  openSection: number | null;
  setOpenSection: (n: number | null) => void;
  toggleSection: (n: number) => void;
  /** Open a section and collapse others (used by progress bar / Continue). */
  openOnly: (n: number) => void;
  /** Attempt to open; returns false when locked. */
  tryOpenSection: (n: number) => boolean;
  toast: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
};

const BuilderAccordionContext = createContext<AccordionCtx | null>(null);

export function BuilderAccordionProvider({
  children,
  defaultOpen = 1,
}: {
  children: ReactNode;
  defaultOpen?: number;
}) {
  const [openSection, setOpenSection] = useState<number | null>(defaultOpen);
  const [toast, setToast] = useState<string | null>(null);
  const highestUnlockedStep = useBuilderStore((s) => s.highestUnlockedStep);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);

  // If unlock clamps down, close a locked-open section
  useEffect(() => {
    setOpenSection((cur) => {
      if (cur != null && cur > highestUnlockedStep) return highestUnlockedStep;
      return cur;
    });
  }, [highestUnlockedStep]);

  const tryOpenSection = useCallback(
    (n: number) => {
      if (!canOpenBuilderStep(n, highestUnlockedStep)) {
        showToast("Complete the previous steps before unlocking this section.");
        return false;
      }
      setOpenSection(n);
      return true;
    },
    [highestUnlockedStep, showToast]
  );

  const toggleSection = useCallback(
    (n: number) => {
      if (!canOpenBuilderStep(n, highestUnlockedStep)) {
        showToast("Complete the previous steps before unlocking this section.");
        return;
      }
      setOpenSection((cur) => (cur === n ? null : n));
    },
    [highestUnlockedStep, showToast]
  );

  const openOnly = useCallback(
    (n: number) => {
      tryOpenSection(n);
    },
    [tryOpenSection]
  );

  const value = useMemo(
    () => ({
      openSection,
      setOpenSection,
      toggleSection,
      openOnly,
      tryOpenSection,
      toast,
      showToast,
      clearToast,
    }),
    [
      openSection,
      toggleSection,
      openOnly,
      tryOpenSection,
      toast,
      showToast,
      clearToast,
    ]
  );

  return (
    <BuilderAccordionContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="status"
          className="fixed bottom-[7.5rem] left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-[#B85304]/50 bg-[#1a1510] px-4 py-3 text-center text-sm text-[#F3D9C4] shadow-lg md:bottom-28"
        >
          ⚠️ {toast}
        </div>
      ) : null}
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
