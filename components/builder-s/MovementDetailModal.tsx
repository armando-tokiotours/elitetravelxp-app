"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { BrandMedia } from "@/components/ui/BrandMedia";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { PinchZoomPhoto } from "@/components/ui/PinchZoomPhoto";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import type { IntraCityTransport } from "@/store/useSingleDayBuilderStore";
import {
  recommendChauffeurFleet,
  SUICA_PRELOAD_OPTIONS_EUR,
} from "@/lib/singleDayTransport";

const KEY_BY_ID: Record<IntraCityTransport, string> = {
  walk: "transit_walk",
  subway: "transit_subway",
  private_driver: "transit_private_driver",
  mix: "transit_mix",
};

/**
 * Explains Public Transport / Private Driver / Mix.
 * Back / Close / Keep return to the 3-option Logistics screen (parent keeps that open).
 */
export function MovementDetailModal({
  movementId,
  selected,
  partySize = 2,
  initialNeedsSuica = false,
  initialSuicaValueEur = 15,
  onClose,
  onSelect,
}: {
  movementId: IntraCityTransport | null;
  selected: IntraCityTransport | null;
  partySize?: number;
  initialNeedsSuica?: boolean;
  initialSuicaValueEur?: number;
  onClose: () => void;
  onSelect: (
    id: IntraCityTransport,
    extras?: { needsSuica?: boolean; suicaValueEur?: number }
  ) => void;
}) {
  const open = Boolean(movementId);
  useModalDismiss(open, onClose);

  const getItem = useSiteBrandingStore((s) => s.getItem);
  const item = movementId ? getItem(KEY_BY_ID[movementId]) : null;

  const [needsSuica, setNeedsSuica] = useState(initialNeedsSuica);
  const [suicaValueEur, setSuicaValueEur] = useState(initialSuicaValueEur);

  useEffect(() => {
    if (!open) return;
    setNeedsSuica(initialNeedsSuica);
    setSuicaValueEur(initialSuicaValueEur);
  }, [open, movementId, initialNeedsSuica, initialSuicaValueEur]);

  if (typeof document === "undefined") return null;

  const fleet = recommendChauffeurFleet(partySize);
  const alreadySelected = selected === movementId;

  const keep = () => {
    if (!movementId) return;
    if (movementId === "subway" || movementId === "mix") {
      onSelect(movementId, { needsSuica, suicaValueEur });
      return;
    }
    onSelect(movementId);
  };

  return createPortal(
    <AnimatePresence>
      {open && movementId && item ? (
        <motion.div
          key="movement-detail"
          className="fixed inset-0 z-[130] flex h-full w-full flex-col bg-[#0A1017] p-6"
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <header className="relative mx-auto flex w-full max-w-2xl shrink-0 items-center justify-between border-b border-white/10 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-300 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span>Back</span>
            </button>
            <h3 className="pointer-events-none absolute inset-x-0 truncate px-16 text-center text-xs font-bold uppercase tracking-widest text-[#0080A3]">
              {item.title}
            </h3>
            <div className="w-12 shrink-0" aria-hidden />
          </header>

          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden pt-4">
            <PinchZoomPhoto className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-[#0D141C]">
              {item.isVideo && item.mediaUrl ? (
                <LazyVideo
                  src={item.mediaUrl}
                  poster={item.posterUrl || undefined}
                  muted
                  loop
                  playsInline
                  autoPlay
                  className="h-full w-full object-cover"
                />
              ) : (
                <BrandMedia
                  src={item.mediaUrl || item.posterUrl}
                  fallback=""
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A1017] via-transparent to-transparent" />
            </PinchZoomPhoto>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                Preferred movement
              </p>
              <h3 className="font-godiva text-2xl uppercase tracking-wider text-white">
                {item.title}
              </h3>
              <p className="text-sm text-white/55">{item.subtitle}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">
                {item.description}
              </p>

              {movementId === "walk" ? (
                <div className="bg-emerald-500/10 p-3 text-xs text-emerald-200">
                  Neighborhood pace on foot · <strong>€0</strong> — no ticket or
                  chauffeur line items.
                </div>
              ) : null}

              {movementId === "subway" || movementId === "mix" ? (
                <div className="space-y-3 bg-[#0D141C] p-4">
                  <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                    Suica / PASMO IC cards
                  </p>
                  <p className="text-xs text-zinc-300">
                    Do you need us to provide &amp; pre-load physical Suica /
                    PASMO IC cards for your group?
                  </p>
                  <label className="flex cursor-pointer items-start gap-3 bg-[#0A1017] p-3">
                    <input
                      type="radio"
                      name="suica"
                      checked={!needsSuica}
                      onChange={() => setNeedsSuica(false)}
                      className="mt-0.5 accent-[#075473]"
                    />
                    <span className="text-xs text-white">
                      I already have my own Suica / Apple Wallet IC card
                      <span className="mt-0.5 block text-[10px] text-zinc-500">
                        No fee · no ticket request for Ops
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 bg-[#0A1017] p-3">
                    <input
                      type="radio"
                      name="suica"
                      checked={needsSuica}
                      onChange={() => setNeedsSuica(true)}
                      className="mt-0.5 accent-[#075473]"
                    />
                    <span className="text-xs text-white">
                      Yes, please prepare Suica cards for our group
                      <span className="mt-0.5 block text-[10px] text-zinc-500">
                        Setup €0 · flags Ticketer (TIX NEEDED). Optional preload
                        estimate only.
                      </span>
                    </span>
                  </label>
                  {needsSuica ? (
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase">
                        Initial preload per guest (estimate)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SUICA_PRELOAD_OPTIONS_EUR.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setSuicaValueEur(val)}
                            className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold ${
                              suicaValueEur === val
                                ? "border border-[#0080A3] bg-[#0D141C] text-white"
                                : "bg-[#0A1017] text-gray-400"
                            }`}
                          >
                            €{val}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-emerald-400">
                        Setup free · estimated load €{suicaValueEur * partySize}{" "}
                        ({partySize} guests) — shown as transport estimate, not a
                        hard charge.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {movementId === "private_driver" || movementId === "mix" ? (
                <div className="space-y-2 bg-[#0D141C] p-4 text-xs">
                  <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                    {movementId === "mix"
                      ? "Private legs · fleet recommendation"
                      : "Fleet recommendation"}
                  </p>
                  <div className="flex justify-between gap-3 text-zinc-400">
                    <span>Recommended fleet</span>
                    <span className="text-right font-bold text-white">
                      {fleet.fleetLabel}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-zinc-400">
                    <span>Party band</span>
                    <span className="font-bold text-white">
                      {fleet.capacityBand} · {partySize} guests
                    </span>
                  </div>
                  <p className="pt-1 text-[10px] text-zinc-500">
                    Exact chauffeur pricing is prepared after Ops confirms —
                    quote shown as chauffeur estimate, not a public line item
                    yet.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={keep}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white"
              >
                {alreadySelected
                  ? "Keep this option →"
                  : "Select this option →"}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
