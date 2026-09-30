"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";
import { performFullBookingReset } from "@/lib/useBookingSync";

/**
 * START TRIP — if a brief is already on file, ask Continue vs New.
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
  const [open, setOpen] = useState(false);
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

  const goFresh = async () => {
    setBusy(true);
    try {
      await performFullBookingReset();
      router.push("/pre-elite-builder");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  const goContinue = () => {
    setOpen(false);
    router.push("/pre-build");
  };

  const onClick = () => {
    if (!hydrated) {
      router.push("/pre-elite-builder");
      return;
    }
    if (hasDraft) {
      setOpen(true);
      return;
    }
    router.push("/pre-elite-builder");
  };

  return (
    <>
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  key="start-trip-gate"
                  className="fixed inset-0 z-[200] flex items-center justify-center bg-[#05080C]/75 p-4 backdrop-blur-sm"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="start-trip-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <button
                    type="button"
                    aria-label="Close"
                    className="absolute inset-0"
                    onClick={() => setOpen(false)}
                  />
                  <motion.div
                    className="relative z-[1] w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1117] p-5 shadow-2xl"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                      Trip in progress
                    </p>
                    <h3
                      id="start-trip-title"
                      className="mt-2 font-godiva text-2xl uppercase tracking-wider text-white"
                    >
                      Continue or start new?
                    </h3>
                    <p className="mt-3 text-sm text-white/65">
                      You already have a brief
                      {bookingRef ? (
                        <>
                          {" "}
                          (<span className="font-mono text-amber-300">
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
                        onClick={() => void goFresh()}
                        className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 disabled:opacity-50"
                      >
                        {busy ? "Resetting…" : "New trip"}
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
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  );
}
