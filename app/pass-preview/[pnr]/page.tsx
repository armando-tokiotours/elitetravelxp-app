"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Apple, Copy, Check } from "lucide-react";
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
import { isIOSChrome } from "@/lib/wallet/iosWallet";
import { useBuilderStore } from "@/store/useBuilderStore";
import { useItineraryStore } from "@/store/useItineraryStore";
import { getCityName } from "@/lib/cityLabels";
import { useConciergeAgentName } from "@/lib/useConciergeAgentName";

function PassPreviewInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pnrParam = String(params?.pnr || "").toUpperCase();
  const conciergeAgentName = useConciergeAgentName(pnrParam);
  const [showSafariHint, setShowSafariHint] = useState(
    searchParams.get("openInSafari") === "1"
  );
  const [showGoogleHint, setShowGoogleHint] = useState(
    searchParams.get("wallet") === "google"
  );
  const [stashed, setStashed] = useState<BookingPassProps | null>(null);
  const [copied, setCopied] = useState(false);
  const [safariUrl, setSafariUrl] = useState("");

  const state = useBuilderStore();
  const clientName = useItineraryStore((s) => s.clientName);
  const departureIso = useBuilderStore((s) => s.departureDate());

  useEffect(() => {
    if (searchParams.get("openInSafari") === "1" || isIOSChrome()) {
      setShowSafariHint(true);
    }
    if (searchParams.get("wallet") === "google") {
      setShowGoogleHint(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!pnrParam) return;
    setStashed(readStashedPassPayload(pnrParam));
  }, [pnrParam]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSafariUrl(
      `${window.location.origin}/pass-preview/${encodeURIComponent(pnrParam)}`
    );
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

  const pass = useMemo(() => {
    const base = stashed || fromStore;
    if (!base) return null;
    return {
      ...base,
      conciergeAgentName:
        conciergeAgentName || base.conciergeAgentName || null,
    };
  }, [stashed, fromStore, conciergeAgentName]);

  const copySafariLink = async () => {
    if (!safariUrl) return;
    try {
      await navigator.clipboard.writeText(safariUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

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
            Apple Wallet passes open natively in{" "}
            <span className="text-white">Safari</span> on iPhone — not in Chrome.
          </p>
        </div>

        {showSafariHint ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-amber-300 uppercase">
              <Apple className="h-3.5 w-3.5" />
              Open in Safari to add to Wallet
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Chrome on iPhone cannot show the Add to Apple Wallet sheet. Copy
              this link, open it in Safari, then tap Add to Apple Wallet.
            </p>
            <button
              type="button"
              onClick={() => void copySafariLink()}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-black/40 px-3 py-2.5 text-[11px] font-bold tracking-wider text-amber-200 uppercase"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Link copied" : "Copy Safari link"}
            </button>
          </div>
        ) : null}

        {showGoogleHint ? (
          <div className="rounded-2xl border border-[#4285F4]/30 bg-[#1A73E8]/10 p-4 text-left">
            <p className="text-[11px] font-bold tracking-wider text-[#8AB4F8] uppercase">
              Google Wallet
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Google Wallet save links are not configured on this server yet.
              Use Add to Apple Wallet in Safari, or open your booking on the
              website to keep this pass handy.
            </p>
          </div>
        ) : null}

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
          <a
            href={`/api/wallet/pass-file?pnr=${encodeURIComponent(pnrParam)}`}
            className="rounded-xl bg-black px-4 py-2.5 text-[11px] font-bold tracking-wider text-white uppercase border border-zinc-600"
          >
            Download Japan Pass PDF
          </a>
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

export default function PassPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="tokio-ambient-bg flex min-h-screen items-center justify-center text-sm text-zinc-400">
          Loading pass…
        </div>
      }
    >
      <PassPreviewInner />
    </Suspense>
  );
}
