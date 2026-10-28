"use client";

/**
 * Tab 7 — Communications & Reminders for ONE booking PNR only.
 * No cross-PNR queue. Pending windows + extras.comms_sent history.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type PocketBase from "pocketbase";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  History,
  Loader2,
  Mail,
  MessageSquareHeart,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import type { OpsHubRow } from "@/components/staff/opsHubClient";
import { PaymentMilestoneBar } from "@/components/ops/PaymentMilestoneBar";
import { BulkJourneyDispatchButton } from "@/components/ops/BulkJourneyDispatchButton";
import { NotifyLockDatesButton } from "@/components/ops/NotifyLockDatesButton";
import {
  REMINDER_CATEGORY_META,
  REMINDER_IDS,
  calculatePendingReminders,
  computeReminders,
  readCommsSent,
  resolveTripEndDate,
  type PendingReminder,
  type ReminderId,
} from "@/lib/remindersEngine";
import { useTeamAuth } from "@/store/useTeamAuth";

const CATEGORY_ICONS: Record<ReminderId, typeof Wallet> = {
  balance_reminder: Wallet,
  week_prep: ClipboardList,
  day_before: CalendarClock,
  post_tour_survey: MessageSquareHeart,
};

function categoryTone(id: ReminderId): string {
  switch (id) {
    case "balance_reminder":
      return "border-[#F6A724]/40 bg-[#F6A724]/10 text-[#F6A724]";
    case "week_prep":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
    case "day_before":
      return "border-[#054F70]/50 bg-[#054F70]/25 text-sky-200";
    case "post_tour_survey":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-zinc-600 bg-zinc-900 text-zinc-400";
  }
}

type GuestEnrichment = {
  email: string;
  name: string;
  duration_days: number | null;
};

function durationDaysFromBal(bal: {
  duration_value?: number;
  duration_label?: string;
  type?: string;
}): number | null {
  const type = String(bal.type || "").toLowerCase();
  const label = String(bal.duration_label || "").toLowerCase();
  const raw = Number(bal.duration_value) || 0;
  if (
    raw > 0 &&
    (type.includes("multi") ||
      label.includes("day") ||
      (!type.includes("single") && raw <= 30 && raw >= 2))
  ) {
    return Math.round(raw);
  }
  return null;
}

export function SingleBookingCommsTab({
  row,
  pb,
  onSent,
}: {
  row: OpsHubRow;
  pb: PocketBase;
  onSent?: () => void;
}) {
  const getClient = useTeamAuth((s) => s.getClient);
  const staffName = useTeamAuth((s) => {
    const n = String(s.record?.name || "").trim();
    return n || String(s.email || "").trim() || "Staff";
  });
  const staffId = useTeamAuth((s) => s.staffId);

  const pnr = String(row.pnr || "")
    .trim()
    .toUpperCase();

  const [hub, setHub] = useState<OpsHubRow>(row);
  const [guest, setGuest] = useState<GuestEnrichment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<PendingReminder | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setHub(row);
  }, [row]);

  const loadSingle = useCallback(async () => {
    if (!pnr) {
      setLoading(false);
      setError("Missing PNR");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      try {
        const fresh = await pb
          .collection("ops_hub")
          .getFirstListItem<OpsHubRow>(`pnr="${pnr.replace(/"/g, "")}"`, {
            requestKey: null,
          });
        setHub(fresh);
      } catch {
        setHub(row);
      }

      try {
        const bals = await pb.collection("bookings_and_leads").getFullList<{
          booking_ref?: string;
          email?: string;
          full_name?: string;
          name?: string;
          duration_value?: number;
          duration_label?: string;
          type?: string;
        }>({
          filter: `booking_ref="${pnr.replace(/"/g, "")}"`,
          requestKey: null,
        });
        const bal = bals[0];
        if (bal) {
          setGuest({
            email: String(bal.email || "")
              .trim()
              .toLowerCase(),
            name: String(bal.full_name || bal.name || "").trim(),
            duration_days: durationDaysFromBal(bal),
          });
        } else {
          setGuest(null);
        }
      } catch {
        setGuest(null);
      }
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load booking");
    } finally {
      setLoading(false);
    }
  }, [pb, pnr, row]);

  useEffect(() => {
    void loadSingle();
  }, [loadSingle]);

  const summaryName = String(hub.guest_summary || "")
    .split(/[·|/]/)[0]
    ?.trim();

  const bookingInput = useMemo(
    () => ({
      id: hub.id,
      pnr,
      status: hub.status,
      tour_date: hub.tour_date,
      end_date: hub.end_date,
      duration_days: guest?.duration_days ?? null,
      tour_payment_status: hub.tour_payment_status,
      payment_confirmed: hub.payment_confirmed,
      concierge_fee_paid: hub.concierge_fee_paid,
      deposit_amount: hub.deposit_amount,
      concierge_fee_amount: hub.concierge_fee_amount,
      total_paid_eur: hub.total_paid_eur,
      estimated_total_eur: hub.estimated_total_eur,
      guestName: guest?.name || summaryName || null,
      guestEmail: guest?.email || null,
      primary_city: hub.primary_city,
      extras: hub.extras,
      guest_summary: hub.guest_summary,
    }),
    // tick forces recompute after reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hub, guest, pnr, summaryName, tick]
  );

  const pending = useMemo(
    () => calculatePendingReminders([bookingInput]),
    [bookingInput]
  );

  const sentHistory = useMemo(() => {
    const endYmd = resolveTripEndDate(bookingInput);
    const items = computeReminders({
      tourDate: bookingInput.tour_date,
      endDate: endYmd,
      status: bookingInput.status,
      tour_payment_status: bookingInput.tour_payment_status,
      payment_confirmed: bookingInput.payment_confirmed,
      concierge_fee_paid: bookingInput.concierge_fee_paid,
      deposit_amount: bookingInput.deposit_amount,
      concierge_fee_amount: bookingInput.concierge_fee_amount,
      total_paid_eur: bookingInput.total_paid_eur,
      estimated_total_eur: bookingInput.estimated_total_eur,
      guestName: bookingInput.guestName,
      guestEmail: bookingInput.guestEmail,
      pnr,
      extras: bookingInput.extras,
    });
    const sentMap = readCommsSent(bookingInput.extras);
    return REMINDER_IDS.map((id) => {
      const item = items.find((i) => i.id === id);
      const sentAt = sentMap[id] || item?.sentAt || null;
      return {
        id,
        title: item?.title || REMINDER_CATEGORY_META[id].label,
        subject: item?.subject || null,
        sentAt,
        lane: item?.lane || (sentAt ? ("sent" as const) : ("pending" as const)),
      };
    }).filter((h) => Boolean(h.sentAt));
  }, [bookingInput, pnr]);

  const sendReminder = useCallback(
    async (item: PendingReminder) => {
      setError(null);
      setOkMsg(null);
      const key = `${item.pnr}:${item.id}`;
      setSendingKey(key);
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
            pnr: item.pnr,
            reminderId: item.id,
            staffName,
            staffId: staffId || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          alreadySent?: boolean;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `Send failed (${res.status})`);
        }
        setOkMsg(
          data.alreadySent
            ? `Already sent ${item.id} for ${item.pnr}.`
            : `Sent ${item.title} → ${item.pnr}`
        );
        setPreview(null);
        await loadSingle();
        onSent?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
      } finally {
        setSendingKey(null);
      }
    },
    [getClient, loadSingle, onSent, staffId, staffName]
  );

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/70 p-3">
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold tracking-[0.14em] text-[#F6A724] uppercase">
                Communications for PNR {pnr || "—"}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                This booking only — pending reminders and sent history. Cross-PNR
                desk:{" "}
                <a
                  href="/ops/concierge"
                  className="font-semibold text-cyan-300/90 underline-offset-2 hover:underline"
                >
                  /ops/concierge
                </a>
                . Send marks{" "}
                <span className="font-mono text-zinc-300">
                  ops_hub.extras.comms_sent
                </span>
                .
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                {guest?.name || summaryName || "Guest"}
                {guest?.email ? (
                  <span className="ml-2 text-cyan-300/80">{guest.email}</span>
                ) : (
                  <span className="ml-2 text-amber-300/80">no email on file</span>
                )}
                {hub.tour_date ? (
                  <span className="ml-2">· Start {hub.tour_date}</span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSingle()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-zinc-300 uppercase hover:border-zinc-500 disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              Refresh
            </button>
          </div>
        </div>
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

      <section className="space-y-2 rounded-xl border border-white/10 bg-zinc-950/40 p-3">
        <h3 className="text-[10px] font-bold tracking-[0.14em] text-zinc-500 uppercase">
          Payment lock · guide & driver notify
        </h3>
        <PaymentMilestoneBar hub={hub} />
        <NotifyLockDatesButton
          pnr={pnr}
          hub={hub}
          pb={pb}
          onDone={() => {
            void loadSingle();
            onSent?.();
          }}
        />
        <BulkJourneyDispatchButton
          pnr={pnr}
          hub={hub}
          pb={pb}
          onDone={() => {
            void loadSingle();
            onSent?.();
          }}
        />
        <p className="text-[10px] text-zinc-500">
          At 30%+ or 100%: emails assigned guide/driver to lock dates; ticketer
          dashboard moves to proceed-to-purchase (no ticketer email). Bulk
          Journey Dispatch covers every day-job guide and driver leg on the PNR.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-[10px] font-bold tracking-[0.14em] text-zinc-500 uppercase">
          Pending for this PNR
        </h3>
        {loading && pending.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading reminders…
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700/80 bg-black/20 px-4 py-6 text-center">
            <CheckCircle2
              className="mx-auto h-5 w-5 text-zinc-600"
              aria-hidden
            />
            <p className="mt-2 text-sm text-zinc-400">
              No pending reminders for {pnr}.
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Calendar + payment gates apply for this booking only.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((item) => {
              const Icon = CATEGORY_ICONS[item.category];
              const key = `${item.pnr}:${item.id}`;
              const sending = sendingKey === key;
              return (
                <li
                  key={key}
                  className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/70 p-3"
                >
                  <div className="relative z-10 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${categoryTone(item.category)}`}
                        >
                          <Icon className="h-3 w-3" aria-hidden />
                          {REMINDER_CATEGORY_META[item.category].shortLabel}
                        </span>
                        <span className="text-sm text-zinc-200">
                          {item.title}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {item.daysUntilStart != null
                          ? `${item.daysUntilStart}d to start · `
                          : ""}
                        {item.daysSinceEnd != null && item.daysSinceEnd >= 0
                          ? `${item.daysSinceEnd}d since end · `
                          : ""}
                        <span className="font-mono text-zinc-400">
                          {item.paymentStatus}
                        </span>
                        {" · "}
                        {item.reason}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreview(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-zinc-300 uppercase hover:border-zinc-500"
                      >
                        <Mail className="h-3 w-3" aria-hidden />
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={sending || !item.guestEmail}
                        onClick={() => void sendReminder(item)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#F6A724] px-2.5 py-1 text-[10px] font-bold tracking-wide text-black uppercase disabled:opacity-40"
                        title={
                          !item.guestEmail
                            ? "Guest email missing on bookings_and_leads"
                            : "Review & Send"
                        }
                      >
                        {sending ? (
                          <Loader2
                            className="h-3 w-3 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <Send className="h-3 w-3" aria-hidden />
                        )}
                        {sending ? "Sending…" : "Review & Send"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-zinc-500 uppercase">
          <History className="h-3.5 w-3.5" aria-hidden />
          Sent history
        </h3>
        {sentHistory.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 bg-black/10 px-3 py-4 text-center text-[11px] text-zinc-600">
            No reminder emails recorded in{" "}
            <span className="font-mono">extras.comms_sent</span> yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sentHistory.map((h) => {
              const Icon = CATEGORY_ICONS[h.id];
              return (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ${categoryTone(h.id)}`}
                    >
                      <Icon className="h-3 w-3" aria-hidden />
                      {REMINDER_CATEGORY_META[h.id].shortLabel}
                    </span>
                    <span className="truncate text-xs text-zinc-300">
                      {h.subject || h.title}
                    </span>
                  </div>
                  <time
                    className="font-mono text-[10px] text-emerald-300/90"
                    dateTime={h.sentAt || undefined}
                  >
                    {h.sentAt
                      ? new Date(h.sentAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {preview ? (
        <SinglePreviewModal
          item={preview}
          sending={sendingKey === `${preview.pnr}:${preview.id}`}
          onClose={() => setPreview(null)}
          onSend={() => void sendReminder(preview)}
        />
      ) : null}
    </div>
  );
}

function SinglePreviewModal({
  item,
  sending,
  onClose,
  onSend,
}: {
  item: PendingReminder;
  sending: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Reminder preview"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0A1017] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-zinc-500 uppercase">
              Preview · {item.pnr} · {item.id}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {item.subject}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              To:{" "}
              <span className="text-cyan-300/90">
                {item.guestEmail || "—"}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-white"
            aria-label="Close preview"
          >
            ×
          </button>
        </div>
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap px-4 py-3 font-sans text-[12px] leading-relaxed text-zinc-300">
          {item.previewText}
        </pre>
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 uppercase"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sending || !item.guestEmail}
            onClick={onSend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F6A724] px-3 py-1.5 text-[11px] font-bold text-black uppercase disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            {sending ? "Sending…" : "Approve & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
