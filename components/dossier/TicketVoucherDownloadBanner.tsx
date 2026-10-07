"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";

export type TicketVoucherInfo = {
  url: string;
  filename: string;
  itemId?: string;
  title?: string;
};

export type TicketVoucherBundle = {
  /** First voucher (legacy single-link callers) */
  url: string;
  filename: string;
  vouchers: TicketVoucherInfo[];
};

/** Load Ops-uploaded per-item ticket voucher PDFs for a PNR. */
export function useTicketVoucher(
  pnr: string | null | undefined
): TicketVoucherBundle | null {
  const [bundle, setBundle] = useState<TicketVoucherBundle | null>(null);

  const reload = useCallback(async () => {
    const ref = String(pnr || "").trim();
    if (!ref || ref.startsWith("TMP-") || ref.includes("····")) {
      setBundle(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/tickets/voucher?pnr=${encodeURIComponent(ref)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        setBundle(null);
        return;
      }
      const data = (await res.json()) as {
        vouchers?: Array<{
          url?: string;
          filename?: string;
          itemId?: string;
          title?: string;
        }>;
        voucher?: { url?: string; filename?: string } | null;
      };
      const list = (data.vouchers || [])
        .filter((v) => String(v.url || "").trim())
        .map((v) => ({
          url: String(v.url),
          filename:
            String(v.filename || "").trim() ||
            "TokioTours_Ticket_Voucher.pdf",
          itemId: v.itemId,
          title: v.title,
        }));
      if (list.length === 0 && data.voucher?.url) {
        list.push({
          url: data.voucher.url,
          filename:
            data.voucher.filename || "TokioTours_Ticket_Vouchers.pdf",
          itemId: undefined,
          title: undefined,
        });
      }
      if (list.length === 0) {
        setBundle(null);
        return;
      }
      setBundle({
        url: list[0].url,
        filename: list[0].filename,
        vouchers: list,
      });
    } catch {
      setBundle(null);
    }
  }, [pnr]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return bundle;
}

/**
 * Guest dossier — download official ticket PDFs when Ticketer has uploaded them.
 */
export function TicketVoucherDownloadBanner({
  pnr,
  className = "",
}: {
  pnr: string;
  className?: string;
}) {
  const bundle = useTicketVoucher(pnr);

  if (!bundle?.vouchers?.length) return null;

  const multi = bundle.vouchers.length > 1;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-[#075473] bg-[#075473]/30 p-4 ${className}`}
    >
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#075473] text-xl">
            🎟️
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-wider text-white uppercase">
              Your official attraction tickets are ready
            </h4>
            <p className="text-[10px] text-zinc-300">
              {multi
                ? "Download each pass / entry voucher and save it to your phone before your tour."
                : "Download and save your QR vouchers to your phone before your tour."}
            </p>
          </div>
        </div>
        {!multi ? (
          <a
            href={bundle.url}
            download={bundle.filename}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#F6A724] px-5 py-2.5 text-xs font-bold tracking-wider text-black uppercase shadow-lg transition hover:bg-[#F6A724]/85 active:scale-95"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Download tickets (PDF)
          </a>
        ) : null}
      </div>
      {multi ? (
        <ul className="space-y-2">
          {bundle.vouchers.map((v) => (
            <li
              key={v.itemId || v.url}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
            >
              <span className="truncate text-[11px] font-semibold text-white">
                {v.title || v.filename}
              </span>
              <a
                href={v.url}
                download={v.filename}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#F6A724] px-3 py-1.5 text-[10px] font-bold tracking-wider text-black uppercase"
              >
                <Download className="h-3 w-3" aria-hidden />
                PDF
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
