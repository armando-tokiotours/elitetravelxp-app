"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, X } from "lucide-react";

const DEFAULT_INCLUSIONS = [
  "Private guide / host for booked experiences",
  "Itinerary planning & live Ops coordination",
  "Quoted private transfers and tickets when selected",
  "WhatsApp / email support during your travel window",
];

const DEFAULT_EXCLUSIONS = [
  "International flights and personal travel insurance",
  "Meals, drinks, and shopping not listed as included",
  "Self-arranged local transport (taxi / subway) unless selected",
  "Entrance fees not marked included on a tour card",
];

type AccordionKey = "inclusions" | "exclusions" | "cancellation" | null;

/**
 * Final dossier block — FAQ-style accordion (Multi / Single / Builder E).
 */
export function DossierTermsFooterSection({
  className = "",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState<AccordionKey>(null);
  const [policiesOpen, setPoliciesOpen] = useState(false);

  const toggle = (key: Exclude<AccordionKey, null>) =>
    setOpen((cur) => (cur === key ? null : key));

  return (
    <>
      <section
        className={`relative mx-auto my-6 w-full max-w-2xl rounded-3xl border-2 border-dashed border-white/40 bg-black/20 p-4 print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent ${className}`}
      >
        <span className="absolute -top-3 left-4 z-20 rounded border border-white/30 bg-zinc-800 px-2 py-0.5 font-mono text-[9px] tracking-widest text-amber-400 uppercase print:border-gray-300 print:bg-white print:text-gray-900">
          Trip Terms
        </span>

        <div className="space-y-2">
          <TermsAccordionRow
            title="Inclusions"
            open={open === "inclusions"}
            onToggle={() => toggle("inclusions")}
          >
            <ul className="space-y-1.5 text-sm leading-relaxed text-zinc-300">
              {DEFAULT_INCLUSIONS.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#1BA58A]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </TermsAccordionRow>

          <TermsAccordionRow
            title="Exclusions"
            open={open === "exclusions"}
            onToggle={() => toggle("exclusions")}
          >
            <ul className="space-y-1.5 text-sm leading-relaxed text-zinc-300">
              {DEFAULT_EXCLUSIONS.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#E60F43]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </TermsAccordionRow>

          <TermsAccordionRow
            title="Cancellation policy"
            open={open === "cancellation"}
            onToggle={() => toggle("cancellation")}
          >
            <button
              type="button"
              onClick={() => setPoliciesOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F6A724] underline-offset-2 hover:underline"
            >
              Full cancellation &amp; refund policy
              <ExternalLink className="h-3 w-3" aria-hidden />
            </button>
          </TermsAccordionRow>
        </div>
      </section>

      <PoliciesPreviewModal
        open={policiesOpen}
        onClose={() => setPoliciesOpen(false)}
      />
    </>
  );
}

function TermsAccordionRow({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/90 text-white print:break-inside-avoid print:rounded-none print:border print:border-gray-300 print:bg-transparent print:text-gray-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left print:pointer-events-none"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 print:text-gray-700">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/50 transition-transform print:hidden ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-4 pb-4 pt-3">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PoliciesPreviewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="policies-preview-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0A1017] shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h2
                id="policies-preview-title"
                className="font-godiva text-lg tracking-wide text-[#F6A724] uppercase"
              >
                Terms &amp; Policies
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white transition hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-zinc-300">
              <section>
                <h3 className="mb-2 font-semibold text-[#075473]">
                  1. Cancellation &amp; Refunds
                </h3>
                <p className="mb-2">
                  All deposits are non-refundable once the itinerary is
                  confirmed. If a cancellation occurs within 30 days of the
                  travel date, a 100% cancellation fee applies to all arranged
                  private transport and local guides.
                </p>
                <p>
                  Public transport tickets (including Suica and JR Passes)
                  cannot be refunded once validated or issued by the operator.
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-semibold text-[#075473]">
                  2. Itinerary Modifications
                </h3>
                <p>
                  Changes to confirmed itineraries requested within 14 days of
                  arrival may incur administrative fees. We cannot guarantee the
                  availability of specific private chauffeurs for last-minute
                  adjustments.
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-semibold text-[#075473]">
                  3. Travel Insurance
                </h3>
                <p>
                  TokioTours highly recommends comprehensive travel insurance.
                  Guests are responsible for their own medical, trip
                  interruption, and personal property coverage.
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
