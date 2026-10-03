"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { JapanKeyword } from "@/components/branding/JapanKeyword";
import { ManageBookingModal } from "@/components/modals/ManageBookingModal";
import { BRAND_LOGO_ICON } from "@/lib/brand";
import { performFullBookingReset } from "@/lib/useBookingSync";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import type { TripType } from "@/lib/preEliteBuilder";
import {
  fetchSiteBranding,
  resolveToriiPortalBranding,
  type ToriiPortalGateId,
} from "@/lib/pocketbase/client";

interface GateOption {
  id: ToriiPortalGateId;
  title: string;
  subtitle: string;
  route: string;
  tripType?: TripType;
}

const GATE_META: GateOption[] = [
  {
    id: "multiday",
    title: "Grand Japan Journey",
    subtitle: "Full Bespoke Vacation across Tokyo, Kyoto & Beyond",
    route: "/pre-elite-builder?type=multiday",
    tripType: "multi_day",
  },
  {
    id: "single",
    title: "1-Day Express Pass",
    subtitle: "Custom 1-Day Private Route & Instant Quote",
    route: "/pre-elite-builder?type=single",
    tripType: "single_day",
  },
  {
    id: "experience",
    title: "VIP Tickets & Local Access",
    subtitle: "Hard-to-get tickets, restaurant reservations & local specs",
    route: "/builder/vip-access",
  },
];

const SWIPE_THRESHOLD = 40;

