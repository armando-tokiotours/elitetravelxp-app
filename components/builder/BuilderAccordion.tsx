"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AccordionCtx = {
  openSection: number | null;
  setOpenSection: (n: number | null) => void;
  toggleSection: (n: number) => void;
  /** Open a section and collapse others (used by progress bar). */
  openOnly: (n: number) => void;
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

  const toggleSection = useCallback((n: number) => {
    setOpenSection((cur) => (cur === n ? null : n));
  }, []);

  const openOnly = useCallback((n: number) => {
    setOpenSection(n);
  }, []);

  const value = useMemo(
    () => ({ openSection, setOpenSection, toggleSection, openOnly }),
    [openSection, toggleSection, openOnly]
  );

  return (
    <BuilderAccordionContext.Provider value={value}>
      {children}
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
