"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type PocketBase from "pocketbase";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Mail,
  MessageSquareHeart,
  RefreshCw,
  Send,
  Wallet,
  X,
} from "lucide-react";
import {
  loadOpsHub,
  type OpsHubRow,
} from "@/components/staff/opsHubClient";
import {
  REMINDER_CATEGORY_META,
  REMINDER_IDS,
  calculatePendingReminders,
  countByCategory,
  type PendingReminder,
  type ReminderId,
} from "@/lib/remindersEngine";
import { toCanonicalStatus } from "@/lib/bookingStatus";
import { useTeamAuth } from "@/store/useTeamAuth";

type CategoryFilter = ReminderId | "all";

const CATEGORY_ICONS: Record<ReminderId, typeof Wallet> = {
  balance_reminder: Wallet,
  week_prep: ClipboardList,
  day_before: CalendarClock,
  post_tour_survey: MessageSquareHeart,
};

type GuestEnrichment = {
  email: string;
  name: string;
  duration_days: number | null;
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

/**
 * Global Communications Desk — scans ALL active ops_hub PNRs.
 * For a single booking use SingleBookingCommsTab (Ops Tab 7).
 */
export function CommsAndRemindersConsole({
  pb,
  focusPnr,
  onSent,
}: {
  pb: PocketBase;
  /** Optional soft-focus chip only; desk still defaults to all PNRs */
  focusPnr?: string | null;
  onSent?: () => void;
}) {
  const getClient = useTeamAuth((s) => s.getClient);
  const staffName = useTeamAuth((s) => {
    const n = String(s.record?.name || "").trim();
    return n || String(s.email || "").trim() || "Staff";
  });
  const staffId = useTeamAuth((s) => s.staffId);

  const [hubs, setHubs] = useState<OpsHubRow[]>([]);
  const [guests, setGuests] = useState<Record<string, GuestEnrichment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [focusOnly, setFocusOnly] = useState(false);
  const [preview, setPreview] = useState<PendingReminder | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const loadDesk = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await loadOpsHub(pb);
      const active = rows.filter(
        (r) => toCanonicalStatus(r.status) !== "cancelled"
      );
      setHubs(active);

      const enrich: Record<string, GuestEnrichment> = {};
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
          requestKey: null,
        });
        for (const bal of bals) {
          const ref = String(bal.booking_ref || "")
            .trim()
            .toUpperCase();
          if (!ref) continue;
          const type = String(bal.type || "").toLowerCase();
          const label = String(bal.duration_label || "").toLowerCase();
          let durationDays: number | null = null;
          const raw = Number(bal.duration_value) || 0;
          // Multi-day trips store days; single-day stores hours — only use days.
          if (
            raw > 0 &&
            (type.includes("multi") ||
              label.includes("day") ||
              (!type.includes("single") && raw <= 30 && raw >= 2))
          ) {
            durationDays = Math.round(raw);
          }
          enrich[ref] = {
            email: String(bal.email || "")
              .trim()
              .toLowerCase(),
            name: String(bal.full_name || bal.name || "").trim(),
            duration_days: durationDays,
          };
        }
      } catch {
        /* agency-only hubs may lack BAL rows */
      }
      setGuests(enrich);
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ops_hub");
    } finally {
      setLoading(false);
    }
  }, [pb]);

  useEffect(() => {
    void loadDesk();
  }, [loadDesk]);

  const pending = useMemo(() => {
    const inputs = hubs.map((h) => {
      const pnr = String(h.pnr || "")
        .trim()
        .toUpperCase();
      const g = guests[pnr];
      const summaryName = String(h.guest_summary || "")
        .split(/[·|/]/)[0]
        ?.trim();
      return {
        id: h.id,
        pnr,
        status: h.status,
        tour_date: h.tour_date,
        end_date: h.end_date,
        duration_days: g?.duration_days ?? null,
        tour_payment_status: h.tour_payment_status,
        payment_confirmed: h.payment_confirmed,
        concierge_fee_paid: h.concierge_fee_paid,
        deposit_amount: h.deposit_amount,
        concierge_fee_amount: h.concierge_fee_amount,
        total_paid_eur: h.total_paid_eur,
        estimated_total_eur: h.estimated_total_eur,
        guestName: g?.name || summaryName || null,
        guestEmail: g?.email || null,
        primary_city: h.primary_city,
        extras: h.extras,
        guest_summary: h.guest_summary,
      };
    });
    return calculatePendingReminders(inputs);
    // tick forces recompute after reload (extras / comms_sent may change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubs, guests, tick]);

  const counts = useMemo(() => countByCategory(pending), [pending]);

  const focusNorm = String(focusPnr || "")
    .trim()
    .toUpperCase();

  const filtered = useMemo(() => {
    let rows = pending;
    if (category !== "all") {
      rows = rows.filter((r) => r.category === category);
    }
    if (focusOnly && focusNorm) {
      rows = rows.filter((r) => r.pnr === focusNorm);
    }
    return rows;
  }, [pending, category, focusOnly, focusNorm]);

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
          sentAt?: string;
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
        await loadDesk();
        onSent?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
      } finally {
        setSendingKey(null);
      }
    },
    [getClient, loadDesk, onSent, staffId, staffName]
  );

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/70 p-3">
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold tracking-[0.14em] text-[#F6A724] uppercase">
                Global Communications Desk
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Cross-PNR scan of every active{" "}
                <span className="font-mono text-zinc-300">ops_hub</span> row.
                Manual approval only — nothing auto-sends. Sent flags:{" "}
                <span className="font-mono text-zinc-300">
                  ops_hub.extras.comms_sent
                </span>
                . Per-booking Tab 7 is scoped to one PNR only.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadDesk()}
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

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <FilterChip
              active={category === "all"}
              onClick={() => setCategory("all")}
              label={`All (${counts.all})`}
            />
            {REMINDER_IDS.map((id) => {
              const Icon = CATEGORY_ICONS[id];
              const meta = REMINDER_CATEGORY_META[id];
              return (
                <FilterChip
                  key={id}
                  active={category === id}
                  onClick={() => setCategory(id)}
                  label={`${meta.shortLabel} (${counts[id]})`}
                  icon={<Icon className="h-3 w-3" aria-hidden />}
                  tone={category === id ? categoryTone(id) : undefined}
                />
              );
            })}
            {focusNorm ? (
              <FilterChip
                active={focusOnly}
                onClick={() => setFocusOnly((v) => !v)}
                label={focusOnly ? `Only ${focusNorm}` : `Focus ${focusNorm}`}
              />
            ) : null}
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

      {loading && hubs.length === 0 ? (
        <div className="flex items-center gap-2 py-8 text-xs text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Scanning active PNRs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700/80 bg-black/20 px-4 py-8 text-center">
          <CheckCircle2 className="mx-auto h-5 w-5 text-zinc-600" aria-hidden />
          <p className="mt-2 text-sm text-zinc-400">
            No pending reminders in this window.
          </p>
          <p className="mt-1 text-[11px] text-zinc-600">
            Scanned {hubs.length} active hub
            {hubs.length === 1 ? "" : "s"} · calendar + payment gates apply.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const Icon = CATEGORY_ICONS[item.category];
            const key = `${item.pnr}:${item.id}`;
            const sending = sendingKey === key;
            const isFocus = focusNorm && item.pnr === focusNorm;
            return (
              <li
                key={key}
                className={`relative overflow-hidden rounded-xl border border-white/10 bg-[#0D1117]/70 p-3 ${
                  isFocus ? "ring-1 ring-[#F6A724]/30" : ""
                }`}
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
                      <span className="font-mono text-sm font-semibold text-white">
                        {item.pnr}
                      </span>
                      {item.primaryCity ? (
                        <span className="text-[11px] text-zinc-500">
                          {item.primaryCity}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-200">
                      {item.guestName || "Guest"}
                      {item.guestEmail ? (
                        <span className="ml-2 text-[11px] text-cyan-300/80">
                          {item.guestEmail}
                        </span>
                      ) : (
                        <span className="ml-2 text-[11px] text-amber-300/80">
                          no email
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Start {item.tourDate || "—"}
                      {item.endDate && item.endDate !== item.tourDate
                        ? ` → ${item.endDate}`
                        : ""}
                      {item.daysUntilStart != null
                        ? ` · ${item.daysUntilStart}d to start`
                        : ""}
                      {item.daysSinceEnd != null && item.daysSinceEnd >= 0
                        ? ` · ${item.daysSinceEnd}d since end`
                        : ""}
                      {" · "}
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

      {preview ? (
        <PreviewModal
          item={preview}
          sending={sendingKey === `${preview.pnr}:${preview.id}`}
          onClose={() => setPreview(null)}
          onSend={() => void sendReminder(preview)}
        />
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold tracking-wide uppercase transition ${
        active
          ? tone ||
            "border-[#F6A724]/50 bg-[#F6A724]/15 text-[#F6A724]"
          : "border-zinc-700 bg-zinc-900/80 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PreviewModal({
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
            <X className="h-4 w-4" />
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
