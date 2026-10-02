"use client";

import { useEffect, useState } from "react";
import type { OpsTicketsRow } from "@/lib/opsTickets";

/**
 * Tab 5 — Ticketer / Ops upload of PDF voucher for guest download.
 */
export function TicketVoucherUploadPanel({
  pnr,
  tourDate,
  tickets,
  onReload,
}: {
  pnr: string;
  tourDate?: string | null;
  tickets?: OpsTicketsRow | null;
  onReload: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);
  const [voucherName, setVoucherName] = useState(
    String(tickets?.voucher_filename || "").trim()
  );

  useEffect(() => {
    setVoucherName(String(tickets?.voucher_filename || "").trim());
    const ref = String(pnr || "").trim();
    if (!ref) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/tickets/voucher?pnr=${encodeURIComponent(ref)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          voucher?: { url?: string; filename?: string } | null;
        };
        if (cancelled) return;
        setVoucherUrl(data.voucher?.url || null);
        if (data.voucher?.filename) setVoucherName(data.voucher.filename);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pnr, tickets?.voucher_pdf, tickets?.voucher_filename]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("pnr", pnr);
      form.append("ticket_pdf", file);
      const end = String(tourDate || tickets?.tour_end_date || "").slice(0, 10);
      if (end) form.append("tour_end_date", end);
      const res = await fetch("/api/tickets/voucher", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        voucher?: { url?: string; filename?: string } | null;
      };
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setVoucherUrl(data.voucher?.url || null);
      setVoucherName(
        data.voucher?.filename || file.name || "Official_Tour_Tickets.pdf"
      );
      onReload();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
      <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold tracking-wider text-[#F6A724] uppercase">
        Ticket procurement &amp; voucher attachments
      </h3>
      <div className="space-y-2">
        <span className="block text-[10px] font-bold text-zinc-500 uppercase">
          Upload PDF ticket voucher
        </span>
        <input
          type="file"
          accept="application/pdf"
          disabled={uploading}
          onChange={(e) => void onUpload(e)}
          className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-[#075473] file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-[#075473]/80 disabled:opacity-40"
        />
        <p className="text-[10px] text-zinc-600">
          Guest dossier shows a download button after upload. Files auto-purge 2
          days after the tour date.
        </p>
        {uploading ? (
          <span className="block text-[10px] text-cyan-300">
            Uploading voucher…
          </span>
        ) : null}
        {error ? (
          <span className="block text-[10px] text-red-400">{error}</span>
        ) : null}
      </div>

      {voucherUrl ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">
              📄 {voucherName || "Official_Tour_Tickets.pdf"}
            </p>
            <p className="text-[10px] text-emerald-400/80">
              Visible on guest dossier
            </p>
          </div>
          <a
            href={voucherUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1 text-[10px] font-bold tracking-wider text-black uppercase"
          >
            View PDF
          </a>
        </div>
      ) : null}
    </div>
  );
}
