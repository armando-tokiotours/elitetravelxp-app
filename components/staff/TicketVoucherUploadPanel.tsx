"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsTicketsRow } from "@/lib/opsTickets";

type CartTicketSlot = {
  id: string;
  title: string;
  category?: string;
  quantity?: number;
  voucherUrl?: string | null;
  voucherFilename?: string | null;
  fulfillmentStatus?: string | null;
};

/**
 * Tab 5 — Ticketer / Ops: one upload slot per invoice cart ticket/pass line.
 * PDFs go to local VPS disk (/uploads/tickets/...); only URLs on agent_services.
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
  const [slots, setSlots] = useState<CartTicketSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadSlots = useCallback(async () => {
    const ref = String(pnr || "").trim();
    if (!ref) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tickets/voucher?pnr=${encodeURIComponent(ref)}&cart=1`,
        { cache: "no-store" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        cartItems?: CartTicketSlot[];
      };
      if (!res.ok) {
        setError(data.error || "Could not load ticket cart");
        setSlots([]);
        return;
      }
      setSlots(Array.isArray(data.cartItems) ? data.cartItems : []);
    } catch {
      setError("Could not load ticket cart");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [pnr]);

  useEffect(() => {
    void reloadSlots();
  }, [reloadSlots, tickets?.voucher_filename, tickets?.tour_end_date]);

  const onUpload = async (
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingId(itemId);
    setError(null);
    try {
      const form = new FormData();
      form.append("pnr", pnr);
      form.append("itemId", itemId);
      form.append("ticket_pdf", file);
      const end = String(tourDate || tickets?.tour_end_date || "").slice(0, 10);
      if (end) form.append("tour_end_date", end);
      const res = await fetch("/api/tickets/voucher", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      await reloadSlots();
      onReload();
    } catch {
      setError("Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
      <h3 className="border-b border-white/10 pb-2 text-[11px] font-bold tracking-wider text-[#F6A724] uppercase">
        Ticket procurement &amp; voucher attachments
      </h3>
      <p className="text-[10px] text-zinc-600">
        One PDF slot per invoice cart ticket/pass (Suica, Pasmo, TeamLab, entry…).
        Files store on this server under /uploads/tickets; guest Day Services links
        each URL. Auto-purge 2 days after the tour date.
      </p>
      {loading ? (
        <p className="text-[10px] text-zinc-500">Loading ticket lines…</p>
      ) : slots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-zinc-950/50 px-3 py-3 text-[11px] text-zinc-500">
          No ticket/pass lines in the invoice cart yet. Add Suica, entry tickets,
          or similar in Pricing Studio, then attach a PDF here per line.
        </p>
      ) : (
        <ul className="space-y-2">
          {slots.map((slot) => {
            const hasFile = Boolean(String(slot.voucherUrl || "").trim());
            const busy = uploadingId === slot.id;
            return (
              <li
                key={slot.id}
                className="rounded-xl border border-white/10 bg-[#0D1117]/70 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">
                      {slot.title}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {slot.category || "TICKET"}
                      {slot.quantity && slot.quantity > 1
                        ? ` · qty ${slot.quantity}`
                        : ""}
                      {hasFile ? " · Ready" : " · Awaiting PDF"}
                    </p>
                  </div>
                  {hasFile ? (
                    <a
                      href={String(slot.voucherUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-bold tracking-wider text-black uppercase"
                    >
                      View PDF
                    </a>
                  ) : (
                    <span className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-300 uppercase">
                      Pending
                    </span>
                  )}
                </div>
                {hasFile && slot.voucherFilename ? (
                  <p className="mt-1 truncate text-[10px] text-emerald-300/80">
                    📄 {slot.voucherFilename}
                  </p>
                ) : null}
                <label className="mt-2 block">
                  <span className="sr-only">Upload PDF for {slot.title}</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={busy}
                    onChange={(e) => void onUpload(slot.id, e)}
                    className="block w-full text-xs text-zinc-300 file:mr-3 file:rounded-xl file:border-0 file:bg-[#075473] file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-white hover:file:bg-[#075473]/80 disabled:opacity-40"
                  />
                </label>
                {busy ? (
                  <span className="mt-1 block text-[10px] text-cyan-300">
                    Uploading…
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <span className="block text-[10px] text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
