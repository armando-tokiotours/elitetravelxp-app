"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
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

const FALLBACK_BULLETS = [
  "Seamless Logistics: Zero language barriers, no local rule confusion, and VIP crowd navigation.",
  "Cultural Translator: Move beyond Wikipedia facts—understand the deep history, unwritten etiquette, and hidden stories.",
  "Time & Comfort Optimization: Skip queues, avoid travel friction, and experience Japan at your preferred rhythm.",
];

/**
 * Centered “Elite Travel Difference” explainer — opened from Tailored Experiences.
 */
export function EliteDifferenceModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional — e.g. select Tailored pathway after confirm */
  onConfirm?: () => void;
}) {
  const ensureLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const items = useSiteBrandingStore((s) => s.itemsByKey);
  const vp = useSiteBrandingStore((s) => s.getValueProposition)();
  void items;

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const bullets = parseBullets(vp.description);
  const lines = bullets.length > 0 ? bullets : FALLBACK_BULLETS;
  const whyTitle = vp.inclusionTitle || "Why Book an Elite Specialist?";
  const whyBody =
    plainBrandingText(vp.inclusionBody) ||
    "Logistics mastery, culture-to-culture translation, and exclusive access — so you experience Japan without friction, guesswork, or tourist-trap detours.";

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="The Elite Travel Difference"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[#B85304]/40 bg-[#121212] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-zinc-400 transition hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-[10px] font-bold uppercase tracking-wider text-[#B85304]">
          {vp.title || "The Elite Travel Difference"}
        </p>
        <h3 className="mb-3 mt-1 font-display text-xl font-extrabold text-white">
          {vp.subtitle || "Cultural Translation, Not Just Sightseeing"}
        </h3>

        <ul className="space-y-2.5 text-sm text-zinc-400">
          {lines.map((line, i) => {
            const colon = line.indexOf(":");
            const label = colon > 0 ? line.slice(0, colon) : null;
            const rest = colon > 0 ? line.slice(colon + 1).trim() : line;
            return (
              <li key={`elite-diff-${i}`} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#B85304]" />
                <span>
                  {label ? (
                    <>
                      <span className="font-semibold text-zinc-200">
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

        {whyBody ? (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#B85304]">
              {whyTitle}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
              {whyBody}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleConfirm}
          className="mt-5 w-full rounded-xl bg-[#1E2D4A] py-2.5 text-xs font-bold text-white transition hover:bg-[#0A4074]"
        >
          I Understand →
        </button>
      </div>
    </div>,
    document.body
  );
}
