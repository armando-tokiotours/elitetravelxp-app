"use client";

import { useState } from "react";
import { Apple, Loader2, RotateCcw } from "lucide-react";
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
  qrValue,
  actions,
  onDownloadWalletPass,
  onRefreshPass,
  showSectionOutline = true,
}: BookingPassProps) {
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);
  const isSingle = tripType === "single";

  const resolvedQr =
    qrValue ||
    `https://tokiotours-app.com/builder/itinerary?ref=${encodeURIComponent(pnrCode)}&view=dossier`;

  const nameParts = (guestName || "GUEST")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

  const handleAppleWallet = () => {
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

  const handleGoogleWallet = () => {
    setWalletMsg(null);
    // Same manual file until Google Wallet save URL is configured
    window.location.href = `/api/wallet/pass-file?pnr=${encodeURIComponent(pnrCode)}&format=pdf`;
  };

  const leftCode = isSingle ? startTime || "09:00" : originCode;
  const leftLabel = isSingle ? "START / PICKUP" : originLabel;
  const rightCode = isSingle ? endTime || "15:00" : destinationCode;
  const rightLabel = isSingle ? "FINISH / DROP-OFF" : destinationLabel;

  const ticket = (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017]/90 text-white shadow-2xl">
      <div
        className="absolute top-1/2 -left-3 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full border border-white/10 bg-[#04080C] md:block"
        aria-hidden
      />
      <div
        className="absolute top-1/2 -right-3 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full border border-white/10 bg-[#04080C] md:block"
        aria-hidden
      />

      <div className="grid grid-cols-1 md:grid-cols-12">
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
                  isSingle
                    ? "text-xl md:text-2xl"
                    : "text-2xl md:text-3xl"
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
                  isSingle
                    ? "text-xl md:text-2xl"
                    : "text-2xl md:text-3xl"
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

          <div className="flex w-full flex-col gap-2">
            <button
              type="button"
              onClick={handleAppleWallet}
              disabled={walletBusy}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-black px-3 py-2.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-md transition-all hover:bg-zinc-900 active:scale-95 disabled:opacity-60"
            >
              {walletBusy ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Apple className="h-3.5 w-3.5 shrink-0 text-white" />
              )}
              <span>Download Japan Pass</span>
            </button>
            <button
              type="button"
              onClick={handleGoogleWallet}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#4285F4]/40 bg-[#1A73E8] px-3 py-2.5 text-[10px] font-bold tracking-wider text-white uppercase shadow-md transition-all hover:bg-[#1967D2] active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"
                />
              </svg>
              <span>Download for Google</span>
            </button>
          </div>

          {walletMsg ? (
            <p className="text-[9px] leading-snug text-zinc-400" role="status">
              {walletMsg}
            </p>
          ) : (
            <p className="text-[9px] leading-snug text-zinc-500">
              Saves a PDF pass file you can keep or share. Apple Wallet install
              needs signing certificates on the server.
            </p>
          )}
        </div>
      </div>
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
