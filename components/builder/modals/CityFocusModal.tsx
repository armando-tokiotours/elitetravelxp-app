"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useMotionValue,
  useMotionValueEvent,
} from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import type { PbCity } from "@/lib/pocketbase/client";
import { cityPhoto, getPocketBase, pbFileUrl } from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import { CatalogSlotImg } from "@/components/catalog/CatalogSlotPhoto";
import { ensureCatalogPlaceholder } from "@/lib/catalogMedia";
import { CrimsonGlow } from "@/components/branding/CrimsonGlow";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { useModalDismiss } from "@/hooks/useModalDismiss";

/**
 * Legacy PocketBase cover only (often empty — cities keep no PB binary).
 * The card photo itself resolves slot-first via CatalogSlotImg:
 * `/uploads/catalog/{cityId}_1.webp` → this legacy cover → clean gradient.
 * Never the old static `/images/cities/{slug}-thumb.jpg` map: that
 * directory is empty, so those URLs 404'd into broken-image icons.
 */
function cityLegacyPhotoUrl(city: PbCity): string {
  const filename = cityPhoto(city);
  return filename && city.collectionId
    ? pbFileUrl(city.collectionId, city.id, filename, {
        thumb: PB_THUMBS.card,
        format: "webp",
      })
    : "";
}

/** Drag up past this (px) inserts the pass into the gate slot. */
const DRAG_INSERT_Y = -150;
const SWIPE_X = 70;

/**
 * Dedicated full-page city focus view (opaque canvas — builder fully hidden).
 * Fan carousel with ←/→; drag active card UP into ticket gate to lock city.
 */
