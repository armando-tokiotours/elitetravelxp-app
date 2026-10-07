"use client";

import type { ReactNode } from "react";

/**
 * Mobile guest Invoice Brief / dossier — strict 3-independent-box architecture.
 *
 * Renders ONLY three sibling bordered containers (md:hidden):
 *  1. Trip details (flat divide-y rows)
 *  2. Invoice highlight (caller supplies InvoiceBriefEstimateBox)
 *  3. Itemized services & totals (caller supplies FlatInvoiceBrief — no outer wrap)
 *
 * Zero nested cards. Desktop composition stays with the parent.
 * Print: ink-friendly white paper; invoice ordered last in the PDF stack.
 */
export function MobileDossierLayout({
  tripDetails,
  estimate,
  itemized,
  onChatClick,
  className = "",
}: {
  /** Flat InvoiceMetaRow children (no bordered wrapper). */
  tripDetails: ReactNode;
  /** Box 2 — InvoiceBriefEstimateBox (gold highlight). */
  estimate: ReactNode;
  /** Box 3 — FlatInvoiceBrief itself (already bordered). */
  itemized: ReactNode;
  /** Optional floating chat — omit when no real chat CTA exists on this surface. */
  onChatClick?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col space-y-6 print:flex print:space-y-4 print:bg-white print:text-black md:hidden ${className}`.trim()}
    >
      {/* BOX 1 — Trip details */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0A1017] print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent print:shadow-none">
        <div className="divide-y divide-white/10 px-5 print:divide-gray-200">
          {tripDetails}
        </div>
        {onChatClick ? (
          <button
            type="button"
            onClick={onChatClick}
            aria-label="Open chat"
            className="absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#075473] text-white shadow-lg print:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.082-3.246A7.97 7.97 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </button>
        ) : null}
      </section>

      {/* BOX 2 — Invoice highlight (sibling, not nested) */}
      <div className="print:break-inside-avoid">{estimate}</div>

      {/* BOX 3 — Itemized + totals (FlatInvoiceBrief is the sole parent card) */}
      <div className="print:order-last print:break-inside-avoid">{itemized}</div>
    </div>
  );
}
