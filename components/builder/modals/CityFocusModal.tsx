"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { PbCity } from "@/lib/pocketbase/client";
import { cityPhoto, pbFileUrl } from "@/lib/pocketbase/client";
import { PB_THUMBS } from "@/lib/mediaStandards";
import { resolveSingleDayCityThumbnail } from "@/config/mediaConfig";
import { BuilderEditModalShell } from "@/components/builder/modals/BuilderEditModalShell";
import { CrimsonGlow } from "@/components/branding/CrimsonGlow";
import { showSystemMessage } from "@/store/useSystemMessageStore";

/**
 * Builder S City Focus picker with change-confirmation overlay.
 * Same-city tap closes; different city opens CONFIRM CITY CHANGE first
 * (portaled above the edit shell so it is never trapped behind it).
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setPendingCityChange(null);
  }, [open]);

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

  const handleCityTap = (city: PbCity) => {
    const same =
      cityFocus.trim().toLowerCase() === city.name.trim().toLowerCase();
    if (same) {
      onClose();
      return;
    }
    setPendingCityChange(city);
  };

  const handleConfirm = () => {
    if (!pendingCityChange) return;
    const next = pendingCityChange;
    setPendingCityChange(null);
    onConfirmCityChange(next);
  };

  return (
    <>
      <BuilderEditModalShell
        open={open}
        onClose={onClose}
        title="City Focus"
        mounted={mounted}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {cities.map((city) => {
            const on =
              cityFocus.trim().toLowerCase() ===
              city.name.trim().toLowerCase();
            const filename = cityPhoto(city);
            const pbImg =
              filename && city.collectionId
                ? pbFileUrl(city.collectionId, city.id, filename, {
                    thumb: PB_THUMBS.card,
                    format: "webp",
                  })
                : "";
            const img = resolveSingleDayCityThumbnail(city.name, pbImg);
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => handleCityTap(city)}
                className={`relative overflow-hidden rounded-xl border text-left ${
                  on
                    ? "border-[#075473] ring-2 ring-[#075473]"
                    : "border-white/10"
                }`}
              >
                <div className="relative h-28 bg-zinc-900 sm:h-32">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  {on ? (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1BA58A]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : null}
                  <div
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6"
                    aria-hidden
                  />
                  <p className="absolute inset-x-0 bottom-0 truncate px-2 pb-2 text-xs font-bold uppercase text-white">
                    {city.name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </BuilderEditModalShell>

      {mounted && typeof document !== "undefined"
        ? createPortal(
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
                        Changing cities will reset any city-bound meeting points
                        and filtered experiences you have selected.
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
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
}
