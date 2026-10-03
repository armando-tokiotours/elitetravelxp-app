"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { performFullBookingReset } from "@/lib/useBookingSync";
import type { TripType } from "@/lib/preEliteBuilder";

type ModalMode = "journey" | "resume" | null;

/**
 * START TRIP — journey-type picker (Single / Multi / Builder E).
 * If a brief is already on file, ask Continue vs New first.
 */
export function StartTripGate({
  className,
  children = "START TRIP →",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<ModalMode>(null);
  const [busy, setBusy] = useState(false);
  const bookingRef = usePreBuilderStore((s) => s.bookingRef);
  const lastPayload = usePreBuilderStore((s) => s.lastPayload);

  useEffect(() => {
    const unsub = usePreBuilderStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (usePreBuilderStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const hasDraft = Boolean(hydrated && bookingRef && lastPayload);

  const seedAndGoPreElite = async (tripType: TripType) => {
    setBusy(true);
    try {
      await performFullBookingReset();
      usePreBuilderStore.getState().setTripType(tripType);
      const q =
        tripType === "single_day" ? "type=single" : "type=multiday";
      router.push(`/pre-elite-builder?${q}`);
    } finally {
      setBusy(false);
      setMode(null);
    }
  };

  const goBuilderE = async () => {
    setBusy(true);
    try {
      await performFullBookingReset();
      router.push("/builder/vip-access");
    } finally {
      setBusy(false);
      setMode(null);
    }
  };

  const goContinue = () => {
    setMode(null);
    router.push("/pre-build");
  };

  const onClick = () => {
    if (!hydrated) {
      setMode("journey");
      return;
    }
    if (hasDraft) {
      setMode("resume");
      return;
    }
    setMode("journey");
  };

  return (
    <>
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {mode === "resume" ? (
                <motion.div
                  key="start-trip-resume"
                  className="fixed inset-0 z-[200] flex items-center justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="start-trip-resume-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    type="button"
                    aria-label="Close"
                    className="absolute inset-0"
                    onClick={() => setMode(null)}
                  />
                  <motion.div
                    className="relative z-[1] w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1117] p-5 shadow-2xl"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                  >
                    <p className="text-[10px] font-bold tracking-[0.2em] text-amber-400 uppercase">
                      Trip in progress
                    </p>
                    <h3
                      id="start-trip-resume-title"
                      className="mt-2 font-godiva text-2xl tracking-wider text-white uppercase"
                    >
                      Continue or start new?
                    </h3>
                    <p className="mt-3 text-sm text-white/65">
                      You already have a brief
                      {bookingRef ? (
                        <>
                          {" "}
                          (
                          <span className="font-mono text-amber-300">
                            {bookingRef}
                          </span>
                          )
                        </>
                      ) : null}
                      . Continue where you left off, or start a new booking.
                    </p>
                    <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setMode("journey")}
                        className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 disabled:opacity-50"
                      >
                        New trip
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={goContinue}
                        className="rounded-xl bg-[#075473] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        Continue
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}

              {mode === "journey" ? (
                <motion.div
                  key="start-trip-journey"
                  className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="journey-type-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    type="button"
                    aria-label="Close"
                    className="absolute inset-0"
                    onClick={() => setMode(null)}
                  />
                  <motion.div
                    className="relative z-[1] w-full max-w-md overflow-visible rounded-2xl border border-white/10 bg-[#0A1017] p-6 pt-2 shadow-2xl"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                  >
                    <button
                      type="button"
                      onClick={() => setMode(null)}
                      className="absolute top-3 right-3 z-10 text-gray-400 hover:text-white"
                      aria-label="Close"
                    >
                      ✕
                    </button>

                    <div className="mb-6 flex flex-col items-center text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/brand/mascot-note.webp"
                        alt="TokioTours Character"
                        className="mb-2 h-24 w-24 -mt-10 object-contain drop-shadow-xl motion-safe:animate-[bounce_1.2s_ease-in-out_2]"
                      />
                      <h1
                        id="journey-type-title"
                        className="font-godiva text-2xl tracking-wide text-white uppercase sm:text-3xl"
                      >
                        Select Your Journey Type
                      </h1>
                    </div>

                    <div className="space-y-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void seedAndGoPreElite("single_day")}
                        className="group relative flex h-32 w-full items-center overflow-hidden rounded-2xl border border-white/20 px-6 text-left shadow-xl transition-all hover:border-[#F6A724] disabled:opacity-50"
                      >
                        <div className="absolute inset-0 bg-[#2C2C2E] transition-transform duration-500 group-hover:scale-105 group-active:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30 transition-opacity group-hover:via-black/40 group-active:via-black/40" />
                        <div className="relative z-10 flex w-full items-center justify-between text-xl font-bold tracking-wide text-white">
                          <span>1. 1-Day Express Pass</span>
                          <span className="text-2xl text-[#F6A724] transition-transform group-hover:translate-x-1">
                            →
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void seedAndGoPreElite("multi_day")}
                        className="group relative flex h-32 w-full items-center overflow-hidden rounded-2xl border border-white/20 px-6 text-left shadow-xl transition-all hover:border-[#F6A724] disabled:opacity-50"
                      >
                        <div className="absolute inset-0 bg-[#2C2C2E] transition-transform duration-500 group-hover:scale-105 group-active:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30 transition-opacity group-hover:via-black/40 group-active:via-black/40" />
                        <div className="relative z-10 flex w-full items-center justify-between text-xl font-bold tracking-wide text-white">
                          <span>2. Grand Japan Journey</span>
                          <span className="text-2xl text-[#F6A724] transition-transform group-hover:translate-x-1">
                            →
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void goBuilderE()}
                        className="group relative flex h-32 w-full items-center overflow-hidden rounded-2xl border border-white/20 px-6 text-left shadow-xl transition-all hover:border-[#F6A724] disabled:opacity-50"
                      >
                        <div className="absolute inset-0 bg-[#2C2C2E] transition-transform duration-500 group-hover:scale-105 group-active:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30 transition-opacity group-hover:via-black/40 group-active:via-black/40" />
                        <div className="relative z-10 flex w-full items-center justify-between text-xl font-bold tracking-wide text-white">
                          <span>3. VIP Tickets & Local Access</span>
                          <span className="text-2xl text-[#F6A724] transition-transform group-hover:translate-x-1">
                            →
                          </span>
                        </div>
                      </button>
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
