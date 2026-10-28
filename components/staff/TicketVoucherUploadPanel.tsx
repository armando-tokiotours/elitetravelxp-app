"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bed,
  CreditCard,
  Gift,
  Landmark,
  Ticket,
  Train,
  Upload,
} from "lucide-react";
import type { OpsTicketsRow } from "@/lib/opsTickets";
import type { ProcurementKind } from "@/lib/agentServices";
import {
  PROCUREMENT_CATEGORY_BADGE,
  type ProcurementTicketCategory,
} from "@/lib/ticketNormalizer";

type CartTicketSlot = {
  id: string;
  title: string;
  category?: string;
  procurementCategory?: ProcurementTicketCategory;
  categoryLabel?: string;
  quantity?: number;
  isBonus?: boolean;
  serviceDate?: string | null;
  scheduledDate?: string | null;
  notes?: string | null;
  kind?: ProcurementKind;
  source?: string;
  uploadable?: boolean;
  voucherUrl?: string | null;
  voucherFilename?: string | null;
  fulfillmentStatus?: string | null;
};

function kindIcon(
  kind: ProcurementKind | undefined,
  procurementCategory?: ProcurementTicketCategory
): typeof Ticket {
  if (procurementCategory === "IC_CARD") return CreditCard;
  if (procurementCategory === "RAIL_PASS" || kind === "transit") return Train;
  if (procurementCategory === "HOTEL" || kind === "hotel") return Bed;
  if (procurementCategory === "ATTRACTION") return Landmark;
  return Ticket;
}

function formatServiceDate(
  slot: CartTicketSlot,
  tourDate?: string | null
): string {
  const d = String(
    slot.serviceDate || slot.scheduledDate || tourDate || ""
  ).slice(0, 10);
  return d || "Trip-wide";
}

function categoryBadge(slot: CartTicketSlot): {
  label: string;
  className: string;
} {
  const cat = slot.procurementCategory;
  if (cat && PROCUREMENT_CATEGORY_BADGE[cat]) {
    return PROCUREMENT_CATEGORY_BADGE[cat];
  }
  if (slot.kind === "hotel") return PROCUREMENT_CATEGORY_BADGE.HOTEL;
  if (slot.kind === "transit") return PROCUREMENT_CATEGORY_BADGE.RAIL_PASS;
  return PROCUREMENT_CATEGORY_BADGE.GENERAL_TICKET;
}

/**
 * Tab 5 — Ticketer procurement checklist from invoice cart lines
 * (ops_hub.extras.agent_services + access rollup). PDFs → /uploads/tickets/{PNR}/{itemId}/.
 */
