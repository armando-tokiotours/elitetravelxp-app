"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { PbChauffeurRate, PbVehicle } from "@/lib/pocketbase/client";
import { chauffeurDaysForCity } from "@/lib/dateCascade";
import {
  formatTransferPriceRange,
  priceFleetChauffeurDay,
} from "@/lib/vehicleAllocator";
import { useBuilderStore } from "@/store/useBuilderStore";

export function ChauffeurDayModal({
  open,
  onClose,
  cityId,
  cityName,
  vehicles = [],
  chauffeurRates = [],
}: {
  open: boolean;
  onClose: () => void;
  cityId: string | null;
  cityName: string;
  vehicles?: PbVehicle[];
  chauffeurRates?: PbChauffeurRate[];
}) {
  const [mounted, setMounted] = useState(false);
  const adults = useBuilderStore((s) => s.adults);
  const children = useBuilderStore((s) => s.children);
  const arrivalDate = useBuilderStore((s) => s.arrivalDate);
  const locations = useBuilderStore((s) => s.locations);
  const chauffeurDays = useBuilderStore((s) => s.chauffeurDays);
  const setChauffeurDay = useBuilderStore((s) => s.setChauffeurDay);
  const selectedToursByCity = useBuilderStore((s) => s.selectedToursByCity);
  const totalPax = adults + children;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const days = useMemo(() => {
    if (!cityId) return [];
    return chauffeurDaysForCity(arrivalDate, locations, cityId);
  }, [arrivalDate, locations, cityId]);

  const selected = cityId ? chauffeurDays[cityId] ?? [] : [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const quote = useMemo(() => {
    if (!cityId || totalPax <= 0 || !vehicles.length) return null;
    return priceFleetChauffeurDay({
      cityId,
      totalPax,
      vehicles,
      rates: chauffeurRates,
    });
  }, [cityId, totalPax, vehicles, chauffeurRates]);

  const dailyLabel =
    quote?.fromRates && quote.min > 0
      ? formatTransferPriceRange(quote.min, quote.max)
      : null;
  const fleetLabel = quote?.fleet?.label?.replace("×", "x") ?? null;

  const tourCount = cityId
    ? (selectedToursByCity[cityId] ?? []).length
    : 0;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && cityId ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Private chauffeur · ${cityName}`}
        >
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-[1] flex h-[90dvh] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#FBF8F2] shadow-2xl sm:h-[min(90dvh,52rem)] sm:max-h-[min(90dvh,52rem)] sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sticky top-0 z-20 shrink-0 border-b border-[#EEE8DF] bg-white px-4 pb-4 pt-6 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#075473]">
                    Private chauffeur
                  </p>
                  <h3 className="font-display text-2xl text-[#0B1F3A]">
                    {cityName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-full bg-[#0B1F3A] px-4 py-1.5 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </div>
              <p className="mt-3 text-sm text-[#5C6570]">
                {dailyLabel ? (
                  <>
                    Daily rate:{" "}
                    <span className="font-semibold text-[#0B1F3A]">
                      {dailyLabel}
                    </span>
                    {fleetLabel ? (
                      <span className="text-[#8A8278]">
                        {" "}
                        (Includes {fleetLabel})
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    Select days below. Pricing uses your party size
                    {totalPax > 0 ? ` (${totalPax} pax)` : ""}.
                  </>
                )}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5">
              {!arrivalDate ? (
                <p className="rounded-xl bg-[#F7F3EC] px-4 py-3 text-sm text-[#8A8278]">
                  Set your arrival date in Step 1 to choose chauffeur days.
                </p>
              ) : days.length === 0 ? (
                <p className="rounded-xl bg-[#F7F3EC] px-4 py-3 text-sm text-[#8A8278]">
                  No stay nights found for {cityName}. Add nights in Step 3.
                </p>
              ) : (
                <ul className="space-y-2">
                  {days.map((day) => {
                    const on = selectedSet.has(day.date);
                    return (
                      <li
                        key={day.date}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#EEE8DF] bg-white px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#0B1F3A]">
                            {day.label}
                          </p>
                          {tourCount > 0 ? (
                            <p className="mt-0.5 text-[11px] text-[#8A8278]">
                              {tourCount} experience
                              {tourCount === 1 ? "" : "s"} selected in this
                              city
                            </p>
                          ) : null}
                        </div>
                        <DaySwitch
                          on={on}
                          onChange={(next) =>
                            setChauffeurDay(cityId, day.date, next)
                          }
                          label={`Chauffeur on ${day.date}`}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}

              {selected.length > 0 && dailyLabel ? (
                <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-[#EEE8DF] pt-4">
                  <span className="text-sm font-semibold text-[#0B1F3A]">
                    {selected.length} day{selected.length === 1 ? "" : "s"}{" "}
                    selected
                  </span>
                  <span className="text-base font-semibold text-[#0B1F3A]">
                    {formatTransferPriceRange(
                      (quote?.min ?? 0) * selected.length,
                      (quote?.max ?? 0) * selected.length
                    )}
                  </span>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function DaySwitch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        on ? "bg-[#0B1F3A]" : "bg-[#D9D2C7]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
          on ? "left-[1.35rem]" : "left-0.5"
        }`}
      />
      <span className="sr-only">{on ? "On" : "Off"}</span>
    </button>
  );
}
