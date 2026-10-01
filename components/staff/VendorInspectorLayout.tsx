"use client";

import { useState } from "react";

/** Portal inspector roles (UI labels). Maps from vendor_dispatch tokens. */
export type VendorInspectorRole =
  | "CONCIERGE"
  | "TICKET_SUPPLIER"
  | "GUIDE"
  | "DRIVER";

/** Sanitized booking snapshot for shared inspector layout. */
export type VendorInspectorBooking = {
  pnr: string;
  city: string;
  paxCount: string;
  startDate: string;
  endDate: string;
  pickupDetails?: string;
  guestName?: string;
  mobilityNotes?: string;
  language?: string;
  dayItinerary?: string[];
  meetingPoint?: string;
  emergencyPhone?: string;
  jrPass?: boolean | null;
  suicaCount?: number | null;
  ticketDetails?: string;
  /** Concierge-only — never pass to GUIDE/DRIVER/TICKET_SUPPLIER from API */
  totalPrice?: string | null;
  paymentStatus?: string | null;
  assignmentStatus?: string;
};

const ROLE_LABEL: Record<VendorInspectorRole, string> = {
  CONCIERGE: "CONCIERGE",
  TICKET_SUPPLIER: "TICKET SUPPLIER",
  GUIDE: "GUIDE",
  DRIVER: "DRIVER",
};

export function VendorInspectorLayout({
  role,
  booking,
  onUpdateStatus,
  onAddNote,
  confirming = false,
}: {
  role: VendorInspectorRole;
  booking: VendorInspectorBooking;
  onUpdateStatus?: (status: string) => void;
  onAddNote?: (note: string) => void;
  confirming?: boolean;
}) {
  const [note, setNote] = useState("");
  const showGuest = role === "CONCIERGE" || role === "GUIDE";
  const showPickup = role === "DRIVER" || role === "CONCIERGE";
  const showTickets = role === "CONCIERGE" || role === "TICKET_SUPPLIER";
  const showFinancials = role === "CONCIERGE";
  const showItinerary = role === "GUIDE" || role === "CONCIERGE";

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-[#0A1017] p-6 text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="min-w-0">
          <span className="font-mono text-xs text-zinc-400">
            PNR: {booking.pnr}
          </span>
          <h2 className="font-godiva text-xl text-[#F6A724]">
            {booking.city} · {booking.paxCount}
          </h2>
          {booking.assignmentStatus ? (
            <p className="mt-1 text-xs text-zinc-500">{booking.assignmentStatus}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/20 px-3 py-1 text-xs text-blue-300">
          {ROLE_LABEL[role]} VIEW
        </span>
      </div>

      <div className="space-y-4">
        <section className="space-y-2 rounded-xl border border-white/5 bg-[#0D1117] p-4">
          <h4 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Logistics & timing
          </h4>
          <p className="text-sm">
            Dates: {booking.startDate}
            {booking.endDate && booking.endDate !== booking.startDate
              ? ` → ${booking.endDate}`
              : ""}
          </p>
          {showPickup ? (
            <p className="text-sm text-zinc-300">
              Flight / pickup details: {booking.pickupDetails || "Not set"}
            </p>
          ) : null}
          {role === "DRIVER" ? (
            <>
              <p className="text-sm text-zinc-300">
                Hotel: {booking.meetingPoint || "TBD"}
              </p>
            </>
          ) : null}
        </section>

        {showGuest ? (
          <section className="space-y-2 rounded-xl border border-white/5 bg-[#0D1117] p-4">
            <h4 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
              Guest requirements
            </h4>
            <p className="text-sm">
              Primary guest: {booking.guestName || "—"}
            </p>
            <p className="text-sm text-zinc-300">
              Mobility / special notes: {booking.mobilityNotes || "None"}
            </p>
            <p className="text-sm text-zinc-300">
              Language: {booking.language || "English"}
            </p>
            {booking.meetingPoint && role === "GUIDE" ? (
              <p className="text-sm text-zinc-300">
                Meeting point: {booking.meetingPoint}
              </p>
            ) : null}
            {booking.emergencyPhone && role === "GUIDE" ? (
              <p className="text-sm text-zinc-300">
                Emergency phone: {booking.emergencyPhone}
              </p>
            ) : null}
          </section>
        ) : null}

        {showItinerary && booking.dayItinerary?.length ? (
          <section className="space-y-2 rounded-xl border border-white/5 bg-[#0D1117] p-4">
            <h4 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
              Day itinerary
            </h4>
            <ul className="space-y-1">
              {booking.dayItinerary.map((line, i) => (
                <li key={`${line}-${i}`} className="text-sm text-zinc-200">
                  · {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {showTickets ? (
          <section className="space-y-2 rounded-xl border border-white/5 bg-[#0D1117] p-4">
            <h4 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
              Passes & ticket fulfillment
            </h4>
            <p className="text-sm">
              JR Pass needed:{" "}
              {booking.jrPass == null ? "—" : booking.jrPass ? "Yes" : "No"}
            </p>
            <p className="text-sm">
              Suica cards needed:{" "}
              {booking.suicaCount == null ? "—" : booking.suicaCount}
            </p>
            <p className="text-sm text-zinc-300">
              Specific tickets: {booking.ticketDetails || "Standard metro"}
            </p>
          </section>
        ) : null}

        {showFinancials ? (
          <section className="space-y-2 rounded-xl border border-emerald-500/20 bg-[#0D1117] p-4">
            <h4 className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
              Financial overview
            </h4>
            <p className="text-sm">
              Total invoiced: {booking.totalPrice || "—"}
            </p>
            <p className="text-sm text-zinc-400">
              Payment status: {booking.paymentStatus || "—"}
            </p>
          </section>
        ) : null}
      </div>

      {onAddNote ? (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <label className="block text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            Add note for Ops
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-white"
              placeholder="Optional update for the concierge team…"
            />
          </label>
          <button
            type="button"
            disabled={!note.trim()}
            onClick={() => {
              const t = note.trim();
              if (!t) return;
              onAddNote(t);
              setNote("");
            }}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40"
          >
            Post note
          </button>
        </div>
      ) : null}

      <div className="flex gap-3 border-t border-white/10 pt-4">
        <button
          type="button"
          disabled={confirming || !onUpdateStatus}
          onClick={() => onUpdateStatus?.("CONFIRMED")}
          className="w-full rounded-xl bg-[#075473] py-3 text-sm font-medium text-white transition-colors hover:bg-[#075473]/80 disabled:opacity-40"
        >
          {confirming
            ? "Confirming…"
            : `Confirm assignment for ${ROLE_LABEL[role]}`}
        </button>
      </div>

      <p className="text-[11px] text-zinc-600">
        {showFinancials
          ? "Full concierge snapshot — financials visible."
          : "Financials, margins, and internal staff logs are hidden on this view."}
      </p>
    </div>
  );
}
