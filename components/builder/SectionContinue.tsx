"use client";

import { useBuilderAccordionOptional } from "./BuilderAccordion";

/** Advances accordion to the next section (auto-collapses current). */
export function SectionContinue({
  next,
  label = "Continue",
}: {
  next: number;
  label?: string;
}) {
  const accordion = useBuilderAccordionOptional();
  if (!accordion) return null;

  return (
    <div className="mt-5 flex justify-end">
      <button
        type="button"
        onClick={() => {
          accordion.openOnly(next);
          const id = [
            "",
            "section-duration",
            "section-arrival",
            "section-hotels",
            "section-locations",
            "section-tours",
          ][next];
          if (id) {
            requestAnimationFrame(() => {
              document
                .getElementById(id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
          }
        }}
        className="rounded-full bg-[#0B1F3A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#143052]"
      >
        {label} →
      </button>
    </div>
  );
}
