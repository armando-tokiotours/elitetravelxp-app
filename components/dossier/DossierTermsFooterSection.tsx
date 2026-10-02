"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

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

/**
 * Final dossier block — same dashed shell as Coordination Team.
 * Shown at the end of Multi / Single / Builder E itineraries.
 */
export function DossierTermsFooterSection({
  className = "",
}: {
  className?: string;
}) {
  return (
    <section
      className={`relative mx-auto my-6 w-full max-w-2xl rounded-3xl border-2 border-dashed border-white/40 bg-black/20 p-4 ${className}`}
    >
      <span className="absolute -top-3 left-4 z-20 rounded border border-white/30 bg-zinc-800 px-2 py-0.5 font-mono text-[9px] tracking-widest text-amber-400 uppercase">
        Trip Terms
      </span>

      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            Inclusions
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-300">
            {DEFAULT_INCLUSIONS.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#1BA58A]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            Exclusions
          </p>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-300">
            {DEFAULT_EXCLUSIONS.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#E60F43]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/90 p-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            Cancellation policy
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            Deposits are non-refundable once the itinerary is confirmed. Within
            30 days of travel, a 100% cancellation fee may apply to private
            transport and guides. Issued rail / Suica tickets follow operator
            rules.
          </p>
          <Link
            href="/policies"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#F6A724] underline-offset-2 hover:underline"
          >
            Full cancellation &amp; refund policy
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