export function ToriiGatePortalHero() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(1);
  const [isZooming, setIsZooming] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [portalBranding, setPortalBranding] = useState(() =>
    resolveToriiPortalBranding(null)
  );
  const touchStartX = useRef<number | null>(null);
  const navigating = useRef(false);
  const wheelLockUntil = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const row = await fetchSiteBranding();
      if (cancelled) return;
      setPortalBranding(resolveToriiPortalBranding(row));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const gates = useMemo(
    () =>
      GATE_META.map((gate) => ({
        ...gate,
        ...portalBranding.gates[gate.id],
        heroImage: portalBranding.gates[gate.id].imageUrl,
        gateFrameAsset: portalBranding.gates[gate.id].frameUrl,
      })),
    [portalBranding]
  );

  const enterGate = useCallback(
    async (gate: (typeof gates)[number]) => {
      if (navigating.current || busy) return;
      navigating.current = true;
      setBusy(true);
      setIsZooming(true);

      window.setTimeout(() => {
        router.push(gate.route);
      }, 120);

      try {
        await performFullBookingReset();
        if (gate.tripType) {
          usePreBuilderStore.getState().setTripType(gate.tripType);
        }
      } catch {
        /* still navigate — local reset is best-effort */
      }
    },
    [busy, router]
  );

  const handleGateClick = (gate: (typeof gates)[number], index: number) => {
    if (isZooming || busy) return;
    if (activeIndex !== index) {
      setActiveIndex(index);
      return;
    }
    void enterGate(gate);
  };

  const cycle = (delta: number) => {
    if (isZooming) return;
    setActiveIndex((i) => (i + delta + gates.length) % gates.length);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || isZooming) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    cycle(dx < 0 ? 1 : -1);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (isZooming || busy) return;
    if (Math.abs(e.deltaX) < 18 && Math.abs(e.deltaY) < 18) return;
    const now = Date.now();
    if (now < wheelLockUntil.current) return;
    wheelLockUntil.current = now + 420;
    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    cycle(delta > 0 ? 1 : -1);
  };

  // Spotlight tracks the focused gate (0=left, 1=center, 2=right)
  const spotlightShiftPct = (activeIndex - 1) * 28;
  const isVerticalDesktop = portalBranding.orientation === "VERTICAL";
  const gateScale = portalBranding.gateScale;

  return (
    <div
      className="relative flex min-h-dvh w-full select-none flex-col overflow-hidden bg-[#05080C] text-white"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(7,84,115,0.28)_0%,_transparent_50%)]"
      />

      <header className="relative z-20 flex shrink-0 items-center justify-between px-4 py-4 sm:px-10 sm:py-5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_LOGO_ICON}
            alt="Tokiotours"
            className="h-8 w-8 rounded-full object-cover sm:h-10 sm:w-10"
          />
          <p className="font-godiva text-xs tracking-[0.3em] text-[#D91147] uppercase sm:text-base sm:tracking-[0.35em]">
            Tokiotours
          </p>
        </div>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-wider text-zinc-300 uppercase transition hover:border-white/30 hover:text-white"
        >
          Manage
        </button>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-5xl shrink-0 px-4 pt-1 sm:px-10 sm:pt-2">
        <h1 className="font-godiva max-w-xl text-2xl tracking-wide text-white sm:text-5xl">
          Welcome to{" "}
          <JapanKeyword className="text-3xl text-[#F6A724] sm:text-6xl">
            Japan
          </JapanKeyword>
        </h1>
        <p className="mt-1.5 max-w-md text-[11px] leading-relaxed font-light text-gray-400 sm:mt-2 sm:text-sm">
          Select your door. Tap what you love—secret food spots, private day
          tours, or exclusive VIP tickets.
        </p>
      </div>

      {/* Stage: spotlight + horizontal portals */}
      <div className="relative z-10 mx-auto my-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-2 py-6 sm:px-8 sm:py-10">
        {/* Overhead cone spotlight — follows active gate */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 inset-x-0 z-0 flex flex-col items-center transition-transform duration-500 ease-out"
          style={{ transform: `translateX(${spotlightShiftPct}%)` }}
        >
          <div className="h-2.5 w-16 rounded-b-full bg-white/90 shadow-[0_0_25px_rgba(255,255,255,0.9)] sm:h-3 sm:w-24" />
          <div
            className="h-[280px] w-full max-w-md bg-gradient-to-b from-cyan-400/25 via-cyan-500/10 to-transparent transition-all duration-500 sm:h-[420px] sm:max-w-2xl"
            style={{
              clipPath: "polygon(45% 0%, 55% 0%, 100% 100%, 0% 100%)",
            }}
          />
          <div className="-mt-10 h-10 w-56 rounded-[100%] bg-cyan-400/30 blur-2xl animate-pulse sm:-mt-12 sm:h-12 sm:w-96" />
        </div>

        {/*
          Strict 1-line horizontal on mobile always.
          VERTICAL branding only stacks from md+ (admin override).
        */}
        <div
          className={`relative z-10 flex w-full items-end justify-center gap-2 overflow-x-auto overflow-y-visible px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-8 lg:gap-12 [&::-webkit-scrollbar]:hidden ${
            isVerticalDesktop
              ? "flex-row md:flex-col md:items-center"
              : "flex-row"
          }`}
        >
          {gates.map((gate, idx) => {
            const isActive = activeIndex === idx;
            return (
              <button
                key={gate.id}
                type="button"
                disabled={busy || isZooming}
                onClick={() => handleGateClick(gate, idx)}
                onMouseEnter={() => {
                  if (!isZooming && !busy) setActiveIndex(idx);
                }}
                aria-pressed={isActive}
                aria-label={`${gate.title}. ${isActive ? "Enter portal" : "Focus portal"}`}
                className={`group relative flex shrink-0 flex-col items-center transition-all duration-500 ease-out ${
                  isActive
                    ? "z-30 opacity-100"
                    : "z-10 opacity-55 hover:opacity-80"
                }`}
                style={{
                  transform: `scale(${
                    isActive ? gateScale * 1.08 : gateScale * 0.88
                  })`,
                }}
              >
                <div className="relative flex h-36 w-28 items-end justify-center sm:h-[17rem] sm:w-52">
                  {isActive ? (
                    <div
                      className="absolute z-0 overflow-hidden rounded-t-full border border-amber-400/50 bg-[#2C2C2E] shadow-[0_0_35px_rgba(246,167,36,0.6)]"
                      style={{
                        width: `${gate.maskWidth}%`,
                        height: `${gate.maskHeight}%`,
                        left: "50%",
                        bottom: "6%",
                        transform: `translate(calc(-50% + ${gate.photoOffsetX}%), ${gate.photoOffsetY}%)`,
                      }}
                    >
                      {gate.heroImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={gate.heroImage}
                          alt=""
                          className="h-full w-full object-cover brightness-110 contrast-105"
                          draggable={false}
                        />
                      ) : null}
                      {/* Glossy glass reflection */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent"
                      />
                      {/* Interdimensional calling pulsar */}
                      <div
                        aria-hidden
                        className="animate-calling-pulsar pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-cyan-500/10 to-amber-500/30"
                      />
                      {/* White flash only inside the portal photo box */}
                      {isZooming ? (
                        <div
                          aria-hidden
                          className="animate-box-camera-flash pointer-events-none absolute inset-0 z-20 bg-white"
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div
                      aria-hidden
                      className="absolute z-0 rounded-t-full border border-white/10 bg-black/80"
                      style={{
                        width: `${gate.maskWidth}%`,
                        height: `${gate.maskHeight}%`,
                        left: "50%",
                        bottom: "6%",
                        transform: `translate(calc(-50% + ${gate.photoOffsetX}%), ${gate.photoOffsetY}%)`,
                      }}
                    />
                  )}

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gate.gateFrameAsset}
                    alt=""
                    className={`pointer-events-none relative z-10 h-full w-full object-contain transition-all duration-300 ${
                      isActive
                        ? "drop-shadow-[0_15px_30px_rgba(7,84,115,0.9)]"
                        : "opacity-60 grayscale-[30%]"
                    }`}
                    draggable={false}
                  />
                </div>

                {isActive ? (
                  <div className="mt-2 space-y-0.5 text-center sm:mt-3">
                    <h3 className="font-godiva text-sm tracking-wider text-[#F6A724] uppercase sm:text-lg">
                      {gate.title}
                    </h3>
                    <p className="mx-auto line-clamp-2 max-w-[140px] text-[9px] text-gray-300 sm:max-w-[180px] sm:text-xs">
                      {gate.subtitle}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 h-[2.5rem] sm:mt-3 sm:h-[3.25rem]" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] text-center font-mono text-[9px] tracking-widest text-gray-500 uppercase sm:text-[10px]">
        <span>← Tap or swipe portals to explore →</span>
      </div>

      <ManageBookingModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </div>
  );
}
