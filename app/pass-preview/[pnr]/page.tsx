"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { JapanBookingPass } from "@/components/dossier/JapanBookingPass";
import type { BookingPassProps } from "@/components/dossier/JapanBookingPass.types";
import {
  buildDossierQrUrl,
  buildRouteBreakdown,
  experienceTierLabel,
  formatGuestCountText,
  formatPassDateLine,
  resolvePnr,
} from "@/lib/dossier/bookingPassHelpers";
import { readStashedPassPayload } from "@/lib/wallet/downloadApplePass";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { getCityName } from "@/lib/cityLabels";

export default function PassPreviewPage() {
  const params = useParams();
  const pnrParam = String(params?.pnr || "").toUpperCase();
  const [stashed, setStashed] = useState<BookingPassProps | null>(null);

  const state = useBuilderStore();
  const clientName = useItineraryStore((s) => s.clientName);
  const departureIso = useBuilderStore((s) => s.departureDate());

  useEffect(() => {
    if (!pnrParam) return;
    setStashed(readStashedPassPayload(pnrParam));
  }, [pnrParam]);

  const fromStore = useMemo((): BookingPassProps | null => {
    const pnr = resolvePnr({
      tempBookingRef: state.tempBookingRef,
      confirmedBookingRef: state.confirmedBookingRef,
      bookingStatus: state.bookingStatus,
    });
    const code = pnrParam || pnr;
    if (!code || code.includes("·")) return null;

    return {
      pnrCode: code,
      guestName: clientName || "GUEST",
      partyText: formatGuestCountText(state.adults, state.children),
      travelStyle: "—",
      tripType: state.tripMode === "single_day" ? "single" : "multi",
      experienceType: experienceTierLabel(
        state.experienceService,
        state.isEliteConcierge
      ),
      originCode: "NRT",
      originLabel: "TOKYO ENTRY",
      destinationCode: "HND",
      destinationLabel: "DEPARTURE",
      durationText: `${state.durationDays} DAY${state.durationDays === 1 ? "" : "S"}`,
      startDateText: formatPassDateLine(state.arrivalDate),
      endDateText: formatPassDateLine(departureIso),
      routeBreakdown: buildRouteBreakdown(state.locations, (id) =>
        getCityName(id)
      ),
      qrValue: buildDossierQrUrl(code, "/builder/itinerary"),
    };
  }, [state, clientName, departureIso, pnrParam]);

  const pass = stashed || fromStore;

  return (
    <div className="tokio-ambient-bg min-h-screen bg-transparent px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-widest text-amber-400 uppercase">
            Mobile Pass Preview
          </p>
          <h1 className="mt-1 font-godiva text-2xl uppercase tracking-wide">
            TOKIOTOURS Japan Pass
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            On iPhone, use Add to Apple Wallet when signing is enabled — or keep
            this page / QR for concierge access.
          </p>
        </div>

        {pass ? (
          <JapanBookingPass {...pass} showSectionOutline={false} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#0A1017]/90 p-6 text-center">
            <p className="font-mono text-lg text-[#F6A724]">{pnrParam || "—"}</p>
            <p className="mt-2 text-sm text-zinc-400">
              Open this link from your itinerary device, or return to your
              dossier to refresh pass details.
            </p>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Link
            href={`/builder/itinerary?ref=${encodeURIComponent(pnrParam)}&view=dossier`}
            className="rounded-xl bg-[#075473] px-4 py-2.5 text-[11px] font-bold tracking-wider text-white uppercase"
          >
            Open booking on website
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-zinc-700 bg-black/40 px-4 py-2.5 text-[11px] font-bold tracking-wider text-zinc-300 uppercase"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
