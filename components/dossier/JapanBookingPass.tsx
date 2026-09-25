"use client";

import { useState } from "react";
import { Apple, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { DossierSectionOutline } from "@/components/builder/DossierSectionOutline";
import { downloadAppleWalletPass } from "@/lib/wallet/downloadApplePass";
import type { BookingPassProps } from "./JapanBookingPass.types";

export type { BookingPassProps } from "./JapanBookingPass.types";

export function JapanBookingPass({
  pnrCode,
  passengerName,
  guestCountText,
  travelStyle,
  tripType,
  originCode = "NRT",
  originLabel = "TOKYO ENTRY",
  destinationCode = "HND",
  destinationLabel = "DEPARTURE",
  durationText = "10 DAYS",
  datesText,
  status = "IN_PROGRESS",
  qrValue,
  paceLabel,
  experienceLabel,
  actions,
  onDownloadWalletPass,
  showSectionOutline = true,
}: BookingPassProps) {
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);

  const resolvedQr =
    qrValue ||
    `https://tokiotours-app.com/builder/itinerary?ref=${encodeURIComponent(pnrCode)}&view=dossier`;

  const displayName =
    (passengerName || "").trim().split(/\s+/)[0]?.toUpperCase() || "GUEST";

  const statusTone =
    status === "CONFIRMED"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
      : status === "IN_PROGRESS"
        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
        : status === "REVIEW"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
          : "border-white/20 bg-white/5 text-white/70";

  const statusLabel =
    status === "CONFIRMED"
      ? "Confirmed"
      : status === "IN_PROGRESS"
        ? "In Progress"
        : status === "REVIEW"
          ? "Review"
          : "Draft";

  const handleWallet = async () => {
    if (onDownloadWalletPass) {
      onDownloadWalletPass();
      return;
    }
    setWalletBusy(true);
    setWalletMsg(null);
    try {
      await downloadAppleWalletPass({
        pnrCode,
        passengerName: displayName,
        guestCountText,
        travelStyle,
        tripType,
        originCode,
        originLabel,
        destinationCode,
        destinationLabel,
        durationText,
        datesText,
        status,
        qrValue: resolvedQr,
      });
      setWalletMsg("Pass downloaded — open with Apple Wallet on iPhone.");
    } catch (err) {
      setWalletMsg(
        err instanceof Error
          ? err.message
          : "Apple Wallet pass is not available yet."
      );
    } finally {
      setWalletBusy(false);
    }
  };

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
        <div className="relative space-y-5 border-b border-dashed border-white/15 p-5 sm:p-6 md:col-span-8 md:border-r md:border-b-0">
          <div
            className="absolute -bottom-3 -left-3 z-10 h-6 w-6 rounded-full border border-white/10 bg-[#04080C] md:hidden"
            aria-hidden
          />
          <div
            className="absolute -right-3 -bottom-3 z-10 h-6 w-6 rounded-full border border-white/10 bg-[#04080C] md:hidden"
            aria-hidden
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/tokiotours-logo.png"
                alt="TOKIOTOURS"
                className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/15"
              />
              <span className="font-godiva text-sm font-bold tracking-wider text-white uppercase">
                TOKIOTOURS
              </span>
            </div>
            <span className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
              {tripType === "multi"
                ? "Japan Multi-Day Pass"
                : "Japan Day Tour Pass"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="font-mono text-2xl font-black tracking-wider text-white md:text-3xl">
                {originCode}
              </span>
              <span className="mt-0.5 block text-[10px] tracking-wider text-zinc-400 uppercase">
                {originLabel}
              </span>
            </div>

            <div className="flex flex-col items-center px-3">
              <span className="text-[9px] font-bold tracking-widest text-amber-400 uppercase">
                {durationText}
              </span>
              <div className="relative my-1.5 h-[2px] w-20 bg-gradient-to-r from-cyan-500 via-amber-400 to-cyan-500 md:w-32">
                <span className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0A1017] bg-cyan-400" />
              </div>
              <span className="max-w-[140px] truncate font-mono text-[9px] text-zinc-400">
                {datesText || "Dates TBD"}
              </span>
            </div>

            <div className="text-right">
              <span className="font-mono text-2xl font-black tracking-wider text-white md:text-3xl">
                {destinationCode}
              </span>
              <span className="mt-0.5 block text-[10px] tracking-wider text-zinc-400 uppercase">
                {destinationLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-3 text-left">
            <div className="min-w-0">
              <span className="block text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                Passenger
              </span>
              <span className="mt-0.5 block truncate text-xs font-bold text-white uppercase">
                {displayName}
              </span>
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                Party
              </span>
              <span className="mt-0.5 block truncate text-xs font-bold text-white uppercase">
                {guestCountText}
              </span>
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
                Style
              </span>
              <span className="mt-0.5 block truncate text-xs font-bold text-amber-400 uppercase">
                {travelStyle || "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${statusTone}`}
            >
              {statusLabel}
            </span>
            {paceLabel ? (
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-white/75">
                {paceLabel}
              </span>
            ) : null}
            {experienceLabel ? (
              <span className="rounded-full border border-[#075473]/40 bg-[#075473]/10 px-2.5 py-1 text-[10px] text-[#F3D9C4]">
                {experienceLabel}
              </span>
            ) : null}
            {actions ? <div className="ml-auto">{actions}</div> : null}
          </div>
        </div>

        <div className="relative flex flex-col items-center justify-center space-y-3 bg-cyan-950/20 p-5 text-center sm:p-6 md:col-span-4">
          <div>
            <span className="block text-[9px] font-bold tracking-widest text-zinc-400 uppercase">
              Booking Ref
            </span>
            <span className="mt-0.5 block font-mono text-lg font-bold tracking-wider text-[#F6A724]">
              {pnrCode}
            </span>
          </div>

          <div className="rounded-xl border border-white/20 bg-white p-2.5 shadow-lg">
            <QRCodeSVG
              value={resolvedQr}
              size={95}
              bgColor="#FFFFFF"
              fgColor="#0A1017"
              level="H"
              includeMargin={false}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleWallet()}
            disabled={walletBusy}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-black px-3 py-2 text-[10px] font-bold tracking-wider text-white uppercase shadow-md transition-all hover:bg-zinc-900 active:scale-95 disabled:opacity-60"
          >
            {walletBusy ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Apple className="h-3.5 w-3.5 shrink-0 text-white" />
            )}
            <span>Add to Apple Wallet</span>
          </button>

          {walletMsg ? (
            <p className="text-[9px] leading-snug text-zinc-400" role="status">
              {walletMsg}
            </p>
          ) : (
            <span className="font-mono text-[9px] tracking-wider text-zinc-400 uppercase">
              Scan for concierge access
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (!showSectionOutline) return ticket;

  return (
    <DossierSectionOutline label="Section 2: Booking Pass">
      {ticket}
    </DossierSectionOutline>
  );
}
