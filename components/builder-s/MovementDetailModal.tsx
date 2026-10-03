"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
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
};

/**
 * Explains Walking / Subway / Private Driver.
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
    if (movementId === "subway") {
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
          className="fixed inset-0 z-[130] flex items-stretch justify-center bg-[#05080C]/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden border border-white/10 bg-[#0D1117]/95 shadow-2xl backdrop-blur-xl sm:rounded-2xl md:max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="absolute top-3 right-3 left-3 z-20 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 rounded-full border border-white/20 bg-black/60 px-3 py-2 text-xs font-semibold text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>

            <PinchZoomPhoto className="relative aspect-[16/10] w-full bg-zinc-900">
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
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D1117] via-transparent to-transparent" />
            </PinchZoomPhoto>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">
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
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                  Neighborhood pace on foot · <strong>€0</strong> — no ticket or
                  chauffeur line items.
                </div>
              ) : null}

              {movementId === "subway" ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
                  <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                    Suica / PASMO IC cards
                  </p>
                  <p className="text-xs text-zinc-300">
                    Do you need us to provide &amp; pre-load physical Suica /
                    PASMO IC cards for your group?
                  </p>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#0A1017] p-3">
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
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#0A1017] p-3">
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
                                ? "bg-[#075473] text-white"
                                : "bg-white/5 text-gray-400"
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

              {movementId === "private_driver" ? (
                <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs">
                  <p className="text-[10px] font-bold tracking-wider text-[#F6A724] uppercase">
                    Fleet recommendation
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

              <button
                type="button"
                onClick={keep}
                className="mt-2 w-full rounded-full bg-[#075473] py-3 text-sm font-semibold text-white"
              >
                {alreadySelected ? "Keep this option" : "Select this option"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