export function CityFocusModal({
  open,
  onClose,
  cities,
  cityFocus,
  onConfirmCityChange,
}: {
  open: boolean;
  onClose: () => void;
  cities: PbCity[];
  cityFocus: string;
  onConfirmCityChange: (city: PbCity) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [pendingCityChange, setPendingCityChange] = useState<PbCity | null>(
    null
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [gateHot, setGateHot] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [gateSuccess, setGateSuccess] = useState(false);
  const dragY = useMotionValue(0);
  const insertControls = useAnimationControls();

  useModalDismiss(open && !inserting, onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Self-heal: each city card shows its OWN `{cityId}_1` slot. If a
  // (pre-existing) city has no slot file yet, ask the server to stamp
  // its named blank placeholder. Staff-authed + never overwrites, so
  // this is a silent no-op for guests / existing photos.
  useEffect(() => {
    if (!open || cities.length === 0) return;
    const token = getPocketBase().authStore.token || "";
    for (const city of cities) {
      if (city.id) {
        void ensureCatalogPlaceholder(city.id, city.name, token).catch(
          () => false
        );
      }
    }
  }, [open, cities]);

  useEffect(() => {
    if (!open) {
      setPendingCityChange(null);
      setGateHot(false);
      setInserting(false);
      setGateSuccess(false);
      dragY.set(0);
      void insertControls.set({ y: 0, x: 0, rotate: 0, scale: 1, opacity: 1 });
      return;
    }
    const focusIdx = cities.findIndex(
      (c) => c.name.trim().toLowerCase() === cityFocus.trim().toLowerCase()
    );
    setActiveIndex(focusIdx >= 0 ? focusIdx : 0);
  }, [open, cities, cityFocus, dragY, insertControls]);

  useEffect(() => {
    if (!pendingCityChange) return;
    const name = pendingCityChange.name.trim() || "this city";
    showSystemMessage({
      text: `Do you want to change your tour city to ${name}? Meeting point and tours for the old city will reset.`,
      tone: "tip",
      foxSrc: "/brand/fox-peek.webp",
      side: "left",
      durationMs: 9000,
    });
  }, [pendingCityChange]);

  useMotionValueEvent(dragY, "change", (y) => {
    setGateHot(y < DRAG_INSERT_Y * 0.55);
  });

  const requestSelect = (city: PbCity) => {
    const same =
      cityFocus.trim().toLowerCase() === city.name.trim().toLowerCase();
    // Same city still locks via ticket-gate insert (parent marks ✓ + advances pulsar)
    if (same) {
      onConfirmCityChange(city);
      return;
    }
    setPendingCityChange(city);
  };

  const finishInsert = (city: PbCity) => {
    setGateSuccess(true);
    window.setTimeout(() => {
      setInserting(false);
      setGateSuccess(false);
      dragY.set(0);
      void insertControls.set({ y: 0, x: 0, rotate: 0, scale: 1, opacity: 1 });
      requestSelect(city);
    }, 520);
  };

  const handleConfirm = () => {
    if (!pendingCityChange) return;
    const next = pendingCityChange;
    setPendingCityChange(null);
    onConfirmCityChange(next);
  };

  const handleVerticalDragEnd = async (
    _: unknown,
    info: { offset: { y: number } }
  ) => {
    if (inserting) return;
    if (info.offset.y < DRAG_INSERT_Y) {
      const city = cities[activeIndex];
      if (!city) {
        dragY.set(0);
        setGateHot(false);
        return;
      }
      // Seed controls at current drag Y so suction continues from release point
      insertControls.set({
        x: 0,
        y: dragY.get(),
        rotate: 0,
        scale: 1,
        opacity: 1,
        zIndex: 30,
      });
      setInserting(true);
      setGateHot(true);
      // Magnetic suction — stay opaque while sliding under the header roof
      await insertControls.start({
        y: -500,
        transition: { type: "spring", stiffness: 400, damping: 25 },
      });
      finishInsert(city);
      return;
    }
    dragY.set(0);
    setGateHot(false);
  };

  const handleFanPanEnd = (
    _: unknown,
    info: { offset: { x: number; y: number } }
  ) => {
    if (inserting) return;
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
    if (info.offset.x <= -SWIPE_X) {
      setActiveIndex((i) => (i < cities.length - 1 ? i + 1 : 0));
    } else if (info.offset.x >= SWIPE_X) {
      setActiveIndex((i) => (i > 0 ? i - 1 : cities.length - 1));
    }
  };

  const handlePrev = () => {
    if (inserting || cities.length === 0) return;
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : cities.length - 1));
  };

  const handleNext = () => {
    if (inserting || cities.length === 0) return;
    setActiveIndex((prev) => (prev < cities.length - 1 ? prev + 1 : 0));
  };

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="city-fan-carousel"
            className="fixed inset-0 z-50 flex h-full w-full select-none flex-col items-center justify-between bg-[#0A1017] px-6 py-6 font-mono text-white"
            role="dialog"
            aria-modal="true"
            aria-label="Select city focus"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Solid dark roof — Back / title / ticket gate. Cards slide under it. */}
            <div className="relative z-50 w-full bg-[#060A0F] pb-8">
              <div className="mx-auto flex w-full max-w-2xl items-center justify-between border-b border-white/10 pb-4 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={inserting}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-300 transition hover:text-white disabled:opacity-40"
                  aria-label="Back to builder"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  <span>Back</span>
                </button>
                <span className="text-xs font-bold uppercase tracking-widest text-[#0080A3]">
                  Select City Focus
                </span>
                <div className="w-12" aria-hidden />
              </div>

              <div
                className={`mx-auto mt-3 w-full max-w-xs rounded-t-2xl border-2 border-dashed px-6 py-3 text-center text-xs font-bold uppercase tracking-widest shadow-lg transition ${
                  gateSuccess
                    ? "border-[#1BA58A] bg-[#1BA58A]/20 text-[#1BA58A] shadow-[#1BA58A]/30"
                    : gateHot
                      ? "border-[#0080A3] bg-[#0080A3]/25 text-[#0080A3] shadow-[#0080A3]/40"
                      : "border-[#0080A3] bg-black/60 text-[#0080A3] shadow-[#0080A3]/20"
                }`}
              >
                {gateSuccess ? (
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                    Pass accepted
                  </span>
                ) : gateHot ? (
                  "Release to insert pass"
                ) : (
                  "↑ Insert pass into ticket gate"
                )}
                {/* Slot mouth (cyan line) */}
                <div
                  className={`mx-auto mt-2 h-1.5 w-4/5 max-w-[200px] rounded-full ${
                    gateSuccess ? "bg-[#1BA58A]" : "bg-[#0080A3]/80"
                  }`}
                  aria-hidden
                />
              </div>
            </div>

            {/* Deck — cards at z-30 so suction (y: -500) disappears under the roof */}
            <div className="relative my-auto flex w-full max-w-2xl flex-1 items-center justify-center">
              {/* Carousel + nav arrows. Arrows sit in the empty space
                  above the fan's slanted side cards (upper-middle left /
                  right of the fan, level with each other) instead of
                  flanking the centre card, so they never cover a pass. */}
              <div className="relative flex w-full items-center justify-center">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={inserting || cities.length < 2}
                  className="absolute -top-24 left-[13%] z-40 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-bold text-white shadow-xl transition hover:bg-[#0080A3] disabled:opacity-40 sm:left-[19%] md:left-[23%]"
                  aria-label="Previous city"
                >
                  ←
                </button>

                <motion.div
                  className="relative z-30 flex h-80 w-64 touch-pan-y items-center justify-center"
                  onPanEnd={handleFanPanEnd}
                >
                  {cities.map((city, index) => {
                    const offset = index - activeIndex;
                    const isActive = index === activeIndex;
                    const isInsertingCard = isActive && inserting;

                    return (
                      <motion.div
                        key={city.id}
                        drag={isActive && !inserting ? "y" : false}
                        dragConstraints={{ top: -200, bottom: 0 }}
                        dragElastic={0.2}
                        style={{ y: isActive && !inserting ? dragY : undefined }}
                        onDragEnd={
                          isActive && !inserting
                            ? handleVerticalDragEnd
                            : undefined
                        }
                        animate={
                          isInsertingCard
                            ? insertControls
                            : {
                                x: offset * 90,
                                y: 0,
                                rotate: offset * 12,
                                scale: isActive ? 1 : 0.82,
                                zIndex: isActive ? 30 : 20 - Math.abs(offset),
                                opacity: Math.abs(offset) > 3 ? 0 : 1,
                              }
                        }
                        transition={{
                          type: "spring",
                          stiffness: 260,
                          damping: 22,
                        }}
                        onClick={() => {
                          if (!inserting && !isActive) setActiveIndex(index);
                        }}
                        className={`absolute h-80 w-60 cursor-pointer overflow-hidden rounded-3xl border shadow-2xl ${
                          isActive
                            ? "z-30 border-[#0080A3] shadow-[0_0_28px_rgba(0,128,163,0.4)]"
                            : "border-white/15"
                        }`}
                      >
                        <CatalogSlotImg
                          recordId={city.id}
                          fallbackSrc={cityLegacyPhotoUrl(city)}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                          emptyClassName="absolute inset-0 bg-gradient-to-br from-[#1a3355] to-[#0B1F3A]"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                          <h3 className="text-xl font-bold uppercase tracking-wider">
                            {city.name}
                          </h3>
                          {isActive && !inserting ? (
                            <p className="mt-1 text-[10px] font-bold uppercase text-[#0080A3]">
                              {gateHot
                                ? "Release to insert pass"
                                : "↑ Drag up to insert pass"}
                            </p>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={inserting || cities.length < 2}
                  className="absolute -top-24 right-[13%] z-40 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-bold text-white shadow-xl transition hover:bg-[#0080A3] disabled:opacity-40 sm:right-[19%] md:right-[23%]"
                  aria-label="Next city"
                >
                  →
                </button>
              </div>
            </div>

            <p className="mb-4 text-[10px] uppercase tracking-widest text-gray-400">
              Use arrows or drag card up to insert pass
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingCityChange ? (
          <motion.div
            key="city-change-confirm"
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0A1017]/70 p-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="city-change-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label="Dismiss"
              className="absolute inset-0 cursor-default"
              onClick={() => setPendingCityChange(null)}
            />

            <motion.div
              className="relative z-[1] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/95 p-5 shadow-2xl backdrop-blur-xl"
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <CrimsonGlow placement="top-right" className="opacity-50" />
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  boxShadow: "inset 0 0 40px rgba(230, 15, 67, 0.18)",
                }}
                aria-hidden
              />

              <div className="relative z-10">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Confirm city change
                </p>
                <h3
                  id="city-change-title"
                  className="mt-2 font-godiva text-xl font-bold uppercase tracking-wide text-white"
                >
                  Change tour city?
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Are you sure you want to change the city of your tour?
                  Changing cities will reset any city-bound meeting points and
                  filtered experiences you have selected.
                </p>
                {pendingCityChange.name ? (
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-white/45">
                    New city:{" "}
                    <span className="font-bold text-white">
                      {pendingCityChange.name}
                    </span>
                  </p>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPendingCityChange(null)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:border-white/30"
                  >
                    No / Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="rounded-full bg-[#E60F43] px-3 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#c40d39]"
                  >
                    Yes, Change City
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>,
    document.body
  );
}