export function TicketVoucherUploadPanel({
  pnr,
  tourDate,
  tickets,
  guestPaxLabel,
  onReload,
}: {
  pnr: string;
  tourDate?: string | null;
  tickets?: OpsTicketsRow | null;
  /** e.g. "4 pax (2A/2K)" from guest_summary / bookings_and_leads */
  guestPaxLabel?: string | null;
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

  const summary = useMemo(() => {
    const ready = slots.filter((s) => Boolean(String(s.voucherUrl || "").trim()));
    const bonus = slots.filter((s) => Boolean(s.isBonus));
    return {
      total: slots.length,
      ready: ready.length,
      needed: slots.length - ready.length,
      bonus: bonus.length,
    };
  }, [slots]);

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
    <div className="relative mt-4 space-y-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="relative z-10 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-2">
          <div>
            <h3 className="text-[11px] font-bold tracking-wider text-[#F6A724] uppercase">
              Ticketer procurement checklist
            </h3>
            <p className="mt-1 text-[10px] text-zinc-600">
              Auto-built from invoice cart (IC cards, rail passes, attractions,
              hotels). Upload one PDF or image e-ticket per cart line — stored
              under /uploads/tickets and synced to the guest dossier.
              {guestPaxLabel ? (
                <span className="text-zinc-500"> · Party: {guestPaxLabel}</span>
              ) : null}
            </p>
          </div>
          {!loading && slots.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-lg border border-white/10 bg-zinc-950/80 px-2 py-0.5 text-[9px] font-bold tracking-wider text-zinc-400 uppercase">
                {summary.total} items
              </span>
              {summary.needed > 0 ? (
                <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-300 uppercase">
                  {summary.needed} action needed
                </span>
              ) : (
                <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300 uppercase">
                  All vouchers ready
                </span>
              )}
              {summary.bonus > 0 ? (
                <span className="rounded-lg border border-purple-500/40 bg-purple-950/40 px-2 py-0.5 text-[9px] font-bold tracking-wider text-purple-200 uppercase">
                  {summary.bonus} bonus gift
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {loading ? (
          <p className="text-[10px] text-zinc-500">Loading procurement lines…</p>
        ) : slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-zinc-950/50 px-3 py-3 text-[11px] text-zinc-500">
            No ticket / pass / hotel lines in the invoice cart yet. Add Suica,
            Nikko rail, JR Pass, TeamLab, or accommodation in Pricing Studio —
            including bonus gifts — then attach a PDF here per line.
          </p>
        ) : (
          <ul className="space-y-2">
            {slots.map((slot) => {
              const hasFile = Boolean(String(slot.voucherUrl || "").trim());
              const busy = uploadingId === slot.id;
              const bonus = Boolean(slot.isBonus);
              const uploadable = slot.uploadable !== false;
              const Icon = kindIcon(slot.kind, slot.procurementCategory);
              const badge = categoryBadge(slot);
              const qty = Math.max(1, Math.round(Number(slot.quantity) || 1));
              const dateLabel = formatServiceDate(slot, tourDate);
              const paxBit =
                qty > 1
                  ? `qty ${qty}`
                  : guestPaxLabel
                    ? guestPaxLabel
                    : null;

              return (
                <li
                  key={slot.id}
                  className={
                    bonus
                      ? "rounded-xl border border-purple-500/50 bg-purple-950/30 p-3"
                      : "rounded-xl border border-white/10 bg-[#0D1117]/70 p-3"
                  }
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm ${
                        bonus
                          ? "border-purple-500/40 bg-purple-950/50 text-purple-200"
                          : hasFile
                            ? "border-emerald-500/35 bg-emerald-950/30 text-emerald-300"
                            : "border-amber-500/30 bg-amber-950/20 text-amber-300"
                      }`}
                      aria-hidden
                    >
                      {bonus ? (
                        <Gift className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-white">
                          {slot.title}
                        </p>
                        {bonus ? (
                          <span className="inline-flex items-center gap-1 rounded border border-purple-400/50 bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-200 uppercase">
                            <Gift className="h-2.5 w-2.5" aria-hidden />
                            Bonus gift
                          </span>
                        ) : null}
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        {slot.source && slot.source !== "agent_services" ? (
                          <span className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-zinc-500 uppercase">
                            {slot.source === "access_rollup"
                              ? "Access rollup"
                              : "Day ticket"}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-[10px] text-zinc-500">
                        {[
                          paxBit,
                          dateLabel !== "Trip-wide"
                            ? dateLabel
                            : "Trip-wide / open date",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      {bonus ? (
                        <p className="mt-0.5 text-[10px] text-purple-300/80">
                          (Client Price: €0 · Company Expense)
                        </p>
                      ) : null}

                      {slot.notes ? (
                        <p className="mt-1 line-clamp-2 text-[10px] text-zinc-600">
                          {slot.notes}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {hasFile ? (
                          <>
                            <span className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300 uppercase">
                              Issued
                            </span>
                            <a
                              href={String(slot.voucherUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-bold tracking-wider text-black uppercase"
                            >
                              View voucher
                            </a>
                          </>
                        ) : (
                          <span
                            className={
                              bonus
                                ? "rounded-lg border border-purple-500/50 bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-purple-200 uppercase"
                                : "rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-300 uppercase"
                            }
                          >
                            Procurement needed
                          </span>
                        )}
                      </div>

                      {hasFile && slot.voucherFilename ? (
                        <p
                          className={`mt-1 truncate text-[10px] ${
                            bonus ? "text-purple-200/70" : "text-emerald-300/80"
                          }`}
                        >
                          {slot.voucherFilename}
                        </p>
                      ) : null}

                      {uploadable ? (
                        <label className="mt-2 flex cursor-pointer items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-bold text-white ${
                              busy
                                ? "bg-zinc-700 opacity-50"
                                : bonus
                                  ? "bg-purple-700 hover:bg-purple-600"
                                  : "bg-[#075473] hover:bg-[#075473]/80"
                            }`}
                          >
                            <Upload className="h-3 w-3" aria-hidden />
                            {busy
                              ? "Uploading…"
                              : hasFile
                                ? "Replace file"
                                : "Upload PDF / image"}
                          </span>
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.pdf,.jpg,.jpeg,.png,.webp"
                            disabled={busy}
                            onChange={(e) => void onUpload(slot.id, e)}
                            className="sr-only"
                          />
                          <span className="text-[10px] text-zinc-600">
                            PDF or image
                          </span>
                        </label>
                      ) : (
                        <p className="mt-2 text-[10px] text-zinc-500">
                          Add this line in Pricing Studio to enable voucher
                          upload.
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error ? (
          <span className="block text-[10px] text-red-400">{error}</span>
        ) : null}
      </div>
    </div>
  );
}
