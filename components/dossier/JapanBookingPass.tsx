"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RotateCcw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  downloadAppleWalletPass,
  WalletPassFallbackError,
} from "@/lib/wallet/downloadApplePass";
import type { BookingPassProps } from "./JapanBookingPass.types";

export type { BookingPassProps, RouteBreakdownItem } from "./JapanBookingPass.types";

/**
 * Reusable glassmorphic Japan Booking Pass — multi-day + single-day.
 * Layout matches Builder M Travel Dossier Section 2 (Screenshot 13.05.34).
 */
export function JapanBookingPass({
  pnrCode,
  guestName,
  guestEmail,
  partyText,
  travelStyle,
  tripType,
  experienceType = "PREMIUM CONCIERGE",
  originCode = "NRT",
  originLabel = "TOKYO ENTRY",
  destinationCode = "HND",
  destinationLabel = "DEPARTURE",
  durationText = "6 DAYS",
  startDateText,
  endDateText,
  routeBreakdown = [],
  startTime = "09:00",
  endTime = "15:00",
  singleDayHighlights,
  status = "IN_PROGRESS",
  conciergeAgentName,
  qrValue,
  actions,
  onDownloadWalletPass,
  onRefreshPass,
  showSectionOutline = true,
}: BookingPassProps) {
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const isSingle = tripType === "single";
  const isConfirmed = String(status || "").toUpperCase() === "CONFIRMED";

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const resolvedQr =
    qrValue ||
    `https://tokiotours-app.com/builder/itinerary?ref=${encodeURIComponent(pnrCode)}&view=dossier`;

  const nameParts = (guestName || "GUEST")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  const runConfirmedWalletDownload = () => {
    if (onDownloadWalletPass) {
      onDownloadWalletPass();
      return;
    }
    setWalletBusy(true);
    setWalletMsg(null);
    try {
      downloadAppleWalletPass({
        pnrCode,
        guestName: nameParts.join(" "),
        partyText,
        travelStyle,
        tripType,
        experienceType,
        originCode,
        originLabel,
        destinationCode,
        destinationLabel,
        startTime,
        endTime,
        singleDayHighlights,
        durationText,
        startDateText,
        endDateText,
        routeBreakdown,
        status,
        qrValue: resolvedQr,
      });
      setWalletMsg("Downloading your Japan Pass file…");
    } catch (err) {
      setWalletBusy(false);
      if (err instanceof WalletPassFallbackError) {
        window.location.assign(err.previewUrl);
        return;
      }
      window.location.href = `/api/wallet/pass-file?pnr=${encodeURIComponent(pnrCode)}`;
    }
  };

  const handleAppleWalletClick = () => {
    // Draft / in-progress: show notice — active Wallet pass requires CONFIRMED.
    if (!isConfirmed) {
      setShowDraftModal(true);
      return;
    }
    runConfirmedWalletDownload();
  };

  const leftCode = isSingle ? startTime || "09:00" : originCode;
  const leftLabel = isSingle ? "START / PICKUP" : originLabel;
  const rightCode = isSingle ? endTime || "15:00" : destinationCode;
  const rightLabel = isSingle ? "FINISH / DROP-OFF" : destinationLabel;

  const draftModal =
    showDraftModal && portalReady
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-draft-title"
            onClick={() => setShowDraftModal(false)}
          >
            <div
              className="relative max-w-sm rounded-2xl border border-amber-500/30 bg-[#0A1017] p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-xl text-amber-400">
                🎫
              </div>

              <h3
                id="wallet-draft-title"
                className="font-godiva text-base font-bold tracking-wider text-white uppercase"
              >
                Pass Pending Confirmation
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                Your booking reference{" "}
                <span className="font-mono font-bold text-cyan-400">
                  {pnrCode}
                </span>{" "}
                is currently in{" "}
                <span className="font-bold text-amber-400">
                  {String(status || "DRAFT").toUpperCase()}
                </span>{" "}
                status.
              </p>

              <p className="mt-2 rounded-xl border border-white/5 bg-zinc-900/60 p-3 text-[11px] leading-relaxed text-zinc-400">
                To activate your official Apple Wallet pass, your itinerary
                request must be reviewed and changed to{" "}
                <span className="font-bold text-emerald-400">CONFIRMED</span>{" "}
                status by our concierge team.
              </p>

              <button
                type="button"
                onClick={() => setShowDraftModal(false)}
                className="mt-5 w-full rounded-xl bg-cyan-700 py-2.5 text-xs font-bold tracking-wider text-white uppercase shadow-lg transition-all hover:bg-cyan-600 active:scale-95"
              >
                Understood
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  const ticket = (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/90 text-white shadow-2xl">
      {/* Top-right crimson/magenta radial glow — matches pass badge premium vibe */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 z-0 h-64 w-64 select-none rounded-full opacity-35 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #E60F43 0%, rgba(230,15,67,0) 70%)",
        }}
        aria-hidden
      />
      <div
        className="absolute top-1/2 -left-3 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full border border-white/10 bg-[#04080C] md:block"
        aria-hidden
      />
      <div
        className="absolute top-1/2 -right-3 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full border border-white/10 bg-[#04080C] md:block"
        aria-hidden
      />

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-12">
        <div className="space-y-4 border-b border-dashed border-white/15 p-6 md:col-span-8 md:border-r md:border-b-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tokiotours-logo.png"
                alt="Tokiotours"
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
              <span className="font-godiva text-sm font-bold tracking-wider text-white">
                TOKIOTOURS
              </span>
            </div>
            <span className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
              {tripType === "multi"
                ? "JAPAN MULTI-DAY PASS"
                : "JAPAN DAY TOUR PASS"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <span
                className={`font-black font-mono tracking-wider text-white ${
                  isSingle ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
                }`}
              >
                {leftCode}
              </span>
              <span className="block text-[10px] tracking-wider text-zinc-400 uppercase">
                {leftLabel}
              </span>
            </div>

            <div className="flex flex-col items-center px-2 text-center">
              <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">
                {durationText}
              </span>
              <div className="relative my-1 h-[2px] w-20 bg-gradient-to-r from-cyan-500 via-amber-400 to-cyan-500 md:w-28">
                <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-black bg-cyan-400" />
              </div>
              <div className="pt-0.5 font-mono text-[9px] leading-tight font-semibold text-zinc-300 uppercase">
                {isSingle ? (
                  <div>{startDateText || "DATE TBD"}</div>
                ) : (
                  <>
                    <div>{startDateText || "DATE TBD"}</div>
                    <div className="text-zinc-400">
                      TO {endDateText || "DATE TBD"}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="text-right">
              <span
                className={`font-black font-mono tracking-wider text-white ${
                  isSingle ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
                }`}
              >
                {rightCode}
              </span>
              <span className="block text-[10px] tracking-wider text-zinc-400 uppercase">
                {rightLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 items-start gap-2 border-t border-white/10 pt-3 text-left">
            <div className="min-w-0">
              <span className="block text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                GUEST
              </span>
              <div className="pt-0.5 text-xs leading-tight font-bold tracking-wide text-white uppercase">
                {nameParts.map((part, idx) => (
                  <div key={`${part}-${idx}`} className="truncate">
                    {part}
                  </div>
                ))}
              </div>
              {guestEmail ? (
                <p className="mt-0.5 truncate text-[10px] font-medium normal-case tracking-normal text-zinc-400">
                  {guestEmail}
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                PARTY
              </span>
              <span className="block truncate pt-0.5 text-xs font-bold text-white uppercase">
                {partyText}
              </span>
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                STYLE
              </span>
              <span className="block truncate pt-0.5 text-xs font-bold text-amber-400 uppercase">
                {travelStyle || "—"}
              </span>
            </div>
          </div>

          {(isSingle || routeBreakdown.length > 0 || experienceType) && (
            <div className="flex items-start justify-between gap-2 border-t border-white/10 pt-3 text-left">
              <div className="min-w-0">
                <span className="block text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                  {isSingle ? "HIGHLIGHTS & AREA" : "ROUTE & NIGHTS"}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 font-mono text-[11px] font-bold text-zinc-200">
                  {isSingle ? (
                    <span className="text-white">
                      {singleDayHighlights || "TOKYO · DAY TOUR"}
                    </span>
                  ) : routeBreakdown.length === 0 ? (
                    <span className="text-zinc-500">—</span>
                  ) : (
                    routeBreakdown.map((item, idx) => (
                      <span
                        key={`${item.city}-${idx}`}
                        className="flex items-center gap-1"
                      >
                        <span className="text-white">{item.city}</span>
                        {item.nights > 0 ? (
                          <span className="text-[10px] text-amber-400">
                            ({item.nights}N)
                          </span>
                        ) : null}
                        {idx < routeBreakdown.length - 1 ? (
                          <span className="text-zinc-600">→</span>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="shrink-0 pl-2 text-right">
                <span className="block text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                  EXPERIENCE TIER
                </span>
                <span className="mt-0.5 inline-block rounded border border-cyan-500/20 bg-cyan-950/40 px-2 py-0.5 text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
                  {experienceType}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex flex-col items-center justify-center space-y-3 bg-cyan-950/20 p-6 text-center md:col-span-4">
          {actions ? (
            <div className="absolute top-3 right-3">{actions}</div>
          ) : onRefreshPass ? (
            <button
              type="button"
              onClick={onRefreshPass}
              title="Refresh Pass Details"
              className="absolute top-3 right-3 rounded-lg bg-black/40 p-1.5 text-zinc-400 transition-all hover:bg-black/60 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : null}

          <div>
            <span className="block text-[9px] font-bold tracking-widest text-zinc-400 uppercase">
              BOOKING REF
            </span>
            <span className="block font-mono text-lg font-bold tracking-wider text-[#F6A724]">
              {pnrCode}
            </span>
            {conciergeAgentName ? (
              <p className="mt-1.5 text-[10px] leading-snug text-zinc-400">
                Your concierge:{" "}
                <span className="font-semibold text-cyan-300">
                  {conciergeAgentName}
                </span>
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/20 bg-white p-2.5 shadow-lg">
            <QRCodeSVG
              value={resolvedQr}
              size={100}
              bgColor="#FFFFFF"
              fgColor="#0A1017"
              level="H"
              includeMargin={false}
            />
          </div>

          <div className="flex w-full flex-col items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAppleWalletClick}
              disabled={walletBusy}
              className="transition-opacity hover:opacity-90 focus:outline-none active:scale-95 disabled:opacity-60"
              aria-label="Add to Apple Wallet"
            >
              {walletBusy ? (
                <span className="inline-flex h-10 items-center gap-2 rounded-md bg-black px-4 text-[10px] font-bold tracking-wider text-white uppercase">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Preparing…
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/brand/add-to-apple-wallet.svg"
                  alt="Add to Apple Wallet"
                  className="h-10 w-auto object-contain"
                />
              )}
            </button>
          </div>

          {walletMsg ? (
            <p className="text-[9px] leading-snug text-zinc-400" role="status">
              {walletMsg}
            </p>
          ) : (
            <p className="text-[9px] leading-snug text-zinc-500">
              {isConfirmed
                ? "Add this pass to Apple Wallet on your iPhone."
                : "Wallet pass activates after concierge marks this booking Confirmed."}
            </p>
          )}
        </div>
      </div>
      {draftModal}
    </div>
  );

  if (!showSectionOutline) return ticket;

  return (
    <div className="relative mx-auto my-6 w-full max-w-2xl rounded-3xl border-2 border-dashed border-white/40 bg-black/20 p-4">
      <span className="absolute -top-3 left-4 z-20 rounded border border-white/30 bg-zinc-800 px-2 py-0.5 font-mono text-[9px] tracking-widest text-amber-400 uppercase">
        SECTION 2: BOOKING PASS
      </span>
      {ticket}
    </div>
  );
}
