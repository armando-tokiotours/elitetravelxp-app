"use client";

import { useEffect } from "react";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { plainBrandingText } from "@/lib/brandingUi";

function parseBullets(raw: string): string[] {
  return plainBrandingText(raw)
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/^[\s•\-\d.]+/, "")
        .trim()
    )
    .filter((line) => line.length > 0);
}

/** Compact “TOKIOTOURS Difference” banner for Builder / Budget surfaces. */
export function EliteValuePropositionBanner({
  tone = "dark",
  compact = false,
}: {
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const items = useSiteBrandingStore((s) => s.itemsByKey);
  const vp = useSiteBrandingStore((s) => s.getValueProposition)();
  void items;

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const bullets = parseBullets(vp.description);
  const whyTitle = vp.inclusionTitle || "Why Book an Elite Specialist?";
  const whyBody = plainBrandingText(vp.inclusionBody);

  const shell =
    tone === "dark"
      ? "border-zinc-800 bg-zinc-950/80 text-white"
      : "border-[#E8E2D9] bg-[#FBF8F2] text-[#0B1F3A]";
  const muted = tone === "dark" ? "text-zinc-400" : "text-[#5C6570]";
  const accent = tone === "dark" ? "text-accent-500" : "text-[#075473]";

  return (
    <aside
      className={`overflow-hidden rounded-2xl border ${shell} ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.2em] ${accent}`}
      >
        {vp.title || "The TOKIOTOURS Difference"}
      </p>
      <h3
        className={`mt-1 font-display ${
          compact ? "text-lg" : "text-xl sm:text-2xl"
        } leading-snug`}
      >
        {vp.subtitle || "Cultural Translation, Not Just Sightseeing"}
      </h3>

      {bullets.length > 0 ? (
        <ul className={`mt-3 space-y-2 ${compact ? "text-xs" : "text-sm"} ${muted}`}>
          {bullets.map((line, i) => {
            const colon = line.indexOf(":");
            const label = colon > 0 ? line.slice(0, colon) : null;
            const rest = colon > 0 ? line.slice(colon + 1).trim() : line;
            return (
              <li key={`vp-bullet-${i}`} className="flex gap-2">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${accent === "text-accent-500" ? "bg-accent-500" : "bg-[#075473]"}`} />
                <span>
                  {label ? (
                    <>
                      <span className="font-semibold text-inherit opacity-90">
                        {label}:
                      </span>{" "}
                      {rest}
                    </>
                  ) : (
                    rest
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {whyBody ? (
        <div
          className={`mt-3 border-t pt-3 ${
            tone === "dark" ? "border-zinc-800" : "border-[#E8E2D9]"
          }`}
        >
          <p className={`text-[10px] font-bold uppercase tracking-widest ${accent}`}>
            {whyTitle}
          </p>
          <p className={`mt-1 ${compact ? "text-xs" : "text-sm"} ${muted}`}>
            {whyBody}
          </p>
        </div>
      ) : null}
    </aside>
  );
}

/** Subtle self-guided vs Elite guided comparison for Budget Planner cards. */
export function SelfGuidedEliteCompareCallout({
  tone = "dark",
}: {
  tone?: "dark" | "light";
}) {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const items = useSiteBrandingStore((s) => s.itemsByKey);
  const vp = useSiteBrandingStore((s) => s.getValueProposition)();
  void items;

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  const selfLine =
    plainBrandingText(vp.creditTitle) ||
    "Self-Guided (Ticket Only): Photo opportunity & entry.";
  const eliteLine =
    plainBrandingText(vp.creditBody) ||
    "Elite Guided Experience: Full cultural translation, zero transit friction, and local etiquette masterclass.";

  const shell =
    tone === "dark"
      ? "border-[#075473]/40 bg-[#075473]/15 text-zinc-400"
      : "border-[#075473]/35 bg-[#075473]/8 text-[#5C6570]";

  return (
    <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[10px] leading-relaxed ${shell}`}>
      <p>{selfLine}</p>
      <p className="mt-1 font-medium text-accent-500/90">{eliteLine}</p>
    </div>
  );
}
