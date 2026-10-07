"use client";

import { Car, Download, Mail, Ticket, UserRound } from "lucide-react";
import {
  accessTypeGuestBadge,
  experienceNeedsEntryTicket,
} from "@/lib/accessType";
import { PaperActivityTicketCard } from "@/components/dossier/ItineraryStopTickets";

export { experienceNeedsEntryTicket };

export type ServiceIconState = "none" | "pending" | "confirmed" | "cancelled";

function toneClass(state: ServiceIconState): string {
  switch (state) {
    case "confirmed":
      return "border-emerald-500/50 bg-emerald-500/15 text-emerald-300";
    case "pending":
      return "border-amber-500/50 bg-amber-500/15 text-amber-300";
    case "cancelled":
      return "border-red-500/50 bg-red-500/15 text-red-300";
    default:
      return "border-white/10 bg-zinc-900/80 text-zinc-600";
  }
}

function ServiceIcon({
  label,
  state,
  Icon,
}: {
  label: string;
  state: ServiceIconState;
  Icon: typeof Car;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-1.5 ${toneClass(state)}`}
      title={`${label}: ${state}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="text-[8px] font-bold tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}

/**
 * Day-by-day car / guide / tickets status strip.
 * none = muted · pending = amber · confirmed = green · cancelled = red
 */
export function DayServiceIcons({
  car = "none",
  guide = "none",
  tickets = "none",
  dayLabel,
}: {
  car?: ServiceIconState;
  guide?: ServiceIconState;
  tickets?: ServiceIconState;
  dayLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {dayLabel ? (
        <span className="mr-1 font-mono text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          {dayLabel}
        </span>
      ) : null}
      <ServiceIcon label="Car" state={car} Icon={Car} />
      <ServiceIcon label="Guide" state={guide} Icon={UserRound} />
      <ServiceIcon label="Tickets" state={tickets} Icon={Ticket} />
    </div>
  );
}

/**
 * Staff identity card stubs for day timeline (guide / driver).
 * Precedence: assigned person → purchased invoice service → empty copy.
 */
export function StaffIdentityCard({
  role,
  name,
  photoUrl,
  email,
  phone,
  whatsappDigits,
  unlockMessage,
  emptyLabel,
  serviceTitle,
  serviceHint,
}: {
  role: "guide" | "driver";
  name?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsappDigits?: string | null;
  /** Shown when full contact is still gated. */
  unlockMessage?: string | null;
  /** Override when unassigned (e.g. “No guide assigned yet”). */
  emptyLabel?: string;
  /** Invoice/agent_services title when purchased but not yet assigned. */
  serviceTitle?: string | null;
  /** e.g. “Vehicle secured · Pending assignment” */
  serviceHint?: string | null;
}) {
  const label = role === "guide" ? "Guide" : "Driver";
  const assigned = Boolean(name && String(name).trim());
  const secured = !assigned && Boolean(serviceTitle && String(serviceTitle).trim());
  const pendingCopy =
    emptyLabel ||
    (role === "guide" ? "No guide assigned yet" : "No driver assigned yet");
  const defaultHint =
    role === "guide"
      ? "Pending assignment"
      : "Vehicle secured · Pending assignment";
  const Icon = role === "guide" ? UserRound : Car;
  const wa = String(whatsappDigits || "").replace(/\D/g, "");
  const phoneDisplay = String(phone || "").trim();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 print:border-gray-300 print:bg-transparent">
      {photoUrl && assigned ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
        />
      ) : (
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-[10px] font-bold tracking-wider uppercase print:border-gray-300 print:bg-transparent print:text-gray-700 ${
            assigned
              ? "border-cyan-500/30 bg-cyan-950/40 text-cyan-300"
              : secured
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-white/10 bg-zinc-900 text-zinc-600"
          }`}
        >
          {secured ? <Icon className="h-5 w-5" aria-hidden /> : "ID"}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase print:text-gray-600">
          {label}
        </p>
        {assigned ? (
          <>
            <p className="truncate text-sm font-semibold text-white print:text-gray-900">
              {name}
            </p>
            {email ? (
              <a
                href={`mailto:${email}`}
                className="block truncate text-[11px] text-cyan-300/80 hover:underline print:text-gray-700"
              >
                {email}
              </a>
            ) : null}
            {phoneDisplay || wa ? (
              <p className="truncate text-[11px] text-zinc-400 print:text-gray-700">
                {wa ? (
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300/90 hover:underline"
                  >
                    WhatsApp
                  </a>
                ) : null}
                {wa && phoneDisplay ? " · " : null}
                {phoneDisplay || null}
              </p>
            ) : null}
            {unlockMessage ? (
              <p className="mt-0.5 text-[10px] leading-snug text-amber-300/85 print:text-gray-600">
                {unlockMessage}
              </p>
            ) : null}
          </>
        ) : secured ? (
          <>
            <p className="truncate text-sm font-semibold text-white print:text-gray-900">
              {serviceTitle}
            </p>
            <p className="truncate text-[11px] text-amber-300/85 print:text-gray-700">
              {serviceHint || defaultHint}
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-500 print:text-gray-600">
            {pendingCopy}
          </p>
        )}
      </div>
    </div>
  );
}

/** Paper-style ticket stub (train / cinema / attraction) — shared itinerary skin. */
export function TicketStubCard({
  title,
  subtitle,
  accessType,
  thumbUrl,
  stopNumber,
  durationHours,
}: {
  title: string;
  subtitle?: string;
  /** tours.access_type — Ticket vs Admission vs VIP vs Timed */
  accessType?: string | null;
  thumbUrl?: string;
  stopNumber?: number;
  durationHours?: number;
}) {
  const badge = accessTypeGuestBadge(accessType);
  return (
    <PaperActivityTicketCard
      kind="ticket"
      title={title}
      stopNumber={stopNumber ?? 0}
      durationHours={durationHours}
      vibeLabel={badge}
      address={subtitle}
      thumbUrl={thumbUrl}
    />
  );
}

/** Quiet “not applicable” row for day services. */
export function DayServiceIdleRow({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-zinc-950/40 px-3 py-2">
      <p className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">{message}</p>
    </div>
  );
}

const ticketActionIdleClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/70 text-zinc-500 opacity-45 cursor-not-allowed";
const ticketActionReadyClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 transition hover:bg-emerald-500/25";

/**
 * Agent-services ticket row for guest Day Services (Suica, Teamlab, entry…).
 * Download + email actions always visible; disabled until Ready.
 */
export function DayServiceTicketRow({
  title,
  ready,
  downloadUrl,
  downloadFilename,
  guestEmail,
}: {
  title: string;
  ready: boolean;
  downloadUrl?: string | null;
  downloadFilename?: string | null;
  /** Optional prefill for send-by-email mailto. */
  guestEmail?: string | null;
}) {
  const href = String(downloadUrl || "").trim();
  const filename =
    String(downloadFilename || "").trim() || "TokioTours_Ticket_Voucher.pdf";
  const canDownload = ready && Boolean(href);
  const canEmail = ready;
  const pendingTip = "Tickets unlock when ready";
  const to = String(guestEmail || "").trim();
  const mailSubject = encodeURIComponent(`Your TokioTours ticket: ${title}`);
  const mailBody = encodeURIComponent(
    href
      ? `Your ticket voucher is ready.\n\nDownload:\n${href}\n`
      : `Your ticket (${title}) is ready. Check your TokioTours booking for the voucher.\n`
  );
  const mailtoHref = `mailto:${to}?subject=${mailSubject}&body=${mailBody}`;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
        ready
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-amber-500/35 bg-amber-500/10"
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
          ready
            ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
            : "border-amber-500/40 bg-amber-950/30 text-amber-300"
        }`}
      >
        <Ticket className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold tracking-wider text-zinc-500 uppercase">
          Ticket
        </p>
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        <p
          className={`truncate text-[11px] ${
            ready ? "text-emerald-300/90" : "text-amber-300/85"
          }`}
        >
          {ready ? "Ready" : "Pending"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canDownload ? (
          <a
            href={href}
            download={filename}
            target="_blank"
            rel="noopener noreferrer"
            className={ticketActionReadyClass}
            title="Download ticket"
            aria-label={`Download ${title}`}
          >
            <Download className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <span
            className={ticketActionIdleClass}
            title={ready ? "Voucher file not available yet" : pendingTip}
            aria-label={`Download ${title} unavailable`}
            aria-disabled="true"
          >
            <Download className="h-4 w-4" aria-hidden />
          </span>
        )}
        {canEmail ? (
          <a
            href={mailtoHref}
            className={ticketActionReadyClass}
            title="Send ticket by email"
            aria-label={`Email ${title}`}
          >
            <Mail className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <span
            className={ticketActionIdleClass}
            title={pendingTip}
            aria-label={`Email ${title} unavailable`}
            aria-disabled="true"
          >
            <Mail className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

/** Trip-wide Suica / PASMO card — place after all days. */
export function SuicaPassCard({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="mt-4 rounded-2xl border border-[#1BA58A]/40 bg-gradient-to-br from-[#0a2a24] to-[#0A1017] p-4">
      <p className="text-[10px] font-bold tracking-[0.2em] text-[#1BA58A] uppercase">
        IC Pass · Trip-wide
      </p>
      <p className="mt-1 font-godiva text-lg tracking-wider text-white">
        SUICA / PASMO
      </p>
      <p className="mt-1 text-xs text-zinc-400">
        Valid for the full itinerary — trains, metro, and many convenience
        stores.
      </p>
    </div>
  );
}
