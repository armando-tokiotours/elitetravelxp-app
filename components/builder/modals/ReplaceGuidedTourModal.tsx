"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export type ReplaceGuidedTourSide = {
  title: string;
  durationLabel: string;
  languageLabel: string;
};

/**
 * Confirm before swapping the single guided-tour slot (Discover / Builder S).
 * Yes → replace; No → cancel and leave Discover.
 */
export function ReplaceGuidedTourModal({
  open,
  current,
  next,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  current: ReplaceGuidedTourSide;
  next: ReplaceGuidedTourSide;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="replace-guided-tour-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#111A24] p-5 text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="replace-guided-tour-title"
          className="font-godiva text-lg font-bold uppercase tracking-wide text-white"
        >
          Change guided tour?
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Do you want to change the current tour{" "}
          <span className="font-semibold text-white">{current.title}</span>
          {current.durationLabel || current.languageLabel ? (
            <span className="text-white/55">
              {" "}
              (
              {[current.durationLabel, current.languageLabel]
                .filter(Boolean)
                .join(" · ")}
              )
            </span>
          ) : null}{" "}
          for <span className="font-semibold text-white">{next.title}</span>
          {next.durationLabel || next.languageLabel ? (
            <span className="text-white/55">
              {" "}
              (
              {[next.durationLabel, next.languageLabel]
                .filter(Boolean)
                .join(" · ")}
              )
            </span>
          ) : null}
          ?
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white/85 transition active:scale-[0.99]"
          >
            No
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-2xl bg-[#075473] py-3 text-sm font-bold text-white transition hover:bg-[#0A6C93] active:scale-[0.99]"
          >
            Yes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
