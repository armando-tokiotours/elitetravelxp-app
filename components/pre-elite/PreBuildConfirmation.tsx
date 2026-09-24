"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  INTERESTS,
  MOTIVATIONS,
  PAIN_POINTS,
  TRAVEL_STYLES,
  labelFor,
  parseItineraryData,
} from "@/lib/preEliteBuilder";
import { hydrateStoresFromPreEliteBrief } from "@/lib/preEliteHydrate";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useSingleDayBuilderStore } from "@/store/useSingleDayBuilderStore";

/**
 * Pre-Build summary after qualification submit or Manage Booking retrieve.
 * Shows brief parameters + CTA into Builder S or Builder M.
 */
export function PreBuildConfirmation({
  bookingRef,
  fullName,
  email,
  itineraryData,
  onReset,
}: {
  bookingRef: string;
  fullName: string;
  email?: string;
  itineraryData: string;
  onReset?: () => void;
}) {
  const router = useRouter();
  const data = parseItineraryData(itineraryData);
  const isSingleDay = data?.tripType === "single_day";
  const firstName = (fullName || "").trim().split(/\s+/)[0] || "";

  const openBuilder = () => {
    const builder = useBuilderStore.getState();
    const single = useSingleDayBuilderStore.getState();
    const alreadyLoaded =
      builder.confirmedBookingRef === bookingRef &&
      (builder.highestUnlockedStep > 1 ||
        (Array.isArray(builder.locations) && builder.locations.length > 0) ||
        (isSingleDay &&
          (!!single.tourDate ||
            single.selectedExperiences.length > 0 ||
            !!single.cityFocus)));

    if (alreadyLoaded) {
      router.push(
        isSingleDay
          ? `/builder-single?ref=${encodeURIComponent(bookingRef)}`
          : `/builder?ref=${encodeURIComponent(bookingRef)}`
      );
      return;
    }

    const result = hydrateStoresFromPreEliteBrief({
      bookingRef,
      fullName,
      email,
      itineraryData,
    });
    if (!result) {
      router.push(isSingleDay ? "/builder-single" : "/builder");
      return;
    }
    router.push(result.href);
  };

  return (
    <div className="rounded-3xl border border-[#075473]/40 bg-[#0D1117]/80 p-7 backdrop-blur-md sm:p-10">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/tokiotours-logo.png"
          alt="TOKIOTOURS"
          className="h-12 w-12 rounded-full object-cover"
        />
        <p className="text-xs tracking-[0.22em] text-[#F29727] uppercase">
          We&apos;ve Got Your Request
        </p>
      </div>

      <h1 className="mt-3 font-godiva text-2xl uppercase tracking-wider text-white sm:text-3xl">
        {firstName ? (
          <>
            <span className="block">{firstName},</span>
            <span className="mt-1 block text-[0.9em] leading-tight">
              your brief is with us.
            </span>
          </>
        ) : (
          "Your brief is with us."
        )}
      </h1>

      <p className="mt-4 font-mono text-2xl tracking-wide text-[#F29727]">
        {bookingRef}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-white/60">
        We&apos;ve got your ideas saved. Keep this reference handy — your
        concierge will use it to design your trip.
      </p>

      {data ? (
        <dl className="mt-8 grid gap-3 text-sm text-white/75">
          <Summary
            label="Style"
            value={labelFor(TRAVEL_STYLES, data.travelStyle)}
          />
          <Summary
            label="Interests"
            value={data.interests
              .map((id) => labelFor(INTERESTS, id))
              .join(", ")}
          />
          <Summary
            label="Motivation"
            value={labelFor(MOTIVATIONS, data.tripMotivation)}
          />
          <Summary
            label="Concerns"
            value={data.painPoints
              .map((id) => labelFor(PAIN_POINTS, id))
              .join(", ")}
          />
          <Summary
            label="Trip type"
            value={
              data.tripType === "single_day"
                ? "Single-Day Tour"
                : "Multi-Day Journey"
            }
          />
          <Summary label="Timing" value={data.dates} />
          <Summary
            label="Group"
            value={`${data.groupSize.adults} adults, ${data.groupSize.children} children`}
          />
        </dl>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={openBuilder}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#075473] px-5 py-3.5 text-sm font-semibold text-white"
        >
          {isSingleDay
            ? "Open Single-Day Builder →"
            : "Open Multi-Day Builder →"}
          <ArrowRight className="h-4 w-4" />
        </button>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-[#075473]/40 px-5 py-3.5 text-sm text-[#075473]"
          >
            Start another brief
          </button>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3.5 text-sm text-white/70"
          >
            Back home
          </Link>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-white/10 pt-3 sm:flex-row sm:justify-between sm:gap-6">
      <dt className="text-white/40">{label}</dt>
      <dd className="sm:text-right">{value}</dd>
    </div>
  );
}
