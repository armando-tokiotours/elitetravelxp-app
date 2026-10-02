"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";

/**
 * Guest dossier — download official ticket PDF when Ticketer has uploaded one.
 */
export function TicketVoucherDownloadBanner({
  pnr,
  className = "",
}: {
  pnr: string;
  className?: string;
}) {
  const [voucher, setVoucher] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  const reload = useCallback(async () => {
    const ref = String(pnr || "").trim();
    if (!ref || ref.startsWith("TMP-")) {
      setVoucher(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/tickets/voucher?pnr=${encodeURIComponent(ref)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        voucher?: { url?: string; filename?: string } | null;
      };
      if (data.voucher?.url) {
        setVoucher({
          url: data.voucher.url,
          filename:
            data.voucher.filename || "TokioTours_Ticket_Vouchers.pdf",
        });
      } else {
        setVoucher(null);
      }
    } catch {
      setVoucher(null);
    }
  }, [pnr]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!voucher) return null;

  return (
    <div
      className={`flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#075473] bg-[#075473]/30 p-4 sm:flex-row ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#075473] text-xl">
          🎟️
        </div>
        <div>
          <h4 className="text-xs font-bold tracking-wider text-white uppercase">
            Your official attraction tickets are ready
          </h4>
          <p className="text-[10px] text-zinc-300">
            Download and save your QR vouchers to your phone before your tour.
          </p>
        </div>
      </div>
      <a
        href={voucher.url}
        download={voucher.filename}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-[#F6A724] px-5 py-2.5 text-xs font-bold tracking-wider text-black uppercase shadow-lg transition hover:bg-[#F6A724]/85 active:scale-95"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Download tickets (PDF)
      </a>
    </div>
  );
}
