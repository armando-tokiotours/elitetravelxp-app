"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { LazyVideo } from "@/components/ui/LazyVideo";
import { useBuilderStore } from "@/store/useBuilderStore";
import { FieldLabel } from "../ui";
import { type PaceId } from "@/lib/travelPace";
import { useSiteBrandingStore } from "@/store/useSiteBrandingStore";
import { PaceDetailModal } from "@/components/builder/modals/PaceDetailModal";
import { GuestCountStrip } from "@/components/branding/GuestCountStrip";
import { GuestRequirementsSelector } from "@/components/builder/GuestRequirementsSelector";
import {
  guestSpecialRequirementsChoicesComplete,
  guestSpecialRequirementsNotesValid,
} from "@/lib/guestSpecialRequirements";

/**
 * Pace + guest party configure modal (“Configure Trip Details”).
 * Days + arrival date live in DaysDateEditorModal.
 */
export function DurationEditorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const travelPace = useBuilderStore((s) => s.travelPace);
  const guestSpecialRequirements = useBuilderStore(
    (s) => s.guestSpecialRequirements
  );
  const guestSpecialRequirementsAcked = useBuilderStore(
    (s) => s.guestSpecialRequirementsAcked
  );
  const setGuestSpecialRequirements = useBuilderStore(
    (s) => s.setGuestSpecialRequirements
  );
  const ackGuestSpecialRequirements = useBuilderStore(
    (s) => s.ackGuestSpecialRequirements
  );
  const setAdults = useBuilderStore((s) => s.setAdults);
  const setChildren = useBuilderStore((s) => s.setChildren);
  const setTravelPace = useBuilderStore((s) => s.setTravelPace);
  const ensureBrandingLoaded = useSiteBrandingStore((s) => s.ensureLoaded);
  const brandingItems = useSiteBrandingStore((s) => s.itemsByKey);
  const getTravelPaces = useSiteBrandingStore((s) => s.getTravelPaces);
  const travelPaces = getTravelPaces();
  void brandingItems; // subscribe so cards refresh after PB load

  const [mounted, setMounted] = useState(false);
  const [paceModal, setPaceModal] = useState<PaceId | null>(null);

  const totalGuests = adults + children;
  const guestReqsNotesOk = guestSpecialRequirementsNotesValid(
    guestSpecialRequirements
  );
  const guestReqsChoicesOk = guestSpecialRequirementsChoicesComplete(
    guestSpecialRequirements
  );
  const canDone =
    travelPace !== null &&
    totalGuests > 0 &&
    guestReqsChoicesOk &&
    guestSpecialRequirementsAcked &&
    guestReqsNotesOk;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void ensureBrandingLoaded();
    document.body.style.overflow = "hidden";
  }, [open, ensureBrandingLoaded]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        document.body.style.overflow = "";
      }}
    >
      {open ? (
        <motion.div
          key="duration-editor"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#05080C]/85 p-0 backdrop-blur-md sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Configure trip details"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#0A1017] shadow-2xl sm:h-[min(92vh,920px)] sm:rounded-3xl sm:border sm:border-white/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="sticky top-0 z-20 flex w-full shrink-0 items-center gap-3 border-b border-white/10 bg-[#0A1017]/95 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] backdrop-blur-md">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-godiva text-base uppercase tracking-wider text-white">
                  Party &amp; Pace
                </h3>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-4 pb-12">
              <div>
                <FieldLabel>Travel pace</FieldLabel>
                <p className="mb-3 text-xs text-zinc-500">
                  Tap a style to learn more, then confirm your preferred rhythm.
                </p>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {travelPaces.map((pace) => {
                    const isSelected = travelPace === pace.id;
                    const hasSelection = travelPace !== null;
                    const cardClass = isSelected
                      ? "border-2 border-[#075473] opacity-100 scale-100 z-10"
                      : hasSelection
                        ? "border border-zinc-800 opacity-40 grayscale-[50%] scale-95"
                        : "border border-zinc-800 opacity-100 hover:border-accent-500/40 scale-100";
                    return (
                      <button
                        key={pace.id}
                        type="button"
                        onClick={() => setPaceModal(pace.id)}
                        aria-pressed={isSelected}
                        className={`group relative overflow-hidden rounded-2xl text-left transition-all duration-300 ease-in-out ${cardClass}`}
                      >
                        <span className="relative block aspect-[3/4] w-full bg-zinc-900">
                          {pace.isVideo && pace.mediaUrl ? (
                            <LazyVideo
                              src={pace.mediaUrl}
                              poster={pace.posterUrl || undefined}
                              muted
                              loop
                              playsInline
                              autoPlay
                              className="h-full w-full object-cover"
                            />
                          ) : pace.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pace.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                          <span
                            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
                            aria-hidden
                          />
                          {isSelected ? (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#D9718C] text-white">
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                          ) : null}
                          <span className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3">
                            <span className="block font-display text-base text-white sm:text-lg">
                              {pace.label}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-snug text-zinc-300 sm:text-[11px]">
                              {pace.tagline}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <FieldLabel>Guests</FieldLabel>
                <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                  <GuestStepper
                    label="Adults"
                    value={adults}
                    onChange={setAdults}
                    min={1}
                    kind="adults"
                  />
                  <GuestStepper
                    label="Children"
                    value={children}
                    onChange={setChildren}
                    min={0}
                    kind="kids"
                  />
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">
                  Used for airport transfers, vehicles, and hotel room guidance.
                </p>

                <div className="mt-3 space-y-2">
                  <FieldLabel>Dietary &amp; mobility</FieldLabel>
                  {!guestReqsChoicesOk ? (
                    <p className="text-[11px] text-amber-200/80">
                      Confirm Dietary and Mobility with Yes or No to continue.
                    </p>
                  ) : null}
                  <GuestRequirementsSelector
                    value={guestSpecialRequirements}
                    onChange={setGuestSpecialRequirements}
                    onAck={ackGuestSpecialRequirements}
                  />
                </div>
              </div>
            </div>

            <div className="tokio-modal-chrome flex flex-shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={onClose}
                disabled={!canDone}
                className="w-full rounded-full bg-[#054F70] py-3 text-sm font-semibold text-white transition hover:bg-[#043d57] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Done
              </button>
            </div>
          </motion.div>

          <PaceDetailModal
            paceId={paceModal}
            selected={travelPace}
            onClose={() => setPaceModal(null)}
            onSelect={(id) => {
              setTravelPace(id);
              setPaceModal(null);
            }}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function GuestStepper({
  label,
  value,
  onChange,
  min,
  kind,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  kind: "adults" | "kids";
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3.5 last:border-b-0">
      <span className="w-16 shrink-0 text-sm font-medium text-white">{label}</span>
      <GuestCountStrip kind={kind} count={value} />
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-white transition hover:bg-zinc-950"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-semibold text-white">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(value + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-white transition hover:bg-zinc-950"
        >
          +
        </button>
      </div>
    </div>
  );
}
