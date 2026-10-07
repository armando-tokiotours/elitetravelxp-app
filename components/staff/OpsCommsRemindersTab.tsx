"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type PocketBase from "pocketbase";
import {
  computeReminders,
  type ReminderItem,
  type ReminderLane,
} from "@/lib/reminderRules";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import { useTeamAuth } from "@/store/useTeamAuth";

function laneStyle(lane: ReminderLane): string {
  switch (lane) {
    case "due":
      return "border-[#F6A724]/50 bg-[#F6A724]/15 text-[#F6A724]";
    case "sent":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-zinc-600/50 bg-zinc-900/60 text-zinc-400";
  }
}

export function OpsCommsRemindersTab({
  row,
  pb,
  guestName,
  onSent,
}: {
  row: OpsHubRow;
  pb: PocketBase;
  guestName?: string | null;
  onSent?: () => void;
}) {
  const getClient = useTeamAuth((s) => s.getClient);
  const staffName = useTeamAuth((s) => {
    const n = String(s.record?.name || "").trim();
    return n || String(s.email || "").trim() || "Staff";
  });
  const staffId = useTeamAuth((s) => s.staffId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lead = await pb
          .collection("bookings_and_leads")
          .getFirstListItem(`booking_ref="${String(row.pnr).replace(/"/g, "")}"`, {
            requestKey: null,
          });
        if (!cancelled) {
          setGuestEmail(String(lead.email || "").trim().toLowerCase());
        }
      } catch {
        if (!cancelled) setGuestEmail("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pb, row.pnr]);

  const reminders = useMemo(
    () =>
      computeReminders({
        tourDate: row.tour_date,
        endDate: row.end_date,
        status: row.status,
        tour_payment_status: row.tour_payment_status,
        payment_confirmed: row.payment_confirmed,
        concierge_fee_paid: row.concierge_fee_paid,
        deposit_amount: row.deposit_amount,
        concierge_fee_amount: row.concierge_fee_amount,
        total_paid_eur: row.total_paid_eur,
        estimated_total_eur: row.estimated_total_eur,
        guestName: guestName || null,
        guestEmail,
        pnr: row.pnr,
        extras: row.extras,
      }),
    [row, guestName, guestEmail]
  );

  const due = reminders.filter((r) => r.lane === "due");
  const pending = reminders.filter((r) => r.lane === "pending");
  const sent = reminders.filter((r) => r.lane === "sent");
  const preview = reminders.find((r) => r.id === previewId) || null;

  const sendReminder = useCallback(
    async (item: ReminderItem) => {
      setError(null);
      setOkMsg(null);
      setSendingId(item.id);
      try {
        const token = getClient().authStore.token;
        if (!token) throw new Error("Staff session expired — sign in again.");
        const res = await fetch("/api/comms/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            pnr: row.pnr,
            reminderId: item.id,
            staffName,
            staffId: staffId || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          alreadySent?: boolean;
          sentAt?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `Send failed (${res.status})`);
        }
        setOkMsg(
          data.alreadySent
            ? `Already sent ${item.id}.`
            : `Sent ${item.title}.`
        );
        onSent?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
      } finally {
        setSendingId(null);
      }
    },
    [getClient, onSent, row.pnr, staffId, staffName]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#F6A724]/25 bg-[#0D1117]/80 p-3">
        <p className="text-[10px] font-bold tracking-[0.14em] text-[#F6A724] uppercase">
          Situational reminders
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Manual approval only — nothing auto-sends. Due items match tour date +
          payment status. Sent flags live on{" "}
          <span className="font-mono text-zinc-300">ops_hub.extras.comms_sent</span>.
        </p>
        {guestEmail ? (
          <p className="mt-1.5 text-[11px] text-zinc-500">
            To: <span className="text-cyan-300/90">{guestEmail}</span>
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-amber-300/80">
            Guest email not found on this PNR — send will fail until lead has
            email.
          </p>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {okMsg}
        </p>
      ) : null}

      <ReminderGroup
        title="Due now"
        empty="No due reminders."
        items={due}
        previewId={previewId}
        sendingId={sendingId}
        onPreview={setPreviewId}
        onSend={sendReminder}
        primary
      />
      <ReminderGroup
        title="Pending"
        empty="No pending reminders."
        items={pending}
        previewId={previewId}
        sendingId={sendingId}
        onPreview={setPreviewId}
        onSend={sendReminder}
      />
      <ReminderGroup
        title="Sent"
        empty="Nothing sent yet."
        items={sent}
        previewId={previewId}
        sendingId={sendingId}
        onPreview={setPreviewId}
        onSend={sendReminder}
      />

      {preview ? (
        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                Preview · {preview.id}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {preview.subject}
              </p>
            </div>
            <button
              type="button"
              className="text-[10px] text-zinc-500 hover:text-white"
              onClick={() => setPreviewId(null)}
            >
              Close
            </button>
          </div>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 font-sans text-[11px] leading-relaxed text-zinc-300">
            {preview.previewText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function ReminderGroup({
  title,
  empty,
  items,
  previewId,
  sendingId,
  onPreview,
  onSend,
  primary,
}: {
  title: string;
  empty: string;
  items: ReminderItem[];
  previewId: string | null;
  sendingId: string | null;
  onPreview: (id: string) => void;
  onSend: (item: ReminderItem) => void;
  primary?: boolean;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold tracking-[0.14em] text-zinc-500 uppercase">
        {title}
        {items.length ? (
          <span className="ml-2 font-mono text-[#F6A724]">{items.length}</span>
        ) : null}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-600">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`relative overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/70 p-3 ${
                primary ? "ring-1 ring-[#F6A724]/20" : ""
              }`}
            >
              <div className="relative z-10 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${laneStyle(item.lane)}`}
                    >
                      {item.lane}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {item.title}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Due {item.dueDate || "—"} · {item.reason}
                    {item.sentAt
                      ? ` · Sent ${String(item.sentAt).slice(0, 16).replace("T", " ")}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPreview(item.id)}
                    className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                      previewId === item.id
                        ? "border-[#F6A724]/50 bg-[#F6A724]/15 text-[#F6A724]"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    Preview
                  </button>
                  {item.lane !== "sent" ? (
                    <button
                      type="button"
                      disabled={sendingId === item.id || !item.eligible}
                      onClick={() => void onSend(item)}
                      className="rounded-lg bg-[#F6A724] px-2.5 py-1 text-[10px] font-bold tracking-wide text-black uppercase disabled:opacity-40"
                      title={
                        !item.eligible
                          ? item.reason
                          : item.lane === "due"
                            ? "Approve & Send"
                            : "Review & Send (not due yet)"
                      }
                    >
                      {sendingId === item.id
                        ? "Sending…"
                        : item.lane === "due"
                          ? "Approve & Send"
                          : "Review & Send"}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
