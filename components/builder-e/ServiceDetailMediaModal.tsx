"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { SubServiceItem } from "@/components/builder-e/subServices";
import {
  useBuilderEStore,
  type BuilderEDriverPayload,
  type BuilderEExperiencePayload,
  type BuilderETransitPayload,
} from "@/store/useBuilderEStore";
import { showSystemMessage } from "@/store/useSystemMessageStore";
import { DesktopSafeViewport } from "@/components/layout/DesktopSafeViewport";

const LANGS = ["EN", "NL", "ES", "FR"] as const;

export function ServiceDetailMediaModal({
  service,
  onClose,
}: {
  service: SubServiceItem | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [slide, setSlide] = useState(0);
  const [selectedLang, setSelectedLang] =
    useState<(typeof LANGS)[number]>("EN");
  const [showRoute, setShowRoute] = useState(false);
  const [showIncluded, setShowIncluded] = useState(false);

  // Local logistics (seeded into store on Add)
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [timeSlot, setTimeSlot] = useState<
    "morning" | "afternoon" | "evening" | ""
  >("");
  const [routeFrom, setRouteFrom] = useState("Tokyo");
  const [routeTo, setRouteTo] = useState("Kyoto");
  const [travelDate, setTravelDate] = useState("");

  const ensureBookingRef = useBuilderEStore((s) => s.ensureBookingRef);
  const setCategory = useBuilderEStore((s) => s.setCategory);
  const addCartItem = useBuilderEStore((s) => s.addCartItem);
  const patchDriver = useBuilderEStore((s) => s.patchDriver);
  const patchExperience = useBuilderEStore((s) => s.patchExperience);
  const patchTransit = useBuilderEStore((s) => s.patchTransit);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!service) return;
    setSlide(0);
    setShowRoute(false);
    setShowIncluded(false);
    setSelectedLang("EN");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [service]);

  const gallery = useMemo(() => {
    if (!service) return [];
    const urls = [
      service.heroMediaUrl,
      ...(service.galleryUrls || []),
    ].filter(Boolean);
    return Array.from(new Set(urls));
  }, [service]);

  if (!mounted || !service) return null;

  const total = Math.max(1, gallery.length);
  const heroSrc = gallery[slide % total] || service.heroMediaUrl;

  const nextSlide = () => setSlide((s) => (s + 1) % total);
  const prevSlide = () => setSlide((s) => (s - 1 + total) % total);

  const handleAdd = () => {
    ensureBookingRef();
    setCategory(service.category);

    if (service.category === "DRIVER") {
      const patch: Partial<BuilderEDriverPayload> = {
        pickupLocation:
          pickupLocation ||
          (service.id === "pickup" ? "Narita / Haneda" : pickupLocation),
        pickupTime,
        flightNumber,
        dropoffLocation:
          dropoffLocation ||
          (service.id === "dropoff" ? "Narita / Haneda" : dropoffLocation),
        notes: service.title,
      };
      patchDriver(patch);
      addCartItem({
        category: "DRIVER",
        label: service.title,
        summary: [
          patch.pickupLocation,
          patch.dropoffLocation,
          patch.pickupTime,
        ]
          .filter(Boolean)
          .join(" · ") || service.description.slice(0, 60),
        payload: { subServiceId: service.id, language: selectedLang, ...patch },
      });
    } else if (service.category === "EXPERIENCE") {
      const patch: Partial<BuilderEExperiencePayload> = {
        activityTitle: service.title,
        targetDate,
        timeSlot,
        guideLanguage: selectedLang,
        notes: service.description,
      };
      patchExperience(patch);
      addCartItem({
        category: "EXPERIENCE",
        label: service.title,
        summary: [targetDate, timeSlot, selectedLang]
          .filter(Boolean)
          .join(" · ") || service.duration || "Experience",
        payload: { subServiceId: service.id, language: selectedLang, ...patch },
      });
    } else {
      const passMap: Record<string, BuilderETransitPayload["passType"]> = {
        suica: "suica_physical",
        bullet_train: "shinkansen",
        jr_pass: "jr_pass",
      };
      const patch: Partial<BuilderETransitPayload> = {
        passType: passMap[service.id] || "",
        routeFrom: service.id === "suica" ? "" : routeFrom,
        routeTo: service.id === "suica" ? "" : routeTo,
        travelDate,
        notes: service.title,
      };
      patchTransit(patch);
      addCartItem({
        category: "TRANSIT",
        label: service.title,
        summary:
          service.id === "suica"
            ? `Suica · ${selectedLang}`
            : `${routeFrom} → ${routeTo}${travelDate ? ` · ${travelDate}` : ""}`,
        payload: { subServiceId: service.id, language: selectedLang, ...patch },
      });
    }

    showSystemMessage({
      text: `Added · ${service.title}`,
      tone: "info",
    });
    onClose();
  };

  return createPortal(
    <DesktopSafeViewport
      onClose={onClose}
      maxWidth="max-w-md"
      zIndexClass="z-[200]"
    >
      {/* Hero — clipped to safe viewport column */}
      <div className="relative h-[min(42dvh,320px)] w-full max-w-md shrink-0 overflow-hidden bg-black sm:h-[45%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroSrc}
          alt={service.title}
          className="h-full w-full max-w-full object-cover opacity-80"
          onClick={nextSlide}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A1017] via-transparent to-black/60" />

        <div className="absolute inset-x-4 top-4 z-10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-md hover:bg-black/80"
          >
            ← Back to Discover
          </button>
          <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-1 font-mono text-xs text-gray-300 backdrop-blur-md">
            {slide + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 bg-black/60 p-2 text-white backdrop-blur-md hover:bg-black/80"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={prevSlide}
              className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 px-2 py-1 text-white"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={nextSlide}
              className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 px-2 py-1 text-white"
            >
              ›
            </button>
          </>
        ) : null}

        <div className="absolute right-4 bottom-4 left-4 z-10 space-y-1">
          {service.badgeTag ? (
            <span className="inline-block rounded-full bg-[#075473] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-200 uppercase">
              {service.badgeTag}
            </span>
          ) : null}
          <h2 className="font-godiva text-2xl tracking-wide text-white uppercase">
            {service.title}
          </h2>
          {service.duration ? (
            <p className="flex items-center gap-1 text-xs text-gray-300">
              ⏱ {service.duration}
            </p>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div className="space-y-2">
          <span className="flex items-center gap-1 text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
            🌐 Preferred Language
          </span>
          <div className="flex gap-2">
            {LANGS.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedLang(lang)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  selectedLang === lang
                    ? "border border-white/40 bg-white/20 text-white"
                    : "border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs leading-relaxed text-gray-300">
          {service.description}
        </p>

        {showRoute ? (
          <div className="rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-xs text-zinc-300">
            <p className="mb-1 font-bold tracking-wider text-[#F6A724] uppercase">
              Route
            </p>
            {service.routeHint ||
              "Route details confirmed after Ops assignment."}
          </div>
        ) : null}

        {showIncluded ? (
          <div className="rounded-2xl border border-white/10 bg-[#0D1117] p-4 text-xs text-zinc-300">
            <p className="mb-2 font-bold tracking-wider text-[#F6A724] uppercase">
              Included
            </p>
            <ul className="list-inside list-disc space-y-1">
              {(service.included || ["Concierge coordination"]).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {service.category === "DRIVER" ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
            <h4 className="text-xs font-bold text-[#F6A724] uppercase">
              Pickup &amp; Drop-off Logistics
            </h4>
            <input
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="Pickup location (Airport / Hotel)"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
            <input
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              placeholder="Flight Number (optional)"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              placeholder="Drop-off / hotel address"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
          </div>
        ) : null}

        {service.category === "EXPERIENCE" ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
            <h4 className="text-xs font-bold text-[#F6A724] uppercase">
              Date &amp; time slot
            </h4>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
            <select
              value={timeSlot}
              onChange={(e) =>
                setTimeSlot(
                  e.target.value as "morning" | "afternoon" | "evening" | ""
                )
              }
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            >
              <option value="">Preferred slot…</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
        ) : null}

        {service.category === "TRANSIT" && service.id !== "suica" ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0D1117] p-4">
            <h4 className="text-xs font-bold text-[#F6A724] uppercase">
              Route details
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={routeFrom}
                onChange={(e) => setRouteFrom(e.target.value)}
                placeholder="From"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={routeTo}
                onChange={(e) => setRouteTo(e.target.value)}
                placeholder="To"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
              />
            </div>
            <input
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            />
          </div>
        ) : null}
      </div>

      {/* Sticky footer inside frame */}
      <div className="shrink-0 border-t border-white/10 bg-[#0D1117] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setShowRoute((v) => !v);
              setShowIncluded(false);
            }}
            className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10"
          >
            📍 Route
          </button>
          <button
            type="button"
            onClick={() => {
              setShowIncluded((v) => !v);
              setShowRoute(false);
            }}
            className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-white hover:bg-white/10"
          >
            ✓ Included
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center justify-center gap-1 rounded-xl bg-[#075473] py-2.5 text-xs font-bold text-white shadow-lg transition-transform hover:bg-[#075473]/80 active:scale-95"
          >
            + Add
          </button>
        </div>
      </div>
    </DesktopSafeViewport>,
    document.body
  );
}
