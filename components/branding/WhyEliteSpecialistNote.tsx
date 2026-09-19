"use client";

import { useEffect } from "react";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { plainBrandingText } from "@/lib/brandingUi";
import { SelfGuidedEliteCompareCallout } from "@/components/branding/EliteValueProposition";

/** Compact “Why Book an Elite Specialist?” strip for experience detail panels. */
export function WhyEliteSpecialistNote({
  showCompare = false,
}: {
  showCompare?: boolean;
}) {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const items = useSiteBrandingStore((s) => s.itemsByKey);
  const vp = useSiteBrandingStore((s) => s.getValueProposition)();
  void items;

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const title = vp.inclusionTitle || "Why Book an Elite Specialist?";
  const body =
    plainBrandingText(vp.inclusionBody) ||
    "Logistics mastery, culture-to-culture translation, and exclusive access.";

  return (
    <>
      <div className="mt-3 rounded-xl border border-[#E8E2D9] bg-[#FBF8F2] px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#B85304]">
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[#5C6570]">{body}</p>
      </div>
      {showCompare ? <SelfGuidedEliteCompareCallout tone="light" /> : null}
    </>
  );
}
