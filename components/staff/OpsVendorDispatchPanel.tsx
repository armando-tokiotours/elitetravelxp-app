"use client";

import { useState } from "react";
import type PocketBase from "pocketbase";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import type { OpsDispatchRow } from "@/lib/opsDispatch";
import type { OpsTicketsRow } from "@/lib/opsTickets";
import {
  guideConfirmStaffLabel,
  normalizeGuideConfirmStatus,
} from "@/lib/guideConfirmStatus";
import {
  appendBookingLog,
  isoDateOnly,
} from "@/lib/bookingLogs";
import {
  createVendorDispatchToken,
  maybePromoteToInOps,
  type VendorRole,
} from "@/lib/vendorDispatch";

export function OpsVendorDispatchPanel({
  pb,
  row,
  dispatch,
  tickets,
  staffId,
  staffName,
  paymentConfirmed,
  onPaymentToggle,
  onHubPatched,
}: {
  pb: PocketBase;
  row: OpsHubRow;
  dispatch?: OpsDispatchRow;
  tickets?: OpsTicketsRow;
  staffId: string | null;
  staffName: string;
  paymentConfirmed: boolean;
  onPaymentToggle?: (next: boolean) => void;
  onHubPatched: (patch: Partial<OpsHubRow>) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [briefingSent, setBriefingSent] = useState(
    Boolean(row.client_briefing_sent)
  );

  const guideStatus = normalizeGuideConfirmStatus(dispatch?.guide_mode, {
    boardVisible: Boolean(dispatch?.guide_board_visible),
    assignedGuideId: dispatch?.assigned_guide_id,
    guideResponse: dispatch?.guide_response,
  });
  const guideAccepted = guideStatus === "guide_confirmed";
  const ticketsIssued =
    (tickets?.ticket_status || row.ticket_status) === "done" ||
    (tickets?.ticket_status || row.ticket_status) === "ordered";

  const sendDispatch = async (vendorRole: VendorRole) => {
    setBusy(vendorRole);
    setMsg(null);
    setErr(null);
    setLastLink(null);
    try {
      const { urlPath } = await createVendorDispatchToken(pb, {
        pnr: row.pnr,
        opsHubId: row.id,
        vendorRole,
        createdBy: staffId,
      });
      const absolute =
        typeof window !== "undefined"
          ? `${window.location.origin}${urlPath}`
          : urlPath;
      setLastLink(absolute);
      try {
        await navigator.clipboard.writeText(absolute);
        setMsg(`${vendorRole} dispatch link copied.`);
      } catch {
        setMsg(`${vendorRole} dispatch link ready — copy below.`);
      }
      void appendBookingLog(pb, {
        pnr: row.pnr,
        opsHubId: row.id,
        staffId,
        staffName,
        actionType: "note_added",
        details: `${staffName} generated ${vendorRole} dispatch link`,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create dispatch link");
    } finally {
      setBusy(null);
    }
  };

  const toggleBriefing = async (next: boolean) => {
    setBriefingSent(next);
    try {
      const patch: Partial<OpsHubRow> = {
        client_briefing_sent: next,
        last_action_by: staffId || "",
        last_action_date: isoDateOnly(),
      };
      await pb.collection("ops_hub").update(row.id, patch, { requestKey: null });
      onHubPatched(patch);
      const promoted = await maybePromoteToInOps(pb, {
        id: row.id,
        status: row.status,
        payment_confirmed: paymentConfirmed,
        client_briefing_sent: next,
        ticketStatus: tickets?.ticket_status || row.ticket_status,
        guideAccepted,
      });
      if (promoted) {
        onHubPatched({ status: promoted });
        setMsg("All checklist items complete — status → in_ops");
      }
    } catch (e) {
      setBriefingSent(!next);
      setErr(e instanceof Error ? e.message : "Failed to save briefing flag");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Concierge share link
          </span>
          <span className="rounded bg-[#F6A724]/15 px-2 py-0.5 text-xs text-[#F6A724]">
            FULL + FINANCIALS
          </span>
        </div>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void sendDispatch("concierge")}
          className="w-full rounded bg-[#075473] py-2 text-xs font-medium text-white hover:bg-[#075473]/80 disabled:opacity-40"
        >
          {busy === "concierge"
            ? "Generating…"
            : "Generate concierge inspector link"}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Guide assignment
          </span>
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
            {guideConfirmStaffLabel(guideStatus)}
          </span>
        </div>
        <p className="mb-2 text-[11px] text-zinc-500">
          {dispatch?.assigned_guide
            ? `Assigned: ${dispatch.assigned_guide}`
            : "No guide assigned yet — assign above, then send link."}
        </p>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void sendDispatch("guide")}
          className="w-full rounded bg-[#075473] py-2 text-xs font-medium text-white hover:bg-[#075473]/80 disabled:opacity-40"
        >
          {busy === "guide"
            ? "Generating…"
            : "Generate & send guide dispatch link"}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Chauffeur assignment
          </span>
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
            {dispatch?.assigned_driver ? "ASSIGNED" : "PENDING"}
          </span>
        </div>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void sendDispatch("driver")}
          className="w-full rounded bg-[#075473] py-2 text-xs font-medium text-white hover:bg-[#075473]/80 disabled:opacity-40"
        >
          {busy === "driver"
            ? "Generating…"
            : "Generate & send chauffeur dispatch link"}
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0D1117] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Ticket supplier
          </span>
          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
            {(tickets?.ticket_status || row.ticket_status || "none").toUpperCase()}
          </span>
        </div>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void sendDispatch("ticketer")}
          className="w-full rounded bg-[#075473] py-2 text-xs font-medium text-white hover:bg-[#075473]/80 disabled:opacity-40"
        >
          {busy === "ticketer"
            ? "Generating…"
            : "Generate & send ticket dispatch link"}
        </button>
      </div>

      {lastLink ? (
        <p className="break-all rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[10px] text-zinc-300">
          {lastLink}
        </p>
      ) : null}
      {msg ? <p className="text-xs text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-xs text-red-400">{err}</p> : null}

      <div className="mt-2 border-t border-white/10 pt-4">
        <h5 className="mb-2 text-xs font-bold tracking-wider text-[#F6A724] uppercase">
          Operation completion status
        </h5>
        <div className="space-y-2 text-xs text-zinc-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={paymentConfirmed}
              onChange={(e) => onPaymentToggle?.(e.target.checked)}
              disabled={!onPaymentToggle}
            />
            <span>Payment received</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={guideAccepted} readOnly />
            <span>Guide accepted</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ticketsIssued} readOnly />
            <span>Tickets issued</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={briefingSent}
              onChange={(e) => void toggleBriefing(e.target.checked)}
            />
            <span>Client final briefing sent</span>
          </label>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          When all four are true, status automatically moves to{" "}
          <span className="text-zinc-400">in_ops</span>.
        </p>
      </div>
    </div>
  );
}
