"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PreBuildConfirmation } from "@/components/pre-elite/PreBuildConfirmation";
import { usePreBuilderStore } from "@/store/usePreBuilderStore";

/**
 * /pre-build — summary after Manage Booking retrieve or Pre-Elite submit.
 */
export default function PreBuildPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const bookingRef = usePreBuilderStore((s) => s.bookingRef);
  const lastPayload = usePreBuilderStore((s) => s.lastPayload);

  useEffect(() => {
    const unsub = usePreBuilderStore.persist.onFinishHydration(() => {
      setReady(true);
    });
    if (usePreBuilderStore.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);

  if (!ready) {
    return (
      <div className="min-h-dvh text-white">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <div className="h-80 rounded-3xl border border-zinc-800/80 bg-[#0D1117]/80 backdrop-blur-md" />
        </div>
      </div>
    );
  }

  if (!bookingRef || !lastPayload?.itineraryData) {
    return (
      <div className="min-h-dvh text-white">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
            <Link href="/" className="inline-flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tokiotours-logo.png"
                alt=""
                className="h-8 w-8 rounded-full object-cover"
              />
              <span className="font-godiva text-sm tracking-[0.22em] text-[#D91147] uppercase">
                TOKIOTOURS
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-5 py-16 text-center">
          <h1 className="font-godiva text-2xl uppercase tracking-wider">
            No brief on file
          </h1>
          <p className="mt-3 text-sm text-white/55">
            Retrieve your booking with PNR + email, or complete Pre-Elite
            qualification first.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/manage"
              className="rounded-full bg-[#075473] px-5 py-3 text-sm font-semibold text-white"
            >
              Manage My Booking
            </Link>
            <Link
              href="/pre-elite-builder"
              className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/70"
            >
              Start Pre-Build
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/tokiotours-logo.png"
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="font-godiva text-sm tracking-[0.22em] text-[#D91147] uppercase">
              TOKIOTOURS
            </span>
          </Link>
          <p className="text-xs tracking-[0.18em] text-white/50 uppercase">
            Pre-Build Summary
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <PreBuildConfirmation
          bookingRef={bookingRef}
          fullName={lastPayload.fullName}
          email={lastPayload.email}
          itineraryData={lastPayload.itineraryData}
          onReset={() => {
            void (async () => {
              const { performFullBookingReset } = await import(
                "@/lib/useBookingSync"
              );
              await performFullBookingReset();
              router.push("/");
            })();
          }}
        />
      </main>
    </div>
  );
}
